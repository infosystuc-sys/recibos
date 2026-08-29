'use client'

import { useState, useTransition } from 'react'
import { registrarConformidad } from '@/acciones/recibos-empleado'

export default function FormularioConformidad({ reciboId }: { reciboId: string }) {
  const [acepta, setAcepta] = useState(false)
  const [pendiente, iniciar] = useTransition()
  const [error, setError] = useState<string | null>(null)

  return (
    <div className="flex flex-col gap-4">
      <label className="flex items-start gap-3 text-base">
        <input
          type="checkbox"
          checked={acepta}
          onChange={(e) => setAcepta(e.target.checked)}
          className="mt-1 size-5"
        />
        <span>Leí el recibo y presto conformidad con su contenido.</span>
      </label>

      {error && (
        <p role="alert" className="text-base text-error">
          {error}
        </p>
      )}

      <button
        type="button"
        disabled={!acepta || pendiente}
        onClick={() => {
          setError(null)
          iniciar(async () => {
            const r = await registrarConformidad(reciboId)
            if (r && 'error' in r) setError(r.error)
          })
        }}
        className="rounded-lg bg-marron px-4 py-3 text-lg font-medium text-white disabled:opacity-50"
      >
        {pendiente ? 'Registrando…' : 'Confirmar conformidad'}
      </button>
    </div>
  )
}
