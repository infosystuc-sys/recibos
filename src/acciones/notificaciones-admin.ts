'use server'

import { revalidatePath } from 'next/cache'
import { registrarEvento } from '@/lib/auditoria'
import { procesarCola, type ResumenProceso } from '@/lib/notificaciones/cola'
import { exigirAdmin } from '@/lib/sesion'
import { clienteServicio } from '@/lib/supabase/cliente-servicio'

/** Procesa la cola a demanda desde el panel (además del cron). */
export async function procesarColaAhora(): Promise<ResumenProceso | { error: string }> {
  const admin = await exigirAdmin('operar')
  const servicio = clienteServicio()
  const resumen = await procesarCola(servicio)

  await registrarEvento({
    actorTipo: 'admin',
    actorId: admin.id,
    accion: 'notificaciones.procesar_manual',
    entidad: 'notificaciones',
    detalle: { ...resumen },
  })

  revalidatePath('/admin/notificaciones')
  return resumen
}
