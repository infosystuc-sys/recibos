// En Next.js 16 el archivo `middleware` se renombró a `proxy` (misma función,
// mismo comportamiento). Refresca la cookie de sesión de Supabase en cada
// petición y manda al login que corresponda a quien entre sin sesión a una
// zona protegida (/admin o /mi). La autorización real (rol del admin, estado
// del empleado) se vuelve a verificar en cada layout y Server Action.

import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(peticion: NextRequest) {
  let respuesta = NextResponse.next({ request: peticion })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => peticion.cookies.getAll(),
        setAll: (cookiesNuevas) => {
          for (const { name, value } of cookiesNuevas) {
            peticion.cookies.set(name, value)
          }
          respuesta = NextResponse.next({ request: peticion })
          for (const { name, value, options } of cookiesNuevas) {
            respuesta.cookies.set(name, value, options)
          }
        },
      },
    },
  )

  const { data } = await supabase.auth.getUser()
  const ruta = peticion.nextUrl.pathname

  if (!data.user) {
    if (ruta.startsWith('/admin')) {
      const destino = peticion.nextUrl.clone()
      destino.pathname = '/ingresar'
      return NextResponse.redirect(destino)
    }
    if (ruta.startsWith('/mi') && ruta !== '/mi/ingresar') {
      const destino = peticion.nextUrl.clone()
      destino.pathname = '/mi/ingresar'
      return NextResponse.redirect(destino)
    }
  }

  return respuesta
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|webp)$).*)'],
}
