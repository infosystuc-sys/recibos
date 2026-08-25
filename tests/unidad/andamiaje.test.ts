import { describe, expect, it } from 'vitest'

describe('andamiaje', () => {
  it('resuelve el alias @/ hacia src/', async () => {
    const modulo = await import('@/lib/version')
    expect(modulo.NOMBRE_APP).toBe('Conforme')
  })
})
