import { canalEmail } from '@/lib/notificaciones/email'
import { canalPush } from '@/lib/notificaciones/push'
import { canalWhatsapp } from '@/lib/notificaciones/whatsapp'
import { puede } from '@/lib/permisos'
import { exigirAdmin } from '@/lib/sesion'
import { clienteServidor } from '@/lib/supabase/cliente-servidor'
import ProcesarAhora from './procesar'

const CANALES = [canalEmail, canalPush, canalWhatsapp]

export default async function PaginaNotificaciones() {
  const admin = await exigirAdmin('ver')
  const supabase = await clienteServidor()

  const desde = new Date(Date.now() - 7 * 86_400_000).toISOString()
  const { data: recientes } = await supabase
    .from('notificaciones')
    .select('estado, canal, tipo')
    .gte('created_at', desde)

  const filas = recientes ?? []
  const cuenta = (p: (n: { estado: string }) => boolean) => filas.filter(p).length

  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Notificaciones</h1>

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-neutral-500">Canales</h2>
        <ul className="flex flex-col gap-2">
          {CANALES.map((c) => {
            const activo = c.activo()
            return (
              <li key={c.nombre} className="rounded-lg border p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium capitalize">{c.nombre}</span>
                  <span
                    className={
                      activo ? 'text-green-700 dark:text-green-400' : 'text-neutral-500'
                    }
                  >
                    {activo ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
                {!activo && (
                  <p className="mt-1 text-neutral-500">{c.motivoInactivo()}</p>
                )}
              </li>
            )
          })}
        </ul>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-neutral-500">Últimos 7 días</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ['Encoladas', cuenta((n) => n.estado === 'encolada' || n.estado === 'enviando')],
            ['Enviadas', cuenta((n) => n.estado === 'enviada')],
            ['Fallidas', cuenta((n) => n.estado === 'fallida')],
            ['Descartadas', cuenta((n) => n.estado === 'descartada')],
          ].map(([etiqueta, n]) => (
            <div key={etiqueta} className="rounded-lg border p-3">
              <div className="text-2xl font-semibold">{n}</div>
              <div className="text-sm text-neutral-500">{etiqueta}</div>
            </div>
          ))}
        </div>
      </div>

      {puede(admin.rol, 'operar') && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-neutral-500">
            El cron procesa la cola cada hora. También podés forzarlo:
          </p>
          <ProcesarAhora />
        </div>
      )}
    </section>
  )
}
