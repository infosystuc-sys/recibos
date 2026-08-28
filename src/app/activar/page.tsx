'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { activarCuenta } from '@/acciones/activacion'

export default function PaginaActivar() {
  const [estado, accion, pendiente] = useActionState(activarCuenta, null)

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-8 p-6">
      <div>
        <h1 className="text-3xl font-semibold">Activá tu cuenta</h1>
        <p className="mt-1 text-neutral-600 dark:text-neutral-400">
          Con tu CUIL y el código de un solo uso que te dio la administración.
        </p>
      </div>

      <form action={accion} className="flex flex-col gap-5">
        <label className="flex flex-col gap-2 text-base">
          CUIL
          <input
            name="cuil"
            inputMode="numeric"
            required
            defaultValue={estado?.cuil ?? ''}
            placeholder="20-12345678-9"
            className="rounded-lg border px-4 py-3 text-lg"
          />
        </label>

        <label className="flex flex-col gap-2 text-base">
          Código de activación
          <input
            name="codigo"
            required
            defaultValue={estado?.codigo ?? ''}
            autoCapitalize="characters"
            autoComplete="one-time-code"
            className="rounded-lg border px-4 py-3 text-lg tracking-widest uppercase"
          />
        </label>

        <label className="flex flex-col gap-2 text-base">
          Elegí una clave (mínimo 8 caracteres)
          <input
            name="clave"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            className="rounded-lg border px-4 py-3 text-lg"
          />
        </label>

        <label className="flex flex-col gap-2 text-base">
          Repetí la clave
          <input
            name="claveRepetida"
            type="password"
            autoComplete="new-password"
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
          {pendiente ? 'Activando…' : 'Activar y entrar'}
        </button>
      </form>

      <p className="text-base text-neutral-600 dark:text-neutral-400">
        ¿Ya activaste?{' '}
        <Link href="/mi/ingresar" className="font-medium text-blue-900 underline dark:text-blue-300">
          Ingresá con tu clave
        </Link>
        .
      </p>
    </main>
  )
}
