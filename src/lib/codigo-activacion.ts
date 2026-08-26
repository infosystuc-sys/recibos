import { createHash, randomInt } from 'node:crypto'

/**
 * Sin O/0, I/1/l, S/5 ni B/V (B y V suenan igual en español rioplatense):
 * el código se dicta por teléfono o se copia de un papel.
 */
const ALFABETO = 'ABCDEFGHJKMNPQRTUWXYZ2346789'
const LARGO = 8

export function generarCodigo(): string {
  let codigo = ''
  for (let i = 0; i < LARGO; i++) {
    codigo += ALFABETO[randomInt(ALFABETO.length)]
  }
  return codigo
}

/**
 * El id de la persona actúa como sal: dos personas con el mismo código
 * producen hashes distintos, y el hash almacenado no sirve fuera de su fila.
 */
export function hashearCodigo(personaId: string, codigo: string): string {
  const normalizado = codigo.replace(/\s+/g, '').toUpperCase()
  return createHash('sha256').update(`${personaId}:${normalizado}`).digest('hex')
}
