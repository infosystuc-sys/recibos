'use client'

import { sha256Hex } from '@/lib/hash'
import { clienteNavegador } from '@/lib/supabase/cliente-navegador'

const ESPERAS_MS = [1000, 2000, 4000]

/** SHA-256 en hex del contenido de un File, leyendo su ArrayBuffer una sola vez. */
export async function hashDeArchivo(archivo: File): Promise<string> {
  return sha256Hex(await archivo.arrayBuffer())
}

/**
 * Sube un archivo a Storage contra una URL firmada, reintentando hasta 3 veces
 * con espera creciente (1 s, 2 s, 4 s). Lanza si tras el último intento sigue
 * fallando.
 */
export async function subirArchivoFirmado(
  ruta: string,
  token: string,
  archivo: File,
): Promise<void> {
  const supabase = clienteNavegador()

  for (let intento = 0; ; intento++) {
    const { error } = await supabase.storage
      .from('recibos')
      .uploadToSignedUrl(ruta, token, archivo, { contentType: 'application/pdf' })

    if (!error) return

    if (intento >= ESPERAS_MS.length) {
      throw new Error(`No se pudo subir ${archivo.name}: ${error.message}`)
    }
    await new Promise((r) => setTimeout(r, ESPERAS_MS[intento]))
  }
}
