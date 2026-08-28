import 'server-only'

import { Resend } from 'resend'
import type { CanalNotificacion } from '@/lib/notificaciones/tipos'

function config() {
  return { apiKey: process.env.RESEND_API_KEY, from: process.env.EMAIL_FROM }
}

export const canalEmail: CanalNotificacion = {
  nombre: 'email',

  activo() {
    const { apiKey, from } = config()
    return Boolean(apiKey && from)
  },

  motivoInactivo() {
    return 'Falta RESEND_API_KEY y/o EMAIL_FROM. El dominio debe estar verificado en Resend.'
  },

  async enviar(mensaje, destino) {
    if (!destino.email) {
      return { estado: 'descartada', error: 'La persona no tiene email cargado.' }
    }
    const { apiKey, from } = config()
    if (!apiKey || !from) {
      return { estado: 'fallida', error: this.motivoInactivo() }
    }

    const resend = new Resend(apiKey)
    const { data, error } = await resend.emails.send({
      from,
      to: destino.email,
      subject: mensaje.asunto,
      html: `<p>${escapar(mensaje.cuerpo)}</p><p><a href="${mensaje.url}">Ver mis recibos</a></p>`,
      text: `${mensaje.cuerpo}\n\n${mensaje.url}`,
    })

    if (error) return { estado: 'fallida', error: error.message }
    return { estado: 'enviada', proveedorMsgId: data?.id ?? null }
  },
}

function escapar(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!)
}
