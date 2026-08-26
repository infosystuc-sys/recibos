import type { TipoLiquidacion } from '@/lib/tango/parse-nombre-recibo'

/** SHA-256 en hexadecimal. Usa WebCrypto: funciona en el navegador y en Node 18+. */
export async function sha256Hex(datos: ArrayBuffer): Promise<string> {
  const resumen = await crypto.subtle.digest('SHA-256', datos)
  return [...new Uint8Array(resumen)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function rutaStorage(
  empresaId: string,
  periodo: number,
  tipo: TipoLiquidacion,
  datoFijo: number,
  legajo: number,
  version: number,
): string {
  return `${empresaId}/${periodo}/${tipo}-${datoFijo}/${legajo}-v${version}.pdf`
}
