import Link from 'next/link'

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-8 p-6">
      <div>
        <h1 className="text-3xl font-semibold">Conforme</h1>
        <p className="mt-1 text-neutral-600 dark:text-neutral-400">
          Recibos de sueldo con conformidad digital.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <Link
          href="/mi/ingresar"
          className="rounded-lg bg-blue-900 px-4 py-3 text-center text-lg font-medium text-white"
        >
          Soy empleado
        </Link>
        <Link
          href="/ingresar"
          className="rounded-lg border px-4 py-3 text-center text-base"
        >
          Administración
        </Link>
      </div>
    </main>
  )
}
