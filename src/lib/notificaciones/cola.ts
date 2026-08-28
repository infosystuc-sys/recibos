import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { formatearPeriodo } from '@/lib/periodo'
import { canalEmail } from '@/lib/notificaciones/email'
import { canalPush } from '@/lib/notificaciones/push'
import { canalWhatsapp } from '@/lib/notificaciones/whatsapp'
import type { CanalNotificacion, DatosDestino, MensajeNotificacion } from '@/lib/notificaciones/tipos'
import { ETIQUETA_TIPO, type TipoLiquidacion } from '@/lib/tango/parse-nombre-recibo'

const CANALES: Record<string, CanalNotificacion> = {
  email: canalEmail,
  push: canalPush,
  whatsapp: canalWhatsapp,
}

const MAX_INTENTOS = 5
/** backoff exponencial en minutos: 1, 2, 4, 8, 16. */
const backoffMs = (intentos: number) => Math.min(2 ** intentos, 16) * 60_000

type Servicio = SupabaseClient

function urlApp(): string {
  return (process.env.APP_URL ?? 'http://localhost:3000').replace(/\/$/, '')
}

// ── Encolado ──────────────────────────────────────────────────────────

interface PersonaObjetivo {
  personaId: string
  reciboId: string
  email: string | null
  telefono: string | null
  tienePush: boolean
}

async function personasDeLiquidacion(
  servicio: Servicio,
  liquidacionId: string,
  soloPendientes: boolean,
): Promise<PersonaObjetivo[]> {
  const { data: recibos } = await servicio
    .from('recibos')
    .select('id, legajos(personas(id, email, telefono)), conformidades(id)')
    .eq('liquidacion_id', liquidacionId)
    .eq('estado', 'vigente')

  const filas = ((recibos as unknown as Array<{
    id: string
    legajos: { personas: { id: string; email: string | null; telefono: string | null } | null } | null
    conformidades: { id: string } | null
  }>) ?? []).filter((r) => r.legajos?.personas)

  const relevantes = soloPendientes ? filas.filter((r) => !r.conformidades) : filas
  const personaIds = [...new Set(relevantes.map((r) => r.legajos!.personas!.id))]

  const conPush = new Set<string>()
  if (personaIds.length > 0) {
    const { data: subs } = await servicio
      .from('push_subscriptions')
      .select('persona_id')
      .in('persona_id', personaIds)
    for (const s of subs ?? []) conPush.add(s.persona_id)
  }

  return relevantes.map((r) => ({
    personaId: r.legajos!.personas!.id,
    reciboId: r.id,
    email: r.legajos!.personas!.email,
    telefono: r.legajos!.personas!.telefono,
    tienePush: conPush.has(r.legajos!.personas!.id),
  }))
}

/** Encola avisos de publicación para todos los recibos de una liquidación. */
export async function encolarPublicacion(servicio: Servicio, liquidacionId: string) {
  const objetivos = await personasDeLiquidacion(servicio, liquidacionId, false)
  await encolar(servicio, liquidacionId, objetivos, 'publicacion')
}

/**
 * Encola recordatorios a los pendientes de conformidad.
 * - `dias = 3`: personas que nunca recibieron un recordatorio de esa liquidación.
 * - `dias = 7`: personas cuyo último recordatorio fue hace más de 3 días.
 * En ambos casos la liquidación tiene que estar publicada hace al menos `dias`.
 */
export async function encolarRecordatorios(servicio: Servicio, dias: 3 | 7) {
  const limitePublicada = new Date(Date.now() - dias * 86_400_000).toISOString()
  const { data: liqs } = await servicio
    .from('liquidaciones')
    .select('id')
    .eq('estado', 'publicada')
    .lte('publicada_at', limitePublicada)

  const haceTresDias = Date.now() - 3 * 86_400_000

  for (const liq of liqs ?? []) {
    const objetivos = await personasDeLiquidacion(servicio, liq.id, true)
    if (objetivos.length === 0) continue

    const { data: previos } = await servicio
      .from('notificaciones')
      .select('persona_id, created_at')
      .eq('liquidacion_id', liq.id)
      .eq('tipo', 'recordatorio')
      .neq('estado', 'descartada')

    const ultimoPorPersona = new Map<string, number>()
    for (const p of previos ?? []) {
      const t = new Date(p.created_at).getTime()
      ultimoPorPersona.set(p.persona_id, Math.max(ultimoPorPersona.get(p.persona_id) ?? 0, t))
    }

    const pendientes = objetivos.filter((o) => {
      const ultimo = ultimoPorPersona.get(o.personaId)
      return dias === 3 ? ultimo === undefined : ultimo !== undefined && ultimo < haceTresDias
    })
    await encolar(servicio, liq.id, pendientes, 'recordatorio')
  }
}

