import 'server-only'

import webpush from 'web-push'
import type { CanalNotificacion } from '@/lib/notificaciones/tipos'

let configurado = false
function asegurarConfig(): boolean {
  const pub = process.env.VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT ?? 'mailto:admin@conforme.local'
  if (!pub || !priv) return false
  if (!configurado) {
    webpush.setVapidDetails(subject, pub, priv)
    configurado = true
  }
  return true
}

export const canalPush: CanalNotificacion = {
  nombre: 'push',

  activo() {
    return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY)
  },

  motivoInactivo() {
    return 'Faltan VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY.'
  },

  async enviar(mensaje, destino) {
    if (destino.suscripcionesPush.length === 0) {
      return { estado: 'descartada', error: 'La persona no tiene el navegador suscripto a push.' }
    }
    if (!asegurarConfig()) {
      return { estado: 'fallida', error: this.motivoInactivo() }
    }

    const payload = JSON.stringify({
      title: mensaje.asunto,
      body: mensaje.cuerpo,
      url: mensaje.url,
    })

    const muertas: string[] = []
    let algunaOk = false
    let ultimoError: string | null = null

    for (const s of destino.suscripcionesPush) {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
        )
        algunaOk = true
      } catch (e) {
        const codigo = (e as { statusCode?: number }).statusCode
        if (codigo === 404 || codigo === 410) muertas.push(s.endpoint)
        else ultimoError = e instanceof Error ? e.message : 'error de push'
      }
    }

    if (algunaOk) return { estado: 'enviada', suscripcionesMuertas: muertas }
    if (muertas.length > 0 && !ultimoError) {
      return { estado: 'descartada', error: 'Todas las suscripciones estaban muertas.', suscripcionesMuertas: muertas }
    }
    return { estado: 'fallida', error: ultimoError ?? 'No se pudo entregar el push.', suscripcionesMuertas: muertas }
  },
}
