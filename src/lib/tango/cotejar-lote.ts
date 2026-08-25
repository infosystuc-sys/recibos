import { formatearCuil } from '@/lib/cuil'
import type { ArchivoEscaneado, Lote } from '@/lib/tango/agrupar-lotes'

export type CodigoDiagnostico =
  | 'LEGAJO_INEXISTENTE'
  | 'CUIL_NO_COINCIDE'
  | 'EMPLEADO_INACTIVO'
  | 'FALTA_EN_LOTE'
  | 'DUPLICADO_EN_LOTE'
  | 'YA_SUBIDO'
  | 'REEMPLAZO'

export type Severidad = 'bloqueante' | 'advertencia' | 'informativo'

export interface LegajoPadron {
  legajoId: string
  numero: number
  cuil: string
  nombre: string
  activo: boolean
}

/** Recibo vigente que ya está cargado en el sistema para esta liquidación. */
export interface ReciboExistente {
  legajo: number
  sha256: string
}

export interface Diagnostico {
  codigo: CodigoDiagnostico
  severidad: Severidad
  legajo: number
  /** Nombre del archivo involucrado, o null cuando el problema es una ausencia. */
  archivo: string | null
  detalle: string
}

export interface ResultadoCotejo {
  diagnosticos: Diagnostico[]
  /** Archivos que deben subirse y publicarse. */
  publicables: ArchivoEscaneado[]
  hayBloqueantes: boolean
}

interface EntradaCotejo {
  lote: Lote
  padron: LegajoPadron[]
  existentes: ReciboExistente[]
  /** SHA-256 por nombre de archivo, calculado antes de subir. */
  hashes: Map<string, string>
}

export function cotejarLote({ lote, padron, existentes, hashes }: EntradaCotejo): ResultadoCotejo {
  const diagnosticos: Diagnostico[] = []
  const publicables: ArchivoEscaneado[] = []

  const porNumero = new Map(padron.map((l) => [l.numero, l]))
  const existentePorLegajo = new Map(existentes.map((r) => [r.legajo, r]))
  const vecesEnLote = new Map<number, number>()

  for (const archivo of lote.archivos) {
    const legajo = archivo.datos.legajo
    vecesEnLote.set(legajo, (vecesEnLote.get(legajo) ?? 0) + 1)
  }

  const duplicadosReportados = new Set<number>()

  for (const archivo of lote.archivos) {
    const { legajo, cuil } = archivo.datos

    if ((vecesEnLote.get(legajo) ?? 0) > 1) {
      if (!duplicadosReportados.has(legajo)) {
        duplicadosReportados.add(legajo)
        diagnosticos.push({
          codigo: 'DUPLICADO_EN_LOTE',
          severidad: 'bloqueante',
          legajo,
          archivo: archivo.nombre,
          detalle: `El legajo ${legajo} aparece ${vecesEnLote.get(legajo)} veces en esta liquidación. Dejá un solo archivo.`,
        })
      }
      continue
    }

    const enPadron = porNumero.get(legajo)

    if (!enPadron) {
      diagnosticos.push({
        codigo: 'LEGAJO_INEXISTENTE',
        severidad: 'bloqueante',
        legajo,
        archivo: archivo.nombre,
        detalle: `El legajo ${legajo} (CUIL ${formatearCuil(cuil)}) no existe en el padrón de esta empresa. Importalo o excluí el archivo.`,
      })
      continue
    }

    if (enPadron.cuil !== cuil) {
      diagnosticos.push({
        codigo: 'CUIL_NO_COINCIDE',
        severidad: 'bloqueante',
        legajo,
        archivo: archivo.nombre,
        detalle: `El legajo ${legajo} figura en el padrón con CUIL ${formatearCuil(enPadron.cuil)} (${enPadron.nombre}), pero el archivo trae ${formatearCuil(cuil)}. Revisalo antes de publicar.`,
      })
      continue
    }

    if (!enPadron.activo) {
      diagnosticos.push({
        codigo: 'EMPLEADO_INACTIVO',
        severidad: 'advertencia',
        legajo,
        archivo: archivo.nombre,
        detalle: `${enPadron.nombre} está dado de baja pero tiene recibo en esta liquidación.`,
      })
    }

    const existente = existentePorLegajo.get(legajo)
    const hash = hashes.get(archivo.nombre)

    if (existente && hash && existente.sha256 === hash) {
      diagnosticos.push({
        codigo: 'YA_SUBIDO',
        severidad: 'informativo',
        legajo,
        archivo: archivo.nombre,
        detalle: `Ya está cargado y sin cambios. Se saltea.`,
      })
      continue
    }

    if (existente && hash && existente.sha256 !== hash) {
      diagnosticos.push({
        codigo: 'REEMPLAZO',
        severidad: 'advertencia',
        legajo,
        archivo: archivo.nombre,
        detalle: `Ya hay un recibo cargado para ${enPadron.nombre} en esta liquidación y el archivo cambió. Se publicará como versión nueva y requerirá una nueva conformidad.`,
      })
    }

    publicables.push(archivo)
  }

  const legajosEnLote = new Set(lote.archivos.map((a) => a.datos.legajo))
  for (const entrada of padron) {
    if (entrada.activo && !legajosEnLote.has(entrada.numero)) {
      diagnosticos.push({
        codigo: 'FALTA_EN_LOTE',
        severidad: 'advertencia',
        legajo: entrada.numero,
        archivo: null,
        detalle: `${entrada.nombre} está activo en el padrón pero no tiene recibo en esta liquidación.`,
      })
    }
  }

  return {
    diagnosticos,
    publicables,
    hayBloqueantes: diagnosticos.some((d) => d.severidad === 'bloqueante'),
  }
}
