import type { CanalNotificacion } from '@/lib/notificaciones/tipos'

/**
 * Adaptador inactivo. Existe para que el panel muestre el canal y qué falta
 * para activarlo, sin tocar el resto del sistema. Se activará en la Fase 3
 * cuando haya cuenta de Meta Business y variables WHATSAPP_*.
 */
export const canalWhatsapp: CanalNotificacion = {
  nombre: 'whatsapp',
  activo: () => false,
  motivoInactivo: () =>
    'WhatsApp requiere una cuenta de Meta Business verificada y las variables WHATSAPP_* (Fase 3).',
  enviar: async () => ({ estado: 'descartada', error: 'Canal de WhatsApp inactivo.' }),
}
