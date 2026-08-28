'use client'

const BASE = 'conforme'
const ALMACEN = 'carpetas'

function abrirBase(): Promise<IDBDatabase> {
  return new Promise((resolver, rechazar) => {
    const peticion = indexedDB.open(BASE, 1)
    peticion.onupgradeneeded = () => peticion.result.createObjectStore(ALMACEN)
    peticion.onsuccess = () => resolver(peticion.result)
    peticion.onerror = () => rechazar(peticion.error)
  })
}

async function operar<T>(
  modo: IDBTransactionMode,
  fn: (almacen: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const base = await abrirBase()
  return new Promise((resolver, rechazar) => {
    const peticion = fn(base.transaction(ALMACEN, modo).objectStore(ALMACEN))
    peticion.onsuccess = () => resolver(peticion.result)
    peticion.onerror = () => rechazar(peticion.error)
  })
}

export function soportaCarpetaLocal(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window
}

export async function guardarHandle(empresaId: string, handle: FileSystemDirectoryHandle) {
  await operar('readwrite', (a) => a.put(handle, empresaId))
}

export async function recuperarHandle(
  empresaId: string,
): Promise<FileSystemDirectoryHandle | null> {
  const handle = await operar<FileSystemDirectoryHandle | undefined>('readonly', (a) =>
    a.get(empresaId),
  )
  return handle ?? null
}

/** El permiso hay que revalidarlo en cada sesión: el navegador no lo regala. */
export async function asegurarPermiso(handle: FileSystemDirectoryHandle): Promise<boolean> {
  const opciones = { mode: 'read' } as const
  if ((await handle.queryPermission(opciones)) === 'granted') return true
  return (await handle.requestPermission(opciones)) === 'granted'
}
