import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SERVICIO = process.env.SUPABASE_SERVICE_ROLE_KEY!
const DOMINIO = process.env.EMPLEADO_EMAIL_DOMAIN ?? 'empleados.conforme.local'

const servicio = createClient(URL, SERVICIO, { auth: { persistSession: false } })

// Identificadores propios de este archivo: no deben chocar con rls.test.ts,
// que corre en paralelo contra la misma base (ver trampa #4 de docs/ESTADO.md).
const CUIL = '20160210010'
const CLAVE = 'prueba-publicar-2026'
const RAZON_SOCIAL = 'Publicar Test SA'
const CUIT = '30888888888'
const EMAIL_ADMIN = `publicar-admin-test@${DOMINIO}`

let empresaId: string
let legajoId: string
let personaId: string
let usuarioEmpleado: string | undefined
let usuarioAdmin: string | undefined
let liquidacionId: string
let clienteEmpleado: SupabaseClient

async function limpiar(paso: string, accion: () => PromiseLike<{ error: unknown }>) {
  try {
    const { error } = await accion()
    if (error) console.warn(`Limpieza (${paso}) con error no fatal:`, error)
  } catch (error) {
    console.warn(`Limpieza (${paso}) con excepción no fatal:`, error)
  }
}

async function borrarUsuario(email: string) {
  try {
    for (let pagina = 1; pagina <= 50; pagina++) {
      const { data } = await servicio.auth.admin.listUsers({ page: pagina, perPage: 200 })
      if (!data) return
      const u = data.users.find((x) => x.email === email)
      if (u) {
        await servicio.auth.admin.deleteUser(u.id)
        return
      }
      if (data.users.length < 200) return
    }
  } catch (error) {
    console.warn(`No se pudo borrar el usuario ${email}:`, error)
  }
}

async function limpiezaDefensiva() {
  const { data: emps } = await servicio.from('empresas').select('id').eq('razon_social', RAZON_SOCIAL)
  for (const e of emps ?? []) {
    const { data: liqs } = await servicio.from('liquidaciones').select('id').eq('empresa_id', e.id)
    for (const q of liqs ?? []) {
      await limpiar('recibos previos', () => servicio.from('recibos').delete().eq('liquidacion_id', q.id))
    }
    await limpiar('liquidaciones previas', () => servicio.from('liquidaciones').delete().eq('empresa_id', e.id))
    await limpiar('legajos previos', () => servicio.from('legajos').delete().eq('empresa_id', e.id))
    await limpiar('empresa previa', () => servicio.from('empresas').delete().eq('id', e.id))
  }
  await limpiar('persona previa', () => servicio.from('personas').delete().eq('cuil', CUIL))
  await limpiar('admin previo', () => servicio.from('admin_usuarios').delete().eq('email', EMAIL_ADMIN))
  await borrarUsuario(`${CUIL}@${DOMINIO}`)
  await borrarUsuario(EMAIL_ADMIN)
}

beforeAll(async () => {
  await limpiezaDefensiva()

  const { data: empresa } = await servicio
    .from('empresas')
    .insert({ razon_social: RAZON_SOCIAL, cuit: CUIT, nombre_corto: 'Publicar' })
    .select('id')
    .single()
  empresaId = empresa!.id

  const { data: usuario } = await servicio.auth.admin.createUser({
    email: `${CUIL}@${DOMINIO}`,
    password: CLAVE,
    email_confirm: true,
  })
  usuarioEmpleado = usuario.user!.id

  const { data: persona } = await servicio
    .from('personas')
    .insert({ cuil: CUIL, apellido_nombre: 'Publicar, Ana', auth_user_id: usuarioEmpleado, estado: 'activo' })
    .select('id')
    .single()
  personaId = persona!.id

  const { data: legajo } = await servicio
    .from('legajos')
    .insert({ empresa_id: empresaId, persona_id: personaId, numero: 950 })
    .select('id')
    .single()
  legajoId = legajo!.id

  const { data: adminUsuario } = await servicio.auth.admin.createUser({
    email: EMAIL_ADMIN,
    password: CLAVE,
    email_confirm: true,
  })
  usuarioAdmin = adminUsuario.user!.id
  await servicio
    .from('admin_usuarios')
    .insert({ id: usuarioAdmin, nombre: 'Admin Publicar', email: EMAIL_ADMIN, rol: 'operador' })

  const { data: liquidacion } = await servicio
    .from('liquidaciones')
    .insert({ empresa_id: empresaId, periodo: 202608, tipo: 'MEN', dato_fijo: 9500 })
    .select('id')
    .single()
  liquidacionId = liquidacion!.id

  // Estado tras dos ingestas (registrarRecibos baja la vigente antes de
  // insertar la nueva, igual que acá): v1 reemplazada, v2 vigente.
  await servicio.from('recibos').insert({
    liquidacion_id: liquidacionId,
    legajo_id: legajoId,
    version: 1,
    storage_path: `${empresaId}/202608/MEN-9500/950-v1.pdf`,
    nombre_original: 'v1.pdf',
    sha256: 'a'.repeat(64),
    bytes: 100,
    cuil_archivo: CUIL,
  })
  await servicio.from('recibos').update({ estado: 'reemplazado' }).eq('liquidacion_id', liquidacionId)
  await servicio.from('recibos').insert({
    liquidacion_id: liquidacionId,
    legajo_id: legajoId,
    version: 2,
    storage_path: `${empresaId}/202608/MEN-9500/950-v2.pdf`,
    nombre_original: 'v2.pdf',
    sha256: 'b'.repeat(64),
    bytes: 100,
    cuil_archivo: CUIL,
  })

  clienteEmpleado = createClient(URL, ANON, { auth: { persistSession: false } })
  await clienteEmpleado.auth.signInWithPassword({ email: `${CUIL}@${DOMINIO}`, password: CLAVE })
}, 60_000)

