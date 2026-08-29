import type { ReactNode } from 'react'
import Link from 'next/link'
import { salirEmpleado } from '@/acciones/sesion-empleado'
import { Logo } from '@/componentes/logo'
import RegistrarSW from '@/componentes/registrar-sw'
import { exigirEmpleado } from '@/lib/sesion-empleado'

export default async function LayoutEmpleado({ children }: { children: ReactNode }) {
  const empleado = await exigirEmpleado()

  return (
    <div className="min-h-dvh">
      <RegistrarSW />
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-borde bg-fondo/95 px-4 py-3 backdrop-blur">
        <Link href="/mi" className="flex items-center gap-2">
          <Logo size={26} />
          <span className="serif text-lg font-semibold">Conforme</span>
        </Link>
        <div className="flex items-center gap-3 text-sm">
          <span className="max-w-[9rem] truncate text-texto-suave">{empleado.apellidoNombre}</span>
          <form action={salirEmpleado}>
            <button type="submit" className="text-texto-suave underline">
              Salir
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-2xl p-4">{children}</main>
    </div>
  )
}
