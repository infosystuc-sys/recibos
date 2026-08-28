import { z } from 'zod'

const esquemaPublico = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url('NEXT_PUBLIC_SUPABASE_URL debe ser una URL válida'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, 'Falta NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  // Fase 2: clave pública VAPID para suscribir el navegador a push. Opcional.
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().min(1).optional(),
})

const esquemaServidor = esquemaPublico.extend({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'Falta SUPABASE_SERVICE_ROLE_KEY'),
  EMPLEADO_EMAIL_DOMAIN: z.string().min(1).default('empleados.conforme.local'),

  // Fase 2 — todas opcionales: si faltan, el canal correspondiente queda
  // inactivo y la cola lo registra sin cortar el resto.
  APP_URL: z.string().url().optional(),
  CRON_SECRET: z.string().min(1).optional(),
  RESEND_API_KEY: z.string().min(1).optional(),
  EMAIL_FROM: z.string().min(1).optional(),
  VAPID_PUBLIC_KEY: z.string().min(1).optional(),
  VAPID_PRIVATE_KEY: z.string().min(1).optional(),
  VAPID_SUBJECT: z.string().min(1).optional(),

  // WhatsApp vía Evolution API (self-hosted).
  EVOLUTION_API_URL: z.string().url().optional(),
  EVOLUTION_API_KEY: z.string().min(1).optional(),
  EVOLUTION_INSTANCE: z.string().min(1).optional(),
  WHATSAPP_PAIS: z.string().min(1).optional(),
})

export function leerEntornoPublico(fuente: Record<string, string | undefined>) {
  return esquemaPublico.parse(fuente)
}

export function leerEntornoServidor(fuente: Record<string, string | undefined>) {
  return esquemaServidor.parse(fuente)
}
