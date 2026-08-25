const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

/** 202604 → 'Abril 2026'. */
export function formatearPeriodo(periodo: number): string {
  const anio = Math.floor(periodo / 100)
  const mes = periodo % 100
  return `${MESES[mes - 1]} ${anio}`
}
