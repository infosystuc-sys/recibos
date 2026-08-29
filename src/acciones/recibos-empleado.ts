'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { registrarEvento } from '@/lib/auditoria'
import { sha256Hex } from '@/lib/hash'
import { exigirEmpleado } from '@/lib/sesion-empleado'
import { clienteServicio } from '@/lib/supabase/cliente-servicio'

interface ReciboParaConformar {
  id: string
  estado: string
  version: number
  storage_path: string
  legajos: { persona_id: string } | null
  liquidaciones: {
    estado: string
    empresas: { texto_conformidad: string } | null
  } | null
}

type CargaRecibo =
  | { ok: true; recibo: ReciboParaConformar }
  | { ok: false; error: string }

async function cargarReciboPropio(reciboId: string, personaId: string): Promise<CargaRecibo> {
  const servicio = clienteServicio()
  const { data } = await servicio
    .from('recibos')
    .select(
      'id, estado, version, storage_path, legajos(persona_id), liquidaciones(estado, empresas(texto_conformidad))',
    )
    .eq('id', reciboId)
    .maybeSingle()

  const recibo = data as ReciboParaConformar | null
  if (!recibo) return { ok: false, error: 'No encontramos ese recibo.' }
  if (recibo.legajos?.persona_id !== personaId) return { ok: false, error: 'Ese recibo no es tuyo.' }
  if (recibo.liquidaciones?.estado !== 'publicada') {
    return { ok: false, error: 'La liquidación de ese recibo no está publicada.' }
  }
  if (recibo.estado !== 'vigente') {
    return { ok: false, error: 'Esta versión del recibo fue reemplazada por una corrección.' }
  }
  return { ok: true, recibo }
}

/** URL firmada de 60 segundos para ver o descargar el PDF propio. */
export async function urlRecibo(
  reciboId: string,
  descargar = false,
): Promise<{ url: string } | { error: string }> {
  const empleado = await exigirEmpleado()
  const res = await cargarReciboPropio(reciboId, empleado.id)
  if (!res.ok) return { error: res.error }

  const servicio = clienteServicio()
  const { data, error } = await servicio.storage
    .from('recibos')
    .createSignedUrl(res.recibo.storage_path, 60, descargar ? { download: true } : undefined)

  if (error || !data) return { error: 'No se pudo generar el enlace del recibo.' }
  return { url: data.signedUrl }
}

/**
 * Registra la conformidad del empleado sobre la versión vigente de un recibo.
 * Sella del lado del servidor: hora (UTC en la base, se muestra en hora AR),
 * SHA-256 del PDF exacto, IP, navegador y copia íntegra del texto legal.
 */
export async function registrarConformidad(
  reciboId: string,
): Promise<{ error: string } | never> {
  const empleado = await exigirEmpleado()
  const res = await cargarReciboPropio(reciboId, empleado.id)
  if (!res.ok) return { error: res.error }

  const servicio = clienteServicio()

  const { data: yaHay } = await servicio
    .from('conformidades')
    .select('id')
    .eq('recibo_id', reciboId)
    .maybeSingle()
  if (yaHay) return { error: 'Ya prestaste conformidad a este recibo.' }

  const { data: yaRechazado } = await servicio
    .from('rechazos')
    .select('id')
    .eq('recibo_id', reciboId)
    .maybeSingle()
  if (yaRechazado) return { error: 'Ya rechazaste este recibo. No se puede conformar después de rechazar.' }

  const textoLegal = res.recibo.liquidaciones?.empresas?.texto_conformidad
  if (!textoLegal) return { error: 'La empresa no tiene configurado el texto de conformidad.' }

  const { data: blob, error: errDescarga } = await servicio.storage
    .from('recibos')
    .download(res.recibo.storage_path)
  if (errDescarga || !blob) return { error: 'No se pudo leer el documento para sellarlo.' }
  const sha256Documento = await sha256Hex(await blob.arrayBuffer())

  const cabeceras = await headers()
  const ip = cabeceras.get('x-forwarded-for')?.split(',')[0]?.trim() || null
  const userAgent = cabeceras.get('user-agent') || null

  const { data: conformidad, error } = await servicio
    .from('conformidades')
    .insert({
      recibo_id: reciboId,
      persona_id: empleado.id,
      sha256_documento: sha256Documento,
      texto_legal: textoLegal,
      ip,
      user_agent: userAgent,
    })
    .select('id')
    .single()

  if (error) return { error: `No se pudo registrar la conformidad: ${error.message}` }

  await registrarEvento({
    actorTipo: 'empleado',
    actorId: empleado.id,
    accion: 'conformidad.registrar',
    entidad: 'conformidades',
    entidadId: conformidad.id,
    detalle: { recibo_id: reciboId, cuil: empleado.cuil },
    ip,
  })

  revalidatePath('/mi')
  revalidatePath(`/mi/recibos/${reciboId}`)
  redirect(`/mi/recibos/${reciboId}?conformado=1`)
}

/**
 * Registra el rechazo del empleado a la versión vigente de un recibo.
 * Conformar y rechazar son excluyentes. Se sella hora, IP y navegador del
 * lado del servidor. Es un registro permanente e inmutable.
 */
export async function rechazarRecibo(
  reciboId: string,
  motivo: string,
): Promise<{ error: string } | never> {
  const empleado = await exigirEmpleado()

  const limpio = motivo.trim()
  if (limpio.length < 3) return { error: 'Contanos brevemente por qué rechazás el recibo.' }
  if (limpio.length > 2000) return { error: 'El motivo es demasiado largo.' }

  const res = await cargarReciboPropio(reciboId, empleado.id)
  if (!res.ok) return { error: res.error }

  const servicio = clienteServicio()

  const { data: yaConforme } = await servicio
    .from('conformidades')
    .select('id')
    .eq('recibo_id', reciboId)
    .maybeSingle()
  if (yaConforme) return { error: 'Ya prestaste conformidad a este recibo. No se puede rechazar después.' }

  const { data: yaHay } = await servicio
    .from('rechazos')
    .select('id')
    .eq('recibo_id', reciboId)
    .maybeSingle()
  if (yaHay) return { error: 'Ya rechazaste este recibo.' }

  const cabeceras = await headers()
  const ip = cabeceras.get('x-forwarded-for')?.split(',')[0]?.trim() || null
  const userAgent = cabeceras.get('user-agent') || null

  const { data: rechazo, error } = await servicio
    .from('rechazos')
    .insert({
      recibo_id: reciboId,
      persona_id: empleado.id,
      motivo: limpio,
      ip,
      user_agent: userAgent,
    })
    .select('id')
    .single()

  if (error) return { error: `No se pudo registrar el rechazo: ${error.message}` }

  await registrarEvento({
    actorTipo: 'empleado',
    actorId: empleado.id,
    accion: 'rechazo.registrar',
    entidad: 'rechazos',
    entidadId: rechazo.id,
    detalle: { recibo_id: reciboId, cuil: empleado.cuil },
    ip,
  })

  revalidatePath('/mi')
  revalidatePath(`/mi/recibos/${reciboId}`)
  redirect(`/mi/recibos/${reciboId}?rechazado=1`)
}
