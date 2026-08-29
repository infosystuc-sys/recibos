'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { EtiquetaSeccion } from '@/componentes/ui'

const OPERACIONES = [
  { href: '/admin/empresas', texto: 'Empresas' },
  { href: '/admin/empleados', texto: 'Empleados' },
  { href: '/admin/liquidaciones', texto: 'Liquidaciones' },
  { href: '/admin/observaciones', texto: 'Observaciones' },
]

function Item({ href, texto, exacto = false }: { href: string; texto: string; exacto?: boolean }) {
  const path = usePathname()
  const activo = exacto ? path === href : path === href || path.startsWith(href + '/')
  return (
    <Link
      href={href}
      aria-current={activo ? 'page' : undefined}
      className={`shrink-0 whitespace-nowrap rounded-lg px-3 py-2 text-sm transition-colors ${
        activo
          ? 'bg-acento-suave font-medium text-texto'
          : 'text-texto-suave hover:bg-superficie-2 hover:text-texto'
      }`}
    >
      {texto}
    </Link>
  )
}

export default function NavAdmin({ esAdmin }: { esAdmin: boolean }) {
  return (
    <nav className="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible">
      <div className="hidden md:block">
        <EtiquetaSeccion>Menú principal</EtiquetaSeccion>
      </div>
      <Item href="/admin" texto="Panel de control" exacto />
      <div className="mt-2 hidden md:block">
        <EtiquetaSeccion>Operaciones</EtiquetaSeccion>
      </div>
      {OPERACIONES.map((o) => (
        <Item key={o.href} {...o} />
      ))}
      {esAdmin && <Item href="/admin/usuarios" texto="Usuarios" />}
    </nav>
  )
}
