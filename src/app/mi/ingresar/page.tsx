'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { ingresarEmpleado } from '@/acciones/sesion-empleado'

export default function PaginaIngresarEmpleado() {
  const [estado, accion, pendiente] = useActionState(ingresarEmpleado, null)

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-8 p-6">
      <div>
        <h1 className="text-3xl font-semibold">Conforme</h1>
        <p className="mt-1 text-neutral-600 dark:text-neutral-400">Tus recibos de sueldo</p>
      </div>

      <form action={accion} className="flex flex-col gap-5">
        <label className="flex flex-col gap-2 text-base">
          CUIL
          <input
            name="cuil"
            inputMode="numeric"
            autoComplete="username"
            required
            defaultValue={estado?.cuil ?? ''}
            placeholder="20-12345678-9"
            className="rounded-lg border px-4 py-3 text-lg"
          />
        </label>

        <label className="flex flex-col gap-2 text-base">
          Clave
          <input
            name="clave"
            type="password"
            autoComplete="current-password"
            required
            className="rounded-lg border px-4 py-3 text-lg"
          />
        </label>

        {estado?.error && (
          <p role="alert" className="text-base text-red-600">
            {estado.error}
          </p>
        )}

        <button
          type="submit"
          disabled={pendiente}
          className="rounded-lg bg-blue-900 px-4 py-3 text-lg font-medium text-white disabled:opacity-50"
        >
          {pendiente ? 'Ingresando…' : 'Ingresar'}
        </button>
      </form>

      <p className="text-base text-neutral-600 dark:text-neutral-400">
        ¿Primera vez?{' '}
        <Link href="/activar" className="font-medium text-blue-900 underline dark:text-blue-300">
          Activá tu cuenta
        </Link>{' '}
        con el código que te dieron.
      </p>
    </main>
  )
}
