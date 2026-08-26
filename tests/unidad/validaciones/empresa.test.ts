import { describe, expect, it } from 'vitest'
import { esquemaEmpresa } from '@/lib/validaciones/empresa'

const base = {
  razonSocial: 'Delta 6 SA',
  cuit: '30-71234567-1',
  nombreCorto: 'Delta 6',
  textoConformidad: 'Presto conformidad total.',
}

describe('esquemaEmpresa', () => {
  it('normaliza el CUIT quitando los guiones', () => {
    expect(esquemaEmpresa.parse(base).cuit).toBe('30712345671')
  })

  it('rechaza un CUIT con dígito verificador inválido', () => {
    expect(() => esquemaEmpresa.parse({ ...base, cuit: '30-71234567-9' })).toThrow(/CUIT/)
  })

  it('rechaza una razón social vacía', () => {
    expect(() => esquemaEmpresa.parse({ ...base, razonSocial: '  ' })).toThrow(/[Rr]azón social/)
  })

  it('exige un texto de conformidad no trivial', () => {
    expect(() => esquemaEmpresa.parse({ ...base, textoConformidad: 'ok' })).toThrow(/conformidad/)
  })
})
