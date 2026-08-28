'use client'

import { useActionState } from 'react'
import { guardarEmpleado } from '@/acciones/padron'

interface Empresa {
  id: string
  razon_social: string
}

export interface EmpleadoInicial {
  empresaId: string
  legajo?: number
  cuil?: string
  apellidoNombre?: string
  email?: string
  telefono?: string
  sector?: string
  activo?: boolean
}

export default function FormularioEmpleado({
  empresas,
  inicial,
  edicion,
}: {
  empresas: Empresa[]
  inicial: EmpleadoInicial
  edicion: boolean
}) {
  const [error, accion, pendiente] = useActionState(guardarEmpleado, null)

  return (
    <form action={accion} className="flex max-w-lg flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        Empresa
        <select
          name="empresaId"
          defaultValue={inicial.empresaId}
          disabled={edicion}
          className="rounded border px-3 py-2 disabled:bg-neutral-100"
        >
          {empresas.map((e) => (
            <option key={e.id} value={e.id}>
              {e.razon_social}
            </option>
          ))}
        </select>
        {edicion && <input type="hidden" name="empresaId" value={inicial.empresaId} />}
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Legajo
        <input
          name="legajo"
          type="number"
          min={1}
          required
          defaultValue={inicial.legajo ?? ''}
          readOnly={edicion}
          className="rounded border px-3 py-2 read-only:bg-neutral-100"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        CUIL
        <input
          name="cuil"
          required
          defaultValue={inicial.cuil ?? ''}
          placeholder="20-27103275-8"
          className="rounded border px-3 py-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Apellido y nombre
        <input
          name="apellidoNombre"
          required
          defaultValue={inicial.apellidoNombre ?? ''}
          className="rounded border px-3 py-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Email
        <input
          name="email"
          type="email"
          defaultValue={inicial.email ?? ''}
          className="rounded border px-3 py-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Teléfono
        <input
          name="telefono"
          defaultValue={inicial.telefono ?? ''}
          className="rounded border px-3 py-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Sector
        <input
          name="sector"
          defaultValue={inicial.sector ?? ''}
          className="rounded border px-3 py-2"
        />
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="activo" value="si" defaultChecked={inicial.activo ?? true} />
        Legajo activo
      </label>

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pendiente}
        className="self-start rounded bg-blue-900 px-4 py-2 text-white disabled:opacity-50"
      >
        {pendiente ? 'Guardando…' : edicion ? 'Guardar cambios' : 'Crear empleado'}
      </button>
    </form>
  )
}
