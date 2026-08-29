'use client'

import { useActionState } from 'react'
import { ingresarAdmin } from '@/acciones/sesion'
import { Marca } from '@/componentes/logo'
import { Alerta, BotonPrimario, Campo, claseInput } from '@/componentes/ui'

export default function PaginaIngresar() {
  const [error, accion, pendiente] = useActionState(ingresarAdmin, null)

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-7 p-6">
      <div className="flex flex-col gap-3">
        <Marca />
        <p className="text-sm text-texto-suave">Panel de administración</p>
      </div>

      <form action={accion} className="flex flex-col gap-4">
        <Campo etiqueta="Email">
          <input
            name="email"
            type="email"
            required
            autoComplete="username"
            className={claseInput}
          />
        </Campo>

        <Campo etiqueta="Contraseña">
          <input
            name="clave"
            type="password"
            required
            autoComplete="current-password"
            className={claseInput}
          />
        </Campo>

        {error && <Alerta>{error}</Alerta>}

        <BotonPrimario type="submit" disabled={pendiente} className="mt-1">
          {pendiente ? 'Ingresando…' : 'Ingresar'}
        </BotonPrimario>
      </form>
    </main>
  )
}
