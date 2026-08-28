'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { registrarEvento } from '@/lib/auditoria'
import { hashearCodigo } from '@/lib/codigo-activacion'
import { emailSinteticoDeCuil, normalizarCuil } from '@/lib/cuil'
import { leerEntornoServidor } from '@/lib/entorno'
import { clienteServidor } from '@/lib/supabase/cliente-servidor'
import { clienteServicio } from '@/lib/supabase/cliente-servicio'

// Mensaje único para CUIL desconocido y código incorrecto: no revela si un
// CUIL existe en el sistema.
const GENERICO = 'CUIL o código incorrectos.'

const esquema = z
  .object({
    cuil: z
      .string()
      .transform((v) => normalizarCuil(v))
      .refine((c): c is string => c !== null, 'El CUIL debe tener 11 dígitos'),
    codigo: z.string().trim().min(1, 'Ingresá el código de activación'),
    clave: z.string().min(8, 'La clave debe tener al menos 8 caracteres'),
    claveRepetida: z.string(),
  })
  .refine((d) => d.clave === d.claveRepetida, {
    message: 'Las claves no coinciden',
    path: ['claveRepetida'],
  })

export interface EstadoActivacion {
  error: string
  // Se devuelven para no perder lo tipeado cuando React resetea el form.
  cuil: string
  codigo: string
}

export async function activarCuenta(
  _estado: EstadoActivacion | null,
  datos: FormData,
): Promise<EstadoActivacion> {
  const cuilCrudo = String(datos.get('cuil') ?? '')
  const codigoCrudo = String(datos.get('codigo') ?? '')
  const conValores = (error: string): EstadoActivacion => ({ error, cuil: cuilCrudo, codigo: codigoCrudo })

  const analisis = esquema.safeParse({
    cuil: datos.get('cuil'),
    codigo: datos.get('codigo'),
    clave: datos.get('clave'),
    claveRepetida: datos.get('claveRepetida'),
  })
  if (!analisis.success) return conValores(analisis.error.issues[0].message)

  const { cuil, codigo, clave } = analisis.data
  const servicio = clienteServicio()

  const { data: persona } = await servicio
    .from('personas')
    .select('id, auth_user_id, estado')
    .eq('cuil', cuil)
    .maybeSingle()
  if (!persona) return conValores(GENERICO)
  if (persona.estado === 'bloqueado') {
    return conValores('Esta cuenta está bloqueada. Comunicate con la administración.')
  }

  const { data: codigoRow } = await servicio
    .from('codigos_activacion')
    .select('id, codigo_hash, expira_at')
    .eq('persona_id', persona.id)
    .is('usado_at', null)
    .is('anulado_at', null)
    .maybeSingle()
  if (!codigoRow) return conValores(GENERICO)
  if (new Date(codigoRow.expira_at) < new Date()) {
    return conValores('El código venció. Pedile uno nuevo a la administración.')
  }
  if (hashearCodigo(persona.id, codigo) !== codigoRow.codigo_hash) return conValores(GENERICO)

  const entorno = leerEntornoServidor(process.env)
  const email = emailSinteticoDeCuil(cuil, entorno.EMPLEADO_EMAIL_DOMAIN)

  let userId = persona.auth_user_id
  if (userId) {
    // Segundo código para una cuenta ya activada = reset de clave.
    const { error } = await servicio.auth.admin.updateUserById(userId, { password: clave })
    if (error) return conValores(`No se pudo actualizar la clave: ${error.message}`)
  } else {
    const { data: nuevo, error } = await servicio.auth.admin.createUser({
      email,
      password: clave,
      email_confirm: true,
    })
    if (error || !nuevo.user) return conValores(`No se pudo crear la cuenta: ${error?.message}`)
    userId = nuevo.user.id
    await servicio.from('personas').update({ auth_user_id: userId }).eq('id', persona.id)
  }

  await servicio.from('personas').update({ estado: 'activo' }).eq('id', persona.id)
  await servicio
    .from('codigos_activacion')
    .update({ usado_at: new Date().toISOString() })
    .eq('id', codigoRow.id)

  await registrarEvento({
    actorTipo: 'empleado',
    actorId: userId,
    accion: persona.auth_user_id ? 'cuenta.resetear_clave' : 'cuenta.activar',
    entidad: 'personas',
    entidadId: persona.id,
  })

  const supabase = await clienteServidor()
  const { error: errLogin } = await supabase.auth.signInWithPassword({ email, password: clave })
  if (errLogin) redirect('/mi/ingresar')
  redirect('/mi')
}
