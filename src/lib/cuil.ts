/** Pesos del algoritmo módulo 11 usado por AFIP para CUIT/CUIL. */
const PESOS = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]

/**
 * Deja el CUIL en su forma canónica: 11 dígitos, sin guiones ni separadores.
 * Devuelve null si el valor no contiene exactamente 11 dígitos.
 */
export function normalizarCuil(valor: string): string | null {
  const digitos = valor.replace(/\D/g, '')
  return digitos.length === 11 ? digitos : null
}

/** '20271032758' → '20-27103275-8'. Espera un CUIL ya normalizado. */
export function formatearCuil(cuil: string): string {
  return `${cuil.slice(0, 2)}-${cuil.slice(2, 10)}-${cuil.slice(10)}`
}

/** Verifica el dígito verificador. Espera un CUIL ya normalizado. */
export function cuilValido(cuil: string): boolean {
  if (!/^\d{11}$/.test(cuil)) return false

  const suma = PESOS.reduce((acc, peso, i) => acc + peso * Number(cuil[i]), 0)
  const resto = suma % 11

  let verificador = 11 - resto
  if (verificador === 11) verificador = 0
  else if (verificador === 10) verificador = 9

  return verificador === Number(cuil[10])
}

/**
 * Email interno con el que el empleado existe en Supabase Auth.
 * El empleado nunca lo ve ni lo escribe: entra con su CUIL y la app traduce.
 */
export function emailSinteticoDeCuil(cuil: string, dominio: string): string {
  return `${cuil}@${dominio}`
}
