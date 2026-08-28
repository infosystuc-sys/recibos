import Link from 'next/link'
import { formatearCuil } from '@/lib/cuil'
import { formatearPeriodo } from '@/lib/periodo'
import { puede } from '@/lib/permisos'
import { exigirAdmin } from '@/lib/sesion'
import { clienteServidor } from '@/lib/supabase/cliente-servidor'
import { ETIQUETA_TIPO, type TipoLiquidacion } from '@/lib/tango/parse-nombre-recibo'
import Responder from './responder'

interface Params {
  searchParams: Promise<{ estado?: string }>
}

interface ObsRow {
  id: string
  texto: string
  estado: string
  respuesta: string | null
  resuelta_at: string | null
  created_at: string
  recibos: {
    id: string
    version: number
    legajos: { numero: number; personas: { apellido_nombre: string; cuil: string } | null } | null
    liquidaciones: {
      periodo: number
      tipo: string
      empresas: { razon_social: string } | null
    } | null
  } | null
}

export default async function PaginaObservaciones({ searchParams }: Params) {
  const admin = await exigirAdmin('ver')
  const { estado } = await searchParams
  const filtro = estado === 'todas' ? null : 'abierta'
  const supabase = await clienteServidor()

  let query = supabase
    .from('observaciones')
    .select(
      'id, texto, estado, respuesta, resuelta_at, created_at, ' +
        'recibos(id, version, legajos(numero, personas(apellido_nombre, cuil)), ' +
        'liquidaciones(periodo, tipo, empresas(razon_social)))',
    )
    .order('created_at', { ascending: false })
  if (filtro) query = query.eq('estado', filtro)

  const { data } = await query
  const observaciones = (data as ObsRow[] | null) ?? []
  const puedeResponder = puede(admin.rol, 'operar')

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Observaciones</h1>
        <div className="flex gap-3 text-sm">
          <Link href="/admin/observaciones" className={!estado || estado !== 'todas' ? 'font-semibold' : 'underline'}>
            Abiertas
          </Link>
          <Link href="/admin/observaciones?estado=todas" className={estado === 'todas' ? 'font-semibold' : 'underline'}>
            Todas
          </Link>
        </div>
      </div>

      {observaciones.length === 0 ? (
        <p className="text-sm text-neutral-600">
          {filtro ? 'No hay observaciones abiertas.' : 'Todavía no hay observaciones.'}
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {observaciones.map((o) => {
            const r = o.recibos
            const persona = r?.legajos?.personas
            const liq = r?.liquidaciones
            return (
              <li
                key={o.id}
                className={`rounded-lg border p-4 ${
                  o.estado === 'abierta' ? 'border-amber-300 bg-amber-50 dark:bg-amber-950' : ''
                }`}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                  <span className="font-medium">
                    {persona?.apellido_nombre ?? '—'}
                    {persona && ` · CUIL ${formatearCuil(persona.cuil)}`}
                    {r?.legajos && ` · legajo ${r.legajos.numero}`}
                  </span>
                  <span className="text-neutral-500">
                    {new Date(o.created_at).toLocaleString('es-AR')}
                  </span>
                </div>
                <div className="text-sm text-neutral-500">
                  {liq?.empresas?.razon_social} · {liq && formatearPeriodo(liq.periodo)} ·{' '}
                  {liq && ETIQUETA_TIPO[liq.tipo as TipoLiquidacion]}
                  {r && r.version > 1 && ` · versión ${r.version}`}
                </div>

                <p className="mt-2 whitespace-pre-wrap text-base">{o.texto}</p>

                {o.respuesta ? (
                  <p className="mt-3 rounded bg-white/60 p-2 text-sm dark:bg-black/30">
                    <span className="font-medium">Respuesta: </span>
                    {o.respuesta}
                    {o.resuelta_at && (
                      <span className="text-neutral-500">
                        {' '}
                        ({new Date(o.resuelta_at).toLocaleDateString('es-AR')})
                      </span>
                    )}
                  </p>
                ) : puedeResponder ? (
                  <Responder observacionId={o.id} />
                ) : (
                  <p className="mt-2 text-sm text-neutral-500">Sin responder.</p>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
