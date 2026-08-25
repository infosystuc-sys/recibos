import { describe, expect, it } from 'vitest'
import { parseNombreRecibo } from '@/lib/tango/parse-nombre-recibo'

describe('parseNombreRecibo', () => {
  it('parsea una liquidación mensual', () => {
    expect(parseNombreRecibo('RS_202604_MEN_679_102_27-22121012-9.pdf')).toEqual({
      periodo: 202604,
      tipo: 'MEN',
      datoFijo: 679,
      legajo: 102,
      cuil: '27221210129',
    })
  })

  it('parsea primera y segunda quincena', () => {
    expect(parseNombreRecibo('RS_202604_1QA_680_201_20-27103275-8.pdf')?.tipo).toBe('1QA')
    expect(parseNombreRecibo('RS_202604_2QA_681_201_20-27103275-8.pdf')?.tipo).toBe('2QA')
  })

  it('distingue legajo de un dígito de otro de tres', () => {
    expect(parseNombreRecibo('RS_202604_MEN_679_1_27-20012949-6.pdf')?.legajo).toBe(1)
    expect(parseNombreRecibo('RS_202604_MEN_679_201_20-27103275-8.pdf')?.legajo).toBe(201)
  })

  it('normaliza el CUIL quitando los guiones', () => {
    expect(parseNombreRecibo('RS_202604_MEN_679_2_20-16021001-0.pdf')?.cuil).toBe('20160210010')
  })

  it('acepta la extensión en mayúsculas', () => {
    expect(parseNombreRecibo('RS_202604_MEN_679_11_20-20454878-2.PDF')).not.toBeNull()
  })

  it('ignora espacios al principio y al final', () => {
    expect(parseNombreRecibo('  RS_202604_MEN_679_11_20-20454878-2.pdf  ')).not.toBeNull()
  })

  it('rechaza un prefijo que no sea RS', () => {
    expect(parseNombreRecibo('SAC_202604_MEN_679_11_20-20454878-2.pdf')).toBeNull()
  })

  it('rechaza un tipo de liquidación desconocido', () => {
    expect(parseNombreRecibo('RS_202604_SAC_679_11_20-20454878-2.pdf')).toBeNull()
  })

  it('rechaza un mes imposible', () => {
    expect(parseNombreRecibo('RS_202613_MEN_679_11_20-20454878-2.pdf')).toBeNull()
    expect(parseNombreRecibo('RS_202600_MEN_679_11_20-20454878-2.pdf')).toBeNull()
  })

  it('rechaza nombres con partes faltantes o de más', () => {
    expect(parseNombreRecibo('RS_202604_MEN_679_11.pdf')).toBeNull()
    expect(parseNombreRecibo('RS_202604_MEN_679_11_20-20454878-2_extra.pdf')).toBeNull()
  })

  it('rechaza archivos que no sean PDF', () => {
    expect(parseNombreRecibo('RS_202604_MEN_679_11_20-20454878-2.txt')).toBeNull()
  })

  it('rechaza un CUIL con la cantidad de dígitos equivocada', () => {
    expect(parseNombreRecibo('RS_202604_MEN_679_11_20-2045487-2.pdf')).toBeNull()
  })
})
