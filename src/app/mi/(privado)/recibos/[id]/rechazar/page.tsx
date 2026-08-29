import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { formatearPeriodo } from '@/lib/periodo'
import { exigirEmpleado } from '@/lib/sesion-empleado'
import { clienteServidor } from '@/lib/supabase/cliente-servidor'
import { ETIQUETA_TIPO, type TipoLiquidacion } from '@/lib/tango/parse-nombre-recibo'
import FormularioRechazo from './formulario'

export default async function RechazarRecibo({ params }: { params: Promise<{ id: string }> }) {
  await exigirEmpleado()
  const { id } = await params
  const supabase = await clienteServidor()

  const { data: recibo } = await supabase
    .from('recibos')
    .select(
      'id, version, estado, liquidaciones(periodo, tipo, dato_fijo, empresas(razon_social)), conformidades(id), rechazos(id)',
    )
    .eq('id', id)
    .maybeSingle()

  if (!recibo || !recibo.liquidaciones) notFound()
  if (recibo.estado !== 'vigente') redirect(`/mi/recibos/${id}`)
  if (recibo.conformidades) redirect(`/mi/recibos/${id}`)
  if (recibo.rechazos) redirect(`/mi/recibos/${id}`)

  const { periodo, tipo, dato_fijo, empresas } = recibo.liquidaciones

  return (
    <section className="flex flex-col gap-6">
      <Link href={`/mi/recibos/${id}`} className="text-sm underline">
        ← Ver el recibo
      </Link>

      <div>
        <h1 className="text-2xl font-semibold">Rechazar recibo</h1>
        <p className="mt-1 text-texto-suave">
          {empresas?.razon_social} · {formatearPeriodo(periodo)} ·{' '}
          {ETIQUETA_TIPO[tipo as TipoLiquidacion]} · Liq. {dato_fijo}
          {recibo.version > 1 && ` · versión ${recibo.version}`}
        </p>
      </div>

      <p className="text-sm text-texto-suave">
        Contanos qué está mal en el recibo. La administración va a recibir tu rechazo con el
        motivo y la fecha. Queda registrado de forma permanente y no se puede deshacer; si
        rechazás no vas a poder prestar conformidad a esta versión.
      </p>

      <FormularioRechazo reciboId={recibo.id} />
    </section>
  )
}
