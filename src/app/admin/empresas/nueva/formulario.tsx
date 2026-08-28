'use client'

import { useActionState } from 'react'
import { crearEmpresa } from '@/acciones/empresas'

const TEXTO_CONFORMIDAD_POR_DEFECTO =
  'Declaro haber recibido el presente recibo de sueldo y prestar conformidad con su contenido.'

export default function FormularioNuevaEmpresa() {
  const [error, accion, pendiente] = useActionState(crearEmpresa, null)

  return (
    <form action={accion} className="flex max-w-lg flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        Razón social
        <input name="razonSocial" required className="rounded border px-3 py-2" />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        CUIT
        <input
          name="cuit"
          required
          inputMode="numeric"
          placeholder="30-71234567-1"
          className="rounded border px-3 py-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Nombre corto
        <input name="nombreCorto" required className="rounded border px-3 py-2" />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Texto de conformidad
        <textarea
          name="textoConformidad"
          required
          rows={4}
          defaultValue={TEXTO_CONFORMIDAD_POR_DEFECTO}
          className="rounded border px-3 py-2"
        />
        <span className="text-xs text-neutral-500">
          Es el texto que el empleado acepta al prestar conformidad. Se copia íntegro en cada firma.
        </span>
      </label>

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pendiente}
        className="rounded bg-blue-900 px-4 py-2 text-white disabled:opacity-50"
      >
        {pendiente ? 'Creando…' : 'Crear empresa'}
      </button>
    </form>
  )
}
