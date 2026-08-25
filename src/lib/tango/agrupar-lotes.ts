import { formatearPeriodo } from '@/lib/periodo'
import { ETIQUETA_TIPO, type ReciboParseado, type TipoLiquidacion } from '@/lib/tango/parse-nombre-recibo'

export interface ArchivoEscaneado {
  nombre: string
  /** Ruta dentro de la carpeta elegida, para poder mostrarla en la revisión. */
  rutaRelativa: string
  bytes: number
  datos: ReciboParseado
}

export interface ClaveLiquidacion {
  periodo: number
  tipo: TipoLiquidacion
  datoFijo: number
}

export interface Lote extends ClaveLiquidacion {
  archivos: ArchivoEscaneado[]
}

const ORDEN_TIPO: Record<TipoLiquidacion, number> = { MEN: 0, '1QA': 1, '2QA': 2 }

export function claveLote(clave: ClaveLiquidacion): string {
  return `${clave.periodo}-${clave.tipo}-${clave.datoFijo}`
}

export function describirLote(clave: ClaveLiquidacion): string {
  return `${formatearPeriodo(clave.periodo)} · ${ETIQUETA_TIPO[clave.tipo]} · Liq. ${clave.datoFijo}`
}

/** Agrupa los archivos escaneados en una liquidación por cada (período, tipo, dato fijo). */
export function agruparEnLotes(archivos: ArchivoEscaneado[]): Lote[] {
  const porClave = new Map<string, Lote>()

  for (const archivo of archivos) {
    const { periodo, tipo, datoFijo } = archivo.datos
    const clave = claveLote({ periodo, tipo, datoFijo })

    let lote = porClave.get(clave)
    if (!lote) {
      lote = { periodo, tipo, datoFijo, archivos: [] }
      porClave.set(clave, lote)
    }
    lote.archivos.push(archivo)
  }

  const lotes = [...porClave.values()]
  for (const lote of lotes) {
    lote.archivos.sort((a, b) => a.datos.legajo - b.datos.legajo)
  }

  return lotes.sort(
    (a, b) =>
      b.periodo - a.periodo ||
      ORDEN_TIPO[a.tipo] - ORDEN_TIPO[b.tipo] ||
      a.datoFijo - b.datoFijo,
  )
}
