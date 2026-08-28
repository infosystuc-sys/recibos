import { describe, expect, it } from 'vitest'
import { aWhatsapp } from '@/lib/telefono'

describe('aWhatsapp', () => {
  it('deja pasar un número ya en formato internacional', () => {
    expect(aWhatsapp('5491122334455')).toBe('5491122334455')
  })

  it('agrega el código de país argentino y el 9 de celular', () => {
    expect(aWhatsapp('1122334455')).toBe('5491122334455')
  })

  it('normaliza el formato con separadores y 0 de trunk', () => {
    expect(aWhatsapp('011 2233-4455')).toBe('5491122334455')
    expect(aWhatsapp('+54 9 11 2233 4455')).toBe('5491122334455')
  })

  it('saca el viejo prefijo 15 de celular', () => {
    expect(aWhatsapp('011 15 2233-4455')).toBe('5491122334455')
  })

  it('respeta otro código de país', () => {
    expect(aWhatsapp('+1 555 123 4567', '1')).toBe('15551234567')
  })

  it('devuelve null si no hay dígitos o queda demasiado corto', () => {
    expect(aWhatsapp('')).toBeNull()
    expect(aWhatsapp('sin numero')).toBeNull()
    expect(aWhatsapp('123')).toBeNull()
    expect(aWhatsapp(null)).toBeNull()
  })
})
