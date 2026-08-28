import 'server-only'

import { aWhatsapp } from '@/lib/telefono'
import type { CanalNotificacion } from '@/lib/notificaciones/tipos'

function config() {
  return {
    url: process.env.EVOLUTION_API_URL?.replace(/\/$/, ''),
    key: process.env.EVOLUTION_API_KEY,
    instancia: process.env.EVOLUTION_INSTANCE,
    pais: process.env.WHATSAPP_PAIS || '54',
  }
}

/** Estado de conexión de la instancia: 'open' cuando el teléfono está vinculado. */
export async function estadoInstanciaWhatsapp(): Promise<string | null> {
  const { url, key, instancia } = config()
  if (!url || !key || !instancia) return null
  try {
    const r = await fetch(`${url}/instance/connectionState/${instancia}`, {
      headers: { apikey: key },
    })
    if (!r.ok) return 'error'
    const j = (await r.json()) as { instance?: { state?: string } }
    return j.instance?.state ?? 'desconocido'
  } catch {
    return 'error'
  }
}

export const canalWhatsapp: CanalNotificacion = {
  nombre: 'whatsapp',

  activo() {
    const { url, key, instancia } = config()
    return Boolean(url && key && instancia)
  },

  motivoInactivo() {
    return 'Faltan EVOLUTION_API_URL / EVOLUTION_API_KEY / EVOLUTION_INSTANCE. La instancia debe estar vinculada a un teléfono (escanear el QR en el manager de Evolution API).'
  },

  async enviar(mensaje, destino) {
    const numero = aWhatsapp(destino.telefono, config().pais)
    if (!numero) {
      return { estado: 'descartada', error: 'La persona no tiene un teléfono válido.' }
    }
    const { url, key, instancia } = config()
    if (!url || !key || !instancia) {
      return { estado: 'fallida', error: this.motivoInactivo() }
    }

    try {
      const r = await fetch(`${url}/message/sendText/${instancia}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: key },
        body: JSON.stringify({
          number: numero,
          text: `${mensaje.cuerpo}\n\n${mensaje.url}`,
        }),
      })

      if (r.ok) {
        const j = (await r.json().catch(() => ({}))) as { key?: { id?: string } }
        return { estado: 'enviada', proveedorMsgId: j.key?.id ?? null }
      }

      const cuerpo = await r.text().catch(() => '')
      // 4xx que no sea 429 = problema del mensaje/número, no se reintenta.
      if (r.status >= 400 && r.status < 500 && r.status !== 429) {
        return { estado: 'descartada', error: `Evolution API ${r.status}: ${cuerpo.slice(0, 200)}` }
      }
      return { estado: 'fallida', error: `Evolution API ${r.status}: ${cuerpo.slice(0, 200)}` }
    } catch (e) {
      return { estado: 'fallida', error: e instanceof Error ? e.message : 'No se pudo contactar Evolution API.' }
    }
  },
}
