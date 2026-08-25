import { describe, expect, it } from 'vitest'
import { agruparEnLotes, type ArchivoEscaneado } from '@/lib/tango/agrupar-lotes'
import { parseNombreRecibo } from '@/lib/tango/parse-nombre-recibo'
import { cotejarLote, type LegajoPadron } from '@/lib/tango/cotejar-lote'

function archivo(nombre: string): ArchivoEscaneado {
  const datos = parseNombreRecibo(nombre)
  if (!datos) throw new Error(`nombre de prueba inválido: ${nombre}`)
  return { nombre, rutaRelativa: nombre, bytes: 45000, datos }
}

function loteDe(...nombres: string[]) {
  return agruparEnLotes(nombres.map(archivo))[0]
}

const PADRON: LegajoPadron[] = [
  { legajoId: 'l-201', numero: 201, cuil: '20271032758', nombre: 'Pérez, Ana', activo: true },
  { legajoId: 'l-202', numero: 202, cuil: '20192021414', nombre: 'Gómez, Luis', activo: true },
  { legajoId: 'l-203', numero: 203, cuil: '20316359214', nombre: 'Díaz, Sol', activo: false },
]

const SIN_EXISTENTES = { existentes: [], hashes: new Map<string, string>() }

describe('cotejarLote', () => {
  it('no reporta nada cuando el lote coincide con el padrón activo', () => {
    const lote = loteDe(
      'RS_202604_1QA_680_201_20-27103275-8.pdf',
      'RS_202604_1QA_680_202_20-19202141-4.pdf',
    )
    const padronActivo = PADRON.filter((l) => l.activo)

    const resultado = cotejarLote({ lote, padron: padronActivo, ...SIN_EXISTENTES })

    expect(resultado.diagnosticos).toEqual([])
    expect(resultado.hayBloqueantes).toBe(false)
    expect(resultado.publicables).toHaveLength(2)
  })

  it('marca como bloqueante un legajo que no existe en el padrón', () => {
    const lote = loteDe('RS_202604_1QA_680_999_20-27103275-8.pdf')

    const resultado = cotejarLote({ lote, padron: PADRON, ...SIN_EXISTENTES })

    expect(resultado.diagnosticos).toContainEqual(
      expect.objectContaining({ codigo: 'LEGAJO_INEXISTENTE', severidad: 'bloqueante', legajo: 999 }),
    )
    expect(resultado.hayBloqueantes).toBe(true)
    expect(resultado.publicables).toHaveLength(0)
  })

  it('marca como bloqueante un legajo cuyo CUIL no coincide con el del padrón', () => {
    // El legajo 201 en el padrón es 20271032758, pero el archivo trae el de otra persona.
    const lote = loteDe('RS_202604_1QA_680_201_20-19202141-4.pdf')

    const resultado = cotejarLote({ lote, padron: PADRON, ...SIN_EXISTENTES })

    expect(resultado.diagnosticos).toContainEqual(
      expect.objectContaining({ codigo: 'CUIL_NO_COINCIDE', severidad: 'bloqueante', legajo: 201 }),
    )
    expect(resultado.hayBloqueantes).toBe(true)
  })

  it('advierte cuando el empleado está inactivo pero deja publicar', () => {
    const lote = loteDe('RS_202604_1QA_680_203_20-31635921-4.pdf')

    const resultado = cotejarLote({ lote, padron: PADRON, ...SIN_EXISTENTES })

    expect(resultado.diagnosticos).toContainEqual(
      expect.objectContaining({ codigo: 'EMPLEADO_INACTIVO', severidad: 'advertencia', legajo: 203 }),
    )
    expect(resultado.hayBloqueantes).toBe(false)
    expect(resultado.publicables).toHaveLength(1)
  })

  it('advierte cuando falta en el lote un legajo activo del padrón', () => {
    const lote = loteDe('RS_202604_1QA_680_201_20-27103275-8.pdf')
    const padronActivo = PADRON.filter((l) => l.activo)

    const resultado = cotejarLote({ lote, padron: padronActivo, ...SIN_EXISTENTES })

    expect(resultado.diagnosticos).toContainEqual(
      expect.objectContaining({ codigo: 'FALTA_EN_LOTE', severidad: 'advertencia', legajo: 202 }),
    )
  })

  it('bloquea cuando el mismo legajo aparece dos veces en el lote', () => {
    const uno = archivo('RS_202604_1QA_680_201_20-27103275-8.pdf')
    const otro = { ...uno, nombre: 'copia.pdf', rutaRelativa: 'sub/RS_202604_1QA_680_201_20-27103275-8.pdf' }
    const lote = agruparEnLotes([uno, otro])[0]

    const resultado = cotejarLote({ lote, padron: PADRON, ...SIN_EXISTENTES })

    expect(resultado.diagnosticos).toContainEqual(
      expect.objectContaining({ codigo: 'DUPLICADO_EN_LOTE', severidad: 'bloqueante', legajo: 201 }),
    )
    expect(resultado.hayBloqueantes).toBe(true)
  })

  it('saltea sin error un archivo ya subido con el mismo contenido', () => {
    const lote = loteDe('RS_202604_1QA_680_201_20-27103275-8.pdf')
    const hashes = new Map([['RS_202604_1QA_680_201_20-27103275-8.pdf', 'abc123']])

    const resultado = cotejarLote({
      lote,
      padron: PADRON,
      existentes: [{ legajo: 201, sha256: 'abc123' }],
      hashes,
    })

    expect(resultado.diagnosticos).toContainEqual(
      expect.objectContaining({ codigo: 'YA_SUBIDO', severidad: 'informativo', legajo: 201 }),
    )
    expect(resultado.publicables).toHaveLength(0)
    expect(resultado.hayBloqueantes).toBe(false)
  })

  it('detecta un reemplazo cuando cambia el contenido del mismo legajo', () => {
    const lote = loteDe('RS_202604_1QA_680_201_20-27103275-8.pdf')
    const hashes = new Map([['RS_202604_1QA_680_201_20-27103275-8.pdf', 'nuevo999']])

    const resultado = cotejarLote({
      lote,
      padron: PADRON,
      existentes: [{ legajo: 201, sha256: 'viejo111' }],
      hashes,
    })

    expect(resultado.diagnosticos).toContainEqual(
      expect.objectContaining({ codigo: 'REEMPLAZO', severidad: 'advertencia', legajo: 201 }),
    )
    expect(resultado.publicables).toHaveLength(1)
  })
})
