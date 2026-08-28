import { exigirAdmin } from '@/lib/sesion'

export default async function InicioAdmin() {
  const admin = await exigirAdmin('ver')
  return <h1 className="text-xl font-semibold">Hola, {admin.nombre}</h1>
}
