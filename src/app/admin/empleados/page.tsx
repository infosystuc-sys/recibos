import Link from 'next/link'
import { formatearCuil } from '@/lib/cuil'
import { puede } from '@/lib/permisos'
import { exigirAdmin } from '@/lib/sesion'
import { clienteServicio } from '@/lib/supabase/cliente-servicio'
import { clienteServidor } from '@/lib/supabase/cliente-servidor'
import GenerarCodigo from './generar-codigo'

const ESTADOS = ['pendiente', 'activo', 'bloqueado'] as const

interface Params {
  searchParams: Promise<{ empresa?: string; estado?: string; q?: string }>
}

export default async function PaginaEmpleados({ searchParams }: Params) {
  const admin = await exigirAdmin('ver')
  const sp = await searchParams
  const supabase = await clienteServidor()

  const { data: empresas } = await supabase
    .from('empresas')
    .select('id, razon_social, nombre_corto')
    .order('razon_social')

  const empresaId = sp.empresa || empresas?.[0]?.id || ''

  let legajos: Array<{
    id: string
    numero: number
    activo: boolean
    personas: {
      id: string
      cuil: string
      apellido_nombre: string
      estado: string
    } | null
  }> = []

  if (empresaId) {
    const { data } = await supabase
      .from('legajos')
      .select('id, numero, activo, personas(id, cuil, apellido_nombre, estado)')
      .eq('empresa_id', empresaId)
      .order('numero')
    legajos = data ?? []
  }

  const personaIds = legajos.map((l) => l.personas?.id).filter((id): id is string => Boolean(id))
  const conCodigoVigente = new Set<string>()
  if (personaIds.length > 0) {
    // codigos_activacion no tiene política RLS de lectura a propósito (defensa
    // en profundidad sobre los hashes). El admin ya pasó exigirAdmin, así que
    // acá se consulta solo el estado con la clave de servicio.
    const servicio = clienteServicio()
    const { data: codigos } = await servicio
      .from('codigos_activacion')
      .select('persona_id, expira_at')
      .in('persona_id', personaIds)
      .is('usado_at', null)
      .is('anulado_at', null)
    for (const c of codigos ?? []) {
      if (new Date(c.expira_at) > new Date()) conCodigoVigente.add(c.persona_id)
    }
  }

  const q = (sp.q ?? '').trim().toLowerCase()
  const filtrados = legajos.filter((l) => {
    if (sp.estado && l.personas?.estado !== sp.estado) return false
    if (!q) return true
    return (
      String(l.numero).includes(q) ||
      (l.personas?.apellido_nombre ?? '').toLowerCase().includes(q) ||
      (l.personas?.cuil ?? '').includes(q.replace(/\D/g, ''))
    )
  })

  const puedeOperar = puede(admin.rol, 'operar')

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl">Empleados</h1>
        <div className="flex gap-3 text-sm">
          {puedeOperar && (
            <Link href="/admin/empleados/importar" className="underline">
              Importar padrón
            </Link>
          )}
          {puedeOperar && (
            <Link
              href={`/admin/empleados/nuevo?empresa=${empresaId}`}
              className="rounded bg-marron px-3 py-2 text-white"
            >
              Nuevo empleado
            </Link>
          )}
        </div>
      </div>

      <form method="get" className="flex flex-wrap items-end gap-3 text-sm">
        <label className="flex flex-col gap-1">
          Empresa
          <select name="empresa" defaultValue={empresaId} className="rounded-lg border border-borde bg-superficie px-2 py-1">
            {(empresas ?? []).map((e) => (
              <option key={e.id} value={e.id}>
                {e.razon_social}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          Estado
          <select name="estado" defaultValue={sp.estado ?? ''} className="rounded-lg border border-borde bg-superficie px-2 py-1">
            <option value="">Todos</option>
            {ESTADOS.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          Buscar
          <input
            name="q"
            defaultValue={sp.q ?? ''}
            placeholder="legajo, nombre o CUIL"
            className="rounded-lg border border-borde bg-superficie px-2 py-1"
          />
        </label>
        <button type="submit" className="rounded-lg border border-borde bg-superficie px-3 py-1">
          Filtrar
        </button>
      </form>

      {filtrados.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-borde text-left text-xs uppercase tracking-wide text-texto-tenue">
              <tr>
                <th className="py-2">Legajo</th>
                <th>Nombre</th>
                <th>CUIL</th>
                <th>Estado</th>
                <th>Activación</th>
                {puedeOperar && <th></th>}
              </tr>
            </thead>
            <tbody>
              {filtrados.map((l) => (
                <tr key={l.id} className="border-t border-borde-suave align-top">
                  <td className="py-2">
                    {l.numero}
                    {!l.activo && <span className="ml-1 text-xs text-texto-tenue">(inactivo)</span>}
                  </td>
                  <td className="py-2">{l.personas?.apellido_nombre ?? '—'}</td>
                  <td className="py-2">{l.personas ? formatearCuil(l.personas.cuil) : '—'}</td>
                  <td className="py-2 capitalize">{l.personas?.estado ?? '—'}</td>
                  <td className="py-2">
                    {l.personas?.estado === 'activo'
                      ? 'Ya activó'
                      : l.personas && conCodigoVigente.has(l.personas.id)
                        ? 'Código vigente'
                        : 'Sin código'}
                  </td>
                  {puedeOperar && (
                    <td className="py-2">
                      <div className="flex flex-col gap-2">
                        {l.personas && l.personas.estado !== 'activo' && (
                          <GenerarCodigo
                            personaId={l.personas.id}
                            tieneCodigoVigente={conCodigoVigente.has(l.personas.id)}
                          />
                        )}
                        <Link
                          href={`/admin/empleados/nuevo?empresa=${empresaId}&legajo=${l.numero}`}
                          className="text-sm underline"
                        >
                          Editar
                        </Link>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-texto-suave">
          {empresaId
            ? 'No hay empleados que coincidan con el filtro.'
            : 'Todavía no hay empresas. Cargá una y después importá su padrón.'}
        </p>
      )}
    </section>
  )
}
