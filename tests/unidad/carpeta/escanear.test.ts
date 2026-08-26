import { describe, expect, it } from 'vitest'
import { escanearDirectorio, type DirectorioLegible } from '@/lib/carpeta/escanear'

function archivoFalso(nombre: string, bytes = 45000) {
  return {
    kind: 'file' as const,
    name: nombre,
    getFile: async () => ({ size: bytes, name: nombre }) as unknown as File,
  }
}

function carpetaFalsa(nombre: string, hijos: unknown[]): DirectorioLegible & { kind: 'directory'; name: string } {
  return {
    kind: 'directory',
    name: nombre,
    async *values() {
      for (const hijo of hijos) yield hijo as never
    },
  }
}

describe('escanearDirectorio', () => {
  it('reconoce los recibos de una carpeta plana', async () => {
    const raiz = carpetaFalsa('202604', [
      archivoFalso('RS_202604_1QA_680_201_20-27103275-8.pdf'),
      archivoFalso('RS_202604_1QA_680_202_20-19202141-4.pdf'),
    ])

    const { archivos, ignorados } = await escanearDirectorio(raiz)

    expect(archivos).toHaveLength(2)
    expect(ignorados).toEqual([])
    expect(archivos[0].datos.legajo).toBe(201)
  })

  it('recorre subcarpetas y arma la ruta relativa', async () => {
    const raiz = carpetaFalsa('Delta 6', [
      carpetaFalsa('202604', [archivoFalso('RS_202604_MEN_679_1_27-20012949-6.pdf')]),
    ])

    const { archivos } = await escanearDirectorio(raiz)

    expect(archivos).toHaveLength(1)
    expect(archivos[0].rutaRelativa).toBe('202604/RS_202604_MEN_679_1_27-20012949-6.pdf')
  })

  it('lista aparte los PDFs que no son recibos', async () => {
    const raiz = carpetaFalsa('202604', [
      archivoFalso('RS_202604_MEN_679_1_27-20012949-6.pdf'),
      archivoFalso('Listado de haberes.pdf'),
    ])

    const { archivos, ignorados } = await escanearDirectorio(raiz)

    expect(archivos).toHaveLength(1)
    expect(ignorados).toEqual(['Listado de haberes.pdf'])
  })

  it('no cuenta como ignorados los archivos que no son PDF', async () => {
    const raiz = carpetaFalsa('202604', [archivoFalso('notas.txt'), archivoFalso('planilla.xlsx')])

    const { archivos, ignorados } = await escanearDirectorio(raiz)

    expect(archivos).toEqual([])
    expect(ignorados).toEqual([])
  })

  it('devuelve vacío para una carpeta sin contenido', async () => {
    const { archivos, ignorados } = await escanearDirectorio(carpetaFalsa('vacia', []))
    expect(archivos).toEqual([])
    expect(ignorados).toEqual([])
  })
})
