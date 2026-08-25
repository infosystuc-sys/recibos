import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { parseNombreRecibo } from '../src/lib/tango/parse-nombre-recibo'

const carpeta = process.argv[2]
if (!carpeta) {
  console.error('Uso: npx tsx scripts/verificar-carpeta-ejemplo.ts <carpeta>')
  process.exit(1)
}

let reconocidos = 0
let ignorados = 0

for (const nombre of readdirSync(carpeta, { recursive: true, encoding: 'utf8' })) {
  const soloNombre = nombre.split(/[\\/]/).pop() ?? ''
  const datos = parseNombreRecibo(soloNombre)
  if (datos) {
    reconocidos++
    console.log(`OK  ${soloNombre} → período ${datos.periodo} ${datos.tipo} legajo ${datos.legajo}`)
  } else if (soloNombre.toLowerCase().endsWith('.pdf')) {
    ignorados++
    console.log(`IGN ${soloNombre}`)
  }
  void join(carpeta, nombre)
}

console.log(`\nReconocidos: ${reconocidos} — PDFs ignorados: ${ignorados}`)
