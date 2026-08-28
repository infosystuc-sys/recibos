'use client'

import { useState, useTransition } from 'react'
import { procesarColaAhora } from '@/acciones/notificaciones-admin'

export default function ProcesarAhora() {
  const [pendiente, iniciar] = useTransition()
  const [msg, setMsg] = useState<string | null>(null)

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        disabled={pendiente}
        onClick={() => {
          setMsg(null)
          iniciar(async () => {
            const r = await procesarColaAhora()
            if ('error' in r) setMsg(r.error)
            else
              setMsg(
                `Tomadas ${r.tomadas} · enviadas ${r.enviadas} · fallidas ${r.fallidas} · descartadas ${r.descartadas}`,
              )
          })
        }}
        className="self-start rounded bg-blue-900 px-3 py-2 text-sm text-white disabled:opacity-50"
      >
        {pendiente ? 'Procesando…' : 'Procesar cola ahora'}
      </button>
      {msg && <p className="text-sm text-neutral-600 dark:text-neutral-400">{msg}</p>}
    </div>
  )
}
