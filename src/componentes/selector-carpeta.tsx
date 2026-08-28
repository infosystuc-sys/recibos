'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  escanearDirectorio,
  type DirectorioLegible,
  type EntradaLegible,
  type ResultadoEscaneo,
} from '@/lib/carpeta/escanear'
import {
  asegurarPermiso,
  guardarHandle,
  recuperarHandle,
  soportaCarpetaLocal,
} from '@/lib/carpeta/handle-persistido'

interface Props {
  empresaId: string
  onResultado: (resultado: ResultadoEscaneo) => void
}

// Adapta un FileSystemEntry (drag & drop) a la interfaz que espera escanearDirectorio.
function adaptarEntrada(entry: FileSystemEntry): EntradaLegible {
  if (entry.isFile) {
    return {
      kind: 'file',
      name: entry.name,
      getFile: () =>
        new Promise<File>((res, rej) => (entry as FileSystemFileEntry).file(res, rej)),
    }
  }
  const dir = entry as FileSystemDirectoryEntry
  return {
    kind: 'directory',
    name: entry.name,
    async *values() {
      const lector = dir.createReader()
      while (true) {
        const tanda: FileSystemEntry[] = await new Promise((res, rej) =>
          lector.readEntries(res, rej),
        )
        if (tanda.length === 0) break
        for (const e of tanda) yield adaptarEntrada(e)
      }
    },
  }
}

export default function SelectorCarpeta({ empresaId, onResultado }: Props) {
  const soporta = soportaCarpetaLocal()
  const [handleRecordado, setHandleRecordado] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [arrastrando, setArrastrando] = useState(false)
  const [resumen, setResumen] = useState<string | null>(null)

  useEffect(() => {
    if (!soporta) return
    let cancelado = false
    recuperarHandle(empresaId).then((h) => {
      if (!cancelado) setHandleRecordado(Boolean(h))
    })
    return () => {
      cancelado = true
    }
  }, [empresaId, soporta])

  const procesar = useCallback(
    async (directorio: DirectorioLegible) => {
      setOcupado(true)
      setError(null)
      try {
        const resultado = await escanearDirectorio(directorio)
        setResumen(
          `${resultado.archivos.length} recibo(s) reconocido(s)` +
            (resultado.ignorados.length ? ` · ${resultado.ignorados.length} PDF ignorado(s)` : ''),
        )
        onResultado(resultado)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'No se pudo leer la carpeta.')
      } finally {
        setOcupado(false)
      }
    },
    [onResultado],
  )

  async function conectar(nueva: boolean) {
    setError(null)
    try {
      let handle = nueva ? null : await recuperarHandle(empresaId)
      if (!handle) {
        handle = await window.showDirectoryPicker({ id: `conforme-${empresaId}`, mode: 'read' })
        await guardarHandle(empresaId, handle)
        setHandleRecordado(true)
      }
      if (!(await asegurarPermiso(handle))) {
        setError('Hace falta dar permiso de lectura sobre la carpeta.')
        return
      }
      await procesar(handle)
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return
      setError(e instanceof Error ? e.message : 'No se pudo conectar la carpeta.')
    }
  }

  async function alSoltar(evento: React.DragEvent) {
    evento.preventDefault()
    setArrastrando(false)
    const entradas = [...evento.dataTransfer.items]
      .map((i) => i.webkitGetAsEntry())
      .filter((e): e is FileSystemEntry => Boolean(e))
    if (entradas.length === 0) return
    const raiz: DirectorioLegible = {
      async *values() {
        for (const e of entradas) yield adaptarEntrada(e)
      },
    }
    await procesar(raiz)
  }

  return (
    <div className="flex flex-col gap-3">
      {soporta ? (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => conectar(false)}
            disabled={ocupado}
            className="rounded bg-blue-900 px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            {ocupado
              ? 'Escaneando…'
              : handleRecordado
                ? 'Escanear de nuevo'
                : 'Conectar carpeta'}
          </button>
          {handleRecordado && (
            <button
              type="button"
              onClick={() => conectar(true)}
              disabled={ocupado}
              className="text-sm underline disabled:opacity-50"
            >
              Elegir otra carpeta
            </button>
          )}
        </div>
      ) : (
        <p className="text-sm text-amber-700">
          Tu navegador no permite recordar la carpeta. Usá Chrome o Edge, o arrastrá los
          archivos acá.
        </p>
      )}

      <div
        onDragOver={(e) => {
          e.preventDefault()
          setArrastrando(true)
        }}
        onDragLeave={() => setArrastrando(false)}
        onDrop={alSoltar}
        className={`rounded border-2 border-dashed p-6 text-center text-sm ${
          arrastrando ? 'border-blue-500 bg-blue-50' : 'border-neutral-300 text-neutral-500'
        }`}
      >
        {ocupado ? 'Escaneando…' : 'Arrastrá acá la carpeta con los recibos de Tango'}
      </div>

      {resumen && <p className="text-sm text-neutral-700">{resumen}</p>}
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  )
}
