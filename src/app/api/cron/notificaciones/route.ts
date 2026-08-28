import { encolarRecordatorios, procesarCola } from '@/lib/notificaciones/cola'
import { clienteServicio } from '@/lib/supabase/cliente-servicio'

// Lo llama Vercel Cron (manda `Authorization: Bearer <CRON_SECRET>`). También
// se puede invocar a mano con el mismo header para procesar la cola ya.
export const maxDuration = 300

export async function GET(req: Request) {
  const secreto = process.env.CRON_SECRET
  if (!secreto) {
    return Response.json({ error: 'Falta CRON_SECRET en el entorno.' }, { status: 503 })
  }
  if (req.headers.get('authorization') !== `Bearer ${secreto}`) {
    return new Response('No autorizado', { status: 401 })
  }

  const servicio = clienteServicio()

  await encolarRecordatorios(servicio, 3)
  await encolarRecordatorios(servicio, 7)
  const resumen = await procesarCola(servicio)

  // Purga los registros de intentos viejos (rate limiting).
  await servicio
    .from('intentos')
    .delete()
    .lt('created_at', new Date(Date.now() - 86_400_000).toISOString())

  return Response.json({ ok: true, ...resumen })
}
