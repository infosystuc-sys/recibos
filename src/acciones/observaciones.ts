'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { registrarEvento } from '@/lib/auditoria'
import { exigirAdmin } from '@/lib/sesion'
import { exigirEmpleado } from '@/lib/sesion-empleado'
import { clienteServicio } from '@/lib/supabase/cliente-servicio'

const esquemaCrear = z.object({
  texto: z.string().trim().min(3, 'Contanos qué observás sobre el recibo.').max(2000),
})

/** El empleado deja un reclamo escrito sobre un recibo propio. */
export async function crearObservacion(reciboId: string, _estado: string | null, datos: FormData) {
  const empleado = await exigirEmpleado()
  const analisis = esquemaCrear.safeParse({ texto: datos.get('texto') })
  if (!analisis.success) return analisis.error.issues[0].message

  const servicio = clienteServicio()

  // El recibo tiene que ser de un legajo de esta persona.
  const { data: recibo } = await servicio
    .from('recibos')
    .select('id, legajos(persona_id)')
    .eq('id', reciboId)
    .maybeSingle<{ id: string; legajos: { persona_id: string } | null }>()
  if (!recibo || recibo.legajos?.persona_id !== empleado.id) {
    return 'Ese recibo no es tuyo.'
  }

  const { data, error } = await servicio
    .from('observaciones')
    .insert({ recibo_id: reciboId, persona_id: empleado.id, texto: analisis.data.texto })
    .select('id')
    .single()
  if (error) return `No se pudo registrar la observación: ${error.message}`

  await registrarEvento({
    actorTipo: 'empleado',
    actorId: empleado.id,
    accion: 'observacion.crear',
    entidad: 'observaciones',
    entidadId: data.id,
    detalle: { recibo_id: reciboId },
  })

  revalidatePath(`/mi/recibos/${reciboId}`)
  revalidatePath('/admin/observaciones')
  return null
}

const esquemaResponder = z.object({
  respuesta: z.string().trim().min(1, 'Escribí una respuesta.').max(2000),
})

/** Un operador o admin responde una observación y la marca resuelta. */
export async function responderObservacion(
  observacionId: string,
  _estado: string | null,
  datos: FormData,
) {
  const admin = await exigirAdmin('operar')
  const analisis = esquemaResponder.safeParse({ respuesta: datos.get('respuesta') })
  if (!analisis.success) return analisis.error.issues[0].message

  const servicio = clienteServicio()
  const { error } = await servicio
    .from('observaciones')
    .update({
      respuesta: analisis.data.respuesta,
      estado: 'resuelta',
      resuelta_por: admin.id,
      resuelta_at: new Date().toISOString(),
    })
    .eq('id', observacionId)
  if (error) return `No se pudo responder: ${error.message}`

  await registrarEvento({
    actorTipo: 'admin',
    actorId: admin.id,
    accion: 'observacion.responder',
    entidad: 'observaciones',
    entidadId: observacionId,
  })

  revalidatePath('/admin/observaciones')
  return null
}
