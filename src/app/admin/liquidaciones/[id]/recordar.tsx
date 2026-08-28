'use client'

import { useState, useTransition } from 'react'
import { recordarPendientes } from '@/acciones/notificaciones-admin'

export default function RecordarPendientes({ liquidacionId }: { liquidacionId: string }) {
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
            const r = await recordarPendientes(liquidacionId)
            setMsg(
              'error' in r
                ? r.error
                : r.encolados === 0
                  ? 'No hay pendientes para recordar.'
                  : `${r.encolados} recordatorio(s) encolado(s). Los envía el cron.`,
            )
          })
        }}
        className="self-start rounded border px-3 py-1.5 text-sm disabled:opacity-50"
      >
        {pendiente ? 'Encolando…' : 'Recordar a los pendientes'}
      </button>
      {msg && <p className="text-sm text-neutral-600 dark:text-neutral-400">{msg}</p>}
    </div>
  )
}
