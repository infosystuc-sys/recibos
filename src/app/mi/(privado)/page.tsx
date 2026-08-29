import Link from 'next/link'
import { formatearPeriodo } from '@/lib/periodo'
import { exigirEmpleado } from '@/lib/sesion-empleado'
import { clienteServidor } from '@/lib/supabase/cliente-servidor'
import { ETIQUETA_TIPO, type TipoLiquidacion } from '@/lib/tango/parse-nombre-recibo'

interface Fila {
  id: string
  version: number
  periodo: number
  tipo: TipoLiquidacion
  empresa: string
  conformadaAt: string | null
}

export default async function MiInicio() {
  await exigirEmpleado()
  const supabase = await clienteServidor()

  const { data } = await supabase
    .from('recibos')
    .select(
      'id, version, estado, liquidaciones(periodo, tipo, empresas(razon_social)), conformidades(created_at)',
    )
    .eq('estado', 'vigente')

  const filas: Fila[] = (data ?? [])
    .filter((r) => r.liquidaciones)
    .map((r) => ({
      id: r.id,
      version: r.version,
      periodo: r.liquidaciones!.periodo,
      tipo: r.liquidaciones!.tipo,
      empresa: r.liquidaciones!.empresas?.razon_social ?? '—',
      conformadaAt: r.conformidades?.created_at ?? null,
    }))
    .sort((a, b) => b.periodo - a.periodo || a.empresa.localeCompare(b.empresa))

  const porEmpresa = new Map<string, Fila[]>()
  for (const f of filas) {
    if (!porEmpresa.has(f.empresa)) porEmpresa.set(f.empresa, [])
    porEmpresa.get(f.empresa)!.push(f)
  }

  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Mis recibos</h1>
      {filas.length === 0 ? (
        <p className="text-base text-neutral-600 dark:text-neutral-400">
          Todavía no tenés recibos publicados. Cuando la administración publique una
          liquidación, va a aparecer acá.
        </p>
      ) : (
        [...porEmpresa.entries()].map(([empresa, recibos]) => (
          <div key={empresa} className="flex flex-col gap-3">
            {porEmpresa.size > 1 && (
              <h2 className="text-sm font-semibold text-neutral-500">{empresa}</h2>
            )}
            <ul className="flex flex-col gap-3">
              {recibos.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/mi/recibos/${r.id}`}
                    className="flex items-center justify-between rounded-lg border p-4"
                  >
                    <div>
                      <div className="text-lg font-medium">{formatearPeriodo(r.periodo)}</div>
                      <div className="text-sm text-neutral-500">
                        {ETIQUETA_TIPO[r.tipo]}
                        {r.version > 1 && ` · versión ${r.version}`}
                      </div>
                    </div>
                    <Estado conformadaAt={r.conformadaAt} corregido={r.version > 1} />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </section>
  )
}

function Estado({ conformadaAt, corregido }: { conformadaAt: string | null; corregido: boolean }) {
  if (conformadaAt) {
    return (
      <span className="text-sm text-green-700 dark:text-green-400">
        Conformado el {new Date(conformadaAt).toLocaleDateString('es-AR')}
      </span>
    )
  }
  return (
    <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-900 dark:bg-amber-900 dark:text-amber-100">
      {corregido ? 'Corregido — prestá conformidad' : 'Pendiente de conformidad'}
    </span>
  )
}
