import { formatearPeriodo } from '@/lib/periodo'
import {
  comprobantesPdf,
  filaAComprobante,
  SELECT_COMPROBANTE,
  type FilaComprobante,
} from '@/lib/comprobante-pdf'
import { obtenerAdmin } from '@/lib/sesion'
import { clienteServicio } from '@/lib/supabase/cliente-servicio'
import { ETIQUETA_TIPO, type TipoLiquidacion } from '@/lib/tango/parse-nombre-recibo'

export const maxDuration = 120

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  if (!(await obtenerAdmin())) return new Response('No autorizado', { status: 401 })

  const servicio = clienteServicio()

  const { data: liq } = await servicio
    .from('liquidaciones')
    .select('periodo, tipo, dato_fijo')
    .eq('id', id)
    .maybeSingle()
  if (!liq) return new Response('No encontrada', { status: 404 })

  const { data: recibos } = await servicio
    .from('recibos')
    .select('id')
    .eq('liquidacion_id', id)
    .eq('estado', 'vigente')
  const reciboIds = (recibos ?? []).map((r) => r.id)

  let comprobantes: FilaComprobante[] = []
  if (reciboIds.length > 0) {
    const { data } = await servicio
      .from('conformidades')
      .select(SELECT_COMPROBANTE)
      .in('recibo_id', reciboIds)
      .order('created_at', { ascending: true })
    comprobantes = (data as FilaComprobante[] | null) ?? []
  }

  const bytes = await comprobantesPdf(comprobantes.map(filaAComprobante))
  const nombre = `constancias-${formatearPeriodo(liq.periodo).replace(' ', '-')}-${ETIQUETA_TIPO[liq.tipo as TipoLiquidacion]}-${liq.dato_fijo}.pdf`

  return new Response(Buffer.from(bytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${nombre}"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
