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
const RAZON_SOCIAL = 'RLS Test SA'
const EMAIL_ADMIN = `rls-admin-test@${DOMINIO}`

let empresaId: string | undefined
let personaAna: string | undefined
let personaLuis: string | undefined
let reciboAna: string
let reciboLuis: string
let usuarioAna: string | undefined
let usuarioLuis: string | undefined
let usuarioAdmin: string | undefined
let liquidacionIds: string[] = []
let clienteAna: SupabaseClient

// Limpieza best-effort: nunca lanza, solo avisa. Así un paso de limpieza que
// falla no corta los siguientes (ver I-3 de la revisión de la Ronda 1).
async function limpiar(paso: string, accion: () => PromiseLike<{ error: unknown }>) {
  try {
    const { error } = await accion()
    if (error) console.warn(`Limpieza (${paso}) con error no fatal:`, error)
  } catch (error) {
    console.warn(`Limpieza (${paso}) con excepción no fatal:`, error)
  }
}

// Busca un usuario de auth por email recorriendo listUsers, porque el cliente
// admin no ofrece un filtro por email directo. Se usa solo para la limpieza
// defensiva de usuarios que pudieron quedar huérfanos de una corrida anterior.
// Pagina hasta encontrar el email o hasta agotar los resultados: quedarse en
// la página 1 pierde en silencio a los huérfanos una vez que auth.users (el
// mismo proyecto que usa la aplicación) supera perPage usuarios, que es
// exactamente el escenario que esta función existe para cubrir.
const BUSQUEDA_USUARIO_PER_PAGE = 200
const BUSQUEDA_USUARIO_MAX_PAGINAS = 50

async function borrarUsuarioPorEmail(email: string) {
  try {
    for (let pagina = 1; pagina <= BUSQUEDA_USUARIO_MAX_PAGINAS; pagina++) {
      const { data, error } = await servicio.auth.admin.listUsers({
        page: pagina,
        perPage: BUSQUEDA_USUARIO_PER_PAGE,
      })
      if (error || !data) {
        console.warn(`No se pudo listar usuarios de auth (página ${pagina}) buscando ${email}:`, error)
        return
      }

      const usuario = data.users.find((u) => u.email === email)
      if (usuario) {
        await servicio.auth.admin.deleteUser(usuario.id)
        return
      }

      if (data.users.length < BUSQUEDA_USUARIO_PER_PAGE) {
        // Última página: se agotaron los resultados sin encontrarlo. No hay
        // huérfano que limpiar.
        return
      }
    }

    // Se llegó al tope de páginas sin encontrar el email ni agotar los
    // resultados: puede haber un huérfano más allá del tope. Se deja
    // constancia en vez de fallar en silencio.
    console.warn(
      `borrarUsuarioPorEmail: se alcanzó el tope de ${BUSQUEDA_USUARIO_MAX_PAGINAS} páginas ` +
        `sin encontrar ni agotar la búsqueda de ${email}. Revisar manualmente si quedó un usuario huérfano.`,
    )
  } catch (error) {
    // Best-effort: si la búsqueda falla no bloquea el resto de la limpieza,
    // pero se avisa para no perder el rastro del huérfano.
    console.warn(`Excepción buscando/borrando el usuario de auth ${email}:`, error)
  }
}