/**
 * Recordatorio a demanda desde el panel: encola para todos los pendientes de
 * la liquidación, sin mirar cuándo se envió el último. Devuelve cuántos entraron.
 */
export async function encolarRecordatorioManual(
  servicio: Servicio,
  liquidacionId: string,
): Promise<number> {
  const objetivos = await personasDeLiquidacion(servicio, liquidacionId, true)
  return encolar(servicio, liquidacionId, objetivos, 'recordatorio')
}

async function encolar(
  servicio: Servicio,
  liquidacionId: string,
  objetivos: PersonaObjetivo[],
  tipo: 'publicacion' | 'recordatorio',
): Promise<number> {
  if (objetivos.length === 0) return 0

  // No duplicar avisos vivos del mismo tipo para la misma (persona, liq, canal).
  const { data: vivos } = await servicio
    .from('notificaciones')
    .select('persona_id, canal')
    .eq('liquidacion_id', liquidacionId)
    .eq('tipo', tipo)
    .in('estado', ['encolada', 'enviando', 'enviada'])

  const yaHay = new Set((vivos ?? []).map((v) => `${v.persona_id}:${v.canal}`))
  const ahora = new Date().toISOString()
  const filas: Array<Record<string, unknown>> = []

  const whatsappActivo = Boolean(
    process.env.EVOLUTION_API_URL && process.env.EVOLUTION_API_KEY && process.env.EVOLUTION_INSTANCE,
  )

  for (const o of objetivos) {
    for (const canal of ['email', 'push', 'whatsapp'] as const) {
      if (canal === 'email' && !o.email) continue
      if (canal === 'push' && !o.tienePush) continue
      if (canal === 'whatsapp' && (!whatsappActivo || !o.telefono)) continue
      if (yaHay.has(`${o.personaId}:${canal}`)) continue
      filas.push({
        persona_id: o.personaId,
        liquidacion_id: liquidacionId,
        recibo_id: o.reciboId,
        canal,
        tipo,
        estado: 'encolada',
        proximo_intento_at: ahora,
      })
    }
  }

  if (filas.length > 0) await servicio.from('notificaciones').insert(filas)
  return filas.length
}

// ── Procesamiento ─────────────────────────────────────────────────────

export interface ResumenProceso {
  tomadas: number
  enviadas: number
  fallidas: number
  descartadas: number
  canalesInactivos: Record<string, string>
}

