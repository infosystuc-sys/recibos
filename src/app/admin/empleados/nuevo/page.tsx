import Link from 'next/link'
import { formatearCuil } from '@/lib/cuil'
import { exigirAdmin } from '@/lib/sesion'
import { clienteServidor } from '@/lib/supabase/cliente-servidor'
import FormularioEmpleado, { type EmpleadoInicial } from './formulario'

interface Params {
  searchParams: Promise<{ empresa?: string; legajo?: string }>
}

export default async function PaginaNuevoEmpleado({ searchParams }: Params) {
  await exigirAdmin('operar')
  const sp = await searchParams
  const supabase = await clienteServidor()

  const { data: empresas } = await supabase
    .from('empresas')
    .select('id, razon_social')
    .order('razon_social')

  const empresaId = sp.empresa || empresas?.[0]?.id || ''
  const legajoNum = sp.legajo ? Number(sp.legajo) : null

  let inicial: EmpleadoInicial = { empresaId, activo: true }
  let edicion = false

  if (empresaId && legajoNum && Number.isInteger(legajoNum)) {
    const { data } = await supabase
      .from('legajos')
      .select('numero, activo, sector, personas(cuil, apellido_nombre, email, telefono)')
      .eq('empresa_id', empresaId)
      .eq('numero', legajoNum)
      .maybeSingle()

    if (data) {
      edicion = true
      inicial = {
        empresaId,
        legajo: data.numero,
        activo: data.activo,
        sector: data.sector ?? undefined,
        cuil: data.personas ? formatearCuil(data.personas.cuil) : undefined,
        apellidoNombre: data.personas?.apellido_nombre,
        email: data.personas?.email ?? undefined,
        telefono: data.personas?.telefono ?? undefined,
      }
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center gap-3 text-sm">
        <Link href={`/admin/empleados?empresa=${empresaId}`} className="underline">
          Empleados
        </Link>
        <span className="text-texto-tenue">/</span>
        <span>{edicion ? `Editar legajo ${inicial.legajo}` : 'Nuevo'}</span>
      </div>
      <h1 className="text-2xl">
        {edicion ? 'Editar empleado' : 'Nuevo empleado'}
      </h1>

      {empresas && empresas.length > 0 ? (
        <FormularioEmpleado empresas={empresas} inicial={inicial} edicion={edicion} />
      ) : (
        <p className="text-sm text-texto-suave">
          Primero cargá una empresa en{' '}
          <Link href="/admin/empresas" className="underline">
            Empresas
          </Link>
          .
        </p>
      )}
    </section>
  )
}
