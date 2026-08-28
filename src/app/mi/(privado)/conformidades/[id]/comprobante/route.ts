import {
  comprobantesPdf,
  filaAComprobante,
  SELECT_COMPROBANTE,
  type FilaComprobante,
} from '@/lib/comprobante-pdf'
import { obtenerEmpleado } from '@/lib/sesion-empleado'
import { clienteServicio } from '@/lib/supabase/cliente-servicio'

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const empleado = await obtenerEmpleado()
  if (!empleado) return new Response('No autorizado', { status: 401 })

  const servicio = clienteServicio()
  const { data } = await servicio
    .from('conformidades')
    .select(SELECT_COMPROBANTE)
    .eq('id', id)
    .maybeSingle()

  const c = data as FilaComprobante | null
  if (!c || c.persona_id !== empleado.id) return new Response('No encontrado', { status: 404 })

  const bytes = await comprobantesPdf([filaAComprobante(c)])
  return new Response(Buffer.from(bytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="comprobante-${c.comprobante_codigo}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