export async function procesarCola(servicio: Servicio, limite = 50): Promise<ResumenProceso> {
  const { data: pendientes } = await servicio
    .from('notificaciones')
    .select('id, persona_id, liquidacion_id, canal, tipo, intentos')
    .in('estado', ['encolada', 'fallida'])
    .lte('proximo_intento_at', new Date().toISOString())
    .order('proximo_intento_at', { ascending: true })
    .limit(limite)

  const cola = pendientes ?? []
  const resumen: ResumenProceso = {
    tomadas: cola.length,
    enviadas: 0,
    fallidas: 0,
    descartadas: 0,
    canalesInactivos: {},
  }
  if (cola.length === 0) return resumen

  const mensajesPorLiq = new Map<string, MensajeNotificacion | null>()
  const destinoPorPersona = new Map<string, DatosDestino>()

  for (const n of cola) {
    await servicio.from('notificaciones').update({ estado: 'enviando' }).eq('id', n.id)

    const canal = CANALES[n.canal]
    if (!canal) {
      await marcar(servicio, n.id, { estado: 'descartada', error: `Canal desconocido: ${n.canal}` })
      resumen.descartadas++
      continue
    }
    if (!canal.activo()) {
      resumen.canalesInactivos[n.canal] = canal.motivoInactivo()
      await servicio
        .from('notificaciones')
        .update({ estado: 'encolada', error: canal.motivoInactivo() })
        .eq('id', n.id)
      continue
    }

    const mensaje = await mensajeDe(servicio, n.liquidacion_id, n.tipo, mensajesPorLiq)
    if (!mensaje) {
      await marcar(servicio, n.id, { estado: 'descartada', error: 'No se pudo armar el mensaje.' })
      resumen.descartadas++
      continue
    }

    const destino = await destinoDe(servicio, n.persona_id, destinoPorPersona)
    const r = await canal.enviar(mensaje, destino)

    if (r.suscripcionesMuertas?.length) {
      await servicio
        .from('push_subscriptions')
        .delete()
        .in('endpoint', r.suscripcionesMuertas)
      destinoPorPersona.delete(n.persona_id)
    }

    if (r.estado === 'enviada') {
      await marcar(servicio, n.id, {
        estado: 'enviada',
        enviada_at: new Date().toISOString(),
        proveedor_msg_id: r.proveedorMsgId ?? null,
        error: null,
      })
      resumen.enviadas++
    } else if (r.estado === 'descartada') {
      await marcar(servicio, n.id, { estado: 'descartada', error: r.error ?? null })
      resumen.descartadas++
    } else {
      const intentos = n.intentos + 1
      if (intentos >= MAX_INTENTOS) {
        await marcar(servicio, n.id, { estado: 'descartada', intentos, error: r.error ?? null })
        resumen.descartadas++
      } else {
        await marcar(servicio, n.id, {
          estado: 'fallida',
          intentos,
          error: r.error ?? null,
          proximo_intento_at: new Date(Date.now() + backoffMs(intentos)).toISOString(),
        })
        resumen.fallidas++
      }
    }
  }

  return resumen
}

async function marcar(servicio: Servicio, id: string, campos: Record<string, unknown>) {
  await servicio.from('notificaciones').update(campos).eq('id', id)
}

async function mensajeDe(
  servicio: Servicio,
  liquidacionId: string,
  tipo: string,
  cache: Map<string, MensajeNotificacion | null>,
): Promise<MensajeNotificacion | null> {
  const clave = `${liquidacionId}:${tipo}`
  if (cache.has(clave)) return cache.get(clave)!

  const { data } = await servicio
    .from('liquidaciones')
    .select('periodo, tipo, empresas(razon_social)')
    .eq('id', liquidacionId)
    .maybeSingle<{ periodo: number; tipo: string; empresas: { razon_social: string } | null }>()

  let mensaje: MensajeNotificacion | null = null
  if (data) {
    const periodo = formatearPeriodo(data.periodo)
    const etiqueta = ETIQUETA_TIPO[data.tipo as TipoLiquidacion]
    const empresa = data.empresas?.razon_social ?? ''
    mensaje =
      tipo === 'recordatorio'
        ? {
            asunto: `Recordatorio: tu recibo de ${periodo} espera tu conformidad`,
            cuerpo: `${empresa} publicó tu recibo de ${periodo} (${etiqueta}) y todavía no prestaste conformidad.`,
            url: `${urlApp()}/mi`,
          }
        : {
            asunto: `Tu recibo de ${periodo} ya está disponible`,
            cuerpo: `${empresa} publicó tu recibo de ${periodo} (${etiqueta}). Entrá para verlo y prestar conformidad.`,
            url: `${urlApp()}/mi`,
          }
  }
  cache.set(clave, mensaje)
  return mensaje
}

async function destinoDe(
  servicio: Servicio,
  personaId: string,
  cache: Map<string, DatosDestino>,
): Promise<DatosDestino> {
  const enCache = cache.get(personaId)
  if (enCache) return enCache

  const { data: persona } = await servicio
    .from('personas')
    .select('email, telefono')
    .eq('id', personaId)
    .maybeSingle<{ email: string | null; telefono: string | null }>()

  const { data: subs } = await servicio
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('persona_id', personaId)

  const destino: DatosDestino = {
    email: persona?.email ?? null,
    telefono: persona?.telefono ?? null,
    suscripcionesPush: (subs as DatosDestino['suscripcionesPush'] | null) ?? [],
  }
  cache.set(personaId, destino)
  return destino
}
