export type RolAdmin = 'admin' | 'operador' | 'consulta'
export type Accion = 'ver' | 'operar' | 'administrar'

const NIVEL: Record<RolAdmin, number> = { consulta: 0, operador: 1, admin: 2 }
const EXIGE: Record<Accion, number> = { ver: 0, operar: 1, administrar: 2 }

/** `ver`: consultar. `operar`: importar, subir, publicar. `administrar`: empresas y usuarios. */
export function puede(rol: RolAdmin, accion: Accion): boolean {
  return NIVEL[rol] >= EXIGE[accion]
}
