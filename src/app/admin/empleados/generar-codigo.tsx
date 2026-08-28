'use client'

import { useState, useTransition } from 'react'
import { generarCodigoActivacion } from '@/acciones/codigos'

export default function GenerarCodigo({
  personaId,
  tieneCodigoVigente,
}: {
  personaId: string
  tieneCodigoVigente: boolean
}) {
  const [pendiente, iniciar] = useTransition()
  const [codigo, setCodigo] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copiado, setCopiado] = useState(false)

  function generar() {
    setError(null)
    setCodigo(null)
    iniciar(async () => {
      const r = await generarCodigoActivacion(personaId, tieneCodigoVigente ? 'reset' : 'alta')
      if ('error' in r) setError(r.error)
      else setCodigo(r.codigo)
    })
  }

  if (codigo) {
    return (
      <div className="flex flex-col gap-1 rounded border-2 border-amber-400 bg-amber-50 p-3">
        <span className="text-lg font-bold tracking-widest">{codigo}</span>
        <span className="text-xs font-semibold text-amber-800">
          Anotalo ahora: no se puede volver a ver
        </span>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(codigo).then(
              () => {
                setCopiado(true)
                setTimeout(() => setCopiado(false), 2000)
              },
              () => setCopiado(false),
            )
          }}
          className="self-start text-xs text-blue-900 underline"
        >
          {copiado ? 'Copiado' : 'Copiar'}
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={generar}
        disabled={pendiente}
        className="self-start text-sm text-blue-900 underline disabled:opacity-50"
      >
        {pendiente
          ? 'Generando…'
          : tieneCodigoVigente
            ? 'Regenerar código'
            : 'Generar código'}
      </button>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  )
}
