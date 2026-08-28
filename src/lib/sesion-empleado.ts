import 'server-only'

import { redirect } from 'next/navigation'
import { clienteServidor } from '@/lib/supabase/cliente-servidor'

export interface EmpleadoSesion {
  id: string
  cuil: string
  apellidoNombre: string
}

/** La persona del empleado autenticado, o null si no hay sesión activa. */
export async function obtenerEmpleado(): Promise<EmpleadoSesion | null> {
  const supabase = await clienteServidor()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return null

  // La política RLS `empleado_lee_su_persona` solo devuelve la fila si la
  // persona está `activo`, así que esto ya filtra pendientes y bloqueados.
  const { data } = await supabase
    .from('personas')
    .select('id, cuil, apellido_nombre')
    .eq('auth_user_id', auth.user.id)
    .maybeSingle()

  if (!data) return null
  return { id: data.id, cuil: data.cuil, apellidoNombre: data.apellido_nombre }
}

/** Corta la ejecución y manda a /mi/ingresar si no hay empleado con sesión. */
export async function exigirEmpleado(): Promise<EmpleadoSesion> {
  const empleado = await obtenerEmpleado()
  if (!empleado) redirect('/mi/ingresar')
  return empleado
}
