import { describe, expect, it } from 'vitest'
import { cuilValido, emailSinteticoDeCuil, formatearCuil, normalizarCuil } from '@/lib/cuil'

describe('normalizarCuil', () => {
  it('quita los guiones', () => {
    expect(normalizarCuil('20-27103275-8')).toBe('20271032758')
  })

  it('acepta el CUIL ya normalizado', () => {
    expect(normalizarCuil('20271032758')).toBe('20271032758')
  })

  it('tolera espacios, puntos y barras', () => {
    expect(normalizarCuil(' 20.27103275/8 ')).toBe('20271032758')
  })

  it('rechaza cantidades de dígitos distintas de 11', () => {
    expect(normalizarCuil('2027103275')).toBeNull()
    expect(normalizarCuil('202710327580')).toBeNull()
    expect(normalizarCuil('')).toBeNull()
  })
})

describe('formatearCuil', () => {
  it('inserta los guiones en las posiciones correctas', () => {
    expect(formatearCuil('20271032758')).toBe('20-27103275-8')
    expect(formatearCuil('27200129496')).toBe('27-20012949-6')
  })
})

describe('cuilValido', () => {
  it('acepta CUILes reales de los archivos de ejemplo', () => {
    expect(cuilValido('20271032758')).toBe(true) // 20-27103275-8
    expect(cuilValido('27200129496')).toBe(true) // 27-20012949-6
    expect(cuilValido('27546017546')).toBe(true) // 27-54601754-6
    expect(cuilValido('20478871032')).toBe(true) // 20-47887103-2
  })

  it('rechaza un dígito verificador incorrecto', () => {
    expect(cuilValido('20271032759')).toBe(false)
  })

  it('rechaza longitudes inválidas', () => {
    expect(cuilValido('2027103275')).toBe(false)
  })
})

describe('emailSinteticoDeCuil', () => {
  it('arma el email interno de login', () => {
    expect(emailSinteticoDeCuil('20271032758', 'empleados.conforme.local'))
      .toBe('20271032758@empleados.conforme.local')
  })
})
