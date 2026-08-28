'use client'

import { useState, useTransition } from 'react'
import { cambiarRol, desactivarAdministrador } from '@/acciones/administradores'
import type { RolAdmin } from '@/lib/permisos'

const ROLES: RolAdmin[] = ['admin', 'operador', 'consulta']

export default function ControlesUsuario({
  usuarioId,
  rol,
  activo,
  esUnoMismo,
}: {
  usuarioId: string
  rol: RolAdmin
  activo: boolean
  esUnoMismo: boolean
}) {
  const [pendiente, iniciar] = useTransition()
  const [error, setError] = useState<string | null>(null)

  if (esUnoMismo) {
    return (
      <div className="flex items-center gap-2 text-sm text-neutral-500">
        <span className="capitalize">{rol}</span>
        <span>· vos</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-3">
        <select
          value={rol}
          disabled={pendiente || !activo}
          onChange={(e) => {
            setError(null)
            const nuevo = e.target.value as RolAdmin
            iniciar(async () => {
              const err = await cambiarRol(usuarioId, nuevo)
              if (err) setError(err)
            })
          }}
          className="rounded border px-2 py-1 text-sm capitalize"
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>

        {activo ? (
          <button
            type="button"
            disabled={pendiente}
            onClick={() => {
              setError(null)
              iniciar(async () => {
                const err = await desactivarAdministrador(usuarioId)
                if (err) setError(err)
              })
            }}
            className="text-sm text-red-600 underline disabled:opacity-50"
          >
            Desactivar
          </button>
        ) : (
          <span className="text-sm text-neutral-500">Inactivo</span>
        )}
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  )
}
