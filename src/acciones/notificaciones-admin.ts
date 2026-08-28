'use server'

import { revalidatePath } from 'next/cache'
import { registrarEvento } from '@/lib/auditoria'
import {
  encolarRecordatorioManual,
  procesarCola,
  type ResumenProceso,
} from '@/lib/notificaciones/cola'
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

/** Encola un recordatorio para los pendientes de conformidad de una liquidación. */
export async function recordarPendientes(
  liquidacionId: string,
): Promise<{ encolados: number } | { error: string }> {
  const admin = await exigirAdmin('operar')
  const servicio = clienteServicio()
  const encolados = await encolarRecordatorioManual(servicio, liquidacionId)

  await registrarEvento({
    actorTipo: 'admin',
    actorId: admin.id,
    accion: 'notificaciones.recordar_pendientes',
    entidad: 'liquidaciones',
    entidadId: liquidacionId,
    detalle: { encolados },
  })

  // Los manda el cron; si querés ya, entrá a Notificaciones y "Procesar cola".
  revalidatePath(`/admin/liquidaciones/${liquidacionId}`)
  return { encolados }
}