// Deja el proyecto como si el test nunca hubiera corrido, aunque una corrida
// anterior haya quedado a mitad de camino (beforeAll fallido). Se limpia por
// los identificadores fijos del test (CUILs, razón social, email de admin),
// no por relaciones que podrían no haberse llegado a crear.
async function limpiezaDefensiva() {
  const { data: personasPrevias } = await servicio
    .from('personas')
    .select('id')
    .in('cuil', [CUIL_ANA, CUIL_LUIS])
  const personaIdsPrevios = (personasPrevias ?? []).map((p) => p.id)

  const { data: empresasPrevias } = await servicio
    .from('empresas')
    .select('id')
    .eq('razon_social', RAZON_SOCIAL)
  const empresaIdsPrevios = (empresasPrevias ?? []).map((e) => e.id)

  const legajoIdsPrevios: string[] = []
  if (personaIdsPrevios.length > 0) {
    const { data } = await servicio.from('legajos').select('id').in('persona_id', personaIdsPrevios)
    legajoIdsPrevios.push(...(data ?? []).map((l) => l.id))
  }
  if (empresaIdsPrevios.length > 0) {
    const { data } = await servicio.from('legajos').select('id').in('empresa_id', empresaIdsPrevios)
    legajoIdsPrevios.push(...(data ?? []).map((l) => l.id))
  }

  let liquidacionIdsPrevias: string[] = []
  if (empresaIdsPrevios.length > 0) {
    const { data } = await servicio.from('liquidaciones').select('id').in('empresa_id', empresaIdsPrevios)
    liquidacionIdsPrevias = (data ?? []).map((q) => q.id)
  }

  if (legajoIdsPrevios.length > 0) {
    await limpiar('recibos por legajo previo', () =>
      servicio.from('recibos').delete().in('legajo_id', legajoIdsPrevios),
    )
  }
  if (liquidacionIdsPrevias.length > 0) {
    await limpiar('recibos por liquidación previa', () =>
      servicio.from('recibos').delete().in('liquidacion_id', liquidacionIdsPrevias),
    )
    await limpiar('liquidaciones previas', () =>
      servicio.from('liquidaciones').delete().in('id', liquidacionIdsPrevias),
    )
  }
  if (legajoIdsPrevios.length > 0) {
    await limpiar('legajos previos', () => servicio.from('legajos').delete().in('id', legajoIdsPrevios))
  }
  if (personaIdsPrevios.length > 0) {
    await limpiar('personas previas', () => servicio.from('personas').delete().in('id', personaIdsPrevios))
  }
  if (empresaIdsPrevios.length > 0) {
    await limpiar('empresas previas', () => servicio.from('empresas').delete().in('id', empresaIdsPrevios))
  }

  await limpiar('admin_usuarios previo', () =>
    servicio.from('admin_usuarios').delete().eq('email', EMAIL_ADMIN),
  )

  await borrarUsuarioPorEmail(`${CUIL_ANA}@${DOMINIO}`)
  await borrarUsuarioPorEmail(`${CUIL_LUIS}@${DOMINIO}`)
  await borrarUsuarioPorEmail(EMAIL_ADMIN)
}

async function crearEmpleado(cuil: string, nombre: string, legajo: number) {
  const { data: usuario, error: errUsuario } = await servicio.auth.admin.createUser({
    email: `${cuil}@${DOMINIO}`,
    password: CLAVE,
    email_confirm: true,
  })
  if (errUsuario) throw errUsuario

  try {
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
  } catch (error) {
    // Si algo después de crear el usuario de auth falla, no lo dejamos
    // huérfano: la corrida siguiente chocaría con "email already registered"
    // (ver I-3 de la revisión de la Ronda 1).
    await servicio.auth.admin.deleteUser(usuario.user.id).catch(() => {})
    throw error
  }
}

