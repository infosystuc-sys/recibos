import 'server-only'

import { createClient } from '@supabase/supabase-js'
import { leerEntornoServidor } from '@/lib/entorno'
import type { Database } from '@/lib/supabase/tipos'

/**
 * Cliente con clave de servicio: IGNORA RLS.
 * Usarlo solo en Server Actions y Route Handlers, y solo después de haber
 * verificado a mano quién es el usuario y qué tiene permitido hacer.
 */
export function clienteServicio() {
  const entorno = leerEntornoServidor(process.env)

  return createClient<Database>(
    entorno.NEXT_PUBLIC_SUPABASE_URL,
    entorno.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}
