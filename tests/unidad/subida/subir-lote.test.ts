import { describe, expect, it } from 'vitest'
import { subirConLimite } from '@/lib/subida/subir-lote'

describe('subirConLimite', () => {
  it('procesa todos los elementos', async () => {
    const hechos: number[] = []
    await subirConLimite([1, 2, 3, 4, 5], 2, async (n) => { hechos.push(n) })
    expect(hechos.sort()).toEqual([1, 2, 3, 4, 5])
  })

  it('nunca supera el límite de concurrencia', async () => {
    let enVuelo = 0
    let pico = 0

    await subirConLimite(Array.from({ length: 20 }, (_, i) => i), 5, async () => {
      enVuelo++
      pico = Math.max(pico, enVuelo)
      await new Promise((r) => setTimeout(r, 5))
      enVuelo--
    })

    expect(pico).toBeLessThanOrEqual(5)
    expect(pico).toBeGreaterThan(1)
  })

  it('informa el avance', async () => {
    const avances: number[] = []
    await subirConLimite([1, 2, 3], 1, async () => {}, (hechos) => avances.push(hechos))
    expect(avances).toEqual([1, 2, 3])
  })

  it('propaga el error y no deja tareas colgadas', async () => {
    await expect(
      subirConLimite([1, 2, 3], 2, async (n) => {
        if (n === 2) throw new Error('falló el 2')
      }),
    ).rejects.toThrow('falló el 2')
  })
})
