import Link from 'next/link'
import { notFound } from 'next/navigation'
import { formatearCuil } from '@/lib/cuil'
import { formatearPeriodo } from '@/lib/periodo'
import { puede } from '@/lib/permisos'
import { exigirAdmin } from '@/lib/sesion'
import { clienteServidor } from '@/lib/supabase/cliente-servidor'
import { ETIQUETA_TIPO } from '@/lib/tango/parse-nombre-recibo'
import PublicarBoton from './publicar-boton'

export default async function PaginaLiquidacion({ params }: { params: Promise<{ id: string }> }) {
  const admin = await exigirAdmin('ver')
  const { id } = await params
  const supabase = await clienteServidor()

  const { data: liquidacion } = await supabase
    .from('liquidaciones')
    .select('id, periodo, tipo, dato_fijo, estado, publicada_at, notas, empresas(razon_social)')
    .eq('id', id)
    .maybeSingle()

  if (!liquidacion) notFound()

  const { data: recibos } = await supabase
    .from('recibos')
    .select('id, version, estado, nombre_original, bytes, cuil_archivo, subido_at, legajos(numero, personas(apellido_nombre))')
    .eq('liquidacion_id', id)
    .order('version', { ascending: false })

  const vigentes = (recibos ?? []).filter((r) => r.estado === 'vigente')

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center gap-3 text-sm">
        <Link href="/admin/liquidaciones" className="underline">
          Liquidaciones
        </Link>
        <span className="text-neutral-400">/</span>
        <span>{liquidacion.empresas?.razon_social}</span>
      </div>

      <h1 className="text-xl font-semibold">
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

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-neutral-500">
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
            {(recibos ?? []).map((r) => (
              <tr key={r.id} className="border-t">
                <td className="py-2">{r.legajos?.numero ?? '—'}</td>
                <td>{r.legajos?.personas?.apellido_nombre ?? '—'}</td>
                <td>{formatearCuil(r.cuil_archivo)}</td>
                <td>v{r.version}</td>
                <td>{r.estado}</td>
                <td className="text-neutral-500">{r.nombre_original}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
