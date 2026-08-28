'use server'

import { headers } from 'next/headers'
import { z } from 'zod'
import { exigirEmpleado } from '@/lib/sesion-empleado'
import { clienteServicio } from '@/lib/supabase/cliente-servicio'

const esquema = z.object({
  endpoint: z.string().url(),
  p256dh: z.string().min(1),
  auth: z.string().min(1),
})

/** Guarda (o refresca) la suscripción push del navegador del empleado. */
export async function guardarSuscripcionPush(entrada: {
  endpoint: string
  p256dh: string
  auth: string
}): Promise<{ ok: true } | { error: string }> {
  const empleado = await exigirEmpleado()
  const analisis = esquema.safeParse(entrada)
  if (!analisis.success) return { error: 'Suscripción inválida.' }

  const cabeceras = await headers()
  const servicio = clienteServicio()
  const { error } = await servicio.from('push_subscriptions').upsert(
    {
      persona_id: empleado.id,
      endpoint: analisis.data.endpoint,
      p256dh: analisis.data.p256dh,
      auth: analisis.data.auth,
      user_agent: cabeceras.get('user-agent') || null,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: 'endpoint' },
  )
  if (error) return { error: `No se pudo guardar la suscripción: ${error.message}` }
  return { ok: true }
}

export async function borrarSuscripcionPush(endpoint: string): Promise<void> {
  await exigirEmpleado()
  const servicio = clienteServicio()
  await servicio.from('push_subscriptions').delete().eq('endpoint', endpoint)
}
