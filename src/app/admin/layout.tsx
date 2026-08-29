import type { ReactNode } from 'react'
import Link from 'next/link'
import { salir } from '@/acciones/sesion'
import { Marca } from '@/componentes/logo'
import { EtiquetaSeccion } from '@/componentes/ui'
import { exigirAdmin } from '@/lib/sesion'
import NavAdmin from './nav'

export default async function LayoutAdmin({ children }: { children: ReactNode }) {
  const admin = await exigirAdmin('ver')
  const iniciales = admin.nombre
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <aside className="flex flex-col gap-6 border-b border-borde bg-fondo px-4 py-4 md:w-60 md:shrink-0 md:border-b-0 md:border-r md:px-5 md:py-6">
        <Link href="/admin">
          <Marca />
        </Link>

        <NavAdmin esAdmin={admin.rol === 'admin'} />

        <div className="mt-auto hidden border-t border-borde pt-4 md:block">
          <EtiquetaSeccion>Conectado como</EtiquetaSeccion>
          <div className="mt-2 flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-full bg-acento-suave text-sm font-semibold text-acento-oscuro">
              {iniciales}
            </span>
            <div className="min-w-0 leading-tight">
              <div className="truncate text-sm font-medium">{admin.nombre}</div>
              <div className="text-xs capitalize text-texto-suave">{admin.rol}</div>
            </div>
          </div>
          <form action={salir} className="mt-3">
            <button type="submit" className="text-sm text-texto-suave underline hover:text-texto">
              Salir
            </button>
          </form>
        </div>

        <form action={salir} className="md:hidden">
          <button type="submit" className="text-sm text-texto-suave underline">
            Salir
          </button>
        </form>
      </aside>

      <main className="flex-1 px-4 py-6 md:px-10 md:py-8">
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>
    </div>
  )
}
