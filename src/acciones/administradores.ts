'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { registrarEvento } from '@/lib/auditoria'
import type { RolAdmin } from '@/lib/permisos'
import { exigirAdmin } from '@/lib/sesion'
import { clienteServicio } from '@/lib/supabase/cliente-servicio'

const esquema = z.object({
  nombre: z.string().trim().min(1, 'Ingresá el nombre'),
  email: z.string().trim().email('Ingresá un email válido'),
  rol: z.enum(['admin', 'operador', 'consulta']),
})

export async function invitarAdministrador(_estado: string | null, datos: FormData) {
  const admin = await exigirAdmin('administrar')

  const analisis = esquema.safeParse({
    nombre: datos.get('nombre'),
    email: datos.get('email'),
    rol: datos.get('rol'),
  })
  if (!analisis.success) return analisis.error.issues[0].message

  const supabase = clienteServicio()

  // Supabase le manda el correo de invitación y la persona define su clave.
  const { data, error } = await supabase.auth.admin.inviteUserByEmail(analisis.data.email)
  if (error) return `No se pudo invitar: ${error.message}`

  const { error: errorFicha } = await supabase.from('admin_usuarios').insert({
    id: data.user.id,
    nombre: analisis.data.nombre,
    email: analisis.data.email,
    rol: analisis.data.rol,
  })
  if (errorFicha) return `Se creó el usuario pero no su ficha: ${errorFicha.message}`

  await registrarEvento({
    actorTipo: 'admin',
    actorId: admin.id,
    accion: 'admin.invitar',
    entidad: 'admin_usuarios',
    entidadId: data.user.id,
    detalle: { rol: analisis.data.rol },
  })

  revalidatePath('/admin/usuarios')
  return null
}

export async function cambiarRol(usuarioId: string, rol: RolAdmin) {
  const admin = await exigirAdmin('administrar')
  if (usuarioId === admin.id) return 'No podés cambiar tu propio rol.'

  const supabase = clienteServicio()
  const { error } = await supabase.from('admin_usuarios').update({ rol }).eq('id', usuarioId)
  if (error) return `No se pudo cambiar el rol: ${error.message}`

  await registrarEvento({
    actorTipo: 'admin',
    actorId: admin.id,
    accion: 'admin.cambiar_rol',
    entidad: 'admin_usuarios',
    entidadId: usuarioId,
    detalle: { rol },
  })

  revalidatePath('/admin/usuarios')
  return null
}

export async function desactivarAdministrador(usuarioId: string) {
  const admin = await exigirAdmin('administrar')
  if (usuarioId === admin.id) return 'No podés desactivarte a vos mismo.'

  const supabase = clienteServicio()
  const { error } = await supabase.from('admin_usuarios').update({ activo: false }).eq('id', usuarioId)
  if (error) return `No se pudo desactivar: ${error.message}`

  await registrarEvento({
    actorTipo: 'admin',
    actorId: admin.id,
    accion: 'admin.desactivar',
    entidad: 'admin_usuarios',
    entidadId: usuarioId,
  })

  revalidatePath('/admin/usuarios')
  return null
}
