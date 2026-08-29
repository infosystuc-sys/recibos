'use client'

import { useActionState } from 'react'
import { invitarAdministrador } from '@/acciones/administradores'

export default function FormularioInvitar() {
  const [error, accion, pendiente] = useActionState(invitarAdministrador, null)

  return (
    <form action={accion} className="flex flex-col gap-3 rounded-lg border border-borde p-4">
      <h2 className="text-base font-semibold">Invitar administrador</h2>

      <div className="flex flex-wrap gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Nombre
          <input name="nombre" required className="rounded-lg border border-borde bg-superficie px-3 py-2" />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Email
          <input name="email" type="email" required className="rounded-lg border border-borde bg-superficie px-3 py-2" />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Rol
          <select name="rol" defaultValue="consulta" className="rounded-lg border border-borde bg-superficie px-3 py-2">
            <option value="consulta">consulta</option>
            <option value="operador">operador</option>
            <option value="admin">admin</option>
          </select>
        </label>
      </div>

      {error && (
        <p role="alert" className="text-sm text-error">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pendiente}
        className="self-start rounded bg-marron px-4 py-2 text-sm text-white disabled:opacity-50"
      >
        {pendiente ? 'Invitando…' : 'Enviar invitación'}
      </button>
    </form>
  )
}
