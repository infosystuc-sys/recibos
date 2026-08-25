import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SERVICIO = process.env.SUPABASE_SERVICE_ROLE_KEY!
const DOMINIO = process.env.EMPLEADO_EMAIL_DOMAIN ?? 'empleados.conforme.local'

const servicio = createClient(URL, SERVICIO, { auth: { persistSession: false } })

const CUIL_ANA = '20271032758'
const CUIL_LUIS = '20192021414'
const CLAVE = 'prueba-rls-2026'

let empresaId: string
let personaAna: string
let personaLuis: string
let reciboAna: string
let reciboLuis: string
let usuarioAna: string
let usuarioLuis: string
let clienteAna: SupabaseClient

async function crearEmpleado(cuil: string, nombre: string, legajo: number) {
  const { data: usuario, error: errUsuario } = await servicio.auth.admin.createUser({
    email: `${cuil}@${DOMINIO}`,
    password: CLAVE,
    email_confirm: true,
  })
  if (errUsuario) throw errUsuario

  const { data: persona, error: errPersona } = await servicio
    .from('personas')
    .insert({ cuil, apellido_nombre: nombre, auth_user_id: usuario.user.id, estado: 'activo' })
    .select('id')
    .single()
  if (errPersona) throw errPersona

  const { data: leg, error: errLegajo } = await servicio
    .from('legajos')
    .insert({ empresa_id: empresaId, persona_id: persona.id, numero: legajo })
    .select('id')
    .single()
  if (errLegajo) throw errLegajo

  return { usuarioId: usuario.user.id, personaId: persona.id, legajoId: leg.id }
}

beforeAll(async () => {
  const { data: empresa } = await servicio
    .from('empresas')
    .insert({ razon_social: 'RLS Test SA', cuit: '30999999990', nombre_corto: 'RLS Test' })
    .select('id')
    .single()
  empresaId = empresa!.id

  const ana = await crearEmpleado(CUIL_ANA, 'Prueba, Ana', 901)
  const luis = await crearEmpleado(CUIL_LUIS, 'Prueba, Luis', 902)
  personaAna = ana.personaId
  personaLuis = luis.personaId
  usuarioAna = ana.usuarioId
  usuarioLuis = luis.usuarioId

  const { data: liquidacion } = await servicio
    .from('liquidaciones')
    .insert({
      empresa_id: empresaId, periodo: 202604, tipo: 'MEN', dato_fijo: 9999,
      estado: 'publicada', publicada_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  const { data: borrador } = await servicio
    .from('liquidaciones')
    .insert({ empresa_id: empresaId, periodo: 202605, tipo: 'MEN', dato_fijo: 9998 })
    .select('id')
    .single()

  const recibos = await servicio
    .from('recibos')
    .insert([
      {
        liquidacion_id: liquidacion!.id, legajo_id: ana.legajoId,
        storage_path: `${empresaId}/202604/MEN-9999/901-v1.pdf`,
        nombre_original: 'a.pdf', sha256: 'a'.repeat(64), bytes: 100, cuil_archivo: CUIL_ANA,
      },
      {
        liquidacion_id: liquidacion!.id, legajo_id: luis.legajoId,
        storage_path: `${empresaId}/202604/MEN-9999/902-v1.pdf`,
        nombre_original: 'b.pdf', sha256: 'b'.repeat(64), bytes: 100, cuil_archivo: CUIL_LUIS,
      },
      {
        liquidacion_id: borrador!.id, legajo_id: ana.legajoId,
        storage_path: `${empresaId}/202605/MEN-9998/901-v1.pdf`,
        nombre_original: 'c.pdf', sha256: 'c'.repeat(64), bytes: 100, cuil_archivo: CUIL_ANA,
      },
    ])
    .select('id, legajo_id, liquidacion_id')

  reciboAna = recibos.data!.find(
    (r) => r.legajo_id === ana.legajoId && r.liquidacion_id === liquidacion!.id,
  )!.id
  reciboLuis = recibos.data!.find((r) => r.legajo_id === luis.legajoId)!.id

  clienteAna = createClient(URL, ANON, { auth: { persistSession: false } })
  const { error } = await clienteAna.auth.signInWithPassword({
    email: `${CUIL_ANA}@${DOMINIO}`,
    password: CLAVE,
  })
  if (error) throw error
}, 60_000)

afterAll(async () => {
  await servicio.from('recibos').delete().eq('cuil_archivo', CUIL_ANA)
  await servicio.from('recibos').delete().eq('cuil_archivo', CUIL_LUIS)
  await servicio.from('liquidaciones').delete().eq('empresa_id', empresaId)
  await servicio.from('legajos').delete().eq('empresa_id', empresaId)
  await servicio.from('personas').delete().in('id', [personaAna, personaLuis])
  await servicio.from('empresas').delete().eq('id', empresaId)
  await servicio.auth.admin.deleteUser(usuarioAna)
  await servicio.auth.admin.deleteUser(usuarioLuis)
})

describe('RLS del empleado', () => {
  it('ve su propio recibo publicado', async () => {
    const { data } = await clienteAna.from('recibos').select('id').eq('id', reciboAna)
    expect(data).toHaveLength(1)
  })

  it('NO ve el recibo de otro empleado', async () => {
    const { data } = await clienteAna.from('recibos').select('id').eq('id', reciboLuis)
    expect(data).toEqual([])
  })

  it('NO ve recibos de liquidaciones en borrador', async () => {
    const { data } = await clienteAna.from('recibos').select('id')
    expect(data!.map((r) => r.id)).toEqual([reciboAna])
  })

  it('NO ve los datos personales de otro empleado', async () => {
    const { data } = await clienteAna.from('personas').select('id')
    expect(data!.map((p) => p.id)).toEqual([personaAna])
  })

  it('NO puede insertar una conformidad directamente', async () => {
    const { error } = await clienteAna.from('conformidades').insert({
      recibo_id: reciboAna,
      persona_id: personaAna,
      sha256_documento: 'a'.repeat(64),
      texto_legal: 'intento directo',
    })
    expect(error).not.toBeNull()
  })

  it('NO puede leer la tabla de administradores', async () => {
    const { data } = await clienteAna.from('admin_usuarios').select('id')
    expect(data).toEqual([])
  })
})
