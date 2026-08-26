/**
 * Ejecuta `tarea` sobre cada elemento con como mucho `limite` en paralelo.
 * Si una tarea falla, se propaga el error y no se arrancan nuevas.
 */
export async function subirConLimite<T>(
  items: T[],
  limite: number,
  tarea: (item: T) => Promise<void>,
  alAvanzar?: (hechos: number) => void,
): Promise<void> {
  let siguiente = 0
  let hechos = 0

  async function trabajador(): Promise<void> {
    while (siguiente < items.length) {
      const indice = siguiente++
      await tarea(items[indice])
      hechos++
      alAvanzar?.(hechos)
    }
  }

  const trabajadores = Array.from(
    { length: Math.min(limite, items.length) },
    () => trabajador(),
  )
  await Promise.all(trabajadores)
}
