import Link from 'next/link'
import { exigirAdmin } from '@/lib/sesion'
import { clienteServidor } from '@/lib/supabase/cliente-servidor'
import Ingesta from './ingesta'

export default async function PaginaIngesta() {
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
        <Link href="/admin/liquidaciones" className="underline">
          Liquidaciones
        </Link>
        <span className="text-neutral-400">/</span>
        <span>Ingesta</span>
      </div>
      <h1 className="text-xl font-semibold">Ingesta de recibos</h1>

      {empresas && empresas.length > 0 ? (
        <Ingesta empresas={empresas} />
      ) : (
        <p className="text-sm text-neutral-600">
          Primero cargá una empresa y su padrón.
        </p>
      )}
    </section>
  )
}
