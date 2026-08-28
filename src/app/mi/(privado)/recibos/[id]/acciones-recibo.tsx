'use client'

import { useState, useTransition } from 'react'
import { urlRecibo } from '@/acciones/recibos-empleado'

export function DescargarRecibo({ reciboId, habilitado }: { reciboId: string; habilitado: boolean }) {
  const [pendiente, iniciar] = useTransition()
  const [error, setError] = useState<string | null>(null)

  if (!habilitado) {
    return (
      <button
        type="button"
        disabled
        className="rounded-lg border px-4 py-3 text-base text-neutral-400"
        title="Disponible al prestar conformidad"
      >
        Descargar (disponible al conformar)
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        disabled={pendiente}
        onClick={() => {
          setError(null)
          iniciar(async () => {
            const r = await urlRecibo(reciboId, true)
            if ('error' in r) setError(r.error)
            else window.location.href = r.url
          })
        }}
        className="rounded-lg bg-blue-900 px-4 py-3 text-base font-medium text-white disabled:opacity-50"
      >
        {pendiente ? 'Preparando…' : 'Descargar recibo'}
      </button>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  )
}
