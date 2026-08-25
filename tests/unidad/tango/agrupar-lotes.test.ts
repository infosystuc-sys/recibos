import { describe, expect, it } from 'vitest'
import { agruparEnLotes, claveLote, describirLote, type ArchivoEscaneado } from '@/lib/tango/agrupar-lotes'
import { parseNombreRecibo } from '@/lib/tango/parse-nombre-recibo'

function archivo(nombre: string): ArchivoEscaneado {
  const datos = parseNombreRecibo(nombre)
  if (!datos) throw new Error(`nombre de prueba inválido: ${nombre}`)
  return { nombre, rutaRelativa: `202604/${nombre}`, bytes: 45000, datos }
}

describe('agruparEnLotes', () => {
  it('agrupa por período, tipo y dato fijo', () => {
    const lotes = agruparEnLotes([
      archivo('RS_202604_1QA_680_201_20-27103275-8.pdf'),
      archivo('RS_202604_1QA_680_202_20-19202141-4.pdf'),
      archivo('RS_202604_MEN_679_1_27-20012949-6.pdf'),
    ])

    expect(lotes).toHaveLength(2)
    expect(lotes.map((l) => l.archivos.length).sort()).toEqual([1, 2])
  })

  it('separa liquidaciones del mismo período con distinto dato fijo', () => {
    const lotes = agruparEnLotes([
      archivo('RS_202604_1QA_680_201_20-27103275-8.pdf'),
      archivo('RS_202604_2QA_681_201_20-27103275-8.pdf'),
    ])
    expect(lotes).toHaveLength(2)
  })

  it('ordena del período más nuevo al más viejo', () => {
    const lotes = agruparEnLotes([
      archivo('RS_202603_MEN_670_1_27-20012949-6.pdf'),
      archivo('RS_202605_MEN_690_1_27-20012949-6.pdf'),
      archivo('RS_202604_MEN_679_1_27-20012949-6.pdf'),
    ])
    expect(lotes.map((l) => l.periodo)).toEqual([202605, 202604, 202603])
  })

  it('devuelve una lista vacía si no hay archivos', () => {
    expect(agruparEnLotes([])).toEqual([])
  })
})

describe('claveLote', () => {
  it('produce una clave estable', () => {
    expect(claveLote({ periodo: 202604, tipo: '1QA', datoFijo: 680 })).toBe('202604-1QA-680')
  })
})

describe('describirLote', () => {
  it('arma la descripción que ve el administrador', () => {
    expect(describirLote({ periodo: 202604, tipo: '1QA', datoFijo: 680 }))
      .toBe('Abril 2026 · Primera quincena · Liq. 680')
  })
})
