'use client'

import { useActionState } from 'react'
import { responderObservacion } from '@/acciones/observaciones'

export default function Responder({ observacionId }: { observacionId: string }) {
  const [error, accion, pendiente] = useActionState(
    responderObservacion.bind(null, observacionId),
    null,
  )

  return (
    <form action={accion} className="mt-2 flex flex-col gap-2">
      <textarea
        name="respuesta"
        required
        rows={2}
        placeholder="Respuesta al empleado…"
        className="rounded-lg border border-borde bg-superficie px-2 py-1 text-sm"
      />
      {error && (
        <p role="alert" className="text-sm text-error">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={pendiente}
        className="self-start rounded bg-marron px-3 py-1 text-sm text-white disabled:opacity-50"
      >
        {pendiente ? 'Guardando…' : 'Responder y resolver'}
      </button>
    </form>
  )
}
