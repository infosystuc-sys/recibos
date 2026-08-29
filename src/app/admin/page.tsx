import Link from 'next/link'
import { formatearPeriodo } from '@/lib/periodo'
import { exigirAdmin } from '@/lib/sesion'
import { clienteServidor } from '@/lib/supabase/cliente-servidor'
import { clienteServicio } from '@/lib/supabase/cliente-servicio'
import { EnlaceBoton, Pastilla, Tarjeta } from '@/componentes/ui'

function inicioDeMes() {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString()
}

export default async function PanelDeControl() {
  const admin = await exigirAdmin('ver')
  const supabase = await clienteServidor()
  const servicio = clienteServicio()
  const desdeMes = inicioDeMes()

  const [
    { count: totalEmpleados },
    { count: altasMes },
    { count: subidosMes },
    { data: vigentes },
    { data: conformidadesRec },
    { data: rechazosRec },
  ] = await Promise.all([
    supabase.from('personas').select('*', { count: 'exact', head: true }),
    supabase.from('personas').select('*', { count: 'exact', head: true }).gte('created_at', desdeMes),
    supabase.from('recibos').select('*', { count: 'exact', head: true }).gte('subido_at', desdeMes),
    supabase
      .from('recibos')
      .select('id, conformidades(id), rechazos(id), liquidaciones(estado)')
      .eq('estado', 'vigente'),
    servicio
      .from('conformidades')
      .select('created_at, comprobante_codigo, recibos(legajos(personas(apellido_nombre)))')
      .order('created_at', { ascending: false })
      .limit(6),
    servicio
      .from('rechazos')
      .select('created_at, motivo, recibos(legajos(personas(apellido_nombre)))')
      .order('created_at', { ascending: false })
      .limit(6),
  ])

  type ItemActividad = {
    tipo: 'conformidad' | 'rechazo'
    created_at: string
    nombre: string
    detalle: string
  }
  const nombreDe = (r: unknown) =>
    (r as { legajos: { personas: { apellido_nombre: string } | null } | null } | null)?.legajos
      ?.personas?.apellido_nombre ?? '—'
  const actividad: ItemActividad[] = [
    ...(conformidadesRec ?? []).map((c) => ({
      tipo: 'conformidad' as const,
      created_at: c.created_at,
      nombre: nombreDe(c.recibos),
      detalle: `Conformó · ${c.comprobante_codigo}`,
    })),
    ...(rechazosRec ?? []).map((r) => ({
      tipo: 'rechazo' as const,
      created_at: r.created_at,
      nombre: nombreDe(r.recibos),
      detalle: `Rechazó · ${r.motivo}`,
    })),
  ]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 6)

  const firmasPendientes = (vigentes ?? []).filter(
    (r) =>
      !r.conformidades &&
      !r.rechazos &&
      (r.liquidaciones as { estado: string } | null)?.estado === 'publicada',
  ).length

  return (
    <div className="flex flex-col gap-7">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl">Panel de control</h1>
          <p className="mt-1 text-sm text-texto-suave">
            Hola, {admin.nombre.split(/[ ,]/)[0]}. Gestioná empresas, empleados, liquidaciones y el
            estado de las conformidades.
          </p>
        </div>
        <EnlaceBoton href="/admin/liquidaciones/ingesta">Nueva ingesta</EnlaceBoton>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          rotulo="Total empleados"
          valor={totalEmpleados ?? 0}
          nota={altasMes ? `+${altasMes} este mes` : 'Sin altas este mes'}
        />
        <StatCard
          rotulo="Firmas pendientes"
          valor={firmasPendientes}
          nota="Requiere atención"
          alerta={firmasPendientes > 0}
        />
        <StatCard
          rotulo="Recibos subidos (mes actual)"
          valor={subidosMes ?? 0}
          nota="Este mes"
        />
      </div>

      <Tarjeta>
        <div className="flex items-center justify-between">
          <h2 className="text-lg">Actividad reciente</h2>
          <Link href="/admin/liquidaciones" className="text-sm text-acento-oscuro hover:underline">
            Ver liquidaciones →
          </Link>
        </div>
        {actividad.length > 0 ? (
          <ul className="mt-3 divide-y divide-borde-suave">
            {actividad.map((c, i) => (
              <li key={i} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <div className="min-w-0">
                  <div className="truncate font-medium">{c.nombre}</div>
                  <div className="truncate text-xs text-texto-suave">{c.detalle}</div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  {c.tipo === 'conformidad' ? (
                    <Pastilla tono="exito">Conformado</Pastilla>
                  ) : (
                    <Pastilla tono="error">Rechazado</Pastilla>
                  )}
                  <span className="w-24 text-right text-xs text-texto-suave">
                    {new Date(c.created_at).toLocaleDateString('es-AR')}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-texto-suave">Todavía no hay actividad registrada.</p>
        )}
      </Tarjeta>
    </div>
  )
}

function StatCard({
  rotulo,
  valor,
  nota,
  alerta = false,
}: {
  rotulo: string
  valor: number
  nota: string
  alerta?: boolean
}) {
  return (
    <Tarjeta>
      <p className="etiqueta-seccion">{rotulo}</p>
      <p className="serif mt-2 text-4xl font-semibold text-marron">{valor.toLocaleString('es-AR')}</p>
      <p className={`mt-1 text-sm ${alerta && valor > 0 ? 'text-error' : 'text-texto-suave'}`}>
        {nota}
      </p>
    </Tarjeta>
  )
}
