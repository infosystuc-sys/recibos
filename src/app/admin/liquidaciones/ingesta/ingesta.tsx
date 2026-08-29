'use client'

import { useMemo, useState } from 'react'
import { datosCotejo, publicarLiquidacion, registrarRecibos } from '@/acciones/liquidaciones'
import { prepararSubida, type PedidoSubida } from '@/acciones/subida'
import SelectorCarpeta from '@/componentes/selector-carpeta'
import { formatearCuil } from '@/lib/cuil'
import { hashDeArchivo, subirArchivoFirmado } from '@/lib/subida/subir-a-storage'
import { subirConLimite } from '@/lib/subida/subir-lote'
import {
  agruparEnLotes,
  claveLote,
  describirLote,
  type ArchivoEscaneado,
  type Lote,
} from '@/lib/tango/agrupar-lotes'
import { cotejarLote, type Diagnostico, type ResultadoCotejo } from '@/lib/tango/cotejar-lote'
import type { ResultadoEscaneo } from '@/lib/carpeta/escanear'

interface Empresa {
  id: string
  razon_social: string
}

const ORDEN_SEVERIDAD = { bloqueante: 0, advertencia: 1, informativo: 2 } as const

function ordenarDiagnosticos(ds: Diagnostico[]): Diagnostico[] {
  return [...ds].sort((a, b) => {
    if (a.severidad !== b.severidad) return ORDEN_SEVERIDAD[a.severidad] - ORDEN_SEVERIDAD[b.severidad]
    // CUIL_NO_COINCIDE primero de todos.
    if (a.codigo === 'CUIL_NO_COINCIDE') return -1
    if (b.codigo === 'CUIL_NO_COINCIDE') return 1
    return a.legajo - b.legajo
  })
}

const COLOR: Record<Diagnostico['severidad'], string> = {
  bloqueante: 'border-red-300 bg-error-fondo text-red-800',
  advertencia: 'border-amber-300 bg-alerta-fondo text-amber-800',
  informativo: 'border-neutral-200 bg-neutral-50 text-texto-suave',
}

