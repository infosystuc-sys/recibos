'use server'

import { revalidatePath } from 'next/cache'
import { registrarEvento } from '@/lib/auditoria'
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
