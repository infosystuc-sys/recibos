import Link from 'next/link'
import { Marca } from '@/componentes/logo'
import { EnlaceBoton } from '@/componentes/ui'

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-8 p-6">
      <div className="flex flex-col gap-3">
        <Marca />
        <p className="text-sm text-texto-suave">Recibos de sueldo con conformidad digital.</p>
      </div>

      <div className="flex flex-col gap-3">
        <EnlaceBoton href="/mi/ingresar" className="w-full py-3 text-base">
          Soy empleado
        </EnlaceBoton>
        <Link
          href="/ingresar"
          className="rounded-lg border border-borde bg-superficie px-4 py-3 text-center text-sm hover:bg-superficie-2"
        >
          Administración
        </Link>
      </div>
    </main>
  )
}
