import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { leerEntornoPublico } from '@/lib/entorno'
import type { Database } from '@/lib/supabase/tipos'

export async function clienteServidor() {
  const almacen = await cookies()
  const entorno = leerEntornoPublico({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  })

  return createServerClient<Database>(
    entorno.NEXT_PUBLIC_SUPABASE_URL,
    entorno.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => almacen.getAll(),
        setAll: (cookiesNuevas) => {
          try {
            for (const { name, value, options } of cookiesNuevas) {
              almacen.set(name, value, options)
            }
          } catch {
            // Llamado desde un Server Component: el middleware ya refrescó la sesión.
          }
        },
      },
    },
  )
}
