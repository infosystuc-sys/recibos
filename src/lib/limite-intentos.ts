import 'server-only'

import { headers } from 'next/headers'
import { clienteServicio } from '@/lib/supabase/cliente-servicio'

async function ip(): Promise<string> {
  const h = await headers()
  return h.get('x-forwarded-for')?.split(',')[0]?.trim() || 'desconocida'
}

/**
 * Registra un intento y devuelve `true` si se pasó del límite en la ventana.
 * `ventana` en minutos.
 */
export async function excedeLimite(
  accion: string,
  identificador: string,
  maximo: number,
  ventanaMin: number,
): Promise<boolean> {
  const servicio = clienteServicio()
  const { data, error } = await servicio.rpc('registrar_intento', {
    p_clave: `${accion}:${identificador}`,
    p_ventana: `${ventanaMin} minutes`,
  })
  if (error) {
    // Si el contador falla, no bloqueamos al usuario legítimo.
    console.error('registrar_intento falló', error)
    return false
  }
  return (data as number) > maximo
}

/** Chequea límite por CUIL y por IP a la vez. */
export async function excedeLimiteCuilOIp(
  accion: string,
  cuil: string,
  limites: { porCuil: number; porIp: number; ventanaMin: number },
): Promise<boolean> {
  const [porCuil, porIp] = await Promise.all([
    excedeLimite(`${accion}:cuil`, cuil, limites.porCuil, limites.ventanaMin),
    excedeLimite(`${accion}:ip`, await ip(), limites.porIp, limites.ventanaMin),
  ])
  return porCuil || porIp
}
