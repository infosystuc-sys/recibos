import Link from 'next/link'
import { formatearCuil } from '@/lib/cuil'
import { exigirAdmin } from '@/lib/sesion'
import { clienteServidor } from '@/lib/supabase/cliente-servidor'

export default async function PaginaEmpresas() {
  const admin = await exigirAdmin('ver')
  const supabase = await clienteServidor()
  const { data: empresas } = await supabase
    .from('empresas')
    .select('id, razon_social, cuit, nombre_corto, activa')
    .order('razon_social')

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl">Empresas</h1>
        {admin.rol === 'admin' && (
          <Link
            href="/admin/empresas/nueva"
            className="inline-flex items-center rounded-lg bg-marron px-3.5 py-2 text-sm font-medium text-white hover:bg-marron-hover"
          >
            Nueva empresa
          </Link>
        )}
      </div>

      {empresas?.length ? (
        <table className="w-full text-sm">
          <thead className="border-b border-borde text-left text-xs uppercase tracking-wide text-texto-tenue">
            <tr>
              <th className="py-2">Razón social</th>
              <th>CUIT</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {empresas.map((e) => (
              <tr key={e.id} className="border-t border-borde-suave">
                <td className="py-2">{e.razon_social}</td>
                <td>{formatearCuil(e.cuit)}</td>
                <td>{e.activa ? 'Activa' : 'Inactiva'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="text-sm text-texto-suave">
          Todavía no hay empresas cargadas. Creá la primera para poder importar su padrón.
        </p>
      )}
    </section>
  )
}
