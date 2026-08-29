import Link from 'next/link'
import { notFound } from 'next/navigation'
import { formatearPeriodo } from '@/lib/periodo'
import { exigirEmpleado } from '@/lib/sesion-empleado'
import { clienteServicio } from '@/lib/supabase/cliente-servicio'
import { clienteServidor } from '@/lib/supabase/cliente-servidor'
import { ETIQUETA_TIPO, type TipoLiquidacion } from '@/lib/tango/parse-nombre-recibo'
import { DescargarRecibo } from './acciones-recibo'
import Observaciones from './observaciones'

interface Params {
  params: Promise<{ id: string }>
  searchParams: Promise<{ conformado?: string; rechazado?: string }>
}

export default async function VerRecibo({ params, searchParams }: Params) {
  await exigirEmpleado()
  const { id } = await params
  const { conformado, rechazado } = await searchParams
  const supabase = await clienteServidor()

  const { data: recibo } = await supabase
    .from('recibos')
    .select(
      'id, version, estado, storage_path, liquidaciones(periodo, tipo, empresas(razon_social)), conformidades(id, created_at, comprobante_codigo), rechazos(id, created_at, motivo)',
    )
    .eq('id', id)
    .maybeSingle()

  if (!recibo || !recibo.liquidaciones) notFound()

  const conformidad = recibo.conformidades
  const rechazo = recibo.rechazos
  const reemplazado = recibo.estado !== 'vigente'
  const periodo = recibo.liquidaciones.periodo
  const tipo = recibo.liquidaciones.tipo as TipoLiquidacion

  const { data: firmada } = await clienteServicio()
    .storage.from('recibos')
    .createSignedUrl(recibo.storage_path, 60)

  const { data: observaciones } = await supabase
    .from('observaciones')
    .select('id, texto, estado, respuesta, created_at')
    .eq('recibo_id', recibo.id)
    .order('created_at', { ascending: false })

  return (
    <section className="flex flex-col gap-5">
      <Link href="/mi" className="text-sm underline">
        ← Mis recibos
      </Link>

      <div>
        <h1 className="text-2xl font-semibold">{formatearPeriodo(periodo)}</h1>
        <p className="text-texto-suave">
          {recibo.liquidaciones.empresas?.razon_social} · {ETIQUETA_TIPO[tipo]}
          {recibo.version > 1 && ` · versión ${recibo.version}`}
        </p>
      </div>

      {conformado && !reemplazado && (
        <p className="rounded-lg bg-exito-fondo px-4 py-3 text-base text-green-800 dark:bg-green-950 dark:text-green-200">
          Conformidad registrada. Ya podés descargar el recibo y el comprobante.
        </p>
      )}

      {rechazado && !reemplazado && (
        <p className="rounded-lg bg-error-fondo px-4 py-3 text-base text-red-800 dark:bg-red-950 dark:text-red-200">
          Rechazo registrado. La administración va a recibir el aviso con tu motivo.
        </p>
      )}

      {reemplazado ? (
        <p className="rounded-lg bg-alerta-fondo px-4 py-3 text-base text-amber-900 dark:bg-amber-950 dark:text-amber-100">
          Esta versión del recibo fue reemplazada por una corrección. Buscá la versión
          vigente en <Link href="/mi" className="underline">Mis recibos</Link>.
        </p>
      ) : (
        <>
          {firmada ? (
            <iframe
              src={firmada.signedUrl}
              title="Recibo de sueldo"
              className="h-[70vh] w-full rounded-lg border"
            />
          ) : (
            <p className="text-base text-error">No se pudo cargar el documento.</p>
          )}

          <div className="flex flex-col gap-3">
            {conformidad ? (
              <>
                <p className="text-base text-exito">
                  Conformado el {new Date(conformidad.created_at).toLocaleString('es-AR')}
                </p>
                <DescargarRecibo reciboId={recibo.id} habilitado />
                <Link
                  href={`/mi/conformidades/${conformidad.id}/comprobante`}
                  className="rounded-lg border px-4 py-3 text-center text-base"
                  prefetch={false}
                >
                  Descargar comprobante de conformidad
                </Link>
              </>
            ) : rechazo ? (
              <>
                <p className="text-base text-error">
                  Rechazado el {new Date(rechazo.created_at).toLocaleString('es-AR')}
                </p>
                <p className="rounded-lg border border-borde bg-superficie-2 px-4 py-3 text-base">
                  <span className="font-medium">Motivo: </span>
                  {rechazo.motivo}
                </p>
                <DescargarRecibo reciboId={recibo.id} habilitado />
              </>
            ) : (
              <>
                <DescargarRecibo reciboId={recibo.id} habilitado={false} />
                <Link
                  href={`/mi/recibos/${recibo.id}/conformar`}
                  className="rounded-lg bg-marron px-4 py-3 text-center text-lg font-medium text-white"
                >
                  Prestar conformidad
                </Link>
                <Link
                  href={`/mi/recibos/${recibo.id}/rechazar`}
                  className="rounded-lg border border-error px-4 py-3 text-center text-base font-medium text-error"
                >
                  Rechazar recibo
                </Link>
              </>
            )}
          </div>
        </>
      )}

      <Observaciones reciboId={recibo.id} observaciones={observaciones ?? []} />
    </section>
  )
}
