/**
 * Normaliza un teléfono al formato que espera WhatsApp: dígitos con código de
 * país, sin `+` ni separadores. Best-effort — el padrón debería venir prolijo.
 *
 * Para Argentina (país 54) WhatsApp exige el `9` antes del área en celulares;
 * se agrega si falta. También se descarta un `0` de trunk y el viejo prefijo
 * `15` cuando aparece pegado después del código de área más común.
 */
export function aWhatsapp(telefono: string | null | undefined, paisPorDefecto = '54'): string | null {
  if (!telefono) return null
  let d = telefono.replace(/\D/g, '')
  if (!d) return null

  // 00 + código de país internacional
  if (d.startsWith('00')) d = d.slice(2)
  // 0 de trunk nacional
  if (d.startsWith('0')) d = d.replace(/^0+/, '')

  let local: string
  if (d.startsWith(paisPorDefecto)) {
    local = d.slice(paisPorDefecto.length)
  } else {
    local = d
  }

  if (paisPorDefecto === '54') {
    // 15 pegado tras un área de 2-4 dígitos (formato viejo de celular)
    local = local.replace(/^(\d{2,4})15(\d{6,8})$/, '$1$2')
    if (!local.startsWith('9') && local.length >= 10) local = '9' + local
  }

  const completo = paisPorDefecto + local
  return completo.length >= 11 && completo.length <= 15 ? completo : null
}
