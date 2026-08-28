import { createClient } from '@supabase/supabase-js'
import { beforeAll, describe, expect, it } from 'vitest'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICIO = process.env.SUPABASE_SERVICE_ROLE_KEY!

const servicio = createClient(URL, SERVICIO, { auth: { persistSession: false } })

// Una conformidad, por diseño, no se puede borrar (trigger de inmutabilidad).
// Por eso este archivo usa un fixture PERMANENTE con identificadores fijos:
// si ya existe lo reutiliza, no acumula filas entre corridas y no limpia nada.
const RAZON_SOCIAL = 'Fixture Inmutabilidad SA'
const CUIT = '30666666660'
const CUIL = '20240855539'

let conformidadId: string
let reciboId: string
let personaId: string

async function idExistente<T extends { id: string }>(
  tabla: string,
  filtro: Record<string, unknown>,
): Promise<string | null> {
  let q = servicio.from(tabla).select('id')
  for (const [k, v] of Object.entries(filtro)) q = q.eq(k, v as never)
  const { data } = await q.maybeSingle<T>()
  return data?.id ?? null
}

beforeAll(async () => {
  let empresaId = await idExistente('empresas', { razon_social: RAZON_SOCIAL })
  if (!empresaId) {
    const { data } = await servicio
      .from('empresas')
      .insert({ razon_social: RAZON_SOCIAL, cuit: CUIT, nombre_corto: 'Fix' })
      .select('id')
      .single()
    empresaId = data!.id
  }

  personaId = (await idExistente('personas', { cuil: CUIL })) ?? ''
  if (!personaId) {
    const { data } = await servicio
      .from('personas')
      .insert({ cuil: CUIL, apellido_nombre: 'Inmutable, Ana', estado: 'activo' })
      .select('id')
      .single()
    personaId = data!.id
  }

  let legajoId = await idExistente('legajos', { empresa_id: empresaId, numero: 960 })
  if (!legajoId) {
    const { data } = await servicio
      .from('legajos')
      .insert({ empresa_id: empresaId, persona_id: personaId, numero: 960 })
      .select('id')
      .single()
    legajoId = data!.id
  }

  let liquidacionId = await idExistente('liquidaciones', {
    empresa_id: empresaId,
    periodo: 202609,
    tipo: 'MEN',
    dato_fijo: 9600,
  })
  if (!liquidacionId) {
    const { data } = await servicio
      .from('liquidaciones')
      .insert({
        empresa_id: empresaId,
        periodo: 202609,
        tipo: 'MEN',
        dato_fijo: 9600,
        estado: 'publicada',
        publicada_at: new Date().toISOString(),
      })
      .select('id')
      .single()
    liquidacionId = data!.id
  }

  reciboId = (await idExistente('recibos', { liquidacion_id: liquidacionId, legajo_id: legajoId })) ?? ''
  if (!reciboId) {
    const { data } = await servicio
      .from('recibos')
      .insert({
        liquidacion_id: liquidacionId,
        legajo_id: legajoId,
        version: 1,
        storage_path: `${empresaId}/202609/MEN-9600/960-v1.pdf`,
        nombre_original: 'r.pdf',
        sha256: 'a'.repeat(64),
        bytes: 100,
        cuil_archivo: CUIL,
      })
      .select('id')
      .single()
    reciboId = data!.id
  }

  conformidadId = (await idExistente('conformidades', { recibo_id: reciboId })) ?? ''
  if (!conformidadId) {
    const { data } = await servicio
      .from('conformidades')
      .insert({
        recibo_id: reciboId,
        persona_id: personaId,
        sha256_documento: 'a'.repeat(64),
        texto_legal: 'Presto conformidad con el presente recibo de sueldo.',
      })
      .select('id')
      .single()
    conformidadId = data!.id
  }
}, 60_000)

describe('inmutabilidad de conformidades', () => {
  it('rechaza UPDATE sobre una conformidad', async () => {
    const { error } = await servicio
      .from('conformidades')
      .update({ texto_legal: 'texto alterado' })
      .eq('id', conformidadId)
    expect(error).not.toBeNull()
    expect(error!.message).toMatch(/solo inserci/i)
  })

  it('rechaza DELETE sobre una conformidad', async () => {
    const { error } = await servicio.from('conformidades').delete().eq('id', conformidadId)
    expect(error).not.toBeNull()
  })

  it('no admite una segunda conformidad para el mismo recibo', async () => {
    const { error } = await servicio.from('conformidades').insert({
      recibo_id: reciboId,
      persona_id: personaId,
      sha256_documento: 'b'.repeat(64),
      texto_legal: 'segunda conformidad',
    })
    expect(error).not.toBeNull()
    expect(error!.code).toBe('23505')
  })
})
