'use client'

import { useActionState } from 'react'
import { invitarAdministrador } from '@/acciones/administradores'

export default function FormularioInvitar() {
  const [error, accion, pendiente] = useActionState(invitarAdministrador, null)

  return (
    <form action={accion} className="flex flex-col gap-3 rounded border p-4">
      <h2 className="text-sm font-semibold">Invitar administrador</h2>

      <div className="flex flex-wrap gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Nombre
          <input name="nombre" required className="rounded border px-3 py-2" />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Email
          <input name="email" type="email" required className="rounded border px-3 py-2" />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Rol
          <select name="rol" defaultValue="consulta" className="rounded border px-3 py-2">
            <option value="consulta">consulta</option>
            <option value="operador">operador</option>
            <option value="admin">admin</option>
          </select>
        </label>
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pendiente}
        className="self-start rounded bg-blue-900 px-4 py-2 text-sm text-white disabled:opacity-50"
      >
        {pendiente ? 'Invitando…' : 'Enviar invitación'}
      </button>
    </form>
  )
}
