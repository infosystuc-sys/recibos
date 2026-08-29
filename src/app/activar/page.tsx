'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { activarCuenta } from '@/acciones/activacion'
import { Marca } from '@/componentes/logo'
import { Alerta } from '@/componentes/ui'

const input =
  'w-full rounded-xl border border-borde bg-superficie px-4 py-3 text-lg outline-none focus:border-acento focus:ring-2 focus:ring-acento/20'

export default function PaginaActivar() {
  const [estado, accion, pendiente] = useActionState(activarCuenta, null)

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-8 p-6">
      <div className="flex flex-col gap-3">
        <Marca />
        <div>
          <h1 className="text-2xl">Activá tu cuenta</h1>
          <p className="mt-1 text-texto-suave">
            Con tu CUIL y el código de un solo uso que te dio la administración.
          </p>
        </div>
      </div>

      <form action={accion} className="flex flex-col gap-5">
        <label className="flex flex-col gap-2 text-base">
          <span className="font-medium">CUIL</span>
          <input
            name="cuil"
            inputMode="numeric"
            required
            defaultValue={estado?.cuil ?? ''}
            placeholder="20-12345678-9"
            className={input}
          />
        </label>

        <label className="flex flex-col gap-2 text-base">
          <span className="font-medium">Código de activación</span>
          <input
            name="codigo"
            required
            defaultValue={estado?.codigo ?? ''}
            autoCapitalize="characters"
            autoComplete="one-time-code"
            className={`${input} tracking-widest uppercase`}
          />
        </label>

        <label className="flex flex-col gap-2 text-base">
          <span className="font-medium">Elegí una clave (mínimo 8 caracteres)</span>
          <input
            name="clave"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            className={input}
          />
        </label>

        <label className="flex flex-col gap-2 text-base">
          <span className="font-medium">Repetí la clave</span>
          <input
            name="claveRepetida"
            type="password"
            autoComplete="new-password"
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
          {pendiente ? 'Activando…' : 'Activar y entrar'}
        </button>
      </form>

      <p className="text-base text-texto-suave">
        ¿Ya activaste?{' '}
        <Link href="/mi/ingresar" className="font-medium text-acento-oscuro underline">
          Ingresá con tu clave
        </Link>
        .
      </p>
    </main>
  )
}
