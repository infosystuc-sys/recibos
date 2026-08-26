import { cuilValido, normalizarCuil } from '@/lib/cuil'

export interface FilaPadron {
  legajo: number
  cuil: string
  apellidoNombre: string
  email: string | null
  telefono: string | null
  sector: string | null
  activo: boolean
}

export interface ErrorFila {
  /** Número de línea del archivo (1-indexado), contando la cabecera como línea 1. */
  linea: number
  motivo: string
  contenido: string
}

const ALIAS: Record<string, keyof FilaPadron> = {
  legajo: 'legajo',
  nro_legajo: 'legajo',
  numero: 'legajo',
  cuil: 'cuil',
  cuit: 'cuil',
  apellido_nombre: 'apellidoNombre',
  apellido_y_nombre: 'apellidoNombre',
  nombre: 'apellidoNombre',
  email: 'email',
  correo: 'email',
  telefono: 'telefono',
  celular: 'telefono',
  sector: 'sector',
  activo: 'activo',
}

const VERDADEROS = new Set(['si', 'sí', 's', 'true', '1', 'activo'])
const FALSOS = new Set(['no', 'n', 'false', '0', 'inactivo', 'baja'])

/** Parte una línea respetando comillas dobles. */
function partirLinea(linea: string, separador: string): string[] {
  const campos: string[] = []
  let actual = ''
  let entreComillas = false

  for (let i = 0; i < linea.length; i++) {
    const caracter = linea[i]
    if (caracter === '"') {
      if (entreComillas && linea[i + 1] === '"') {
        actual += '"'
        i++
      } else {
        entreComillas = !entreComillas
      }
    } else if (caracter === separador && !entreComillas) {
      campos.push(actual)
      actual = ''
    } else {
      actual += caracter
    }
  }
  campos.push(actual)
  return campos.map((c) => c.trim())
}

function normalizarEncabezado(valor: string): string {
  return valor
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_')
}

export function parsearCsvPadron(texto: string): { filas: FilaPadron[]; errores: ErrorFila[] } {
  const lineas = texto.replace(/^\uFEFF/, '').split(/\r?\n/)
  const primera = lineas.find((l) => l.trim() !== '')
  if (!primera) return { filas: [], errores: [{ linea: 0, motivo: 'El archivo está vacío', contenido: '' }] }

  const separador = (primera.match(/;/g)?.length ?? 0) >= (primera.match(/,/g)?.length ?? 0) ? ';' : ','
  const encabezados = partirLinea(primera, separador).map(normalizarEncabezado)
  const columnas = encabezados.map((h) => ALIAS[h] ?? null)

  const errores: ErrorFila[] = []
  for (const obligatoria of ['legajo', 'cuil', 'apellidoNombre'] as const) {
    if (!columnas.includes(obligatoria)) {
      errores.push({
        linea: 0,
        motivo: `Falta la columna obligatoria "${obligatoria}" en la cabecera`,
        contenido: primera,
      })
    }
  }
  if (errores.length > 0) return { filas: [], errores }

  const filas: FilaPadron[] = []
  const legajosVistos = new Set<number>()
  const indiceCabecera = lineas.indexOf(primera)

  for (let i = indiceCabecera + 1; i < lineas.length; i++) {
    const linea = lineas[i]
    if (linea.trim() === '') continue

    const numeroLinea = i - indiceCabecera + 1
    const campos = partirLinea(linea, separador)
    const crudo: Partial<Record<keyof FilaPadron, string>> = {}
    columnas.forEach((columna, indice) => {
      if (columna) crudo[columna] = campos[indice] ?? ''
    })

    const legajo = Number(crudo.legajo)
    if (!Number.isInteger(legajo) || legajo <= 0) {
      errores.push({ linea: numeroLinea, motivo: `El legajo "${crudo.legajo}" no es un número válido`, contenido: linea })
      continue
    }

    const cuil = normalizarCuil(crudo.cuil ?? '')
    if (!cuil) {
      errores.push({ linea: numeroLinea, motivo: `El CUIL "${crudo.cuil}" no tiene 11 dígitos`, contenido: linea })
      continue
    }
    if (!cuilValido(cuil)) {
      errores.push({ linea: numeroLinea, motivo: `El CUIL "${crudo.cuil}" tiene dígito verificador inválido`, contenido: linea })
      continue
    }

    const apellidoNombre = (crudo.apellidoNombre ?? '').trim()
    if (!apellidoNombre) {
      errores.push({ linea: numeroLinea, motivo: 'Falta el apellido y nombre', contenido: linea })
      continue
    }

    if (legajosVistos.has(legajo)) {
      errores.push({ linea: numeroLinea, motivo: `El legajo ${legajo} está duplicado en el archivo`, contenido: linea })
      continue
    }
    legajosVistos.add(legajo)

    const activoCrudo = (crudo.activo ?? '').trim().toLowerCase()
    const activo = activoCrudo === '' ? true : !FALSOS.has(activoCrudo) && VERDADEROS.has(activoCrudo)

    filas.push({
      legajo,
      cuil,
      apellidoNombre,
      email: crudo.email?.trim() || null,
      telefono: crudo.telefono?.trim() || null,
      sector: crudo.sector?.trim() || null,
      activo,
    })
  }

  return { filas, errores }
}
