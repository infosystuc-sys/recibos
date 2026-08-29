import Link from 'next/link'
import { exigirAdmin } from '@/lib/sesion'
import { clienteServidor } from '@/lib/supabase/cliente-servidor'
import ImportadorPadron from './importador'

export default async function PaginaImportarPadron() {
  await exigirAdmin('operar')
  const supabase = await clienteServidor()
  const { data: empresas } = await supabase
    .from('empresas')
    .select('id, razon_social')
    .eq('activa', true)
    .order('razon_social')

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center gap-3 text-sm">
        <Link href="/admin/empleados" className="underline">
          Empleados
        </Link>
        <span className="text-neutral-400">/</span>
        <span>Importar padrón</span>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Importar padrón</h1>
        <Link
          href="/admin/empleados/importar/plantilla-padron"
          prefetch={false}
          className="text-sm underline"
        >
          Descargar plantilla
        </Link>
      </div>

      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        La plantilla trae las columnas: número de legajo, apellido, nombre, CUIL, mail y
        celular. También sirve un CSV de Tango con una sola columna «apellido y nombre».
      </p>

      {empresas && empresas.length > 0 ? (
        <ImportadorPadron empresas={empresas} />
      ) : (
        <p className="text-sm text-neutral-600">
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
