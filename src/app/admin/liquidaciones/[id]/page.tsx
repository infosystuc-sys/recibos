import Link from 'next/link'
import { notFound } from 'next/navigation'
import { formatearCuil } from '@/lib/cuil'
import { formatearPeriodo } from '@/lib/periodo'
import { puede } from '@/lib/permisos'
import { exigirAdmin } from '@/lib/sesion'
import { clienteServidor } from '@/lib/supabase/cliente-servidor'
import { ETIQUETA_TIPO } from '@/lib/tango/parse-nombre-recibo'
import PublicarBoton from './publicar-boton'

interface Params {
  params: Promise<{ id: string }>
  searchParams: Promise<{ pendientes?: string }>
}

export default async function PaginaLiquidacion({ params, searchParams }: Params) {
  const admin = await exigirAdmin('ver')
  const { id } = await params
  const { pendientes } = await searchParams
  const supabase = await clienteServidor()

  const { data: liquidacion } = await supabase
    .from('liquidaciones')
    .select('id, periodo, tipo, dato_fijo, estado, publicada_at, empresas(razon_social)')
    .eq('id', id)
    .maybeSingle()

  if (!liquidacion) notFound()

  const { data: recibos } = await supabase
    .from('recibos')
    .select(
      'id, version, estado, nombre_original, cuil_archivo, legajos(numero, personas(apellido_nombre)), conformidades(created_at, comprobante_codigo)',
    )
    .eq('liquidacion_id', id)
    .order('version', { ascending: false })

  const todos = recibos ?? []
  const vigentes = todos.filter((r) => r.estado === 'vigente')
  const conformados = vigentes.filter((r) => r.conformidades)
  const porcentaje = vigentes.length
    ? Math.round((conformados.length / vigentes.length) * 100)
    : 0

  const soloPendientes = pendientes === '1'
  const seguimiento = [...vigentes]
    .filter((r) => !soloPendientes || !r.conformidades)
    .sort(
      (a, b) =>
        Number(Boolean(a.conformidades)) - Number(Boolean(b.conformidades)) ||
        (a.legajos?.numero ?? 0) - (b.legajos?.numero ?? 0),
    )

  return (
    <section className="flex flex-col gap-5">
      <div className="flex items-center gap-3 text-sm">
        <Link href="/admin/liquidaciones" className="underline">
          Liquidaciones
        </Link>
        <span className="text-texto-tenue">/</span>
        <span>{liquidacion.empresas?.razon_social}</span>
      </div>

      <h1 className="text-2xl">
        {formatearPeriodo(liquidacion.periodo)} · {ETIQUETA_TIPO[liquidacion.tipo]} · Liq.{' '}
        {liquidacion.dato_fijo}
      </h1>

      <p className="text-sm">
        Estado: <strong>{liquidacion.estado}</strong>
        {liquidacion.publicada_at && (
          <> · publicada el {new Date(liquidacion.publicada_at).toLocaleString('es-AR')}</>
        )}
        {' · '}
        {vigentes.length} recibo(s) vigente(s)
      </p>

      {liquidacion.estado === 'borrador' && puede(admin.rol, 'operar') && vigentes.length > 0 && (
        <PublicarBoton liquidacionId={liquidacion.id} />
      )}

      {liquidacion.estado === 'publicada' && vigentes.length > 0 && (
        <div className="flex flex-col gap-3 rounded-lg border p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold">Seguimiento de conformidad</h2>
            <div className="flex gap-3 text-sm">
              <Link
                href={`/admin/liquidaciones/${id}/seguimiento.csv`}
                prefetch={false}
                className="underline"
              >
                Exportar CSV
              </Link>
              <Link
                href={`/admin/liquidaciones/${id}/constancias`}
                prefetch={false}
                className="underline"
              >
                Constancias (PDF)
              </Link>
            </div>
          </div>

          <div>
            <div className="h-2 w-full overflow-hidden rounded bg-borde">
              <div className="h-full bg-exito" style={{ width: `${porcentaje}%` }} />
            </div>
            <p className="mt-1 text-sm">
              {conformados.length} de {vigentes.length} conformados ({porcentaje}%)
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-sm">
            <Link
              href={`/admin/liquidaciones/${id}`}
              className={!soloPendientes ? 'font-semibold' : 'underline'}
            >
              Todos
            </Link>
            <Link
              href={`/admin/liquidaciones/${id}?pendientes=1`}
              className={soloPendientes ? 'font-semibold' : 'underline'}
            >
              Solo pendientes ({vigentes.length - conformados.length})
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-borde text-left text-xs uppercase tracking-wide text-texto-tenue">
                <tr>
                  <th className="py-2">Legajo</th>
                  <th>Nombre</th>
                  <th>Conformidad</th>
                </tr>
              </thead>
              <tbody>
                {seguimiento.map((r) => (
                  <tr key={r.id} className="border-t border-borde-suave">
                    <td className="py-2">{r.legajos?.numero ?? '—'}</td>
                    <td>{r.legajos?.personas?.apellido_nombre ?? '—'}</td>
                    <td>
                      {r.conformidades ? (
                        <span className="text-exito">
                          {new Date(r.conformidades.created_at).toLocaleString('es-AR')} ·{' '}
                          {r.conformidades.comprobante_codigo}
                        </span>
                      ) : (
                        <span className="text-alerta">Pendiente</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <h2 className="text-sm font-semibold text-texto-suave">Recibos</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-borde text-left text-xs uppercase tracking-wide text-texto-tenue">
            <tr>
              <th className="py-2">Legajo</th>
              <th>Nombre</th>
              <th>CUIL archivo</th>
              <th>Versión</th>
              <th>Estado</th>
              <th>Archivo</th>
            </tr>
          </thead>
          <tbody>
            {todos.map((r) => (
              <tr key={r.id} className="border-t border-borde-suave">
                <td className="py-2">{r.legajos?.numero ?? '—'}</td>
                <td>{r.legajos?.personas?.apellido_nombre ?? '—'}</td>
                <td>{formatearCuil(r.cuil_archivo)}</td>
                <td>v{r.version}</td>
                <td>{r.estado}</td>
                <td className="text-texto-suave">{r.nombre_original}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
