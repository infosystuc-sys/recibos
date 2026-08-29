import { describe, expect, it } from 'vitest'
import { parsearCsvPadron } from '@/lib/padron/parse-csv-padron'

const CABECERA = 'legajo;cuil;apellido_nombre;email;telefono;sector;activo'

describe('parsearCsvPadron', () => {
  it('lee una fila completa', () => {
    const { filas, errores } = parsearCsvPadron(
      `${CABECERA}\n201;20-27103275-8;Pérez, Ana;ana@ejemplo.com;3814000000;Administración;SI`,
    )

    expect(errores).toEqual([])
    expect(filas).toEqual([
      {
        legajo: 201,
        cuil: '20271032758',
        apellidoNombre: 'Pérez, Ana',
        email: 'ana@ejemplo.com',
        telefono: '3814000000',
        sector: 'Administración',
        activo: true,
      },
    ])
  })

  it('arma "Apellido, Nombre" con las columnas apellido y nombre separadas', () => {
    const { filas, errores } = parsearCsvPadron(
      'legajo;apellido;nombre;cuil;mail;celular\n201;Pérez;Ana;20-27103275-8;ana@x.com;3814000000',
    )
    expect(errores).toEqual([])
    expect(filas[0]).toMatchObject({
      legajo: 201,
      apellidoNombre: 'Pérez, Ana',
      email: 'ana@x.com',
      telefono: '3814000000',
    })
  })

  it('acepta la plantilla con acentos y espacios en los encabezados', () => {
    const { filas, errores } = parsearCsvPadron(
      'Número de legajo;Apellido;Nombre;CUIL;Mail;Celular\n7;Gómez;Luis;27-20012949-6;;',
    )
    expect(errores).toEqual([])
    expect(filas[0]).toMatchObject({ legajo: 7, apellidoNombre: 'Gómez, Luis', email: null, telefono: null })
  })

  it('acepta tabulador como separador (Excel guardado como texto)', () => {
    const csv =
      'Número de legajo\tApellido\tNombre\tCUIL\tMail\tCelular\n' +
      '1\tGonzález\tAlejandra\t27-20012949-6\tag@x.com\t'
    const { filas, errores } = parsearCsvPadron(csv)
    expect(errores).toEqual([])
    expect(filas[0]).toMatchObject({ legajo: 1, apellidoNombre: 'González, Alejandra', email: 'ag@x.com' })
  })

  it('acepta coma como separador', () => {
    const { filas } = parsearCsvPadron(
      'legajo,cuil,apellido_nombre\n201,20271032758,"Pérez, Ana"',
    )
    expect(filas[0].apellidoNombre).toBe('Pérez, Ana')
  })

  it('deja en null las columnas opcionales ausentes', () => {
    const { filas } = parsearCsvPadron('legajo;cuil;apellido_nombre\n1;27-20012949-6;Gómez, Luis')
    expect(filas[0]).toMatchObject({ email: null, telefono: null, sector: null, activo: true })
  })

  it('interpreta el campo activo en sus variantes habituales', () => {
    const csv = `${CABECERA}\n1;27-20012949-6;A;;;;NO\n2;20-16021001-0;B;;;;0\n3;20-27103275-8;C;;;;S`
    const { filas } = parsearCsvPadron(csv)
    expect(filas.map((f) => f.activo)).toEqual([false, false, true])
  })

  it('reporta un CUIL con dígito verificador inválido sin cortar la importación', () => {
    const csv = `${CABECERA}\n201;20-27103275-9;Pérez, Ana;;;;SI\n202;20-19202141-4;Gómez, Luis;;;;SI`
    const { filas, errores } = parsearCsvPadron(csv)

    expect(filas).toHaveLength(1)
    expect(errores).toHaveLength(1)
    expect(errores[0]).toMatchObject({ linea: 2, motivo: expect.stringMatching(/CUIL/) })
  })

  it('reporta un legajo no numérico', () => {
    const { errores } = parsearCsvPadron(`${CABECERA}\nABC;20-27103275-8;Pérez, Ana;;;;SI`)
    expect(errores[0].motivo).toMatch(/legajo/i)
  })

  it('reporta legajos duplicados dentro del archivo', () => {
    const csv = `${CABECERA}\n201;20-27103275-8;A;;;;SI\n201;20-19202141-4;B;;;;SI`
    const { filas, errores } = parsearCsvPadron(csv)

    expect(filas).toHaveLength(1)
    expect(errores[0].motivo).toMatch(/duplicad/i)
  })

  it('falla con mensaje claro si faltan columnas obligatorias', () => {
    const { errores } = parsearCsvPadron('legajo;nombre\n201;Ana')
    expect(errores[0].motivo).toMatch(/cuil/i)
  })

  it('ignora líneas en blanco', () => {
    const { filas, errores } = parsearCsvPadron(`${CABECERA}\n\n201;20-27103275-8;Ana;;;;SI\n\n`)
    expect(filas).toHaveLength(1)
    expect(errores).toEqual([])
  })

  it('reporta un valor desconocido en la columna activo en vez de marcar inactivo en silencio', () => {
    const { filas, errores } = parsearCsvPadron(`${CABECERA}\n201;20-27103275-8;Pérez, Ana;;;;Vigente`)

    expect(filas).toHaveLength(0)
    expect(errores).toHaveLength(1)
    expect(errores[0].motivo).toMatch(/activo/i)
    expect(errores[0].motivo).toContain('Vigente')
  })
})
