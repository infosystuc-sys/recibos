'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { publicarLiquidacion } from '@/acciones/liquidaciones'

export default function PublicarBoton({ liquidacionId }: { liquidacionId: string }) {
  const router = useRouter()
  const [pendiente, iniciar] = useTransition()
  const [error, setError] = useState<string | null>(null)

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        disabled={pendiente}
        onClick={() => {
          if (
            !window.confirm(
              'Al publicar, los empleados de esta liquidación van a poder ver y conformar sus recibos. ¿Confirmás?',
            )
          ) {
            return
          }
          setError(null)
          iniciar(async () => {
            const r = await publicarLiquidacion(liquidacionId)
            if ('error' in r) setError(r.error)
            else router.refresh()
          })
        }}
        className="self-start rounded bg-exito px-4 py-2 text-sm text-white disabled:opacity-50"
      >
        {pendiente ? 'Publicando…' : 'Publicar liquidación'}
      </button>
      {error && (
        <p role="alert" className="text-sm text-error">
          {error}
        </p>
      )}
    </div>
  )
}
