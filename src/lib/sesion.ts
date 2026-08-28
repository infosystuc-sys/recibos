import 'server-only'

import { redirect } from 'next/navigation'
import { puede, type Accion, type RolAdmin } from '@/lib/permisos'
import { clienteServidor } from '@/lib/supabase/cliente-servidor'

export interface AdminSesion {
  id: string
  nombre: string
  email: string
  rol: RolAdmin
}

export async function obtenerAdmin(): Promise<AdminSesion | null> {
  const supabase = await clienteServidor()
  const { data: sesion } = await supabase.auth.getUser()
  if (!sesion.user) return null

  const { data } = await supabase
    .from('admin_usuarios')
    .select('id, nombre, email, rol, activo')
    .eq('id', sesion.user.id)
    .maybeSingle()

  if (!data || !data.activo) return null
  return { id: data.id, nombre: data.nombre, email: data.email, rol: data.rol }
}

/** Corta la ejecución si no hay administrador con permiso suficiente. */
export async function exigirAdmin(accion: Accion = 'ver'): Promise<AdminSesion> {
  const admin = await obtenerAdmin()
  if (!admin) redirect('/ingresar')
  if (!puede(admin.rol, accion)) {
    throw new Error(`Tu rol (${admin.rol}) no permite esta acción.`)
  }
  return admin
}
