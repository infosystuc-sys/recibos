export function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden
      className="shrink-0"
    >
      <rect width="32" height="32" rx="8" fill="var(--acento)" />
      <path
        d="M16 6.5 25 11v2H7v-2l9-4.5ZM9.5 14.5h2v7h-2v-7Zm5 0h2v7h-2v-7Zm5 0h2v7h-2v-7ZM7 23h18v2.5H7V23Z"
        fill="#fff"
      />
    </svg>
  )
}

/** Logo + nombre, como en las capturas. */
export function Marca({ compacto = false }: { compacto?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <Logo size={compacto ? 28 : 34} />
      <div className="leading-none">
        <div
          className="serif font-semibold text-texto"
          style={{ fontSize: compacto ? '1.05rem' : '1.2rem' }}
        >
          Conforme
        </div>
        <div className="etiqueta-seccion mt-0.5" style={{ fontSize: '0.6rem' }}>
          Recibos de sueldo
        </div>
      </div>
    </div>
  )
}
