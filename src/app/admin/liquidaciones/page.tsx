import Link from 'next/link'
import { formatearPeriodo } from '@/lib/periodo'
import { puede } from '@/lib/permisos'
import { exigirAdmin } from '@/lib/sesion'
import { clienteServidor } from '@/lib/supabase/cliente-servidor'
import { ETIQUETA_TIPO } from '@/lib/tango/parse-nombre-recibo'
import { EnlaceBoton, Pastilla, Tarjeta } from '@/componentes/ui'

const TONO_ESTADO = {
  borrador: 'neutro',
  publicada: 'exito',
  anulada: 'error',
} as const

export default async function PaginaLiquidaciones() {
  const admin = await exigirAdmin('ver')
  const supabase = await clienteServidor()

  const { data: liquidaciones } = await supabase
    .from('liquidaciones')
    .select('id, periodo, tipo, dato_fijo, estado, publicada_at, empresas(razon_social), recibos(count)')
    .order('periodo', { ascending: false })
    .order('created_at', { ascending: false })

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl">Liquidaciones</h1>
          <p className="mt-1 text-sm text-texto-suave">
            Cada lote de recibos de Tango, su estado y el seguimiento de conformidades.
          </p>
        </div>
        {puede(admin.rol, 'operar') && (
          <EnlaceBoton href="/admin/liquidaciones/ingesta">Nueva ingesta</EnlaceBoton>
        )}
      </header>

      {liquidaciones && liquidaciones.length > 0 ? (
        <Tarjeta className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-borde text-left text-xs uppercase tracking-wide text-texto-tenue">
                <tr>
                  <th className="px-4 py-3">Empresa</th>
                  <th className="px-4 py-3">Período</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Liq.</th>
                  <th className="px-4 py-3">Recibos</th>
                  <th className="px-4 py-3">Estado</th>
                </tr>
              </thead>
              <tbody>
                {liquidaciones.map((l) => (
                  <tr key={l.id} className="border-t border-borde-suave hover:bg-superficie-2">
                    <td className="px-4 py-3">
                      <Link href={`/admin/liquidaciones/${l.id}`} className="font-medium hover:underline">
                        {l.empresas?.razon_social ?? '—'}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{formatearPeriodo(l.periodo)}</td>
                    <td className="px-4 py-3">{ETIQUETA_TIPO[l.tipo]}</td>
                    <td className="px-4 py-3">{l.dato_fijo}</td>
                    <td className="px-4 py-3">{l.recibos[0]?.count ?? 0}</td>
                    <td className="px-4 py-3">
                      <Pastilla tono={TONO_ESTADO[l.estado]}>{l.estado}</Pastilla>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Tarjeta>
      ) : (
        <Tarjeta>
          <p className="text-sm text-texto-suave">
            Todavía no hay liquidaciones. Empezá una ingesta para cargar la primera.
          </p>
        </Tarjeta>
      )}
    </div>
  )
}
