'use client'

import { useActionState } from 'react'
import { ingresarAdmin } from '@/acciones/sesion'

export default function PaginaIngresar() {
  const [error, accion, pendiente] = useActionState(ingresarAdmin, null)

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Conforme</h1>
        <p className="text-sm text-neutral-600">Panel de administración</p>
      </div>

      <form action={accion} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Email
          <input
            name="email"
            type="email"
            required
            autoComplete="username"
            className="rounded border px-3 py-2"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Contraseña
          <input
            name="clave"
            type="password"
            required
            autoComplete="current-password"
            className="rounded border px-3 py-2"
          />
        </label>

        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={pendiente}
          className="rounded bg-blue-900 px-4 py-2 text-white disabled:opacity-50"
        >
          {pendiente ? 'Ingresando…' : 'Ingresar'}
        </button>
      </form>
    </main>
  )
}
