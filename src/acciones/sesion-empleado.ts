'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { emailSinteticoDeCuil, normalizarCuil } from '@/lib/cuil'
import { leerEntornoServidor } from '@/lib/entorno'
import { excedeLimiteCuilOIp } from '@/lib/limite-intentos'
import { clienteServidor } from '@/lib/supabase/cliente-servidor'
import { clienteServicio } from '@/lib/supabase/cliente-servicio'

const esquema = z.object({
  cuil: z
    .string()
    .transform((v) => normalizarCuil(v))
    .refine((c): c is string => c !== null, 'El CUIL debe tener 11 dígitos'),
  clave: z.string().min(1, 'Ingresá tu clave'),
})

export interface EstadoIngreso {
  error: string
  cuil: string
}

export async function ingresarEmpleado(
  _estado: EstadoIngreso | null,
  datos: FormData,
): Promise<EstadoIngreso> {
  const cuilCrudo = String(datos.get('cuil') ?? '')
  const conCuil = (error: string): EstadoIngreso => ({ error, cuil: cuilCrudo })

  const analisis = esquema.safeParse({ cuil: datos.get('cuil'), clave: datos.get('clave') })
  if (!analisis.success) return conCuil(analisis.error.issues[0].message)

  const { cuil, clave } = analisis.data

  if (await excedeLimiteCuilOIp('login', cuil, { porCuil: 10, porIp: 30, ventanaMin: 15 })) {
    return conCuil('Demasiados intentos. Esperá unos minutos y probá de nuevo.')
  }

  const entorno = leerEntornoServidor(process.env)
  const email = emailSinteticoDeCuil(cuil, entorno.EMPLEADO_EMAIL_DOMAIN)

  const supabase = await clienteServidor()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: clave })
  if (error || !data.user) return conCuil('CUIL o clave incorrectos.')

  // Un empleado bloqueado puede tener credenciales válidas: se corta acá.
  const servicio = clienteServicio()
  const { data: persona } = await servicio
    .from('personas')
    .select('estado')
    .eq('auth_user_id', data.user.id)
    .maybeSingle()
  if (!persona || persona.estado === 'bloqueado') {
    await supabase.auth.signOut()
    return conCuil('Esta cuenta está bloqueada. Comunicate con la administración.')
  }

  redirect('/mi')
}

export async function salirEmpleado() {
  const supabase = await clienteServidor()
  await supabase.auth.signOut()
  redirect('/mi/ingresar')
}
