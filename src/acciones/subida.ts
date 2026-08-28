'use server'

import { rutaStorage } from '@/lib/hash'
import { exigirAdmin } from '@/lib/sesion'
import { clienteServicio } from '@/lib/supabase/cliente-servicio'

export interface PedidoSubida {
  legajoNumero: number
  nombreOriginal: string
  sha256: string
  bytes: number
  cuilArchivo: string
}

export interface DestinoSubida {
  legajoNumero: number
  rutaStorage: string
  /** Token de subida firmado por Supabase Storage. */
  token: string
  version: number
}

/**
 * Crea (o reutiliza) la liquidación en borrador, resuelve la versión de cada
 * recibo y devuelve un destino firmado por archivo. La subida en sí la hace el
 * navegador contra Storage: el servidor solo autoriza.
 */
export async function prepararSubida(entrada: {
  empresaId: string
  periodo: number
  tipo: '1QA' | '2QA' | 'MEN'
  datoFijo: number
  archivos: PedidoSubida[]
}): Promise<{ liquidacionId: string; destinos: DestinoSubida[] } | { error: string }> {
  await exigirAdmin('operar')
  const supabase = clienteServicio()

  const { data: liquidacion, error: errorLiquidacion } = await supabase
    .from('liquidaciones')
    .upsert(
      {
        empresa_id: entrada.empresaId,
        periodo: entrada.periodo,
        tipo: entrada.tipo,
        dato_fijo: entrada.datoFijo,
      },
      { onConflict: 'empresa_id,periodo,tipo,dato_fijo' },
    )
    .select('id, estado')
    .single()

  if (errorLiquidacion || !liquidacion) {
    return { error: `No se pudo preparar la liquidación: ${errorLiquidacion?.message}` }
  }

  // Una liquidación publicada es inmutable: no se le suben más recibos.
  if (liquidacion.estado === 'publicada') {
    return { error: 'La liquidación ya está publicada: no se pueden subir más recibos.' }
  }

  const destinos: DestinoSubida[] = []

  for (const archivo of entrada.archivos) {
    const { data: legajo } = await supabase
      .from('legajos')
      .select('id')
      .eq('empresa_id', entrada.empresaId)
      .eq('numero', archivo.legajoNumero)
      .single()

    if (!legajo) continue

    const { data: previos } = await supabase
      .from('recibos')
      .select('version')
      .eq('liquidacion_id', liquidacion.id)
      .eq('legajo_id', legajo.id)
      .order('version', { ascending: false })
      .limit(1)

    const version = (previos?.[0]?.version ?? 0) + 1
    const ruta = rutaStorage(
      entrada.empresaId,
      entrada.periodo,
      entrada.tipo,
      entrada.datoFijo,
      archivo.legajoNumero,
      version,
    )

    const { data: firmada, error: errorFirma } = await supabase.storage
      .from('recibos')
      .createSignedUploadUrl(ruta)

    if (errorFirma || !firmada) {
      return {
        error: `No se pudo autorizar la subida de ${archivo.nombreOriginal}: ${errorFirma?.message}`,
      }
    }

    destinos.push({
      legajoNumero: archivo.legajoNumero,
      rutaStorage: ruta,
      token: firmada.token,
      version,
    })
  }

  return { liquidacionId: liquidacion.id, destinos }
}
