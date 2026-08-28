import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { formatearCuil } from '@/lib/cuil'
import { formatearPeriodo } from '@/lib/periodo'
import { obtenerEmpleado } from '@/lib/sesion-empleado'
import { clienteServicio } from '@/lib/supabase/cliente-servicio'
import { ETIQUETA_TIPO, type TipoLiquidacion } from '@/lib/tango/parse-nombre-recibo'

const TZ = 'America/Argentina/Buenos_Aires'

interface ComprobanteData {
  persona_id: string
  comprobante_codigo: string
  created_at: string
  sha256_documento: string
  texto_legal: string
  ip: string | null
  user_agent: string | null
  recibos: {
    version: number
    legajos: {
      numero: number
      personas: { apellido_nombre: string; cuil: string } | null
    } | null
    liquidaciones: {
      periodo: number
      tipo: string
      dato_fijo: number
      empresas: { razon_social: string; cuit: string } | null
    } | null
  } | null
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const empleado = await obtenerEmpleado()
  if (!empleado) return new Response('No autorizado', { status: 401 })

  const servicio = clienteServicio()
  const { data } = await servicio
    .from('conformidades')
    .select(
      'id, persona_id, comprobante_codigo, created_at, sha256_documento, texto_legal, ip, user_agent, ' +
        'recibos(version, legajos(numero, personas(apellido_nombre, cuil)), ' +
        'liquidaciones(periodo, tipo, dato_fijo, empresas(razon_social, cuit)))',
    )
    .eq('id', id)
    .maybeSingle()

  const c = data as ComprobanteData | null
  if (!c || c.persona_id !== empleado.id) return new Response('No encontrado', { status: 404 })

  const recibo = c.recibos
  const liq = recibo?.liquidaciones
  const empresa = liq?.empresas
  const persona = recibo?.legajos?.personas

  const pdf = await PDFDocument.create()
  const pagina = pdf.addPage([595, 842]) // A4
  const fuente = await pdf.embedFont(StandardFonts.Helvetica)
  const negrita = await pdf.embedFont(StandardFonts.HelveticaBold)

  let y = 800
  const margen = 56
  const azul = rgb(0.09, 0.13, 0.42)

  const linea = (texto: string, opts: { bold?: boolean; size?: number; gap?: number; color?: typeof azul } = {}) => {
    const size = opts.size ?? 11
    pagina.drawText(texto, {
      x: margen,
      y,
      size,
      font: opts.bold ? negrita : fuente,
      color: opts.color ?? rgb(0.1, 0.1, 0.1),
    })
    y -= opts.gap ?? size + 8
  }

  const dato = (etiqueta: string, valor: string) => {
    pagina.drawText(etiqueta, { x: margen, y, size: 9, font: fuente, color: rgb(0.45, 0.45, 0.45) })
    y -= 13
    pagina.drawText(valor, { x: margen, y, size: 11, font: negrita, color: rgb(0.1, 0.1, 0.1) })
    y -= 22
  }

  linea('CONFORME', { bold: true, size: 20, color: azul, gap: 10 })
  linea('Comprobante de conformidad de recibo de sueldo', { size: 12, gap: 28 })

  dato('Identificador del comprobante', c.comprobante_codigo)
  dato(
    'Empresa',
    empresa ? `${empresa.razon_social}  ·  CUIT ${formatearCuil(empresa.cuit)}` : '—',
  )
  dato(
    'Empleado',
    persona
      ? `${persona.apellido_nombre}  ·  CUIL ${formatearCuil(persona.cuil)}  ·  legajo ${recibo?.legajos?.numero ?? '—'}`
      : '—',
  )
  dato(
    'Recibo',
    liq
      ? `${formatearPeriodo(liq.periodo)}  ·  ${ETIQUETA_TIPO[liq.tipo as TipoLiquidacion]}  ·  Liq. ${liq.dato_fijo}  ·  versión ${recibo?.version}`
      : '—',
  )
  dato(
    'Fecha y hora de la conformidad',
    new Date(c.created_at).toLocaleString('es-AR', { timeZone: TZ, dateStyle: 'full', timeStyle: 'long' }),
  )
  dato('Hash SHA-256 del documento firmado', c.sha256_documento)
  dato('Origen de la conexión', `IP ${c.ip ?? 'no registrada'}`)
  dato('Dispositivo', c.user_agent ?? 'no registrado')

  y -= 8
  linea('Texto aceptado', { bold: true, size: 10, gap: 16 })
  // el texto legal, envuelto a ~85 caracteres
  for (const trozo of envolver(c.texto_legal, 85)) {
    linea(trozo, { size: 10, gap: 14 })
  }

  y -= 10
  linea(
    'Este comprobante certifica el registro de la conformidad en el sistema. Su validez',
    { size: 8, gap: 11, color: rgb(0.45, 0.45, 0.45) },
  )
  linea('jurídica debe evaluarse según la normativa aplicable.', {
    size: 8,
    color: rgb(0.45, 0.45, 0.45),
  })

  const bytes = await pdf.save()
  return new Response(Buffer.from(bytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="comprobante-${c.comprobante_codigo}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  })
}

function envolver(texto: string, ancho: number): string[] {
  const palabras = texto.split(/\s+/)
  const lineas: string[] = []
  let actual = ''
  for (const palabra of palabras) {
    if ((actual + ' ' + palabra).trim().length > ancho) {
      lineas.push(actual)
      actual = palabra
    } else {
      actual = (actual + ' ' + palabra).trim()
    }
  }
  if (actual) lineas.push(actual)
  return lineas
}