export default function Ingesta({ empresas }: { empresas: Empresa[] }) {
  const [empresaId, setEmpresaId] = useState(empresas[0]?.id ?? '')
  const [escaneo, setEscaneo] = useState<ResultadoEscaneo | null>(null)
  const [claveElegida, setClaveElegida] = useState<string | null>(null)
  const [cotejo, setCotejo] = useState<ResultadoCotejo | null>(null)
  const [cotejando, setCotejando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [subiendo, setSubiendo] = useState(false)
  const [progreso, setProgreso] = useState(0)
  const [fallidos, setFallidos] = useState<string[]>([])
  const [registro, setRegistro] = useState<{ liquidacionId: string; registrados: number } | null>(
    null,
  )

  const [publicando, setPublicando] = useState(false)
  const [publicado, setPublicado] = useState<number | null>(null)

  const lotes = useMemo(
    () => (escaneo ? agruparEnLotes(escaneo.archivos) : []),
    [escaneo],
  )
  const lote: Lote | null = useMemo(
    () => lotes.find((l) => claveLote(l) === claveElegida) ?? null,
    [lotes, claveElegida],
  )

  function reiniciarDesdeEscaneo(r: ResultadoEscaneo) {
    setEscaneo(r)
    setClaveElegida(null)
    setCotejo(null)
    setRegistro(null)
    setPublicado(null)
    setFallidos([])
    setError(null)
  }

  async function elegirLote(l: Lote) {
    setClaveElegida(claveLote(l))
    setCotejo(null)
    setRegistro(null)
    setPublicado(null)
    setError(null)
    setCotejando(true)
    try {
      const hashes = new Map<string, string>()
      for (const a of l.archivos) {
        const f = await a.obtenerArchivo?.()
        if (f) hashes.set(a.nombre, await hashDeArchivo(f))
      }
      const { padron, existentes } = await datosCotejo({
        empresaId,
        periodo: l.periodo,
        tipo: l.tipo,
        datoFijo: l.datoFijo,
      })
      setCotejo(cotejarLote({ lote: l, padron, existentes, hashes }))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cotejar el lote.')
    } finally {
      setCotejando(false)
    }
  }

  async function subirYRegistrar() {
    if (!lote || !cotejo || cotejo.hayBloqueantes) return
    setSubiendo(true)
    setError(null)
    setFallidos([])
    setProgreso(0)

    try {
      const publicables = cotejo.publicables
      const archivos = new Map<string, File>()
      const pedidos: PedidoSubida[] = []
      for (const a of publicables) {
        const f = await a.obtenerArchivo?.()
        if (!f) throw new Error(`No se pudo leer el archivo ${a.nombre}.`)
        archivos.set(a.nombre, f)
        pedidos.push({
          legajoNumero: a.datos.legajo,
          nombreOriginal: a.nombre,
          sha256: await hashDeArchivo(f),
          bytes: f.size,
          cuilArchivo: a.datos.cuil,
        })
      }

      const prep = await prepararSubida({
        empresaId,
        periodo: lote.periodo,
        tipo: lote.tipo,
        datoFijo: lote.datoFijo,
        archivos: pedidos,
      })
      if ('error' in prep) throw new Error(prep.error)

      const destinoPorLegajo = new Map(prep.destinos.map((d) => [d.legajoNumero, d]))
      const fallados: string[] = []

      await subirConLimite(
        publicables,
        5,
        async (a) => {
          const destino = destinoPorLegajo.get(a.datos.legajo)
          const f = archivos.get(a.nombre)
          if (!destino || !f) return
          try {
            await subirArchivoFirmado(destino.rutaStorage, destino.token, f)
          } catch {
            fallados.push(a.nombre)
          }
        },
        (hechos) => setProgreso(hechos),
      )

      setFallidos(fallados)

      const subidosOk = publicables.filter((a) => !fallados.includes(a.nombre))
      const recibos = subidosOk
        .map((a) => {
          const destino = destinoPorLegajo.get(a.datos.legajo)
          const f = archivos.get(a.nombre)
          if (!destino || !f) return null
          return {
            legajoNumero: a.datos.legajo,
            rutaStorage: destino.rutaStorage,
            nombreOriginal: a.nombre,
            sha256: pedidos.find((p) => p.nombreOriginal === a.nombre)!.sha256,
            bytes: f.size,
            cuilArchivo: a.datos.cuil,
            version: destino.version,
          }
        })
        .filter((r): r is NonNullable<typeof r> => r !== null)

      const reg = await registrarRecibos(empresaId, prep.liquidacionId, recibos)
      if ('error' in reg) throw new Error(reg.error)
      setRegistro({ liquidacionId: prep.liquidacionId, registrados: reg.registrados })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falló la subida.')
    } finally {
      setSubiendo(false)
    }
  }

  async function publicar() {
    if (!registro) return
    if (
      !window.confirm(
        'Al publicar, los empleados de esta liquidación van a poder ver y conformar sus recibos. ¿Confirmás?',
      )
    ) {
      return
    }
    setPublicando(true)
    setError(null)
    try {
      const r = await publicarLiquidacion(registro.liquidacionId)
      if ('error' in r) throw new Error(r.error)
      setPublicado(r.publicados)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo publicar.')
    } finally {
      setPublicando(false)
    }
  }

  const diagnosticos = cotejo ? ordenarDiagnosticos(cotejo.diagnosticos) : []
  const yaSubidos = diagnosticos.filter((d) => d.codigo === 'YA_SUBIDO').length
  const reemplazos = diagnosticos.filter((d) => d.codigo === 'REEMPLAZO').length

  return (
    <div className="flex flex-col gap-8">
      <Paso n={1} titulo="Empresa">
        <select
          value={empresaId}
          onChange={(e) => {
            setEmpresaId(e.target.value)
            reiniciarDesdeEscaneo({ archivos: [], ignorados: [] })
            setEscaneo(null)
          }}
          className="rounded-lg border border-borde bg-superficie px-3 py-2 text-sm"
        >
          {empresas.map((e) => (
            <option key={e.id} value={e.id}>
              {e.razon_social}
            </option>
          ))}
        </select>
      </Paso>

      <Paso n={2} titulo="Carpeta">
        <SelectorCarpeta empresaId={empresaId} onResultado={reiniciarDesdeEscaneo} />
      </Paso>

      {escaneo && (
        <Paso n={3} titulo="Lotes">
          {lotes.length === 0 ? (
            <p className="text-sm text-texto-suave">El escaneo no encontró recibos de Tango.</p>
          ) : (
            <div className="flex flex-wrap gap-3">
              {lotes.map((l) => {
                const clave = claveLote(l)
                return (
                  <button
                    key={clave}
                    type="button"
                    onClick={() => elegirLote(l)}
                    className={`rounded border px-4 py-3 text-left text-sm ${
                      clave === claveElegida ? 'border-blue-600 bg-blue-50' : 'border-borde'
                    }`}
                  >
                    <div className="font-medium">{describirLote(l)}</div>
                    <div className="text-texto-suave">{l.archivos.length} recibos</div>
                  </button>
                )
              })}
            </div>
          )}
        </Paso>
      )}

      {claveElegida && (
        <Paso n={4} titulo="Cotejo contra el padrón">
          {cotejando ? (
            <p className="text-sm text-texto-suave">Calculando hashes y cotejando…</p>
          ) : cotejo ? (
            <div className="flex flex-col gap-3">
              {cotejo.hayBloqueantes && (
                <p className="text-sm font-semibold text-error">
                  Hay problemas bloqueantes. Resolvelos antes de subir.
                </p>
              )}
              {diagnosticos.length === 0 ? (
                <p className="text-sm text-exito">Sin observaciones. Todo listo para subir.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {diagnosticos.map((d, i) => (
                    <li key={i} className={`rounded border px-3 py-2 text-sm ${COLOR[d.severidad]}`}>
                      <span className="font-mono text-xs">{d.codigo}</span> · legajo {d.legajo}
                      {d.archivo && <> · {d.archivo}</>}
                      <div>{d.detalle}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
        </Paso>
      )}

      {cotejo && !cotejo.hayBloqueantes && (
        <Paso n={5} titulo="Subida">
          {registro ? (
            <p className="text-sm text-exito">
              {registro.registrados} recibo(s) registrado(s).
              {fallidos.length > 0 && (
                <span className="text-error"> {fallidos.length} fallaron: {fallidos.join(', ')}</span>
              )}
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-texto-suave">
                Se subirán <strong>{cotejo.publicables.length}</strong> archivo(s).
                {yaSubidos > 0 && <> {yaSubidos} ya estaban cargados y se saltean.</>}
                {reemplazos > 0 && <> {reemplazos} son reemplazo de una versión anterior.</>}
              </p>
              {subiendo && (
                <p className="text-sm">
                  Subiendo… {progreso}/{cotejo.publicables.length}
                </p>
              )}
              <button
                type="button"
                onClick={subirYRegistrar}
                disabled={subiendo || cotejo.publicables.length === 0}
                className="self-start rounded bg-marron px-4 py-2 text-sm text-white disabled:opacity-50"
              >
                Subir
              </button>
            </div>
          )}
        </Paso>
      )}

      {registro && (
        <Paso n={6} titulo="Publicación">
          {publicado !== null ? (
            <p className="text-sm font-semibold text-exito">
              Liquidación publicada · {publicado} recibo(s) vigente(s). Los empleados ya pueden verlos.
            </p>
          ) : (
            <button
              type="button"
              onClick={publicar}
              disabled={publicando}
              className="self-start rounded bg-exito px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              {publicando ? 'Publicando…' : 'Publicar'}
            </button>
          )}
        </Paso>
      )}

      {error && (
        <p role="alert" className="text-sm text-error">
          {error}
        </p>
      )}
    </div>
  )
}

function Paso({ n, titulo, children }: { n: number; titulo: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-texto-suave">
        {n}. {titulo}
      </h2>
      {children}
    </section>
  )
}
