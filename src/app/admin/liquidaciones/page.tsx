import Link from 'next/link'
import { formatearPeriodo } from '@/lib/periodo'
import { puede } from '@/lib/permisos'
import { exigirAdmin } from '@/lib/sesion'
import { clienteServidor } from '@/lib/supabase/cliente-servidor'
import { ETIQUETA_TIPO } from '@/lib/tango/parse-nombre-recibo'

export default async function PaginaLiquidaciones() {
  const admin = await exigirAdmin('ver')
  const supabase = await clienteServidor()

  const { data: liquidaciones } = await supabase
    .from('liquidaciones')
    .select('id, periodo, tipo, dato_fijo, estado, publicada_at, empresas(razon_social), recibos(count)')
    .order('periodo', { ascending: false })
    .order('created_at', { ascending: false })

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Liquidaciones</h1>
        {puede(admin.rol, 'operar') && (
          <Link
            href="/admin/liquidaciones/ingesta"
            className="rounded bg-blue-900 px-3 py-2 text-sm text-white"
          >
            Nueva ingesta
          </Link>
        )}
      </div>

      {liquidaciones && liquidaciones.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-neutral-500">
              <tr>
                <th className="py-2">Empresa</th>
                <th>Período</th>
                <th>Tipo</th>
                <th>Liq.</th>
                <th>Recibos</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {liquidaciones.map((l) => (
                <tr key={l.id} className="border-t">
                  <td className="py-2">{l.empresas?.razon_social ?? '—'}</td>
                  <td>{formatearPeriodo(l.periodo)}</td>
                  <td>{ETIQUETA_TIPO[l.tipo]}</td>
                  <td>{l.dato_fijo}</td>
                  <td>{l.recibos[0]?.count ?? 0}</td>
                  <td>
                    <Link href={`/admin/liquidaciones/${l.id}`} className="underline">
                      {l.estado}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-neutral-600">
          Todavía no hay liquidaciones. Empezá una ingesta para cargar la primera.
        </p>
      )}
    </section>
  )
}
