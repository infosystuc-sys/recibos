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

  it('detiene el trabajo tras un fallo: no arranca tareas nuevas aunque las que ya estaban en vuelo terminen', async () => {
    const procesados: number[] = []

    await expect(
      subirConLimite([1, 2, 3, 4, 5, 6], 2, async (n) => {
        if (n === 2) throw new Error('falló el 2')
        await new Promise((r) => setTimeout(r, 20))
        procesados.push(n)
      }),
    ).rejects.toThrow('falló el 2')

    // El ítem 1 ya estaba en vuelo cuando el 2 falló: se deja terminar.
    // Pero ningún ítem nuevo (3, 4, 5, 6) debería arrancar después del
    // fallo. Esperamos bastante más que el tiempo que tomaría procesarlos
    // todos si el trabajador siguiera vivo tomando ítems nuevos.
    await new Promise((r) => setTimeout(r, 150))

    expect(procesados).toEqual([1])
  })

  it('rechaza un límite de concurrencia menor a 1 en vez de terminar sin procesar nada', async () => {
    const hechos: number[] = []
    await expect(
      subirConLimite([1, 2, 3], 0, async (n) => { hechos.push(n) }),
    ).rejects.toThrow(/límite/i)
    expect(hechos).toEqual([])
  })
})
