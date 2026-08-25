export type TipoLiquidacion = '1QA' | '2QA' | 'MEN'

export interface ReciboParseado {
  /** Período liquidado en formato AAAAMM, ej. 202604. */
  periodo: number
  tipo: TipoLiquidacion
  /** "Dato fijo" de Tango: el número de liquidación, ej. 680. */
  datoFijo: number
  legajo: number
  /** CUIL normalizado: 11 dígitos, sin guiones. */
  cuil: string
}

export const ETIQUETA_TIPO: Record<TipoLiquidacion, string> = {
  '1QA': 'Primera quincena',
  '2QA': 'Segunda quincena',
  MEN: 'Mensual',
}

/**
 * Nombre que exporta Tango Sueldos:
 *   RS_202604_1QA_680_201_20-27103275-8.pdf
 *   │  │      │   │   │   └─ CUIL
 *   │  │      │   │   └───── legajo
 *   │  │      │   └───────── dato fijo (número de liquidación)
 *   │  │      └───────────── tipo de liquidación
 *   │  └──────────────────── período AAAAMM
 *   └─────────────────────── prefijo de recibo de sueldo
 */
const PATRON = /^RS_(\d{6})_(1QA|2QA|MEN)_(\d+)_(\d+)_(\d{2})-(\d{8})-(\d)\.pdf$/i

/** Devuelve los datos del recibo, o null si el nombre no corresponde a uno. */
export function parseNombreRecibo(nombre: string): ReciboParseado | null {
  const coincidencia = PATRON.exec(nombre.trim())
  if (!coincidencia) return null

  const periodo = Number(coincidencia[1])
  const mes = periodo % 100
  if (mes < 1 || mes > 12) return null

  return {
    periodo,
    tipo: coincidencia[2].toUpperCase() as TipoLiquidacion,
    datoFijo: Number(coincidencia[3]),
    legajo: Number(coincidencia[4]),
    cuil: `${coincidencia[5]}${coincidencia[6]}${coincidencia[7]}`,
  }
}
