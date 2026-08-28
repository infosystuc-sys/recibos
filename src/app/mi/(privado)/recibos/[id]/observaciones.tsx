'use client'

import { useActionState } from 'react'
import { crearObservacion } from '@/acciones/observaciones'

interface Observacion {
  id: string
  texto: string
  estado: string
  respuesta: string | null
  created_at: string
}

export default function Observaciones({
  reciboId,
  observaciones,
}: {
  reciboId: string
  observaciones: Observacion[]
}) {
  const [error, accion, pendiente] = useActionState(crearObservacion.bind(null, reciboId), null)

  return (
    <section className="flex flex-col gap-4 border-t pt-5">
      <h2 className="text-lg font-semibold">Observaciones</h2>
      <p className="text-sm text-neutral-500">
        Si algo del recibo no te cierra, dejá un reclamo. No afecta tu conformidad ni la
        descarga: llega a la administración para que lo revise.
      </p>

      {observaciones.length > 0 && (
        <ul className="flex flex-col gap-3">
          {observaciones.map((o) => (
            <li key={o.id} className="rounded-lg border p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs text-neutral-500">
                  {new Date(o.created_at).toLocaleString('es-AR')}
                </span>
                <span
                  className={
                    o.estado === 'resuelta'
                      ? 'text-green-700 dark:text-green-400'
                      : 'text-amber-700 dark:text-amber-400'
                  }
                >
                  {o.estado === 'resuelta' ? 'Respondida' : 'Abierta'}
                </span>
              </div>
              <p className="mt-1 whitespace-pre-wrap">{o.texto}</p>
              {o.respuesta && (
                <p className="mt-2 rounded bg-neutral-100 p-2 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200">
                  <span className="font-medium">Respuesta: </span>
                  {o.respuesta}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      <form action={accion} className="flex flex-col gap-2">
        <textarea
          name="texto"
          required
          rows={3}
          placeholder="Escribí tu observación…"
          className="rounded-lg border px-3 py-2 text-base"
        />
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={pendiente}
          className="self-start rounded-lg border px-4 py-2 text-base disabled:opacity-50"
        >
          {pendiente ? 'Enviando…' : 'Enviar observación'}
        </button>
      </form>
    </section>
  )
}
