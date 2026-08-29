import type { ComponentProps, ReactNode } from 'react'
import Link from 'next/link'

/** Tarjeta blanca con borde cálido, como en las capturas. */
export function Tarjeta({
  className = '',
  children,
}: {
  className?: string
  children: ReactNode
}) {
  return (
    <div className={`rounded-xl border border-borde bg-superficie p-5 ${className}`}>{children}</div>
  )
}

type Tono = 'exito' | 'info' | 'alerta' | 'error' | 'neutro'

const TONOS: Record<Tono, string> = {
  exito: 'bg-exito-fondo text-exito',
  info: 'bg-info-fondo text-info',
  alerta: 'bg-alerta-fondo text-alerta',
  error: 'bg-error-fondo text-error',
  neutro: 'bg-superficie-2 text-texto-suave',
}

/** Pastilla de estado (verde / azul / ámbar / rojo). */
export function Pastilla({ tono = 'neutro', children }: { tono?: Tono; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${TONOS[tono]}`}
    >
      <span className="size-1.5 rounded-full bg-current opacity-70" />
      {children}
    </span>
  )
}

const BASE_BOTON =
  'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none'

export function BotonPrimario({ className = '', ...props }: ComponentProps<'button'>) {
  return (
    <button
      {...props}
      className={`${BASE_BOTON} bg-marron text-white hover:bg-marron-hover ${className}`}
    />
  )
}

export function BotonSecundario({ className = '', ...props }: ComponentProps<'button'>) {
  return (
    <button
      {...props}
      className={`${BASE_BOTON} border border-borde bg-superficie text-texto hover:bg-superficie-2 ${className}`}
    />
  )
}

export function EnlaceBoton({
  href,
  variante = 'primario',
  className = '',
  children,
  ...props
}: {
  href: string
  variante?: 'primario' | 'secundario'
  className?: string
  children: ReactNode
} & Omit<ComponentProps<typeof Link>, 'href' | 'className'>) {
  const estilo =
    variante === 'primario'
      ? 'bg-marron text-white hover:bg-marron-hover'
      : 'border border-borde bg-superficie text-texto hover:bg-superficie-2'
  return (
    <Link href={href} className={`${BASE_BOTON} ${estilo} ${className}`} {...props}>
      {children}
    </Link>
  )
}

/** Rótulo de sección tipo "MENÚ PRINCIPAL". */
export function EtiquetaSeccion({ children }: { children: ReactNode }) {
  return <p className="etiqueta-seccion">{children}</p>
}

export const claseInput =
  'w-full rounded-lg border border-borde bg-superficie px-3 py-2 text-sm outline-none focus:border-acento focus:ring-2 focus:ring-acento/20'

/** Campo etiquetado (label + input). */
export function Campo({
  etiqueta,
  hint,
  children,
}: {
  etiqueta: string
  hint?: ReactNode
  children: ReactNode
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium text-texto">{etiqueta}</span>
      {children}
      {hint && <span className="text-xs text-texto-suave">{hint}</span>}
    </label>
  )
}

export function Alerta({ children }: { children: ReactNode }) {
  return (
    <p
      role="alert"
      className="rounded-lg border border-error/30 bg-error-fondo px-3 py-2 text-sm text-error"
    >
      {children}
    </p>
  )
}
