export type Canal = 'email' | 'push' | 'whatsapp'

export interface DatosDestino {
  email: string | null
  telefono: string | null
  suscripcionesPush: Array<{ id: string; endpoint: string; p256dh: string; auth: string }>
}

export interface MensajeNotificacion {
  asunto: string
  cuerpo: string
  url: string
}

export interface ResultadoEnvio {
  estado: 'enviada' | 'fallida' | 'descartada'
  proveedorMsgId?: string | null
  error?: string | null
  /** endpoints de push que el proveedor reportó como muertos (404/410). */
  suscripcionesMuertas?: string[]
}

export interface CanalNotificacion {
  nombre: Canal
  /** true si hay configuración suficiente para intentar enviar. */
  activo(): boolean
  /** explica qué falta cuando `activo()` es false. */
  motivoInactivo(): string
  enviar(mensaje: MensajeNotificacion, destino: DatosDestino): Promise<ResultadoEnvio>
}
