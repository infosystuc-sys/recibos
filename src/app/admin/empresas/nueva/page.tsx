import Link from 'next/link'
import { exigirAdmin } from '@/lib/sesion'
import FormularioNuevaEmpresa from './formulario'

export default async function PaginaNuevaEmpresa() {
  await exigirAdmin('administrar')

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center gap-3 text-sm">
        <Link href="/admin/empresas" className="underline">
          Empresas
        </Link>
        <span className="text-texto-tenue">/</span>
        <span>Nueva</span>
      </div>
      <h1 className="text-2xl">Nueva empresa</h1>
      <FormularioNuevaEmpresa />
    </section>
  )
}
