'use server'

import { revalidatePath } from 'next/cache'
import { registrarEvento } from '@/lib/auditoria'
import { exigirAdmin } from '@/lib/sesion'
import { clienteServicio } from '@/lib/supabase/cliente-servicio'
import type { LegajoPadron, ReciboExistente } from '@/lib/tango/cotejar-lote'

export interface ReciboSubido {
  legajoNumero: number
  rutaStorage: string
  nombreOriginal: string
  sha256: string
  bytes: number
  cuilArchivo: string
  version: number
}

/** Padrón y recibos ya cargados que necesita `cotejarLote` en el navegador. */
export async function datosCotejo(entrada: {
  empresaId: string
  periodo: number
  tipo: '1QA' | '2QA' | 'MEN'
  datoFijo: number
}): Promise<{ padron: LegajoPadron[]; existentes: ReciboExistente[] }> {
  await exigirAdmin('operar')
  const supabase = clienteServicio()

  const { data: legajos } = await supabase
    .from('legajos')
    .select('id, numero, activo, personas(cuil, apellido_nombre)')
    .eq('empresa_id', entrada.empresaId)

  const padron: LegajoPadron[] = (legajos ?? [])
    .filter((l) => l.personas)
    .map((l) => ({
      legajoId: l.id,
      numero: l.numero,
      cuil: l.personas!.cuil,
      nombre: l.personas!.apellido_nombre,
      activo: l.activo,
    }))

  const { data: liquidacion } = await supabase
    .from('liquidaciones')
    .select('id')
    .eq('empresa_id', entrada.empresaId)
    .eq('periodo', entrada.periodo)
    .eq('tipo', entrada.tipo)
    .eq('dato_fijo', entrada.datoFijo)
    .maybeSingle()

  let existentes: ReciboExistente[] = []
  if (liquidacion) {
    const { data: recibos } = await supabase
      .from('recibos')
      .select('sha256, legajos(numero)')
      .eq('liquidacion_id', liquidacion.id)
      .eq('estado', 'vigente')
    existentes = (recibos ?? [])
      .filter((r) => r.legajos)
      .map((r) => ({ legajo: r.legajos!.numero, sha256: r.sha256 }))
  }

  return { padron, existentes }
}

/** Registra en la base los recibos que ya se subieron a Storage. */
export async function registrarRecibos(
  empresaId: string,
  liquidacionId: string,
  recibos: ReciboSubido[],
): Promise<{ registrados: number } | { error: string }> {
  const admin = await exigirAdmin('operar')
  const supabase = clienteServicio()

  const { data: legajos } = await supabase
    .from('legajos')
    .select('id, numero')
    .eq('empresa_id', empresaId)

  const porNumero = new Map((legajos ?? []).map((l) => [l.numero, l.id]))

  const filas = recibos
    .map((r) => {
      const legajoId = porNumero.get(r.legajoNumero)
      if (!legajoId) return null
      return {
        liquidacion_id: liquidacionId,
        legajo_id: legajoId,
        version: r.version,
        storage_path: r.rutaStorage,
        nombre_original: r.nombreOriginal,
        sha256: r.sha256,
        bytes: r.bytes,
        cuil_archivo: r.cuilArchivo,
        subido_por: admin.id,
      }
    })
    .filter((f): f is NonNullable<typeof f> => f !== null)

  if (filas.length === 0) return { registrados: 0 }

  // Antes de insertar una versión nueva hay que bajar la vigente del mismo
  // legajo: `recibo_vigente_unico` no admite dos vigentes por (liquidación,
  // legajo). publicar_liquidacion vuelve a hacer esto como red de seguridad.
  const legajoIds = [...new Set(filas.map((f) => f.legajo_id))]
  await supabase
    .from('recibos')
    .update({ estado: 'reemplazado' })
    .eq('liquidacion_id', liquidacionId)
    .in('legajo_id', legajoIds)
    .eq('estado', 'vigente')

  const { error } = await supabase.from('recibos').insert(filas)
  if (error) return { error: `No se pudieron registrar los recibos: ${error.message}` }

  revalidatePath(`/admin/liquidaciones/${liquidacionId}`)
  return { registrados: filas.length }
}

export async function publicarLiquidacion(
  liquidacionId: string,
): Promise<{ publicados: number } | { error: string }> {
  const admin = await exigirAdmin('operar')
  const supabase = clienteServicio()

  const { data, error } = await supabase.rpc('publicar_liquidacion', {
    p_liquidacion: liquidacionId,
    p_admin: admin.id,
  })

  if (error) return { error: `No se pudo publicar: ${error.message}` }

  await registrarEvento({
    actorTipo: 'admin',
    actorId: admin.id,
    accion: 'liquidacion.publicar',
    entidad: 'liquidaciones',
    entidadId: liquidacionId,
    detalle: { publicados: data },
  })

  revalidatePath('/admin/liquidaciones')
  return { publicados: data as number }
}
