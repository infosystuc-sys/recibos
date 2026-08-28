import type { ReactNode } from 'react'
import Link from 'next/link'
import { salir } from '@/acciones/sesion'
import { exigirAdmin } from '@/lib/sesion'

const ENLACES = [
  { href: '/admin/empresas', texto: 'Empresas' },
  { href: '/admin/empleados', texto: 'Empleados' },
  { href: '/admin/liquidaciones', texto: 'Liquidaciones' },
  { href: '/admin/observaciones', texto: 'Observaciones' },
  { href: '/admin/notificaciones', texto: 'Notificaciones' },
]

export default async function LayoutAdmin({ children }: { children: ReactNode }) {
  const admin = await exigirAdmin('ver')

  return (
    <div className="min-h-dvh">
      <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b px-4 py-3 sm:px-6">
        <Link href="/admin" className="font-semibold">
          Conforme
        </Link>

        <div className="flex items-center gap-4 text-sm">
          <span className="text-neutral-600 dark:text-neutral-400">
            {admin.nombre} · {admin.rol}
          </span>
          <form action={salir}>
            <button type="submit" className="underline">
              Salir
            </button>
          </form>
        </div>

        <nav className="-mx-4 flex w-full items-center gap-4 overflow-x-auto px-4 text-sm sm:mx-0 sm:w-auto sm:overflow-visible sm:px-0">
          {ENLACES.map((e) => (
            <Link key={e.href} href={e.href} className="shrink-0 whitespace-nowrap">
              {e.texto}
            </Link>
          ))}
          {admin.rol === 'admin' && (
            <Link href="/admin/usuarios" className="shrink-0 whitespace-nowrap">
              Usuarios
            </Link>
          )}
        </nav>
      </header>
      <main className="p-4 sm:p-6">{children}</main>
    </div>
  )
}
