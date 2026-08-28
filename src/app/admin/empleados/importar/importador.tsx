'use client'

import { useState, useTransition } from 'react'
import { importarPadron, type ResultadoImportacion } from '@/acciones/padron'
import { formatearCuil } from '@/lib/cuil'
import { parsearCsvPadron, type ErrorFila, type FilaPadron } from '@/lib/padron/parse-csv-padron'

interface Empresa {
  id: string
  razon_social: string
}

export default function ImportadorPadron({ empresas }: { empresas: Empresa[] }) {
  const [empresaId, setEmpresaId] = useState(empresas[0]?.id ?? '')
  const [nombreArchivo, setNombreArchivo] = useState('')
  const [filas, setFilas] = useState<FilaPadron[]>([])
  const [errores, setErrores] = useState<ErrorFila[]>([])
  const [analizado, setAnalizado] = useState(false)
  const [resultado, setResultado] = useState<ResultadoImportacion | null>(null)
  const [pendiente, iniciar] = useTransition()

  async function alElegirArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0]
    setResultado(null)
    if (!archivo) {
      setFilas([])
      setErrores([])
      setAnalizado(false)
      setNombreArchivo('')
      return
    }
    const texto = await archivo.text()
    const parseado = parsearCsvPadron(texto)
    setFilas(parseado.filas)
    setErrores(parseado.errores)
    setNombreArchivo(archivo.name)
    setAnalizado(true)
  }

  function confirmar() {
    setResultado(null)
    iniciar(async () => {
      const r = await importarPadron(empresaId, filas, nombreArchivo)
      setResultado(r)
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <label className="flex max-w-sm flex-col gap-1 text-sm">
        Empresa
        <select
          value={empresaId}
          onChange={(e) => setEmpresaId(e.target.value)}
          className="rounded border px-3 py-2"
        >
          {empresas.map((e) => (
            <option key={e.id} value={e.id}>
              {e.razon_social}
            </option>
          ))}
        </select>
      </label>

      <label className="flex max-w-sm flex-col gap-1 text-sm">
        Archivo CSV del padrón
        <input type="file" accept=".csv,text/csv" onChange={alElegirArchivo} className="text-sm" />
      </label>

      {analizado && (
        <div className="flex flex-col gap-4">
          <p className="text-sm">
            <strong>{filas.length}</strong> {filas.length === 1 ? 'fila válida' : 'filas válidas'}
            {errores.length > 0 && (
              <>
                {' · '}
                <strong className="text-red-600">{errores.length}</strong>{' '}
                {errores.length === 1 ? 'fila con error' : 'filas con error'}
              </>
            )}
          </p>

          {errores.length > 0 && (
            <div className="overflow-x-auto rounded border border-red-200">
              <table className="w-full text-sm">
                <thead className="bg-red-50 text-left text-red-800">
                  <tr>
                    <th className="px-3 py-2">Línea</th>
                    <th className="px-3 py-2">Motivo</th>
                    <th className="px-3 py-2">Contenido</th>
                  </tr>
                </thead>
                <tbody>
                  {errores.map((err, i) => (
                    <tr key={i} className="border-t border-red-100">
                      <td className="px-3 py-2">{err.linea}</td>
                      <td className="px-3 py-2">{err.motivo}</td>
                      <td className="px-3 py-2 font-mono text-xs text-neutral-500">{err.contenido}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {filas.length > 0 && (
            <div className="overflow-x-auto rounded border">
              <table className="w-full text-sm">
                <thead className="text-left text-neutral-500">
                  <tr>
                    <th className="px-3 py-2">Legajo</th>
                    <th className="px-3 py-2">CUIL</th>
                    <th className="px-3 py-2">Apellido y nombre</th>
                    <th className="px-3 py-2">Sector</th>
                    <th className="px-3 py-2">Activo</th>
                  </tr>
                </thead>
                <tbody>
                  {filas.slice(0, 20).map((f) => (
                    <tr key={f.legajo} className="border-t">
                      <td className="px-3 py-2">{f.legajo}</td>
                      <td className="px-3 py-2">{formatearCuil(f.cuil)}</td>
                      <td className="px-3 py-2">{f.apellidoNombre}</td>
                      <td className="px-3 py-2">{f.sector ?? '—'}</td>
                      <td className="px-3 py-2">{f.activo ? 'Sí' : 'No'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filas.length > 20 && (
                <p className="px-3 py-2 text-xs text-neutral-500">
                  … y {filas.length - 20} más. Se importarán todas.
                </p>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={confirmar}
            disabled={pendiente || filas.length === 0 || !empresaId}
            className="self-start rounded bg-blue-900 px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            {pendiente ? 'Importando…' : `Importar ${filas.length} ${filas.length === 1 ? 'empleado' : 'empleados'}`}
          </button>
        </div>
      )}

      {resultado && (
        <div className="flex flex-col gap-3 rounded border border-green-200 bg-green-50 p-4 text-sm">
          {resultado.error ? (
            <p role="alert" className="text-red-700">
              {resultado.error}
            </p>
          ) : (
            <>
              <p>
                <strong>{resultado.creados}</strong> alta(s), <strong>{resultado.actualizados}</strong>{' '}
                actualizada(s), <strong>{resultado.sinCambios}</strong> sin cambios.
              </p>
              {resultado.posiblesBajas.length > 0 && (
                <div>
                  <p className="font-semibold">
                    {resultado.posiblesBajas.length} legajo(s) activo(s) no aparecen en este archivo.
                  </p>
                  <p className="text-neutral-600">
                    <strong>No se dieron de baja automáticamente.</strong> Revisalos y desactivalos a
                    mano si corresponde:
                  </p>
                  <ul className="mt-1 list-inside list-disc">
                    {resultado.posiblesBajas.map((b) => (
                      <li key={b.legajo}>
                        Legajo {b.legajo} — {b.nombre}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
