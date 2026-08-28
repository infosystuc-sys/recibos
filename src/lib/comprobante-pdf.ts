import 'server-only'

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import { formatearCuil } from '@/lib/cuil'
import { formatearPeriodo } from '@/lib/periodo'
import { ETIQUETA_TIPO, type TipoLiquidacion } from '@/lib/tango/parse-nombre-recibo'

const TZ = 'America/Argentina/Buenos_Aires'
const GRIS = rgb(0.45, 0.45, 0.45)
const NEGRO = rgb(0.1, 0.1, 0.1)
const AZUL = rgb(0.09, 0.13, 0.42)

/** SELECT de PostgREST para traer todo lo que necesita un comprobante. */
export const SELECT_COMPROBANTE =
  'persona_id, comprobante_codigo, created_at, sha256_documento, texto_legal, ip, user_agent, ' +
  'recibos(version, legajos(numero, personas(apellido_nombre, cuil)), ' +
  'liquidaciones(periodo, tipo, dato_fijo, empresas(razon_social, cuit)))'

export interface FilaComprobante {
  persona_id: string
  comprobante_codigo: string
  created_at: string
  sha256_documento: string
  texto_legal: string
  ip: string | null
  user_agent: string | null
  recibos: {
    version: number
    legajos: { numero: number; personas: { apellido_nombre: string; cuil: string } | null } | null
    liquidaciones: {
      periodo: number
      tipo: string
      dato_fijo: number
      empresas: { razon_social: string; cuit: string } | null
    } | null
  } | null
}

export function filaAComprobante(c: FilaComprobante): DatosComprobante {
  const r = c.recibos
  const liq = r?.liquidaciones
  return {
    comprobanteCodigo: c.comprobante_codigo,
    createdAt: c.created_at,
    sha256Documento: c.sha256_documento,
    textoLegal: c.texto_legal,
    ip: c.ip,
    userAgent: c.user_agent,
    version: r?.version ?? 1,
    legajoNumero: r?.legajos?.numero ?? null,
    apellidoNombre: r?.legajos?.personas?.apellido_nombre ?? null,
    cuil: r?.legajos?.personas?.cuil ?? null,
    periodo: liq?.periodo ?? null,
    tipo: liq?.tipo ?? null,
    datoFijo: liq?.dato_fijo ?? null,
    empresaRazonSocial: liq?.empresas?.razon_social ?? null,
    empresaCuit: liq?.empresas?.cuit ?? null,
  }
}

export interface DatosComprobante {
  comprobanteCodigo: string
  createdAt: string
  sha256Documento: string
  textoLegal: string
  ip: string | null
  userAgent: string | null
  version: number
  legajoNumero: number | null
  apellidoNombre: string | null
  cuil: string | null
  periodo: number | null
  tipo: string | null
  datoFijo: number | null
  empresaRazonSocial: string | null
  empresaCuit: string | null
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

function dibujarComprobante(
  pagina: PDFPage,
  fuente: PDFFont,
  negrita: PDFFont,
  c: DatosComprobante,
) {
  const margen = 56
  let y = 800

  const linea = (
    texto: string,
    opts: { bold?: boolean; size?: number; gap?: number; color?: ReturnType<typeof rgb> } = {},
  ) => {
    const size = opts.size ?? 11
    pagina.drawText(texto, {
      x: margen,
      y,
      size,
      font: opts.bold ? negrita : fuente,
      color: opts.color ?? NEGRO,
    })
    y -= opts.gap ?? size + 8
  }

  const dato = (etiqueta: string, valor: string) => {
    pagina.drawText(etiqueta, { x: margen, y, size: 9, font: fuente, color: GRIS })
    y -= 13
    pagina.drawText(valor, { x: margen, y, size: 11, font: negrita, color: NEGRO })
    y -= 22
  }

  linea('CONFORME', { bold: true, size: 20, color: AZUL, gap: 10 })
  linea('Comprobante de conformidad de recibo de sueldo', { size: 12, gap: 28 })

  dato('Identificador del comprobante', c.comprobanteCodigo)
  dato(
    'Empresa',
    c.empresaRazonSocial
      ? `${c.empresaRazonSocial}  ·  CUIT ${c.empresaCuit ? formatearCuil(c.empresaCuit) : '—'}`
      : '—',
  )
  dato(
    'Empleado',
    c.apellidoNombre
      ? `${c.apellidoNombre}  ·  CUIL ${c.cuil ? formatearCuil(c.cuil) : '—'}  ·  legajo ${c.legajoNumero ?? '—'}`
      : '—',
  )
  dato(
    'Recibo',
    c.periodo
      ? `${formatearPeriodo(c.periodo)}  ·  ${c.tipo ? ETIQUETA_TIPO[c.tipo as TipoLiquidacion] : '—'}  ·  Liq. ${c.datoFijo ?? '—'}  ·  versión ${c.version}`
      : '—',
  )
  dato(
    'Fecha y hora de la conformidad',
    new Date(c.createdAt).toLocaleString('es-AR', { timeZone: TZ, dateStyle: 'full', timeStyle: 'long' }),
  )
  dato('Hash SHA-256 del documento firmado', c.sha256Documento)
  dato('Origen de la conexión', `IP ${c.ip ?? 'no registrada'}`)
  dato('Dispositivo', c.userAgent ?? 'no registrado')

  y -= 8
  linea('Texto aceptado', { bold: true, size: 10, gap: 16 })
  for (const trozo of envolver(c.textoLegal, 85)) linea(trozo, { size: 10, gap: 14 })

  y -= 10
  linea('Este comprobante certifica el registro de la conformidad en el sistema. Su validez', {
    size: 8,
    gap: 11,
    color: GRIS,
  })
  linea('jurídica debe evaluarse según la normativa aplicable.', { size: 8, color: GRIS })
}

/** PDF con un comprobante por página. */
export async function comprobantesPdf(comprobantes: DatosComprobante[]): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  const fuente = await pdf.embedFont(StandardFonts.Helvetica)
  const negrita = await pdf.embedFont(StandardFonts.HelveticaBold)

  for (const c of comprobantes) {
    const pagina = pdf.addPage([595, 842])
    dibujarComprobante(pagina, fuente, negrita, c)
  }
  if (comprobantes.length === 0) {
    const pagina = pdf.addPage([595, 842])
    pagina.drawText('Sin conformidades registradas.', {
      x: 56,
      y: 780,
      size: 12,
      font: fuente,
      color: NEGRO,
    })
  }
  return pdf.save()
}
