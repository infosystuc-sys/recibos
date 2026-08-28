import 'server-only'

import { clienteServicio } from '@/lib/supabase/cliente-servicio'
import type { Json } from '@/lib/supabase/tipos'

interface Evento {
  actorTipo: 'admin' | 'empleado' | 'sistema'
  actorId?: string | null
  accion: string
  entidad: string
  entidadId?: string | null
  detalle?: { [clave: string]: Json | undefined }
  ip?: string | null
}

/** Deja constancia de una acción. Nunca corta el flujo si falla el registro. */
export async function registrarEvento(evento: Evento): Promise<void> {
  const supabase = clienteServicio()
  const { error } = await supabase.from('eventos_auditoria').insert({
    actor_tipo: evento.actorTipo,
    actor_id: evento.actorId ?? null,
    accion: evento.accion,
    entidad: evento.entidad,
    entidad_id: evento.entidadId ?? null,
    detalle: evento.detalle ?? {},
    ip: evento.ip ?? null,
  })
  if (error) console.error('No se pudo registrar el evento de auditoría', error)
}
