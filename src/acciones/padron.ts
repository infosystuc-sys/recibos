'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { registrarEvento } from '@/lib/auditoria'
import { cuilValido, normalizarCuil } from '@/lib/cuil'
import type { FilaPadron } from '@/lib/padron/parse-csv-padron'
import { exigirAdmin } from '@/lib/sesion'
import { clienteServicio } from '@/lib/supabase/cliente-servicio'

export interface ResultadoImportacion {
  creados: number
  actualizados: number
  sinCambios: number
  posiblesBajas: Array<{ legajo: number; nombre: string }>
  error?: string
}

/**
 * Alta o actualización del padrón de una empresa.
 * Nunca da de baja: los legajos ausentes se devuelven como "posibles bajas"
 * para que el administrador decida.
 */
export async function importarPadron(
  empresaId: string,
  filas: FilaPadron[],
  nombreArchivo: string,
): Promise<ResultadoImportacion> {
  const admin = await exigirAdmin('operar')
  const supabase = clienteServicio()

  if (filas.length === 0) {
    return { creados: 0, actualizados: 0, sinCambios: 0, posiblesBajas: [], error: 'No hay filas para importar.' }
  }

  let creados = 0
  let actualizados = 0
  let sinCambios = 0

  const { data: legajosPrevios } = await supabase
    .from('legajos')
    .select('id, numero, activo, persona_id, personas(apellido_nombre)')
    .eq('empresa_id', empresaId)

  const previosPorNumero = new Map((legajosPrevios ?? []).map((l) => [l.numero, l]))

  for (const fila of filas) {
    // 1) La persona se identifica por CUIL en todo el sistema.
    const { data: persona } = await supabase
      .from('personas')
      .upsert(
        {
          cuil: fila.cuil,
          apellido_nombre: fila.apellidoNombre,
          email: fila.email,
          telefono: fila.telefono,
        },
        { onConflict: 'cuil' },
      )
      .select('id')
      .single()

    if (!persona) continue

    // 2) El legajo es el vínculo con esta empresa.
    const previo = previosPorNumero.get(fila.legajo)

    if (!previo) {
      const { error } = await supabase.from('legajos').insert({
        empresa_id: empresaId,
        persona_id: persona.id,
        numero: fila.legajo,
        activo: fila.activo,
        sector: fila.sector,
      })
      if (!error) creados++
    } else if (previo.activo !== fila.activo || previo.persona_id !== persona.id) {
      await supabase
        .from('legajos')
        .update({ persona_id: persona.id, activo: fila.activo, sector: fila.sector })
        .eq('id', previo.id)
      actualizados++
    } else {
      sinCambios++
    }
  }

  const numerosImportados = new Set(filas.map((f) => f.legajo))
  const posiblesBajas = (legajosPrevios ?? [])
    .filter((l) => l.activo && !numerosImportados.has(l.numero))
    .map((l) => ({
      legajo: l.numero,
      nombre: (l.personas as { apellido_nombre: string } | null)?.apellido_nombre ?? '—',
    }))

  await supabase.from('importaciones').insert({
    empresa_id: empresaId,
    nombre_archivo: nombreArchivo,
    filas_total: filas.length,
    creados,
    actualizados,
    errores: 0,
    resumen: { sinCambios, posiblesBajas },
    creada_por: admin.id,
  })

  await registrarEvento({
    actorTipo: 'admin',
    actorId: admin.id,
    accion: 'padron.importar',
    entidad: 'empresas',
    entidadId: empresaId,
    detalle: { creados, actualizados, sinCambios, archivo: nombreArchivo },
  })

  revalidatePath('/admin/empleados')
  return { creados, actualizados, sinCambios, posiblesBajas }
}

const esquemaEmpleado = z.object({
  empresaId: z.string().uuid(),
  legajo: z.coerce.number().int().positive('El legajo debe ser un número mayor a cero'),
  cuil: z
    .string()
    .transform((v) => normalizarCuil(v))
    .refine((c): c is string => c !== null, 'El CUIL debe tener 11 dígitos')
    .refine((c) => cuilValido(c), 'El CUIL no es válido: revisá el dígito verificador'),
  apellidoNombre: z.string().trim().min(1, 'Ingresá apellido y nombre'),
  email: z.string().trim().email('Email inválido').optional().or(z.literal('')),
  telefono: z.string().trim().optional(),
  sector: z.string().trim().optional(),
  activo: z.coerce.boolean(),
})

/** Alta o edición de un solo legajo. Reutiliza la persona si el CUIL ya existe. */
export async function guardarEmpleado(_estado: string | null, datos: FormData) {
  const admin = await exigirAdmin('operar')

  const analisis = esquemaEmpleado.safeParse(Object.fromEntries(datos))
  if (!analisis.success) return analisis.error.issues[0].message

  const { empresaId, legajo, cuil, apellidoNombre, email, telefono, sector, activo } = analisis.data
  const supabase = clienteServicio()

  const { data: persona, error: errorPersona } = await supabase
    .from('personas')
    .upsert(
      { cuil, apellido_nombre: apellidoNombre, email: email || null, telefono: telefono || null },
      { onConflict: 'cuil' },
    )
    .select('id')
    .single()

  if (errorPersona || !persona) return `No se pudo guardar la persona: ${errorPersona?.message}`

  const { error } = await supabase.from('legajos').upsert(
    { empresa_id: empresaId, persona_id: persona.id, numero: legajo, sector: sector || null, activo },
    { onConflict: 'empresa_id,numero' },
  )
  if (error) return `No se pudo guardar el legajo: ${error.message}`

  await registrarEvento({
    actorTipo: 'admin',
    actorId: admin.id,
    accion: 'empleado.guardar',
    entidad: 'legajos',
    detalle: { empresaId, legajo, cuil },
  })

  revalidatePath('/admin/empleados')
  redirect(`/admin/empleados?empresa=${empresaId}`)
}
