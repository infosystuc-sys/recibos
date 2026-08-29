import { formatearCuil } from '@/lib/cuil'
import { formatearPeriodo } from '@/lib/periodo'
import { obtenerAdmin } from '@/lib/sesion'
import { clienteServidor } from '@/lib/supabase/cliente-servidor'
import { ETIQUETA_TIPO, type TipoLiquidacion } from '@/lib/tango/parse-nombre-recibo'

interface Fila {
  estado: string
  cuil_archivo: string
  legajos: { numero: number; personas: { apellido_nombre: string; cuil: string } | null } | null
  conformidades: { created_at: string; comprobante_codigo: string; sha256_documento: string } | null
  rechazos: { created_at: string; motivo: string } | null
}

function csvCampo(v: string): string {
  return /[";\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  if (!(await obtenerAdmin())) return new Response('No autorizado', { status: 401 })

  const supabase = await clienteServidor()
  const { data: liq } = await supabase
    .from('liquidaciones')
    .select('periodo, tipo, dato_fijo, empresas(razon_social)')
    .eq('id', id)
    .maybeSingle()
  if (!liq) return new Response('No encontrada', { status: 404 })

  const { data } = await supabase
    .from('recibos')
    .select(
      'estado, cuil_archivo, legajos(numero, personas(apellido_nombre, cuil)), conformidades(created_at, comprobante_codigo, sha256_documento), rechazos(created_at, motivo)',
    )
    .eq('liquidacion_id', id)

  const vigentes = ((data as Fila[] | null) ?? []).filter((r) => r.estado === 'vigente')
  vigentes.sort((a, b) => (a.legajos?.numero ?? 0) - (b.legajos?.numero ?? 0))

  const cabecera = [
    'legajo',
    'apellido_nombre',
    'cuil',
    'estado_conformidad',
    'fecha_conformidad',
    'comprobante',
    'sha256_documento',
    'motivo_rechazo',
  ]
  const estado = (r: Fila) =>
    r.conformidades ? 'conformado' : r.rechazos ? 'rechazado' : 'pendiente'
  const filas = vigentes.map((r) =>
    [
      String(r.legajos?.numero ?? ''),
      r.legajos?.personas?.apellido_nombre ?? '',
      formatearCuil(r.legajos?.personas?.cuil ?? r.cuil_archivo),
      estado(r),
      r.conformidades
        ? new Date(r.conformidades.created_at).toISOString()
        : r.rechazos
          ? new Date(r.rechazos.created_at).toISOString()
          : '',
      r.conformidades?.comprobante_codigo ?? '',
      r.conformidades?.sha256_documento ?? '',
      r.rechazos?.motivo ?? '',
    ]
      .map(csvCampo)
      .join(';'),
  )

  const csv = '﻿' + [cabecera.join(';'), ...filas].join('\r\n') + '\r\n'
  const nombre = `seguimiento-${formatearPeriodo(liq.periodo).replace(' ', '-')}-${ETIQUETA_TIPO[liq.tipo as TipoLiquidacion]}-${liq.dato_fijo}.csv`

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${nombre}"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
