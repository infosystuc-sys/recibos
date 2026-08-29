import { z } from 'zod'

const esquemaPublico = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url('NEXT_PUBLIC_SUPABASE_URL debe ser una URL válida'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, 'Falta NEXT_PUBLIC_SUPABASE_ANON_KEY'),
})

const esquemaServidor = esquemaPublico.extend({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'Falta SUPABASE_SERVICE_ROLE_KEY'),
  EMPLEADO_EMAIL_DOMAIN: z.string().min(1).default('empleados.conforme.local'),
})

export function leerEntornoPublico(fuente: Record<string, string | undefined>) {
  return esquemaPublico.parse(fuente)
}

export function leerEntornoServidor(fuente: Record<string, string | undefined>) {
  return esquemaServidor.parse(fuente)
}
