/**
 * Ejecuta `tarea` sobre cada elemento con como mucho `limite` en paralelo.
 * Si una tarea falla, se propaga el primer error y ningún trabajador toma
 * un ítem nuevo a partir de ese momento. Las tareas que ya estaban en
 * vuelo cuando ocurrió el fallo no se cancelan (no es posible cancelar una
 * promesa en curso): terminan, pero no disparan trabajo adicional.
 */
export async function subirConLimite<T>(
  items: T[],
  limite: number,
  tarea: (item: T) => Promise<void>,
  alAvanzar?: (hechos: number) => void,
): Promise<void> {
  if (!Number.isInteger(limite) || limite < 1) {
    throw new Error('El límite de concurrencia debe ser un número entero mayor o igual a 1.')
  }

  let siguiente = 0
  let hechos = 0
  let detenido = false

  async function trabajador(): Promise<void> {
    while (!detenido && siguiente < items.length) {
      const indice = siguiente++
      try {
        await tarea(items[indice])
      } catch (error) {
        detenido = true
        throw error
      }
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
