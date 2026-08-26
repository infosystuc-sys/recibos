import { describe, expect, it } from 'vitest'
import { generarCodigo, hashearCodigo } from '@/lib/codigo-activacion'

describe('generarCodigo', () => {
  it('devuelve 8 caracteres', () => {
    expect(generarCodigo()).toHaveLength(8)
  })

  it('evita caracteres que se confunden al dictarlos', () => {
    for (let i = 0; i < 200; i++) {
      expect(generarCodigo()).not.toMatch(/[O0I1lS5V]/)
    }
  })

  it('no repite el mismo código', () => {
    const codigos = new Set(Array.from({ length: 200 }, () => generarCodigo()))
    expect(codigos.size).toBeGreaterThan(190)
  })
})

describe('hashearCodigo', () => {
  it('es determinístico para la misma persona y código', () => {
    expect(hashearCodigo('persona-1', 'ABCD2345')).toBe(hashearCodigo('persona-1', 'ABCD2345'))
  })

  it('cambia si cambia la persona', () => {
    expect(hashearCodigo('persona-1', 'ABCD2345')).not.toBe(hashearCodigo('persona-2', 'ABCD2345'))
  })

  it('no distingue mayúsculas ni espacios en el código ingresado', () => {
    expect(hashearCodigo('persona-1', ' abcd 2345 ')).toBe(hashearCodigo('persona-1', 'ABCD2345'))
  })

  it('devuelve un hexadecimal de 64 caracteres', () => {
    expect(hashearCodigo('persona-1', 'ABCD2345')).toMatch(/^[0-9a-f]{64}$/)
  })
})
