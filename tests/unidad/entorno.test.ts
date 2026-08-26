import { describe, expect, it } from 'vitest'
import { leerEntornoPublico } from '@/lib/entorno'

describe('leerEntornoPublico', () => {
  it('acepta una configuración completa', () => {
    expect(() =>
      leerEntornoPublico({
        NEXT_PUBLIC_SUPABASE_URL: 'https://x.supabase.co',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'clave',
      }),
    ).not.toThrow()
  })

  it('falla con un mensaje claro si falta la URL', () => {
    expect(() =>
      leerEntornoPublico({ NEXT_PUBLIC_SUPABASE_ANON_KEY: 'clave' }),
    ).toThrow(/NEXT_PUBLIC_SUPABASE_URL/)
  })
})