beforeAll(async () => {
  await limpiezaDefensiva()

  const { data: empresa, error: errEmpresa } = await servicio
    .from('empresas')
    .insert({ razon_social: RAZON_SOCIAL, cuit: '30999999990', nombre_corto: 'RLS Test' })
    .select('id')
    .single()
  if (errEmpresa) throw errEmpresa
  empresaId = empresa.id

  const ana = await crearEmpleado(CUIL_ANA, 'Prueba, Ana', 901)
  const luis = await crearEmpleado(CUIL_LUIS, 'Prueba, Luis', 902)
  personaAna = ana.personaId
  personaLuis = luis.personaId
  usuarioAna = ana.usuarioId
  usuarioLuis = luis.usuarioId

  // Fila de admin_usuarios real: sin ella, el caso "NO puede leer la tabla de
  // administradores" pasaría vacío incluso con una política rota, porque la
  // tabla estaría vacía de todos modos (I-2 de la revisión de la Ronda 1).
  const { data: usuarioAdminData, error: errUsuarioAdmin } = await servicio.auth.admin.createUser({
    email: EMAIL_ADMIN,
    password: CLAVE,
    email_confirm: true,
  })
  if (errUsuarioAdmin) throw errUsuarioAdmin
  usuarioAdmin = usuarioAdminData.user.id

  const { error: errAdminUsuario } = await servicio
    .from('admin_usuarios')
    .insert({ id: usuarioAdmin, nombre: 'Admin RLS Test', email: EMAIL_ADMIN, rol: 'consulta' })
  if (errAdminUsuario) throw errAdminUsuario

  const { data: liquidacion, error: errLiquidacion } = await servicio
    .from('liquidaciones')
    .insert({
      empresa_id: empresaId, periodo: 202604, tipo: 'MEN', dato_fijo: 9999,
      estado: 'publicada', publicada_at: new Date().toISOString(),
    })
    .select('id')
    .single()
  if (errLiquidacion) throw errLiquidacion

  const { data: borrador, error: errBorrador } = await servicio
    .from('liquidaciones')
    .insert({ empresa_id: empresaId, periodo: 202605, tipo: 'MEN', dato_fijo: 9998 })
    .select('id')
    .single()
  if (errBorrador) throw errBorrador

  liquidacionIds = [liquidacion.id, borrador.id]

  const { data: recibosCreados, error: errRecibos } = await servicio
    .from('recibos')
    .insert([
      {
        liquidacion_id: liquidacion.id, legajo_id: ana.legajoId,
        storage_path: `${empresaId}/202604/MEN-9999/901-v1.pdf`,
        nombre_original: 'a.pdf', sha256: 'a'.repeat(64), bytes: 100, cuil_archivo: CUIL_ANA,
      },
      {
        liquidacion_id: liquidacion.id, legajo_id: luis.legajoId,
        storage_path: `${empresaId}/202604/MEN-9999/902-v1.pdf`,
        nombre_original: 'b.pdf', sha256: 'b'.repeat(64), bytes: 100, cuil_archivo: CUIL_LUIS,
      },
      {
        liquidacion_id: borrador.id, legajo_id: ana.legajoId,
        storage_path: `${empresaId}/202605/MEN-9998/901-v1.pdf`,
        nombre_original: 'c.pdf', sha256: 'c'.repeat(64), bytes: 100, cuil_archivo: CUIL_ANA,
      },
    ])
    .select('id, legajo_id, liquidacion_id')
  if (errRecibos) throw errRecibos

  reciboAna = recibosCreados.find(
    (r) => r.legajo_id === ana.legajoId && r.liquidacion_id === liquidacion.id,
  )!.id
  reciboLuis = recibosCreados.find((r) => r.legajo_id === luis.legajoId)!.id

  clienteAna = createClient(URL, ANON, { auth: { persistSession: false } })
  const { error } = await clienteAna.auth.signInWithPassword({
    email: `${CUIL_ANA}@${DOMINIO}`,
    password: CLAVE,
  })
  if (error) throw error
}, 60_000)

afterAll(async () => {
  // Acotado a las liquidaciones que este test creó: nunca por cuil_archivo
  // suelto, que en el mismo proyecto de la aplicación podría alcanzar
  // recibos reales de una persona con ese CUIL (I-4 de la revisión de la
  // Ronda 1). Cada paso es best-effort y no corta a los siguientes (I-3).
  if (liquidacionIds.length > 0) {
    await limpiar('recibos', () =>
      servicio.from('recibos').delete().in('liquidacion_id', liquidacionIds),
    )
    await limpiar('liquidaciones', () =>
      servicio.from('liquidaciones').delete().in('id', liquidacionIds),
    )
  }
  if (empresaId) {
    await limpiar('legajos', () => servicio.from('legajos').delete().eq('empresa_id', empresaId!))
  }
  const idsPersonas = [personaAna, personaLuis].filter((id): id is string => Boolean(id))
  if (idsPersonas.length > 0) {
    await limpiar('personas', () => servicio.from('personas').delete().in('id', idsPersonas))
  }
  if (empresaId) {
    await limpiar('empresas', () => servicio.from('empresas').delete().eq('id', empresaId!))
  }
  if (usuarioAdmin) {
    await limpiar('admin_usuarios', () =>
      servicio.from('admin_usuarios').delete().eq('id', usuarioAdmin!),
    )
  }
  const idsAuth = [usuarioAna, usuarioLuis, usuarioAdmin].filter((id): id is string => Boolean(id))
  for (const id of idsAuth) {
    await limpiar(`auth.users ${id}`, async () => {
      const { error } = await servicio.auth.admin.deleteUser(id)
      return { error }
    })
  }
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
    // Con una fila real en admin_usuarios (creada en beforeAll), este caso
    // solo pasa si la política realmente filtra: antes, con la tabla vacía,
    // pasaba igual aunque la política estuviera rota (I-2 de la Ronda 1).
    const { data } = await clienteAna.from('admin_usuarios').select('id')
    expect(data).toEqual([])
  })
})
