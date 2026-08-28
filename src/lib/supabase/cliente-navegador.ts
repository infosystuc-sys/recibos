'use client'

import { createBrowserClient } from '@supabase/ssr'
import { leerEntornoPublico } from '@/lib/entorno'
import type { Database } from '@/lib/supabase/tipos'

export function clienteNavegador() {
  const entorno = leerEntornoPublico({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  })

  return createBrowserClient<Database>(
    entorno.NEXT_PUBLIC_SUPABASE_URL,
    entorno.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  )
}
