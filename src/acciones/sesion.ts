'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { clienteServidor } from '@/lib/supabase/cliente-servidor'

const esquema = z.object({
  email: z.string().email('Ingresá un email válido'),
  clave: z.string().min(1, 'Ingresá tu contraseña'),
})

export async function ingresarAdmin(_estado: string | null, datos: FormData) {
  const analisis = esquema.safeParse({
    email: datos.get('email'),
    clave: datos.get('clave'),
  })
  if (!analisis.success) {
    return analisis.error.issues[0].message
  }

  const supabase = await clienteServidor()
  const { error } = await supabase.auth.signInWithPassword({
    email: analisis.data.email,
    password: analisis.data.clave,
  })

  if (error) return 'Email o contraseña incorrectos.'
  redirect('/admin')
}

export async function salir() {
  const supabase = await clienteServidor()
  await supabase.auth.signOut()
  redirect('/ingresar')
}
