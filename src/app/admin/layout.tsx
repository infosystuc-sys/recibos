import type { ReactNode } from 'react'
import Link from 'next/link'
import { salir } from '@/acciones/sesion'
import { puede } from '@/lib/permisos'
import { exigirAdmin } from '@/lib/sesion'

export default async function LayoutAdmin({ children }: { children: ReactNode }) {
  const admin = await exigirAdmin('ver')

  return (
    <div className="min-h-dvh">
      <header className="flex items-center justify-between border-b px-6 py-3">
        <div className="flex items-center gap-6">
          <Link href="/admin" className="font-semibold">
            Conforme
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/admin/empresas">Empresas</Link>
            {puede(admin.rol, 'operar') && (
              <Link href="/admin/empleados/importar">Importar padrón</Link>
            )}
            {admin.rol === 'admin' && <Link href="/admin/usuarios">Usuarios</Link>}
          </nav>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span>
            {admin.nombre} · {admin.rol}
          </span>
          <form action={salir}>
            <button type="submit" className="underline">
              Salir
            </button>
          </form>
        </div>
      </header>
      <main className="p-6">{children}</main>
    </div>
  )
}
