import type { ReactNode } from 'react'
import Link from 'next/link'
import { salirEmpleado } from '@/acciones/sesion-empleado'
import RegistrarSW from '@/componentes/registrar-sw'
import { exigirEmpleado } from '@/lib/sesion-empleado'

export default async function LayoutEmpleado({ children }: { children: ReactNode }) {
  const empleado = await exigirEmpleado()

  return (
    <div className="min-h-dvh">
      <RegistrarSW />
      <header className="flex items-center justify-between border-b px-4 py-3">
        <Link href="/mi" className="text-lg font-semibold">
          Conforme
        </Link>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-neutral-600 dark:text-neutral-400">{empleado.apellidoNombre}</span>
          <form action={salirEmpleado}>
            <button type="submit" className="underline">
              Salir
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-2xl p-4">{children}</main>
    </div>
  )
}
