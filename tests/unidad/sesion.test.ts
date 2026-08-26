import { describe, expect, it } from 'vitest'
import { puede } from '@/lib/permisos'

describe('puede', () => {
  it('consulta solo lee', () => {
    expect(puede('consulta', 'ver')).toBe(true)
    expect(puede('consulta', 'operar')).toBe(false)
    expect(puede('consulta', 'administrar')).toBe(false)
  })

  it('operador lee y opera pero no administra', () => {
    expect(puede('operador', 'ver')).toBe(true)
    expect(puede('operador', 'operar')).toBe(true)
    expect(puede('operador', 'administrar')).toBe(false)
  })

  it('admin puede todo', () => {
    expect(puede('admin', 'ver')).toBe(true)
    expect(puede('admin', 'operar')).toBe(true)
    expect(puede('admin', 'administrar')).toBe(true)
  })
})