afterAll(async () => {
  if (liquidacionId) {
    await limpiar('recibos', () => servicio.from('recibos').delete().eq('liquidacion_id', liquidacionId))
    await limpiar('liquidaciones', () => servicio.from('liquidaciones').delete().eq('id', liquidacionId))
  }
  if (empresaId) {
    await limpiar('legajos', () => servicio.from('legajos').delete().eq('empresa_id', empresaId))
    await limpiar('empresas', () => servicio.from('empresas').delete().eq('id', empresaId))
  }
  if (personaId) await limpiar('personas', () => servicio.from('personas').delete().eq('id', personaId))
  if (usuarioAdmin) await limpiar('admin_usuarios', () => servicio.from('admin_usuarios').delete().eq('id', usuarioAdmin!))
  for (const id of [usuarioEmpleado, usuarioAdmin].filter((x): x is string => Boolean(x))) {
    await limpiar(`auth ${id}`, async () => {
      const { error } = await servicio.auth.admin.deleteUser(id)
      return { error }
    })
  }
})

describe('publicar_liquidacion', () => {
  it('una liquidación en borrador no es visible para el empleado', async () => {
    const { data } = await clienteEmpleado.from('recibos').select('id')
    expect(data).toEqual([])
  })

  it('publicar deja una sola versión vigente por legajo', async () => {
    const { data, error } = await servicio.rpc('publicar_liquidacion', {
      p_liquidacion: liquidacionId,
      p_admin: usuarioAdmin!,
    })
    expect(error).toBeNull()
    expect(data).toBe(1)

    const { data: recibos } = await servicio
      .from('recibos')
      .select('version, estado')
      .eq('liquidacion_id', liquidacionId)
      .order('version')
    expect(recibos).toEqual([
      { version: 1, estado: 'reemplazado' },
      { version: 2, estado: 'vigente' },
    ])

    const { data: liq } = await servicio
      .from('liquidaciones')
      .select('estado, publicada_at, publicada_por')
      .eq('id', liquidacionId)
      .single()
    expect(liq!.estado).toBe('publicada')
    expect(liq!.publicada_at).not.toBeNull()
    expect(liq!.publicada_por).toBe(usuarioAdmin)
  })

  it('publicar dos veces la misma liquidación falla', async () => {
    const { error } = await servicio.rpc('publicar_liquidacion', {
      p_liquidacion: liquidacionId,
      p_admin: usuarioAdmin!,
    })
    expect(error).not.toBeNull()
    expect(error!.message).toMatch(/ya está publicada/i)
  })

  it('tras publicar, el empleado ve el recibo de su liquidación', async () => {
    // Nota: la política de `recibos` NO filtra por estado, así que también
    // devuelve la versión reemplazada. El portal del empleado (Fase 1B) debe
    // filtrar `estado = 'vigente'` en la consulta o endurecer la política.
    const { data } = await clienteEmpleado.from('recibos').select('version, estado')
    expect(data?.some((r) => r.version === 2 && r.estado === 'vigente')).toBe(true)
  })
})
