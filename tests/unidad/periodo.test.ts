import { describe, expect, it } from 'vitest'
import { formatearPeriodo } from '@/lib/periodo'

describe('formatearPeriodo', () => {
  it('convierte AAAAMM en texto legible', () => {
    expect(formatearPeriodo(202604)).toBe('Abril 2026')
    expect(formatearPeriodo(202512)).toBe('Diciembre 2025')
    expect(formatearPeriodo(202601)).toBe('Enero 2026')
  })
})
