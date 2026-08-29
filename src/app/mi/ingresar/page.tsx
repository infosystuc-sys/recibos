'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { ingresarEmpleado } from '@/acciones/sesion-empleado'
import { Marca } from '@/componentes/logo'
import { Alerta } from '@/componentes/ui'

const input =
  'w-full rounded-xl border border-borde bg-superficie px-4 py-3 text-lg outline-none focus:border-acento focus:ring-2 focus:ring-acento/20'

export default function PaginaIngresarEmpleado() {
  const [estado, accion, pendiente] = useActionState(ingresarEmpleado, null)

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-8 p-6">
      <div className="flex flex-col gap-3">
        <Marca />
        <p className="text-texto-suave">Tus recibos de sueldo</p>
      </div>

      <form action={accion} className="flex flex-col gap-5">
        <label className="flex flex-col gap-2 text-base">
          <span className="font-medium">CUIL</span>
          <input
            name="cuil"
            inputMode="numeric"
            autoComplete="username"
            required
            defaultValue={estado?.cuil ?? ''}
            placeholder="20-12345678-9"
            className={input}
          />
        </label>

        <label className="flex flex-col gap-2 text-base">
          <span className="font-medium">Clave</span>
          <input
            name="clave"
            type="password"
            autoComplete="current-password"
            required
            className={input}
          />
        </label>

        {estado?.error && <Alerta>{estado.error}</Alerta>}

        <button
          type="submit"
          disabled={pendiente}
          className="rounded-xl bg-marron px-4 py-3 text-lg font-medium text-white hover:bg-marron-hover disabled:opacity-50"
        >
          {pendiente ? 'Ingresando…' : 'Ingresar'}
        </button>
      </form>

      <p className="text-base text-texto-suave">
        ¿Primera vez?{' '}
        <Link href="/activar" className="font-medium text-acento-oscuro underline">
          Activá tu cuenta
        </Link>{' '}
        con el código que te dieron.
      </p>
    </main>
  )
}
