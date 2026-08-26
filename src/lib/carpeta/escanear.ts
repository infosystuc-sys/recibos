import type { ArchivoEscaneado } from '@/lib/tango/agrupar-lotes'
import { parseNombreRecibo } from '@/lib/tango/parse-nombre-recibo'

/**
 * Mínimo que necesitamos de FileSystemDirectoryHandle.
 * Declararlo así permite probar el escaneo sin navegador.
 */
export interface EntradaLegible {
  kind: 'file' | 'directory'
  name: string
  getFile?: () => Promise<File>
  values?: () => AsyncIterable<EntradaLegible>
}

export interface DirectorioLegible {
  values(): AsyncIterable<EntradaLegible>
}

export interface ResultadoEscaneo {
  archivos: ArchivoEscaneado[]
  /** PDFs que no responden al patrón de Tango: se muestran, no se suben. */
  ignorados: string[]
}

export async function escanearDirectorio(
  directorio: DirectorioLegible,
  rutaBase = '',
): Promise<ResultadoEscaneo> {
  const archivos: ArchivoEscaneado[] = []
  const ignorados: string[] = []

  for await (const entrada of directorio.values()) {
    const ruta = rutaBase ? `${rutaBase}/${entrada.name}` : entrada.name

    if (entrada.kind === 'directory' && entrada.values) {
      const hijo = await escanearDirectorio({ values: entrada.values.bind(entrada) }, ruta)
      archivos.push(...hijo.archivos)
      ignorados.push(...hijo.ignorados)
      continue
    }

    if (entrada.kind !== 'file' || !entrada.getFile) continue

    const datos = parseNombreRecibo(entrada.name)
    if (!datos) {
      if (entrada.name.toLowerCase().endsWith('.pdf')) ignorados.push(entrada.name)
      continue
    }

    const archivo = await entrada.getFile()
    archivos.push({
      nombre: entrada.name,
      rutaRelativa: ruta,
      bytes: archivo.size,
      datos,
    })
  }

  return { archivos, ignorados }
}
