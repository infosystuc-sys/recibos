'use client'

import { useState, useTransition } from 'react'
import { rechazarRecibo } from '@/acciones/recibos-empleado'

export default function FormularioRechazo({ reciboId }: { reciboId: string }) {
  const [motivo, setMotivo] = useState('')
  const [acepta, setAcepta] = useState(false)
  const [pendiente, iniciar] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const listo = acepta && motivo.trim().length >= 3

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-base">
        <span className="font-medium">Motivo del rechazo</span>
        <textarea
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          rows={4}
          maxLength={2000}
          placeholder="Ej.: los días trabajados no coinciden, falta un concepto, el neto está mal…"
          className="rounded-lg border border-borde bg-superficie px-3 py-2 text-base"
        />
      </label>

      <label className="flex items-start gap-3 text-base">
        <input
          type="checkbox"
          checked={acepta}
          onChange={(e) => setAcepta(e.target.checked)}
          className="mt-1 size-5"
        />
        <span>Entiendo que el rechazo queda registrado y no puedo conformar esta versión después.</span>
      </label>

      {error && (
        <p role="alert" className="text-base text-error">
          {error}
        </p>
      )}

      <button
        type="button"
        disabled={!listo || pendiente}
        onClick={() => {
          setError(null)
          iniciar(async () => {
            const r = await rechazarRecibo(reciboId, motivo)
            if (r && 'error' in r) setError(r.error)
          })
        }}
        className="rounded-lg border border-error px-4 py-3 text-lg font-medium text-error disabled:opacity-50"
      >
        {pendiente ? 'Registrando…' : 'Confirmar rechazo'}
      </button>
    </div>
  )
}
