import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { formatearPeriodo } from '@/lib/periodo'
import { exigirEmpleado } from '@/lib/sesion-empleado'
import { clienteServidor } from '@/lib/supabase/cliente-servidor'
import { ETIQUETA_TIPO, type TipoLiquidacion } from '@/lib/tango/parse-nombre-recibo'
import FormularioConformidad from './formulario'

export default async function ConformarRecibo({ params }: { params: Promise<{ id: string }> }) {
  await exigirEmpleado()
  const { id } = await params
  const supabase = await clienteServidor()

  const { data: recibo } = await supabase
    .from('recibos')
    .select(
      'id, version, estado, liquidaciones(periodo, tipo, dato_fijo, empresas(razon_social, texto_conformidad)), conformidades(id)',
    )
    .eq('id', id)
    .maybeSingle()

  if (!recibo || !recibo.liquidaciones) notFound()
  if (recibo.estado !== 'vigente') redirect(`/mi/recibos/${id}`)
  if (recibo.conformidades) redirect(`/mi/recibos/${id}`)

  const { periodo, tipo, dato_fijo, empresas } = recibo.liquidaciones

  return (
    <section className="flex flex-col gap-6">
      <Link href={`/mi/recibos/${id}`} className="text-sm underline">
        ← Ver el recibo
      </Link>

      <div>
        <h1 className="text-2xl font-semibold">Prestar conformidad</h1>
        <p className="mt-1 text-neutral-600 dark:text-neutral-400">
          {empresas?.razon_social} · {formatearPeriodo(periodo)} ·{' '}
          {ETIQUETA_TIPO[tipo as TipoLiquidacion]} · Liq. {dato_fijo}
          {recibo.version > 1 && ` · versión ${recibo.version}`}
        </p>
      </div>

      <blockquote className="rounded-lg border-l-4 border-blue-900 bg-neutral-50 px-4 py-3 text-base dark:bg-neutral-900">
        {empresas?.texto_conformidad}
      </blockquote>

      <p className="text-sm text-neutral-500">
        Al confirmar se registran la fecha y hora del servidor, tu dispositivo y el hash del
        documento exacto que estás firmando. Es un registro permanente y no se puede
        deshacer.
      </p>

      <FormularioConformidad reciboId={recibo.id} />
    </section>
  )
}
