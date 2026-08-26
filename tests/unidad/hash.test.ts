import { describe, expect, it } from 'vitest'
import { rutaStorage, sha256Hex } from '@/lib/hash'

describe('sha256Hex', () => {
  it('coincide con el vector conocido de la cadena vacía', async () => {
    expect(await sha256Hex(new ArrayBuffer(0)))
      .toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
  })

  it('coincide con el vector conocido de "abc"', async () => {
    expect(await sha256Hex(new TextEncoder().encode('abc').buffer as ArrayBuffer))
      .toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })
})

describe('rutaStorage', () => {
  it('arma la ruta del bucket', () => {
    expect(rutaStorage('emp-1', 202604, '1QA', 680, 201, 1)).toBe('emp-1/202604/1QA-680/201-v1.pdf')
  })

  it('refleja la versión en el nombre', () => {
    expect(rutaStorage('emp-1', 202604, 'MEN', 679, 1, 2)).toBe('emp-1/202604/MEN-679/1-v2.pdf')
  })
})
