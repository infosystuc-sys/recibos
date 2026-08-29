import { exigirAdmin } from '@/lib/sesion'
import { clienteServidor } from '@/lib/supabase/cliente-servidor'
import ControlesUsuario from './controles'
import FormularioInvitar from './formulario-invitar'

export default async function PaginaUsuarios() {
  const admin = await exigirAdmin('administrar')
  const supabase = await clienteServidor()
  const { data: usuarios } = await supabase
    .from('admin_usuarios')
    .select('id, nombre, email, rol, activo')
    .order('nombre')

  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-2xl">Usuarios administradores</h1>

      <table className="w-full text-sm">
        <thead className="border-b border-borde text-left text-xs uppercase tracking-wide text-texto-tenue">
          <tr>
            <th className="py-2">Nombre</th>
            <th>Email</th>
            <th>Rol y estado</th>
          </tr>
        </thead>
        <tbody>
          {(usuarios ?? []).map((u) => (
            <tr key={u.id} className="border-t border-borde-suave align-top">
              <td className="py-2">{u.nombre}</td>
              <td className="py-2">{u.email}</td>
              <td className="py-2">
                <ControlesUsuario
                  usuarioId={u.id}
                  rol={u.rol}
                  activo={u.activo}
                  esUnoMismo={u.id === admin.id}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <FormularioInvitar />
    </section>
  )
}
