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
    { data: actividad },
  ] = await Promise.all([
    supabase.from('personas').select('*', { count: 'exact', head: true }),
    supabase.from('personas').select('*', { count: 'exact', head: true }).gte('created_at', desdeMes),
    supabase.from('recibos').select('*', { count: 'exact', head: true }).gte('subido_at', desdeMes),
    supabase
      .from('recibos')
      .select('id, conformidades(id), liquidaciones(estado)')
      .eq('estado', 'vigente'),
    servicio
      .from('conformidades')
      .select('created_at, comprobante_codigo, recibos(nombre_original, legajos(personas(apellido_nombre)))')
      .order('created_at', { ascending: false })
      .limit(6),
  ])

  const firmasPendientes = (vigentes ?? []).filter(
    (r) =>
      !r.conformidades &&
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
        {actividad && actividad.length > 0 ? (
          <ul className="mt-3 divide-y divide-borde-suave">
            {actividad.map((c, i) => {
              const persona = (
                c.recibos as {
                  nombre_original: string
                  legajos: { personas: { apellido_nombre: string } | null } | null
                } | null
              )
              return (
                <li key={i} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <div className="min-w-0">
                    <div className="truncate font-medium">
                      {persona?.legajos?.personas?.apellido_nombre ?? '—'}
                    </div>
                    <div className="text-xs text-texto-suave">
                      Conformó · {c.comprobante_codigo}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <Pastilla tono="exito">Conformado</Pastilla>
                    <span className="w-24 text-right text-xs text-texto-suave">
                      {new Date(c.created_at).toLocaleDateString('es-AR')}
                    </span>
                  </div>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-texto-suave">Todavía no hay conformidades registradas.</p>
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
