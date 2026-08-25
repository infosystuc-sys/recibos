# Conforme — Fase 1A: Administración e Ingesta — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir el panel de administración de Conforme: importar el padrón de empleados, conectar la carpeta local de Tango, escanear y cotejar los PDFs, subirlos a Supabase Storage y publicar la liquidación.

**Architecture:** Una app Next.js 16 (App Router) en Vercel. Las lecturas van del cliente a Supabase protegidas por RLS; las escrituras sensibles pasan por Server Actions con la clave de servicio. Los PDFs viven en un bucket privado y solo se acceden por URL firmada. Toda la lógica de negocio pura (parseo de nombres, CUIL, agrupación, cotejo) vive en funciones sin dependencias, desarrolladas con TDD antes de tocar la interfaz.

**Tech Stack:** Next.js 16 (App Router, TypeScript strict), React 19, Tailwind CSS v4, shadcn/ui, Supabase (Postgres + Auth + Storage), `@supabase/supabase-js` v2, `@supabase/ssr`, Zod, Vitest, Playwright, npm.

**Spec:** `docs/superpowers/specs/2026-08-25-conforme-recibos-design.md`

## Global Constraints

- **Idioma:** todo el código, comentarios, nombres de variables, tablas, columnas y textos de interfaz en **español**. Sin mezclar inglés salvo en APIs de terceros.
- **Nombre del producto:** `Conforme`.
- **TypeScript:** `strict: true`. Prohibido `any` sin un comentario que lo justifique.
- **Zona horaria:** todas las fechas mostradas al usuario en `America/Argentina/Buenos_Aires`. En base siempre `timestamptz`.
- **CUIL:** se guarda **siempre** normalizado a 11 dígitos sin guiones (`char(11)`). Se muestra siempre formateado (`20-27103275-8`).
- **Períodos:** enteros con formato `AAAAMM` (ej. `202604`).
- **Storage:** bucket `recibos`, **privado**. Nunca `public: true`, nunca `getPublicUrl`.
- **Clave de servicio:** `SUPABASE_SERVICE_ROLE_KEY` solo en código de servidor. Jamás en un archivo con `'use client'` ni en una variable `NEXT_PUBLIC_*`.
- **RLS:** activa en todas las tablas del esquema `public`, sin excepción, denegando por defecto.
- **Datos personales:** ningún CUIL ni nombre en rutas URL ni en query strings.
- **Commits:** en español, formato `tipo: descripción` (`feat:`, `fix:`, `test:`, `chore:`, `docs:`).
- **Rama:** trabajar en `main` solo hasta el commit inicial; a partir de la Tarea 2, una rama por tarea o commits directos según lo acuerde el equipo. Nunca `push --force`.

---

## Estructura de archivos

```
D:\APP\RECIBOS\
├─ docs/superpowers/
│  ├─ specs/2026-08-25-conforme-recibos-design.md
│  └─ plans/2026-08-25-conforme-fase1a-admin-ingesta.md
├─ supabase/
│  └─ migrations/
│     ├─ 0001_esquema_base.sql          # enums, empresas, personas, legajos, admins, códigos
│     ├─ 0002_liquidaciones.sql          # liquidaciones, recibos, conformidades, observaciones
│     ├─ 0003_operacion.sql              # notificaciones, push, auditoría, importaciones
│     ├─ 0004_rls.sql                    # funciones auxiliares + políticas
│     └─ 0005_storage.sql                # bucket privado y sus políticas
├─ src/
│  ├─ lib/
│  │  ├─ cuil.ts                         # normalizar, formatear, validar, email sintético
│  │  ├─ periodo.ts                      # formateo AAAAMM ↔ texto
│  │  ├─ tango/
│  │  │  ├─ parse-nombre-recibo.ts        # nombre de archivo → datos
│  │  │  ├─ agrupar-lotes.ts              # archivos → lotes por liquidación
│  │  │  └─ cotejar-lote.ts               # lote + padrón → diagnósticos
│  │  ├─ padron/
│  │  │  └─ parse-csv-padron.ts           # CSV de Tango → filas validadas
│  │  ├─ hash.ts                          # SHA-256 con WebCrypto
│  │  ├─ codigo-activacion.ts             # generación y hash de códigos
│  │  └─ supabase/
│  │     ├─ cliente-navegador.ts
│  │     ├─ cliente-servidor.ts
│  │     ├─ cliente-servicio.ts           # service role, solo servidor
│  │     └─ tipos.ts                      # generado, no editar a mano
│  ├─ app/
│  │  ├─ layout.tsx
│  │  ├─ page.tsx                         # redirige según sesión
│  │  ├─ ingresar/page.tsx                # login de administrador
│  │  └─ admin/
│  │     ├─ layout.tsx                    # verifica sesión y rol
│  │     ├─ page.tsx                      # inicio del panel
│  │     ├─ empresas/…
│  │     ├─ usuarios/…                   # administradores y sus roles
│  │     ├─ empleados/…
│  │     └─ liquidaciones/…
│  ├─ componentes/                        # componentes propios
│  └─ acciones/                           # Server Actions
│     ├─ empresas.ts
│     ├─ padron.ts
│     ├─ codigos.ts
│     └─ liquidaciones.ts
├─ tests/
│  ├─ unidad/                             # Vitest, sin red
│  ├─ integracion/                        # Vitest contra Supabase real
│  └─ e2e/                                # Playwright
├─ .env.local.example
├─ vitest.config.ts
├─ playwright.config.ts
└─ package.json
```

**Criterio de separación:** cada archivo de `src/lib/` es una función pura con una responsabilidad, sin dependencias de React ni de Supabase, y tiene su archivo de test espejo en `tests/unidad/`. La lógica que decide si un archivo se puede publicar nunca vive en un componente.

---

## Tarea 1: Andamiaje del proyecto

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `vitest.config.ts`, `.gitignore`, `.env.local.example`
- Create: `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`
- Test: `tests/unidad/andamiaje.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: comandos `npm run dev`, `npm run build`, `npm run test`, `npm run test:e2e`; alias de importación `@/` → `src/`.

- [ ] **Step 1: Crear el proyecto Next.js**

Ejecutar en `D:\APP\RECIBOS` (la carpeta ya tiene `docs/` y `.git`, por eso se crea en `.` y se acepta sobreescribir nada):

```bash
npx create-next-app@latest . --typescript --tailwind --app --src-dir --import-alias "@/*" --no-eslint --use-npm --yes
```

Si el asistente advierte que el directorio no está vacío, aceptar: `docs/`, `.git/` y las carpetas de PDFs de ejemplo se conservan.

- [ ] **Step 2: Excluir del control de versiones los PDFs de ejemplo y los secretos**

Agregar al final de `.gitignore`:

```
# PDFs de ejemplo de Tango (datos personales reales, nunca al repositorio)
/Ejemplo*/
/recibos-prueba/

# Entorno
.env*.local
.vercel

# Resultados de pruebas
/test-results/
/playwright-report/
```

- [ ] **Step 3: Instalar dependencias de desarrollo y de aplicación**

```bash
npm install @supabase/supabase-js @supabase/ssr zod
npm install -D vitest @vitest/coverage-v8 @playwright/test tsx
```

- [ ] **Step 4: Configurar Vitest**

Crear `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/unidad/**/*.test.ts', 'tests/integracion/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
```

- [ ] **Step 5: Declarar los scripts**

En `package.json`, reemplazar el bloque `"scripts"` por:

```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "test": "vitest run tests/unidad",
  "test:integracion": "vitest run tests/integracion",
  "test:e2e": "playwright test",
  "tipos": "supabase gen types typescript --project-id $SUPABASE_PROJECT_ID > src/lib/supabase/tipos.ts"
}
```

- [ ] **Step 6: Escribir el test que verifica que el andamiaje funciona**

Crear `tests/unidad/andamiaje.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

describe('andamiaje', () => {
  it('resuelve el alias @/ hacia src/', async () => {
    const modulo = await import('@/lib/version')
    expect(modulo.NOMBRE_APP).toBe('Conforme')
  })
})
```

- [ ] **Step 7: Correr el test y verificar que falla**

Run: `npm test`
Expected: FAIL — `Cannot find module '@/lib/version'`

- [ ] **Step 8: Implementación mínima**

Crear `src/lib/version.ts`:

```ts
export const NOMBRE_APP = 'Conforme'
```

- [ ] **Step 9: Correr el test y verificar que pasa**

Run: `npm test`
Expected: PASS (1 test)

- [ ] **Step 10: Verificar que compila**

Run: `npm run build`
Expected: build exitoso, sin errores de TypeScript.

- [ ] **Step 11: Plantilla de variables de entorno**

Crear `.env.local.example`:

```
# Supabase — panel del proyecto → Settings → API
NEXT_PUBLIC_SUPABASE_URL=https://twejfeghrujsqzzuzvtf.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Dominio del email sintético con el que los empleados entran por CUIL.
# No necesita existir: nunca se le envía correo.
EMPLEADO_EMAIL_DOMAIN=empleados.conforme.local
```

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "chore: andamiaje del proyecto Next.js con Vitest y Playwright"
```

---

## Tarea 2: Utilidades de CUIL

El CUIL es el identificador de todo el sistema: entra por el nombre del archivo, por el CSV del padrón y por la pantalla de login. Toda la normalización vive acá y en ningún otro lado.

**Files:**
- Create: `src/lib/cuil.ts`
- Test: `tests/unidad/cuil.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `normalizarCuil(valor: string): string | null` — devuelve 11 dígitos sin guiones, o `null` si no tiene 11 dígitos.
  - `formatearCuil(cuil: string): string` — `'20271032758'` → `'20-27103275-8'`.
  - `cuilValido(cuil: string): boolean` — verifica el dígito verificador módulo 11.
  - `emailSinteticoDeCuil(cuil: string, dominio: string): string`.

- [ ] **Step 1: Escribir los tests que fallan**

Crear `tests/unidad/cuil.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { cuilValido, emailSinteticoDeCuil, formatearCuil, normalizarCuil } from '@/lib/cuil'

describe('normalizarCuil', () => {
  it('quita los guiones', () => {
    expect(normalizarCuil('20-27103275-8')).toBe('20271032758')
  })

  it('acepta el CUIL ya normalizado', () => {
    expect(normalizarCuil('20271032758')).toBe('20271032758')
  })

  it('tolera espacios, puntos y barras', () => {
    expect(normalizarCuil(' 20.27103275/8 ')).toBe('20271032758')
  })

  it('rechaza cantidades de dígitos distintas de 11', () => {
    expect(normalizarCuil('2027103275')).toBeNull()
    expect(normalizarCuil('202710327580')).toBeNull()
    expect(normalizarCuil('')).toBeNull()
  })
})

describe('formatearCuil', () => {
  it('inserta los guiones en las posiciones correctas', () => {
    expect(formatearCuil('20271032758')).toBe('20-27103275-8')
    expect(formatearCuil('27200129496')).toBe('27-20012949-6')
  })
})

describe('cuilValido', () => {
  it('acepta CUILes reales de los archivos de ejemplo', () => {
    expect(cuilValido('20271032758')).toBe(true) // 20-27103275-8
    expect(cuilValido('27200129496')).toBe(true) // 27-20012949-6
    expect(cuilValido('27546017546')).toBe(true) // 27-54601754-6
    expect(cuilValido('20478871032')).toBe(true) // 20-47887103-2
  })

  it('rechaza un dígito verificador incorrecto', () => {
    expect(cuilValido('20271032759')).toBe(false)
  })

  it('rechaza longitudes inválidas', () => {
    expect(cuilValido('2027103275')).toBe(false)
  })
})

describe('emailSinteticoDeCuil', () => {
  it('arma el email interno de login', () => {
    expect(emailSinteticoDeCuil('20271032758', 'empleados.conforme.local'))
      .toBe('20271032758@empleados.conforme.local')
  })
})
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `npm test`
Expected: FAIL — `Cannot find module '@/lib/cuil'`

- [ ] **Step 3: Implementar**

Crear `src/lib/cuil.ts`:

```ts
/** Pesos del algoritmo módulo 11 usado por AFIP para CUIT/CUIL. */
const PESOS = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]

/**
 * Deja el CUIL en su forma canónica: 11 dígitos, sin guiones ni separadores.
 * Devuelve null si el valor no contiene exactamente 11 dígitos.
 */
export function normalizarCuil(valor: string): string | null {
  const digitos = valor.replace(/\D/g, '')
  return digitos.length === 11 ? digitos : null
}

/** '20271032758' → '20-27103275-8'. Espera un CUIL ya normalizado. */
export function formatearCuil(cuil: string): string {
  return `${cuil.slice(0, 2)}-${cuil.slice(2, 10)}-${cuil.slice(10)}`
}

/** Verifica el dígito verificador. Espera un CUIL ya normalizado. */
export function cuilValido(cuil: string): boolean {
  if (!/^\d{11}$/.test(cuil)) return false

  const suma = PESOS.reduce((acc, peso, i) => acc + peso * Number(cuil[i]), 0)
  const resto = suma % 11

  let verificador = 11 - resto
  if (verificador === 11) verificador = 0
  else if (verificador === 10) verificador = 9

  return verificador === Number(cuil[10])
}

/**
 * Email interno con el que el empleado existe en Supabase Auth.
 * El empleado nunca lo ve ni lo escribe: entra con su CUIL y la app traduce.
 */
export function emailSinteticoDeCuil(cuil: string, dominio: string): string {
  return `${cuil}@${dominio}`
}
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `npm test`
Expected: PASS (todos los casos de `cuil.test.ts`)

- [ ] **Step 5: Commit**

```bash
git add src/lib/cuil.ts tests/unidad/cuil.test.ts
git commit -m "feat: utilidades de normalización y validación de CUIL"
```

---

## Tarea 3: Parser del nombre de archivo de Tango

**Files:**
- Create: `src/lib/tango/parse-nombre-recibo.ts`
- Test: `tests/unidad/tango/parse-nombre-recibo.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `type TipoLiquidacion = '1QA' | '2QA' | 'MEN'`
  - `interface ReciboParseado { periodo: number; tipo: TipoLiquidacion; datoFijo: number; legajo: number; cuil: string }`
  - `parseNombreRecibo(nombre: string): ReciboParseado | null`
  - `ETIQUETA_TIPO: Record<TipoLiquidacion, string>`

- [ ] **Step 1: Escribir los tests que fallan**

Crear `tests/unidad/tango/parse-nombre-recibo.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { parseNombreRecibo } from '@/lib/tango/parse-nombre-recibo'

describe('parseNombreRecibo', () => {
  it('parsea una liquidación mensual', () => {
    expect(parseNombreRecibo('RS_202604_MEN_679_102_27-22121012-9.pdf')).toEqual({
      periodo: 202604,
      tipo: 'MEN',
      datoFijo: 679,
      legajo: 102,
      cuil: '27221210129',
    })
  })

  it('parsea primera y segunda quincena', () => {
    expect(parseNombreRecibo('RS_202604_1QA_680_201_20-27103275-8.pdf')?.tipo).toBe('1QA')
    expect(parseNombreRecibo('RS_202604_2QA_681_201_20-27103275-8.pdf')?.tipo).toBe('2QA')
  })

  it('distingue legajo de un dígito de otro de tres', () => {
    expect(parseNombreRecibo('RS_202604_MEN_679_1_27-20012949-6.pdf')?.legajo).toBe(1)
    expect(parseNombreRecibo('RS_202604_MEN_679_201_20-27103275-8.pdf')?.legajo).toBe(201)
  })

  it('normaliza el CUIL quitando los guiones', () => {
    expect(parseNombreRecibo('RS_202604_MEN_679_2_20-16021001-0.pdf')?.cuil).toBe('20160210010')
  })

  it('acepta la extensión en mayúsculas', () => {
    expect(parseNombreRecibo('RS_202604_MEN_679_11_20-20454878-2.PDF')).not.toBeNull()
  })

  it('ignora espacios al principio y al final', () => {
    expect(parseNombreRecibo('  RS_202604_MEN_679_11_20-20454878-2.pdf  ')).not.toBeNull()
  })

  it('rechaza un prefijo que no sea RS', () => {
    expect(parseNombreRecibo('SAC_202604_MEN_679_11_20-20454878-2.pdf')).toBeNull()
  })

  it('rechaza un tipo de liquidación desconocido', () => {
    expect(parseNombreRecibo('RS_202604_SAC_679_11_20-20454878-2.pdf')).toBeNull()
  })

  it('rechaza un mes imposible', () => {
    expect(parseNombreRecibo('RS_202613_MEN_679_11_20-20454878-2.pdf')).toBeNull()
    expect(parseNombreRecibo('RS_202600_MEN_679_11_20-20454878-2.pdf')).toBeNull()
  })

  it('rechaza nombres con partes faltantes o de más', () => {
    expect(parseNombreRecibo('RS_202604_MEN_679_11.pdf')).toBeNull()
    expect(parseNombreRecibo('RS_202604_MEN_679_11_20-20454878-2_extra.pdf')).toBeNull()
  })

  it('rechaza archivos que no sean PDF', () => {
    expect(parseNombreRecibo('RS_202604_MEN_679_11_20-20454878-2.txt')).toBeNull()
  })

  it('rechaza un CUIL con la cantidad de dígitos equivocada', () => {
    expect(parseNombreRecibo('RS_202604_MEN_679_11_20-2045487-2.pdf')).toBeNull()
  })
})
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `npm test`
Expected: FAIL — `Cannot find module '@/lib/tango/parse-nombre-recibo'`

- [ ] **Step 3: Implementar**

Crear `src/lib/tango/parse-nombre-recibo.ts`:

```ts
export type TipoLiquidacion = '1QA' | '2QA' | 'MEN'

export interface ReciboParseado {
  /** Período liquidado en formato AAAAMM, ej. 202604. */
  periodo: number
  tipo: TipoLiquidacion
  /** "Dato fijo" de Tango: el número de liquidación, ej. 680. */
  datoFijo: number
  legajo: number
  /** CUIL normalizado: 11 dígitos, sin guiones. */
  cuil: string
}

export const ETIQUETA_TIPO: Record<TipoLiquidacion, string> = {
  '1QA': 'Primera quincena',
  '2QA': 'Segunda quincena',
  MEN: 'Mensual',
}

/**
 * Nombre que exporta Tango Sueldos:
 *   RS_202604_1QA_680_201_20-27103275-8.pdf
 *   │  │      │   │   │   └─ CUIL
 *   │  │      │   │   └───── legajo
 *   │  │      │   └───────── dato fijo (número de liquidación)
 *   │  │      └───────────── tipo de liquidación
 *   │  └──────────────────── período AAAAMM
 *   └─────────────────────── prefijo de recibo de sueldo
 */
const PATRON = /^RS_(\d{6})_(1QA|2QA|MEN)_(\d+)_(\d+)_(\d{2})-(\d{8})-(\d)\.pdf$/i

/** Devuelve los datos del recibo, o null si el nombre no corresponde a uno. */
export function parseNombreRecibo(nombre: string): ReciboParseado | null {
  const coincidencia = PATRON.exec(nombre.trim())
  if (!coincidencia) return null

  const periodo = Number(coincidencia[1])
  const mes = periodo % 100
  if (mes < 1 || mes > 12) return null

  return {
    periodo,
    tipo: coincidencia[2].toUpperCase() as TipoLiquidacion,
    datoFijo: Number(coincidencia[3]),
    legajo: Number(coincidencia[4]),
    cuil: `${coincidencia[5]}${coincidencia[6]}${coincidencia[7]}`,
  }
}
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Verificar contra los archivos reales**

Crear `scripts/verificar-carpeta-ejemplo.ts`:

```ts
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
```

Run: `npx tsx scripts/verificar-carpeta-ejemplo.ts "D:/APP/RECIBOS/Ejemplo Delta 6"`
Expected: 28 reconocidos, 0 ignorados.

- [ ] **Step 6: Commit**

```bash
git add src/lib/tango/parse-nombre-recibo.ts tests/unidad/tango/parse-nombre-recibo.test.ts scripts/verificar-carpeta-ejemplo.ts
git commit -m "feat: parser del nombre de archivo de recibos de Tango"
```

---

## Tarea 4: Agrupación de archivos en lotes de liquidación

**Files:**
- Create: `src/lib/tango/agrupar-lotes.ts`, `src/lib/periodo.ts`
- Test: `tests/unidad/tango/agrupar-lotes.test.ts`, `tests/unidad/periodo.test.ts`

**Interfaces:**
- Consumes: `ReciboParseado`, `TipoLiquidacion`, `ETIQUETA_TIPO` de la Tarea 3.
- Produces:
  - `interface ArchivoEscaneado { nombre: string; rutaRelativa: string; bytes: number; datos: ReciboParseado }`
  - `interface Lote { periodo: number; tipo: TipoLiquidacion; datoFijo: number; archivos: ArchivoEscaneado[] }`
  - `agruparEnLotes(archivos: ArchivoEscaneado[]): Lote[]`
  - `claveLote(lote: { periodo: number; tipo: TipoLiquidacion; datoFijo: number }): string`
  - `formatearPeriodo(periodo: number): string` — `202604` → `'Abril 2026'`
  - `describirLote(lote): string` — `'Abril 2026 · Primera quincena · Liq. 680'`

- [ ] **Step 1: Escribir los tests que fallan**

Crear `tests/unidad/periodo.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { formatearPeriodo } from '@/lib/periodo'

describe('formatearPeriodo', () => {
  it('convierte AAAAMM en texto legible', () => {
    expect(formatearPeriodo(202604)).toBe('Abril 2026')
    expect(formatearPeriodo(202512)).toBe('Diciembre 2025')
    expect(formatearPeriodo(202601)).toBe('Enero 2026')
  })
})
```

Crear `tests/unidad/tango/agrupar-lotes.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { agruparEnLotes, claveLote, describirLote, type ArchivoEscaneado } from '@/lib/tango/agrupar-lotes'
import { parseNombreRecibo } from '@/lib/tango/parse-nombre-recibo'

function archivo(nombre: string): ArchivoEscaneado {
  const datos = parseNombreRecibo(nombre)
  if (!datos) throw new Error(`nombre de prueba inválido: ${nombre}`)
  return { nombre, rutaRelativa: `202604/${nombre}`, bytes: 45000, datos }
}

describe('agruparEnLotes', () => {
  it('agrupa por período, tipo y dato fijo', () => {
    const lotes = agruparEnLotes([
      archivo('RS_202604_1QA_680_201_20-27103275-8.pdf'),
      archivo('RS_202604_1QA_680_202_20-19202141-4.pdf'),
      archivo('RS_202604_MEN_679_1_27-20012949-6.pdf'),
    ])

    expect(lotes).toHaveLength(2)
    expect(lotes.map((l) => l.archivos.length).sort()).toEqual([1, 2])
  })

  it('separa liquidaciones del mismo período con distinto dato fijo', () => {
    const lotes = agruparEnLotes([
      archivo('RS_202604_1QA_680_201_20-27103275-8.pdf'),
      archivo('RS_202604_2QA_681_201_20-27103275-8.pdf'),
    ])
    expect(lotes).toHaveLength(2)
  })

  it('ordena del período más nuevo al más viejo', () => {
    const lotes = agruparEnLotes([
      archivo('RS_202603_MEN_670_1_27-20012949-6.pdf'),
      archivo('RS_202605_MEN_690_1_27-20012949-6.pdf'),
      archivo('RS_202604_MEN_679_1_27-20012949-6.pdf'),
    ])
    expect(lotes.map((l) => l.periodo)).toEqual([202605, 202604, 202603])
  })

  it('devuelve una lista vacía si no hay archivos', () => {
    expect(agruparEnLotes([])).toEqual([])
  })
})

describe('claveLote', () => {
  it('produce una clave estable', () => {
    expect(claveLote({ periodo: 202604, tipo: '1QA', datoFijo: 680 })).toBe('202604-1QA-680')
  })
})

describe('describirLote', () => {
  it('arma la descripción que ve el administrador', () => {
    expect(describirLote({ periodo: 202604, tipo: '1QA', datoFijo: 680 }))
      .toBe('Abril 2026 · Primera quincena · Liq. 680')
  })
})
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `npm test`
Expected: FAIL — módulos inexistentes.

- [ ] **Step 3: Implementar el formateo de período**

Crear `src/lib/periodo.ts`:

```ts
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
```

- [ ] **Step 4: Implementar la agrupación**

Crear `src/lib/tango/agrupar-lotes.ts`:

```ts
import { formatearPeriodo } from '@/lib/periodo'
import { ETIQUETA_TIPO, type ReciboParseado, type TipoLiquidacion } from '@/lib/tango/parse-nombre-recibo'

export interface ArchivoEscaneado {
  nombre: string
  /** Ruta dentro de la carpeta elegida, para poder mostrarla en la revisión. */
  rutaRelativa: string
  bytes: number
  datos: ReciboParseado
}

export interface ClaveLiquidacion {
  periodo: number
  tipo: TipoLiquidacion
  datoFijo: number
}

export interface Lote extends ClaveLiquidacion {
  archivos: ArchivoEscaneado[]
}

const ORDEN_TIPO: Record<TipoLiquidacion, number> = { MEN: 0, '1QA': 1, '2QA': 2 }

export function claveLote(clave: ClaveLiquidacion): string {
  return `${clave.periodo}-${clave.tipo}-${clave.datoFijo}`
}

export function describirLote(clave: ClaveLiquidacion): string {
  return `${formatearPeriodo(clave.periodo)} · ${ETIQUETA_TIPO[clave.tipo]} · Liq. ${clave.datoFijo}`
}

/** Agrupa los archivos escaneados en una liquidación por cada (período, tipo, dato fijo). */
export function agruparEnLotes(archivos: ArchivoEscaneado[]): Lote[] {
  const porClave = new Map<string, Lote>()

  for (const archivo of archivos) {
    const { periodo, tipo, datoFijo } = archivo.datos
    const clave = claveLote({ periodo, tipo, datoFijo })

    let lote = porClave.get(clave)
    if (!lote) {
      lote = { periodo, tipo, datoFijo, archivos: [] }
      porClave.set(clave, lote)
    }
    lote.archivos.push(archivo)
  }

  const lotes = [...porClave.values()]
  for (const lote of lotes) {
    lote.archivos.sort((a, b) => a.datos.legajo - b.datos.legajo)
  }

  return lotes.sort(
    (a, b) =>
      b.periodo - a.periodo ||
      ORDEN_TIPO[a.tipo] - ORDEN_TIPO[b.tipo] ||
      a.datoFijo - b.datoFijo,
  )
}
```

- [ ] **Step 5: Correr los tests y verificar que pasan**

Run: `npm test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/periodo.ts src/lib/tango/agrupar-lotes.ts tests/unidad/periodo.test.ts tests/unidad/tango/agrupar-lotes.test.ts
git commit -m "feat: agrupación de archivos escaneados en lotes de liquidación"
```

---

## Tarea 5: Motor de cotejo contra el padrón

Es la pieza que evita el error más caro del sistema: entregarle a una persona el recibo de otra. Toda la lógica es pura y se prueba sin base de datos.

**Files:**
- Create: `src/lib/tango/cotejar-lote.ts`
- Test: `tests/unidad/tango/cotejar-lote.test.ts`

**Interfaces:**
- Consumes: `Lote`, `ArchivoEscaneado` de la Tarea 4.
- Produces:
  - `type CodigoDiagnostico = 'LEGAJO_INEXISTENTE' | 'CUIL_NO_COINCIDE' | 'EMPLEADO_INACTIVO' | 'FALTA_EN_LOTE' | 'DUPLICADO_EN_LOTE' | 'YA_SUBIDO' | 'REEMPLAZO'`
  - `type Severidad = 'bloqueante' | 'advertencia' | 'informativo'`
  - `interface LegajoPadron { legajoId: string; numero: number; cuil: string; nombre: string; activo: boolean }`
  - `interface ReciboExistente { legajo: number; sha256: string }`
  - `interface Diagnostico { codigo: CodigoDiagnostico; severidad: Severidad; legajo: number; archivo: string | null; detalle: string }`
  - `interface ResultadoCotejo { diagnosticos: Diagnostico[]; publicables: ArchivoEscaneado[]; hayBloqueantes: boolean }`
  - `cotejarLote(entrada: { lote: Lote; padron: LegajoPadron[]; existentes: ReciboExistente[]; hashes: Map<string, string> }): ResultadoCotejo`

- [ ] **Step 1: Escribir los tests que fallan**

Crear `tests/unidad/tango/cotejar-lote.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { agruparEnLotes, type ArchivoEscaneado } from '@/lib/tango/agrupar-lotes'
import { parseNombreRecibo } from '@/lib/tango/parse-nombre-recibo'
import { cotejarLote, type LegajoPadron } from '@/lib/tango/cotejar-lote'

function archivo(nombre: string): ArchivoEscaneado {
  const datos = parseNombreRecibo(nombre)
  if (!datos) throw new Error(`nombre de prueba inválido: ${nombre}`)
  return { nombre, rutaRelativa: nombre, bytes: 45000, datos }
}

function loteDe(...nombres: string[]) {
  return agruparEnLotes(nombres.map(archivo))[0]
}

const PADRON: LegajoPadron[] = [
  { legajoId: 'l-201', numero: 201, cuil: '20271032758', nombre: 'Pérez, Ana', activo: true },
  { legajoId: 'l-202', numero: 202, cuil: '20192021414', nombre: 'Gómez, Luis', activo: true },
  { legajoId: 'l-203', numero: 203, cuil: '20316359214', nombre: 'Díaz, Sol', activo: false },
]

const SIN_EXISTENTES = { existentes: [], hashes: new Map<string, string>() }

describe('cotejarLote', () => {
  it('no reporta nada cuando el lote coincide con el padrón activo', () => {
    const lote = loteDe(
      'RS_202604_1QA_680_201_20-27103275-8.pdf',
      'RS_202604_1QA_680_202_20-19202141-4.pdf',
    )
    const padronActivo = PADRON.filter((l) => l.activo)

    const resultado = cotejarLote({ lote, padron: padronActivo, ...SIN_EXISTENTES })

    expect(resultado.diagnosticos).toEqual([])
    expect(resultado.hayBloqueantes).toBe(false)
    expect(resultado.publicables).toHaveLength(2)
  })

  it('marca como bloqueante un legajo que no existe en el padrón', () => {
    const lote = loteDe('RS_202604_1QA_680_999_20-27103275-8.pdf')

    const resultado = cotejarLote({ lote, padron: PADRON, ...SIN_EXISTENTES })

    expect(resultado.diagnosticos).toContainEqual(
      expect.objectContaining({ codigo: 'LEGAJO_INEXISTENTE', severidad: 'bloqueante', legajo: 999 }),
    )
    expect(resultado.hayBloqueantes).toBe(true)
    expect(resultado.publicables).toHaveLength(0)
  })

  it('marca como bloqueante un legajo cuyo CUIL no coincide con el del padrón', () => {
    // El legajo 201 en el padrón es 20271032758, pero el archivo trae el de otra persona.
    const lote = loteDe('RS_202604_1QA_680_201_20-19202141-4.pdf')

    const resultado = cotejarLote({ lote, padron: PADRON, ...SIN_EXISTENTES })

    expect(resultado.diagnosticos).toContainEqual(
      expect.objectContaining({ codigo: 'CUIL_NO_COINCIDE', severidad: 'bloqueante', legajo: 201 }),
    )
    expect(resultado.hayBloqueantes).toBe(true)
  })

  it('advierte cuando el empleado está inactivo pero deja publicar', () => {
    const lote = loteDe('RS_202604_1QA_680_203_20-31635921-4.pdf')

    const resultado = cotejarLote({ lote, padron: PADRON, ...SIN_EXISTENTES })

    expect(resultado.diagnosticos).toContainEqual(
      expect.objectContaining({ codigo: 'EMPLEADO_INACTIVO', severidad: 'advertencia', legajo: 203 }),
    )
    expect(resultado.hayBloqueantes).toBe(false)
    expect(resultado.publicables).toHaveLength(1)
  })

  it('advierte cuando falta en el lote un legajo activo del padrón', () => {
    const lote = loteDe('RS_202604_1QA_680_201_20-27103275-8.pdf')
    const padronActivo = PADRON.filter((l) => l.activo)

    const resultado = cotejarLote({ lote, padron: padronActivo, ...SIN_EXISTENTES })

    expect(resultado.diagnosticos).toContainEqual(
      expect.objectContaining({ codigo: 'FALTA_EN_LOTE', severidad: 'advertencia', legajo: 202 }),
    )
  })

  it('bloquea cuando el mismo legajo aparece dos veces en el lote', () => {
    const uno = archivo('RS_202604_1QA_680_201_20-27103275-8.pdf')
    const otro = { ...uno, nombre: 'copia.pdf', rutaRelativa: 'sub/RS_202604_1QA_680_201_20-27103275-8.pdf' }
    const lote = agruparEnLotes([uno, otro])[0]

    const resultado = cotejarLote({ lote, padron: PADRON, ...SIN_EXISTENTES })

    expect(resultado.diagnosticos).toContainEqual(
      expect.objectContaining({ codigo: 'DUPLICADO_EN_LOTE', severidad: 'bloqueante', legajo: 201 }),
    )
    expect(resultado.hayBloqueantes).toBe(true)
  })

  it('saltea sin error un archivo ya subido con el mismo contenido', () => {
    const lote = loteDe('RS_202604_1QA_680_201_20-27103275-8.pdf')
    const hashes = new Map([['RS_202604_1QA_680_201_20-27103275-8.pdf', 'abc123']])

    const resultado = cotejarLote({
      lote,
      padron: PADRON,
      existentes: [{ legajo: 201, sha256: 'abc123' }],
      hashes,
    })

    expect(resultado.diagnosticos).toContainEqual(
      expect.objectContaining({ codigo: 'YA_SUBIDO', severidad: 'informativo', legajo: 201 }),
    )
    expect(resultado.publicables).toHaveLength(0)
    expect(resultado.hayBloqueantes).toBe(false)
  })

  it('detecta un reemplazo cuando cambia el contenido del mismo legajo', () => {
    const lote = loteDe('RS_202604_1QA_680_201_20-27103275-8.pdf')
    const hashes = new Map([['RS_202604_1QA_680_201_20-27103275-8.pdf', 'nuevo999']])

    const resultado = cotejarLote({
      lote,
      padron: PADRON,
      existentes: [{ legajo: 201, sha256: 'viejo111' }],
      hashes,
    })

    expect(resultado.diagnosticos).toContainEqual(
      expect.objectContaining({ codigo: 'REEMPLAZO', severidad: 'advertencia', legajo: 201 }),
    )
    expect(resultado.publicables).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `npm test`
Expected: FAIL — `Cannot find module '@/lib/tango/cotejar-lote'`

- [ ] **Step 3: Implementar**

Crear `src/lib/tango/cotejar-lote.ts`:

```ts
import { formatearCuil } from '@/lib/cuil'
import type { ArchivoEscaneado, Lote } from '@/lib/tango/agrupar-lotes'

export type CodigoDiagnostico =
  | 'LEGAJO_INEXISTENTE'
  | 'CUIL_NO_COINCIDE'
  | 'EMPLEADO_INACTIVO'
  | 'FALTA_EN_LOTE'
  | 'DUPLICADO_EN_LOTE'
  | 'YA_SUBIDO'
  | 'REEMPLAZO'

export type Severidad = 'bloqueante' | 'advertencia' | 'informativo'

export interface LegajoPadron {
  legajoId: string
  numero: number
  cuil: string
  nombre: string
  activo: boolean
}

/** Recibo vigente que ya está cargado en el sistema para esta liquidación. */
export interface ReciboExistente {
  legajo: number
  sha256: string
}

export interface Diagnostico {
  codigo: CodigoDiagnostico
  severidad: Severidad
  legajo: number
  /** Nombre del archivo involucrado, o null cuando el problema es una ausencia. */
  archivo: string | null
  detalle: string
}

export interface ResultadoCotejo {
  diagnosticos: Diagnostico[]
  /** Archivos que deben subirse y publicarse. */
  publicables: ArchivoEscaneado[]
  hayBloqueantes: boolean
}

interface EntradaCotejo {
  lote: Lote
  padron: LegajoPadron[]
  existentes: ReciboExistente[]
  /** SHA-256 por nombre de archivo, calculado antes de subir. */
  hashes: Map<string, string>
}

export function cotejarLote({ lote, padron, existentes, hashes }: EntradaCotejo): ResultadoCotejo {
  const diagnosticos: Diagnostico[] = []
  const publicables: ArchivoEscaneado[] = []

  const porNumero = new Map(padron.map((l) => [l.numero, l]))
  const existentePorLegajo = new Map(existentes.map((r) => [r.legajo, r]))
  const vecesEnLote = new Map<number, number>()

  for (const archivo of lote.archivos) {
    const legajo = archivo.datos.legajo
    vecesEnLote.set(legajo, (vecesEnLote.get(legajo) ?? 0) + 1)
  }

  const duplicadosReportados = new Set<number>()

  for (const archivo of lote.archivos) {
    const { legajo, cuil } = archivo.datos

    if ((vecesEnLote.get(legajo) ?? 0) > 1) {
      if (!duplicadosReportados.has(legajo)) {
        duplicadosReportados.add(legajo)
        diagnosticos.push({
          codigo: 'DUPLICADO_EN_LOTE',
          severidad: 'bloqueante',
          legajo,
          archivo: archivo.nombre,
          detalle: `El legajo ${legajo} aparece ${vecesEnLote.get(legajo)} veces en esta liquidación. Dejá un solo archivo.`,
        })
      }
      continue
    }

    const enPadron = porNumero.get(legajo)

    if (!enPadron) {
      diagnosticos.push({
        codigo: 'LEGAJO_INEXISTENTE',
        severidad: 'bloqueante',
        legajo,
        archivo: archivo.nombre,
        detalle: `El legajo ${legajo} (CUIL ${formatearCuil(cuil)}) no existe en el padrón de esta empresa. Importalo o excluí el archivo.`,
      })
      continue
    }

    if (enPadron.cuil !== cuil) {
      diagnosticos.push({
        codigo: 'CUIL_NO_COINCIDE',
        severidad: 'bloqueante',
        legajo,
        archivo: archivo.nombre,
        detalle: `El legajo ${legajo} figura en el padrón con CUIL ${formatearCuil(enPadron.cuil)} (${enPadron.nombre}), pero el archivo trae ${formatearCuil(cuil)}. Revisalo antes de publicar.`,
      })
      continue
    }

    if (!enPadron.activo) {
      diagnosticos.push({
        codigo: 'EMPLEADO_INACTIVO',
        severidad: 'advertencia',
        legajo,
        archivo: archivo.nombre,
        detalle: `${enPadron.nombre} está dado de baja pero tiene recibo en esta liquidación.`,
      })
    }

    const existente = existentePorLegajo.get(legajo)
    const hash = hashes.get(archivo.nombre)

    if (existente && hash && existente.sha256 === hash) {
      diagnosticos.push({
        codigo: 'YA_SUBIDO',
        severidad: 'informativo',
        legajo,
        archivo: archivo.nombre,
        detalle: `Ya está cargado y sin cambios. Se saltea.`,
      })
      continue
    }

    if (existente && hash && existente.sha256 !== hash) {
      diagnosticos.push({
        codigo: 'REEMPLAZO',
        severidad: 'advertencia',
        legajo,
        archivo: archivo.nombre,
        detalle: `Ya hay un recibo cargado para ${enPadron.nombre} en esta liquidación y el archivo cambió. Se publicará como versión nueva y requerirá una nueva conformidad.`,
      })
    }

    publicables.push(archivo)
  }

  const legajosEnLote = new Set(lote.archivos.map((a) => a.datos.legajo))
  for (const entrada of padron) {
    if (entrada.activo && !legajosEnLote.has(entrada.numero)) {
      diagnosticos.push({
        codigo: 'FALTA_EN_LOTE',
        severidad: 'advertencia',
        legajo: entrada.numero,
        archivo: null,
        detalle: `${entrada.nombre} está activo en el padrón pero no tiene recibo en esta liquidación.`,
      })
    }
  }

  return {
    diagnosticos,
    publicables,
    hayBloqueantes: diagnosticos.some((d) => d.severidad === 'bloqueante'),
  }
}
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/tango/cotejar-lote.ts tests/unidad/tango/cotejar-lote.test.ts
git commit -m "feat: motor de cotejo de lotes contra el padrón"
```

---
## Tarea 6: Migración del esquema base

**Files:**
- Create: `supabase/migrations/0001_esquema_base.sql`
- Test: verificación por consulta SQL (paso 3)

**Interfaces:**
- Consumes: nada.
- Produces: tablas `empresas`, `personas`, `legajos`, `admin_usuarios`, `codigos_activacion`; enums `estado_persona`, `rol_admin`, `motivo_codigo`; función `tocar_updated_at()`.

**Precondición:** el conector MCP de Supabase debe estar autorizado sobre el proyecto `twejfeghrujsqzzuzvtf`. Si no lo está, aplicar el archivo pegándolo en el editor SQL del panel de Supabase.

- [ ] **Step 1: Escribir la migración**

Crear `supabase/migrations/0001_esquema_base.sql`:

```sql
-- Conforme — esquema base: empresas, identidades, legajos y administradores.

create extension if not exists pgcrypto;

create type estado_persona as enum ('pendiente', 'activo', 'bloqueado');
create type rol_admin as enum ('admin', 'operador', 'consulta');
create type motivo_codigo as enum ('alta', 'reset');

-- Mantiene updated_at al día sin depender de la aplicación.
create or replace function tocar_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ── Empresas ───────────────────────────────────────────────────────────
create table empresas (
  id                uuid primary key default gen_random_uuid(),
  razon_social      text not null,
  cuit              char(11) not null unique,
  nombre_corto      text not null,
  texto_conformidad text not null default
    'Declaro haber recibido el presente recibo de sueldo y prestar conformidad con su contenido.',
  logo_url          text,
  activa            boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint cuit_11_digitos check (cuit ~ '^[0-9]{11}$')
);

comment on column empresas.cuit is 'Once dígitos, sin guiones.';
comment on column empresas.texto_conformidad is
  'Texto legal que el empleado acepta. Se copia íntegro en cada conformidad.';

create trigger empresas_updated_at before update on empresas
  for each row execute function tocar_updated_at();

-- ── Personas: la identidad del empleado, una por CUIL ──────────────────
create table personas (
  id               uuid primary key default gen_random_uuid(),
  cuil             char(11) not null unique,
  apellido_nombre  text not null,
  email            text,
  email_verificado boolean not null default false,
  telefono         text,
  auth_user_id     uuid unique references auth.users (id) on delete set null,
  estado           estado_persona not null default 'pendiente',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint cuil_11_digitos check (cuil ~ '^[0-9]{11}$')
);

comment on table personas is
  'Identidad única por CUIL. Una persona puede tener legajo en varias empresas.';
comment on column personas.auth_user_id is
  'Nulo hasta que la persona activa su cuenta con el código de activación.';

create trigger personas_updated_at before update on personas
  for each row execute function tocar_updated_at();

-- ── Legajos: el vínculo persona ↔ empresa ──────────────────────────────
create table legajos (
  id            uuid primary key default gen_random_uuid(),
  empresa_id    uuid not null references empresas (id) on delete restrict,
  persona_id    uuid not null references personas (id) on delete restrict,
  numero        integer not null,
  activo        boolean not null default true,
  sector        text,
  fecha_ingreso date,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (empresa_id, numero),
  constraint numero_positivo check (numero > 0)
);

comment on column legajos.numero is 'Número de legajo de Tango Sueldos.';

create index legajos_persona_idx on legajos (persona_id);
create index legajos_empresa_activo_idx on legajos (empresa_id) where activo;

create trigger legajos_updated_at before update on legajos
  for each row execute function tocar_updated_at();

-- ── Administradores ────────────────────────────────────────────────────
create table admin_usuarios (
  id         uuid primary key references auth.users (id) on delete cascade,
  nombre     text not null,
  email      text not null,
  rol        rol_admin not null default 'consulta',
  activo     boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table admin_usuarios is
  'No hay registro abierto: el primer administrador se crea por semilla y el resto por invitación.';

-- ── Códigos de activación ──────────────────────────────────────────────
create table codigos_activacion (
  id          uuid primary key default gen_random_uuid(),
  persona_id  uuid not null references personas (id) on delete cascade,
  codigo_hash text not null,
  motivo      motivo_codigo not null default 'alta',
  creado_por  uuid references admin_usuarios (id) on delete set null,
  expira_at   timestamptz not null,
  usado_at    timestamptz,
  anulado_at  timestamptz,
  created_at  timestamptz not null default now()
);

comment on column codigos_activacion.codigo_hash is
  'Hash del código. El texto plano se muestra una sola vez, al generarlo.';

-- Una persona no puede tener dos códigos vigentes a la vez.
create unique index codigo_vigente_por_persona
  on codigos_activacion (persona_id)
  where usado_at is null and anulado_at is null;
```

- [ ] **Step 2: Aplicar la migración**

Con el conector de Supabase autorizado, usar la herramienta `apply_migration` con `project_id = twejfeghrujsqzzuzvtf`, `name = 0001_esquema_base` y el contenido del archivo.

Alternativa manual: panel de Supabase → SQL Editor → pegar y ejecutar.

- [ ] **Step 3: Verificar que el esquema quedó como se espera**

Ejecutar en el editor SQL (o con `execute_sql`):

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
order by table_name;
```

Expected: `admin_usuarios`, `codigos_activacion`, `empresas`, `legajos`, `personas`.

```sql
select conname
from pg_constraint
where conrelid = 'legajos'::regclass and contype = 'u';
```

Expected: la restricción única sobre `(empresa_id, numero)`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0001_esquema_base.sql
git commit -m "feat: migración del esquema base (empresas, personas, legajos, administradores)"
```

---

## Tarea 7: Migración de liquidaciones, recibos y conformidades

**Files:**
- Create: `supabase/migrations/0002_liquidaciones.sql`

**Interfaces:**
- Consumes: `empresas`, `legajos`, `personas`, `admin_usuarios` de la Tarea 6.
- Produces: tablas `liquidaciones`, `recibos`, `conformidades`, `observaciones`; enums `tipo_liquidacion`, `estado_liquidacion`, `estado_recibo`, `estado_observacion`; función `impedir_modificacion()`.

- [ ] **Step 1: Escribir la migración**

Crear `supabase/migrations/0002_liquidaciones.sql`:

```sql
-- Conforme — liquidaciones, recibos y el registro inmutable de conformidad.

create type tipo_liquidacion   as enum ('1QA', '2QA', 'MEN');
create type estado_liquidacion as enum ('borrador', 'publicada', 'anulada');
create type estado_recibo      as enum ('vigente', 'reemplazado');
create type estado_observacion as enum ('abierta', 'resuelta');

-- ── Liquidaciones: el lote ─────────────────────────────────────────────
create table liquidaciones (
  id            uuid primary key default gen_random_uuid(),
  empresa_id    uuid not null references empresas (id) on delete restrict,
  periodo       integer not null,
  tipo          tipo_liquidacion not null,
  dato_fijo     integer not null,
  estado        estado_liquidacion not null default 'borrador',
  creada_por    uuid references admin_usuarios (id) on delete set null,
  publicada_por uuid references admin_usuarios (id) on delete set null,
  publicada_at  timestamptz,
  notas         text,
  created_at    timestamptz not null default now(),
  unique (empresa_id, periodo, tipo, dato_fijo),
  constraint periodo_valido check (
    periodo between 200001 and 299912 and (periodo % 100) between 1 and 12
  ),
  constraint publicada_coherente check (
    (estado = 'publicada') = (publicada_at is not null)
  )
);

comment on column liquidaciones.periodo   is 'AAAAMM, ej. 202604.';
comment on column liquidaciones.dato_fijo is 'Número de liquidación de Tango, ej. 680.';

create index liquidaciones_empresa_periodo_idx
  on liquidaciones (empresa_id, periodo desc);

-- ── Recibos ────────────────────────────────────────────────────────────
create table recibos (
  id              uuid primary key default gen_random_uuid(),
  liquidacion_id  uuid not null references liquidaciones (id) on delete restrict,
  legajo_id       uuid not null references legajos (id) on delete restrict,
  version         integer not null default 1,
  storage_path    text not null unique,
  nombre_original text not null,
  sha256          char(64) not null,
  bytes           integer not null,
  cuil_archivo    char(11) not null,
  estado          estado_recibo not null default 'vigente',
  subido_por      uuid references admin_usuarios (id) on delete set null,
  subido_at       timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  unique (liquidacion_id, legajo_id, version),
  constraint version_positiva check (version > 0)
);

comment on column recibos.sha256 is
  'SHA-256 del PDF. Da idempotencia a la subida y prueba qué documento se firmó.';
comment on column recibos.cuil_archivo is
  'CUIL leído del nombre del archivo, guardado para poder auditar discrepancias.';

-- Un solo recibo vigente por legajo y liquidación.
create unique index recibo_vigente_unico
  on recibos (liquidacion_id, legajo_id)
  where estado = 'vigente';

create index recibos_legajo_idx on recibos (legajo_id);

-- ── Conformidades: solo inserción, nunca modificación ──────────────────
create sequence comprobante_seq;

create table conformidades (
  id                 uuid primary key default gen_random_uuid(),
  recibo_id          uuid not null unique references recibos (id) on delete restrict,
  persona_id         uuid not null references personas (id) on delete restrict,
  sha256_documento   char(64) not null,
  texto_legal        text not null,
  ip                 inet,
  user_agent         text,
  comprobante_codigo text not null unique default
    'CNF-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('comprobante_seq')::text, 7, '0'),
  created_at         timestamptz not null default now()
);

comment on table conformidades is
  'Registro probatorio de solo inserción. Un trigger impide UPDATE y DELETE.';
comment on column conformidades.texto_legal is
  'Copia íntegra del texto que la persona leyó al firmar, no una referencia.';

create index conformidades_persona_idx on conformidades (persona_id);

-- ── Observaciones del empleado ─────────────────────────────────────────
create table observaciones (
  id           uuid primary key default gen_random_uuid(),
  recibo_id    uuid not null references recibos (id) on delete restrict,
  persona_id   uuid not null references personas (id) on delete restrict,
  texto        text not null,
  estado       estado_observacion not null default 'abierta',
  respuesta    text,
  resuelta_por uuid references admin_usuarios (id) on delete set null,
  resuelta_at  timestamptz,
  created_at   timestamptz not null default now()
);

create index observaciones_abiertas_idx on observaciones (created_at desc)
  where estado = 'abierta';

-- ── Inmutabilidad ──────────────────────────────────────────────────────
create or replace function impedir_modificacion()
returns trigger
language plpgsql
as $$
begin
  raise exception
    'La tabla % es de solo inserción: no se puede % una fila.',
    tg_table_name, lower(tg_op);
end;
$$;

create trigger conformidades_inmutables
  before update or delete on conformidades
  for each row execute function impedir_modificacion();
```

- [ ] **Step 2: Aplicar la migración**

`apply_migration` con `name = 0002_liquidaciones`.

- [ ] **Step 3: Verificar que la inmutabilidad funciona de verdad**

Ejecutar:

```sql
do $$
declare
  v_empresa uuid; v_persona uuid; v_legajo uuid; v_liq uuid; v_recibo uuid;
begin
  insert into empresas (razon_social, cuit, nombre_corto)
    values ('Prueba SA', '30111111113', 'Prueba') returning id into v_empresa;
  insert into personas (cuil, apellido_nombre)
    values ('20271032758', 'Prueba, Ana') returning id into v_persona;
  insert into legajos (empresa_id, persona_id, numero)
    values (v_empresa, v_persona, 1) returning id into v_legajo;
  insert into liquidaciones (empresa_id, periodo, tipo, dato_fijo)
    values (v_empresa, 202604, 'MEN', 679) returning id into v_liq;
  insert into recibos (liquidacion_id, legajo_id, storage_path, nombre_original,
                       sha256, bytes, cuil_archivo)
    values (v_liq, v_legajo, 'prueba/1.pdf', 'x.pdf', repeat('a', 64), 100, '20271032758')
    returning id into v_recibo;
  insert into conformidades (recibo_id, persona_id, sha256_documento, texto_legal)
    values (v_recibo, v_persona, repeat('a', 64), 'texto de prueba');

  begin
    update conformidades set texto_legal = 'alterado' where recibo_id = v_recibo;
    raise exception 'FALLO: se pudo modificar una conformidad';
  exception when others then
    raise notice 'OK: la conformidad no se puede modificar (%)', sqlerrm;
  end;

  raise exception 'rollback de la prueba';
end;
$$;
```

Expected: aviso `OK: la conformidad no se puede modificar`, y la transacción termina revertida por la excepción final (no queda ningún dato de prueba).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0002_liquidaciones.sql
git commit -m "feat: migración de liquidaciones, recibos y conformidades inmutables"
```

---

## Tarea 8: Migración de operación y almacenamiento

**Files:**
- Create: `supabase/migrations/0003_operacion.sql`, `supabase/migrations/0004_storage.sql`

**Interfaces:**
- Consumes: tablas de las Tareas 6 y 7.
- Produces: tablas `notificaciones`, `push_subscriptions`, `eventos_auditoria`, `importaciones`; bucket privado `recibos`.

- [ ] **Step 1: Escribir la migración de operación**

Crear `supabase/migrations/0003_operacion.sql`:

```sql
-- Conforme — cola de avisos, auditoría e importaciones.

create type canal_notificacion  as enum ('email', 'push', 'whatsapp');
create type tipo_notificacion   as enum ('publicacion', 'recordatorio');
create type estado_notificacion as enum ('encolada', 'enviando', 'enviada', 'fallida', 'descartada');
create type tipo_actor          as enum ('admin', 'empleado', 'sistema');

create table notificaciones (
  id                uuid primary key default gen_random_uuid(),
  persona_id        uuid not null references personas (id) on delete cascade,
  liquidacion_id    uuid references liquidaciones (id) on delete cascade,
  recibo_id         uuid references recibos (id) on delete cascade,
  canal             canal_notificacion not null,
  tipo              tipo_notificacion not null,
  estado            estado_notificacion not null default 'encolada',
  intentos          integer not null default 0,
  proximo_intento_at timestamptz not null default now(),
  proveedor_msg_id  text,
  error             text,
  enviada_at        timestamptz,
  created_at        timestamptz not null default now()
);

create index notificaciones_pendientes_idx
  on notificaciones (proximo_intento_at)
  where estado in ('encolada', 'fallida');

create table push_subscriptions (
  id           uuid primary key default gen_random_uuid(),
  persona_id   uuid not null references personas (id) on delete cascade,
  endpoint     text not null unique,
  p256dh       text not null,
  auth         text not null,
  user_agent   text,
  last_seen_at timestamptz not null default now(),
  created_at   timestamptz not null default now()
);

create index push_persona_idx on push_subscriptions (persona_id);

create table eventos_auditoria (
  id         bigserial primary key,
  actor_tipo tipo_actor not null,
  actor_id   uuid,
  accion     text not null,
  entidad    text not null,
  entidad_id uuid,
  detalle    jsonb not null default '{}'::jsonb,
  ip         inet,
  created_at timestamptz not null default now()
);

comment on table eventos_auditoria is 'Solo inserción: un trigger impide UPDATE y DELETE.';

create index auditoria_entidad_idx on eventos_auditoria (entidad, entidad_id, created_at desc);

create trigger auditoria_inmutable
  before update or delete on eventos_auditoria
  for each row execute function impedir_modificacion();

create table importaciones (
  id             uuid primary key default gen_random_uuid(),
  empresa_id     uuid not null references empresas (id) on delete cascade,
  nombre_archivo text not null,
  filas_total    integer not null default 0,
  creados        integer not null default 0,
  actualizados   integer not null default 0,
  errores        integer not null default 0,
  resumen        jsonb not null default '{}'::jsonb,
  creada_por     uuid references admin_usuarios (id) on delete set null,
  created_at     timestamptz not null default now()
);
```

- [ ] **Step 2: Escribir la migración de almacenamiento**

Crear `supabase/migrations/0004_storage.sql`:

```sql
-- Conforme — bucket privado de recibos.
-- Sin políticas para anon ni authenticated: TODO el acceso pasa por el
-- servidor con la clave de servicio, que emite URLs firmadas de 60 segundos.
-- Un bucket sin políticas es un bucket al que nadie llega desde el navegador.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('recibos', 'recibos', false, 10485760, array['application/pdf'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
```

- [ ] **Step 3: Aplicar ambas migraciones**

`apply_migration` con `name = 0003_operacion` y luego `name = 0004_storage`.

- [ ] **Step 4: Verificar que el bucket es privado**

```sql
select id, public, file_size_limit from storage.buckets where id = 'recibos';
```

Expected: `public = false`, `file_size_limit = 10485760`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0003_operacion.sql supabase/migrations/0004_storage.sql
git commit -m "feat: migraciones de operación, auditoría y bucket privado de recibos"
```

---

## Tarea 9: Políticas RLS y pruebas de aislamiento

Es la tarea de seguridad del sistema. Las políticas se prueban intentando activamente leer datos ajenos.

**Files:**
- Create: `supabase/migrations/0005_rls.sql`
- Test: `tests/integracion/rls.test.ts`

**Interfaces:**
- Consumes: todas las tablas anteriores.
- Produces: funciones `es_admin()`, `puede_operar()`, `es_admin_pleno()`, `persona_actual()`; RLS activa en todo `public`.

- [ ] **Step 1: Escribir la migración de RLS**

Crear `supabase/migrations/0005_rls.sql`:

```sql
-- Conforme — funciones auxiliares y políticas de seguridad a nivel de fila.
-- Criterio: denegar por defecto. La clave de servicio ignora RLS, así que
-- todas las escrituras sensibles ocurren en el servidor y no necesitan política.

-- ── Auxiliares ─────────────────────────────────────────────────────────
create or replace function es_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from admin_usuarios a where a.id = auth.uid() and a.activo
  );
$$;

create or replace function puede_operar()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from admin_usuarios a
    where a.id = auth.uid() and a.activo and a.rol in ('admin', 'operador')
  );
$$;

create or replace function es_admin_pleno()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from admin_usuarios a
    where a.id = auth.uid() and a.activo and a.rol = 'admin'
  );
$$;

-- Persona del empleado que está autenticado, o null si no lo está.
create or replace function persona_actual()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.id from personas p
  where p.auth_user_id = auth.uid() and p.estado = 'activo';
$$;

-- ── Activación de RLS en todas las tablas ──────────────────────────────
alter table empresas            enable row level security;
alter table personas            enable row level security;
alter table legajos             enable row level security;
alter table admin_usuarios      enable row level security;
alter table codigos_activacion  enable row level security;
alter table liquidaciones       enable row level security;
alter table recibos             enable row level security;
alter table conformidades       enable row level security;
alter table observaciones       enable row level security;
alter table notificaciones      enable row level security;
alter table push_subscriptions  enable row level security;
alter table eventos_auditoria   enable row level security;
alter table importaciones       enable row level security;

-- ── Administradores ────────────────────────────────────────────────────
create policy admin_lee_empresas on empresas
  for select to authenticated using (es_admin());
create policy admin_escribe_empresas on empresas
  for all to authenticated using (es_admin_pleno()) with check (es_admin_pleno());

create policy admin_lee_personas on personas
  for select to authenticated using (es_admin());
create policy admin_lee_legajos on legajos
  for select to authenticated using (es_admin());
create policy admin_lee_liquidaciones on liquidaciones
  for select to authenticated using (es_admin());
create policy admin_lee_recibos on recibos
  for select to authenticated using (es_admin());
create policy admin_lee_conformidades on conformidades
  for select to authenticated using (es_admin());
create policy admin_lee_observaciones on observaciones
  for select to authenticated using (es_admin());
create policy admin_lee_notificaciones on notificaciones
  for select to authenticated using (es_admin());
create policy admin_lee_importaciones on importaciones
  for select to authenticated using (es_admin());
create policy admin_lee_auditoria on eventos_auditoria
  for select to authenticated using (es_admin());

-- Cada administrador ve su propia ficha; el alta y la baja las hace el servidor.
create policy admin_lee_su_ficha on admin_usuarios
  for select to authenticated using (id = auth.uid() or es_admin_pleno());

-- ── Empleados ──────────────────────────────────────────────────────────
create policy empleado_lee_sus_legajos on legajos
  for select to authenticated using (persona_id = persona_actual());

create policy empleado_lee_su_persona on personas
  for select to authenticated using (id = persona_actual());

-- Solo empresas donde la persona tiene legajo.
create policy empleado_lee_sus_empresas on empresas
  for select to authenticated using (
    exists (
      select 1 from legajos l
      where l.empresa_id = empresas.id and l.persona_id = persona_actual()
    )
  );

-- Solo liquidaciones publicadas donde tiene recibo.
create policy empleado_lee_sus_liquidaciones on liquidaciones
  for select to authenticated using (
    estado = 'publicada'
    and exists (
      select 1 from recibos r
      join legajos l on l.id = r.legajo_id
      where r.liquidacion_id = liquidaciones.id and l.persona_id = persona_actual()
    )
  );

-- Solo recibos propios de liquidaciones publicadas.
create policy empleado_lee_sus_recibos on recibos
  for select to authenticated using (
    exists (
      select 1 from legajos l
      where l.id = recibos.legajo_id and l.persona_id = persona_actual()
    )
    and exists (
      select 1 from liquidaciones q
      where q.id = recibos.liquidacion_id and q.estado = 'publicada'
    )
  );

create policy empleado_lee_sus_conformidades on conformidades
  for select to authenticated using (persona_id = persona_actual());

create policy empleado_lee_sus_observaciones on observaciones
  for select to authenticated using (persona_id = persona_actual());

create policy empleado_crea_sus_observaciones on observaciones
  for insert to authenticated with check (persona_id = persona_actual());

create policy empleado_gestiona_sus_push on push_subscriptions
  for all to authenticated
  using (persona_id = persona_actual())
  with check (persona_id = persona_actual());

-- Deliberadamente NO existe política de INSERT sobre conformidades:
-- se registran por Server Action con la clave de servicio, que es la única
-- forma de sellar hora, IP y hash del lado del servidor.
```

- [ ] **Step 2: Aplicar la migración**

`apply_migration` con `name = 0005_rls`.

- [ ] **Step 3: Escribir las pruebas de aislamiento**

Crear `tests/integracion/rls.test.ts`:

```ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SERVICIO = process.env.SUPABASE_SERVICE_ROLE_KEY!
const DOMINIO = process.env.EMPLEADO_EMAIL_DOMAIN ?? 'empleados.conforme.local'

const servicio = createClient(URL, SERVICIO, { auth: { persistSession: false } })

const CUIL_ANA = '20271032758'
const CUIL_LUIS = '20192021414'
const CLAVE = 'prueba-rls-2026'

let empresaId: string
let personaAna: string
let personaLuis: string
let reciboAna: string
let reciboLuis: string
let usuarioAna: string
let usuarioLuis: string
let clienteAna: SupabaseClient

async function crearEmpleado(cuil: string, nombre: string, legajo: number) {
  const { data: usuario, error: errUsuario } = await servicio.auth.admin.createUser({
    email: `${cuil}@${DOMINIO}`,
    password: CLAVE,
    email_confirm: true,
  })
  if (errUsuario) throw errUsuario

  const { data: persona, error: errPersona } = await servicio
    .from('personas')
    .insert({ cuil, apellido_nombre: nombre, auth_user_id: usuario.user.id, estado: 'activo' })
    .select('id')
    .single()
  if (errPersona) throw errPersona

  const { data: leg, error: errLegajo } = await servicio
    .from('legajos')
    .insert({ empresa_id: empresaId, persona_id: persona.id, numero: legajo })
    .select('id')
    .single()
  if (errLegajo) throw errLegajo

  return { usuarioId: usuario.user.id, personaId: persona.id, legajoId: leg.id }
}

beforeAll(async () => {
  const { data: empresa } = await servicio
    .from('empresas')
    .insert({ razon_social: 'RLS Test SA', cuit: '30999999990', nombre_corto: 'RLS Test' })
    .select('id')
    .single()
  empresaId = empresa!.id

  const ana = await crearEmpleado(CUIL_ANA, 'Prueba, Ana', 901)
  const luis = await crearEmpleado(CUIL_LUIS, 'Prueba, Luis', 902)
  personaAna = ana.personaId
  personaLuis = luis.personaId
  usuarioAna = ana.usuarioId
  usuarioLuis = luis.usuarioId

  const { data: liquidacion } = await servicio
    .from('liquidaciones')
    .insert({
      empresa_id: empresaId, periodo: 202604, tipo: 'MEN', dato_fijo: 9999,
      estado: 'publicada', publicada_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  const { data: borrador } = await servicio
    .from('liquidaciones')
    .insert({ empresa_id: empresaId, periodo: 202605, tipo: 'MEN', dato_fijo: 9998 })
    .select('id')
    .single()

  const recibos = await servicio
    .from('recibos')
    .insert([
      {
        liquidacion_id: liquidacion!.id, legajo_id: ana.legajoId,
        storage_path: `${empresaId}/202604/MEN-9999/901-v1.pdf`,
        nombre_original: 'a.pdf', sha256: 'a'.repeat(64), bytes: 100, cuil_archivo: CUIL_ANA,
      },
      {
        liquidacion_id: liquidacion!.id, legajo_id: luis.legajoId,
        storage_path: `${empresaId}/202604/MEN-9999/902-v1.pdf`,
        nombre_original: 'b.pdf', sha256: 'b'.repeat(64), bytes: 100, cuil_archivo: CUIL_LUIS,
      },
      {
        liquidacion_id: borrador!.id, legajo_id: ana.legajoId,
        storage_path: `${empresaId}/202605/MEN-9998/901-v1.pdf`,
        nombre_original: 'c.pdf', sha256: 'c'.repeat(64), bytes: 100, cuil_archivo: CUIL_ANA,
      },
    ])
    .select('id, legajo_id, liquidacion_id')

  reciboAna = recibos.data!.find(
    (r) => r.legajo_id === ana.legajoId && r.liquidacion_id === liquidacion!.id,
  )!.id
  reciboLuis = recibos.data!.find((r) => r.legajo_id === luis.legajoId)!.id

  clienteAna = createClient(URL, ANON, { auth: { persistSession: false } })
  const { error } = await clienteAna.auth.signInWithPassword({
    email: `${CUIL_ANA}@${DOMINIO}`,
    password: CLAVE,
  })
  if (error) throw error
}, 60_000)

afterAll(async () => {
  await servicio.from('recibos').delete().eq('cuil_archivo', CUIL_ANA)
  await servicio.from('recibos').delete().eq('cuil_archivo', CUIL_LUIS)
  await servicio.from('liquidaciones').delete().eq('empresa_id', empresaId)
  await servicio.from('legajos').delete().eq('empresa_id', empresaId)
  await servicio.from('personas').delete().in('id', [personaAna, personaLuis])
  await servicio.from('empresas').delete().eq('id', empresaId)
  await servicio.auth.admin.deleteUser(usuarioAna)
  await servicio.auth.admin.deleteUser(usuarioLuis)
})

describe('RLS del empleado', () => {
  it('ve su propio recibo publicado', async () => {
    const { data } = await clienteAna.from('recibos').select('id').eq('id', reciboAna)
    expect(data).toHaveLength(1)
  })

  it('NO ve el recibo de otro empleado', async () => {
    const { data } = await clienteAna.from('recibos').select('id').eq('id', reciboLuis)
    expect(data).toEqual([])
  })

  it('NO ve recibos de liquidaciones en borrador', async () => {
    const { data } = await clienteAna.from('recibos').select('id')
    expect(data!.map((r) => r.id)).toEqual([reciboAna])
  })

  it('NO ve los datos personales de otro empleado', async () => {
    const { data } = await clienteAna.from('personas').select('id')
    expect(data!.map((p) => p.id)).toEqual([personaAna])
  })

  it('NO puede insertar una conformidad directamente', async () => {
    const { error } = await clienteAna.from('conformidades').insert({
      recibo_id: reciboAna,
      persona_id: personaAna,
      sha256_documento: 'a'.repeat(64),
      texto_legal: 'intento directo',
    })
    expect(error).not.toBeNull()
  })

  it('NO puede leer la tabla de administradores', async () => {
    const { data } = await clienteAna.from('admin_usuarios').select('id')
    expect(data).toEqual([])
  })
})
```

- [ ] **Step 4: Correr las pruebas de integración**

Copiar `.env.local.example` a `.env.local` y completar las tres claves de Supabase. Después:

Run: `npx dotenv -e .env.local -- npm run test:integracion`

Si `dotenv-cli` no está instalado: `npm install -D dotenv-cli`.

Expected: PASS — los 6 casos, con especial atención a los cuatro que verifican que **no** se ve lo ajeno.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0005_rls.sql tests/integracion/rls.test.ts
git commit -m "feat: políticas RLS y pruebas de aislamiento entre empleados"
```

---

## Tarea 10: Clientes de Supabase y tipos generados

**Files:**
- Create: `src/lib/supabase/cliente-navegador.ts`, `src/lib/supabase/cliente-servidor.ts`, `src/lib/supabase/cliente-servicio.ts`, `src/lib/supabase/tipos.ts`, `src/lib/entorno.ts`
- Test: `tests/unidad/entorno.test.ts`

**Interfaces:**
- Consumes: esquema de las Tareas 6-9.
- Produces:
  - `clienteNavegador(): SupabaseClient<Database>`
  - `clienteServidor(): Promise<SupabaseClient<Database>>` — lee cookies de la petición.
  - `clienteServicio(): SupabaseClient<Database>` — clave de servicio, **solo servidor**.
  - `entorno` — objeto validado con Zod.

- [ ] **Step 1: Escribir el test de validación de entorno**

Crear `tests/unidad/entorno.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { leerEntornoPublico } from '@/lib/entorno'

describe('leerEntornoPublico', () => {
  it('acepta una configuración completa', () => {
    expect(() =>
      leerEntornoPublico({
        NEXT_PUBLIC_SUPABASE_URL: 'https://x.supabase.co',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'clave',
      }),
    ).not.toThrow()
  })

  it('falla con un mensaje claro si falta la URL', () => {
    expect(() =>
      leerEntornoPublico({ NEXT_PUBLIC_SUPABASE_ANON_KEY: 'clave' }),
    ).toThrow(/NEXT_PUBLIC_SUPABASE_URL/)
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npm test`
Expected: FAIL — `Cannot find module '@/lib/entorno'`

- [ ] **Step 3: Implementar la validación de entorno**

Crear `src/lib/entorno.ts`:

```ts
import { z } from 'zod'

const esquemaPublico = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url('NEXT_PUBLIC_SUPABASE_URL debe ser una URL válida'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, 'Falta NEXT_PUBLIC_SUPABASE_ANON_KEY'),
})

const esquemaServidor = esquemaPublico.extend({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'Falta SUPABASE_SERVICE_ROLE_KEY'),
  EMPLEADO_EMAIL_DOMAIN: z.string().min(1).default('empleados.conforme.local'),
})

export function leerEntornoPublico(fuente: Record<string, string | undefined>) {
  return esquemaPublico.parse(fuente)
}

export function leerEntornoServidor(fuente: Record<string, string | undefined>) {
  return esquemaServidor.parse(fuente)
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Generar los tipos del esquema**

Con el conector autorizado, usar `generate_typescript_types` con `project_id = twejfeghrujsqzzuzvtf` y volcar el resultado en `src/lib/supabase/tipos.ts`, encabezado por:

```ts
// Generado desde el esquema de Supabase. No editar a mano.
// Regenerar: npm run tipos
```

- [ ] **Step 6: Crear los tres clientes**

Crear `src/lib/supabase/cliente-navegador.ts`:

```ts
'use client'

import { createBrowserClient } from '@supabase/ssr'
import { leerEntornoPublico } from '@/lib/entorno'
import type { Database } from '@/lib/supabase/tipos'

export function clienteNavegador() {
  const entorno = leerEntornoPublico({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  })

  return createBrowserClient<Database>(
    entorno.NEXT_PUBLIC_SUPABASE_URL,
    entorno.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  )
}
```

Crear `src/lib/supabase/cliente-servidor.ts`:

```ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { leerEntornoPublico } from '@/lib/entorno'
import type { Database } from '@/lib/supabase/tipos'

export async function clienteServidor() {
  const almacen = await cookies()
  const entorno = leerEntornoPublico({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  })

  return createServerClient<Database>(
    entorno.NEXT_PUBLIC_SUPABASE_URL,
    entorno.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => almacen.getAll(),
        setAll: (cookiesNuevas) => {
          try {
            for (const { name, value, options } of cookiesNuevas) {
              almacen.set(name, value, options)
            }
          } catch {
            // Llamado desde un Server Component: el middleware ya refrescó la sesión.
          }
        },
      },
    },
  )
}
```

Crear `src/lib/supabase/cliente-servicio.ts`:

```ts
import 'server-only'

import { createClient } from '@supabase/supabase-js'
import { leerEntornoServidor } from '@/lib/entorno'
import type { Database } from '@/lib/supabase/tipos'

/**
 * Cliente con clave de servicio: IGNORA RLS.
 * Usarlo solo en Server Actions y Route Handlers, y solo después de haber
 * verificado a mano quién es el usuario y qué tiene permitido hacer.
 */
export function clienteServicio() {
  const entorno = leerEntornoServidor(process.env)

  return createClient<Database>(
    entorno.NEXT_PUBLIC_SUPABASE_URL,
    entorno.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}
```

Instalar la guarda: `npm install server-only`

- [ ] **Step 7: Verificar que compila**

Run: `npm run build`
Expected: build exitoso.

- [ ] **Step 8: Commit**

```bash
git add src/lib/entorno.ts src/lib/supabase tests/unidad/entorno.test.ts package.json package-lock.json
git commit -m "feat: clientes de Supabase y validación de variables de entorno"
```

---

## Tarea 11: Autenticación y roles de administrador

**Files:**
- Create: `src/middleware.ts`, `src/app/ingresar/page.tsx`, `src/app/admin/layout.tsx`, `src/app/admin/page.tsx`, `src/lib/sesion.ts`, `src/acciones/sesion.ts`
- Create: `supabase/semillas/primer-admin.sql`
- Test: `tests/unidad/sesion.test.ts`, `tests/e2e/admin-login.spec.ts`

**Interfaces:**
- Consumes: `clienteServidor`, `clienteServicio` de la Tarea 10.
- Produces:
  - `obtenerAdmin(): Promise<AdminSesion | null>` — `{ id, nombre, email, rol }`
  - `exigirAdmin(rolMinimo?: RolAdmin): Promise<AdminSesion>` — redirige a `/ingresar` si no hay sesión, lanza si el rol no alcanza.
  - `type RolAdmin = 'admin' | 'operador' | 'consulta'`
  - `puede(rol: RolAdmin, accion: Accion): boolean`

- [ ] **Step 1: Escribir el test de la matriz de permisos**

Crear `tests/unidad/sesion.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { puede } from '@/lib/permisos'

describe('puede', () => {
  it('consulta solo lee', () => {
    expect(puede('consulta', 'ver')).toBe(true)
    expect(puede('consulta', 'operar')).toBe(false)
    expect(puede('consulta', 'administrar')).toBe(false)
  })

  it('operador lee y opera pero no administra', () => {
    expect(puede('operador', 'ver')).toBe(true)
    expect(puede('operador', 'operar')).toBe(true)
    expect(puede('operador', 'administrar')).toBe(false)
  })

  it('admin puede todo', () => {
    expect(puede('admin', 'ver')).toBe(true)
    expect(puede('admin', 'operar')).toBe(true)
    expect(puede('admin', 'administrar')).toBe(true)
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npm test`
Expected: FAIL — `Cannot find module '@/lib/permisos'`

- [ ] **Step 3: Implementar los permisos**

Crear `src/lib/permisos.ts`:

```ts
export type RolAdmin = 'admin' | 'operador' | 'consulta'
export type Accion = 'ver' | 'operar' | 'administrar'

const NIVEL: Record<RolAdmin, number> = { consulta: 0, operador: 1, admin: 2 }
const EXIGE: Record<Accion, number> = { ver: 0, operar: 1, administrar: 2 }

/** `ver`: consultar. `operar`: importar, subir, publicar. `administrar`: empresas y usuarios. */
export function puede(rol: RolAdmin, accion: Accion): boolean {
  return NIVEL[rol] >= EXIGE[accion]
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Implementar la lectura de sesión**

Crear `src/lib/sesion.ts`:

```ts
import 'server-only'

import { redirect } from 'next/navigation'
import { puede, type Accion, type RolAdmin } from '@/lib/permisos'
import { clienteServidor } from '@/lib/supabase/cliente-servidor'

export interface AdminSesion {
  id: string
  nombre: string
  email: string
  rol: RolAdmin
}

export async function obtenerAdmin(): Promise<AdminSesion | null> {
  const supabase = await clienteServidor()
  const { data: sesion } = await supabase.auth.getUser()
  if (!sesion.user) return null

  const { data } = await supabase
    .from('admin_usuarios')
    .select('id, nombre, email, rol, activo')
    .eq('id', sesion.user.id)
    .maybeSingle()

  if (!data || !data.activo) return null
  return { id: data.id, nombre: data.nombre, email: data.email, rol: data.rol }
}

/** Corta la ejecución si no hay administrador con permiso suficiente. */
export async function exigirAdmin(accion: Accion = 'ver'): Promise<AdminSesion> {
  const admin = await obtenerAdmin()
  if (!admin) redirect('/ingresar')
  if (!puede(admin.rol, accion)) {
    throw new Error(`Tu rol (${admin.rol}) no permite esta acción.`)
  }
  return admin
}
```

- [ ] **Step 6: Middleware que refresca la sesión y protege /admin**

Crear `src/middleware.ts`:

```ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(peticion: NextRequest) {
  let respuesta = NextResponse.next({ request: peticion })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => peticion.cookies.getAll(),
        setAll: (cookiesNuevas) => {
          for (const { name, value } of cookiesNuevas) {
            peticion.cookies.set(name, value)
          }
          respuesta = NextResponse.next({ request: peticion })
          for (const { name, value, options } of cookiesNuevas) {
            respuesta.cookies.set(name, value, options)
          }
        },
      },
    },
  )

  const { data } = await supabase.auth.getUser()

  if (!data.user && peticion.nextUrl.pathname.startsWith('/admin')) {
    const destino = peticion.nextUrl.clone()
    destino.pathname = '/ingresar'
    return NextResponse.redirect(destino)
  }

  return respuesta
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|webp)$).*)'],
}
```

- [ ] **Step 7: Pantalla de ingreso y Server Action**

Crear `src/acciones/sesion.ts`:

```ts
'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { clienteServidor } from '@/lib/supabase/cliente-servidor'

const esquema = z.object({
  email: z.string().email('Ingresá un email válido'),
  clave: z.string().min(1, 'Ingresá tu contraseña'),
})

export async function ingresarAdmin(_estado: string | null, datos: FormData) {
  const analisis = esquema.safeParse({
    email: datos.get('email'),
    clave: datos.get('clave'),
  })
  if (!analisis.success) {
    return analisis.error.issues[0].message
  }

  const supabase = await clienteServidor()
  const { error } = await supabase.auth.signInWithPassword({
    email: analisis.data.email,
    password: analisis.data.clave,
  })

  if (error) return 'Email o contraseña incorrectos.'
  redirect('/admin')
}

export async function salir() {
  const supabase = await clienteServidor()
  await supabase.auth.signOut()
  redirect('/ingresar')
}
```

Crear `src/app/ingresar/page.tsx`:

```tsx
'use client'

import { useActionState } from 'react'
import { ingresarAdmin } from '@/acciones/sesion'

export default function PaginaIngresar() {
  const [error, accion, pendiente] = useActionState(ingresarAdmin, null)

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Conforme</h1>
        <p className="text-sm text-neutral-600">Panel de administración</p>
      </div>

      <form action={accion} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Email
          <input name="email" type="email" required autoComplete="username"
            className="rounded border px-3 py-2" />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Contraseña
          <input name="clave" type="password" required autoComplete="current-password"
            className="rounded border px-3 py-2" />
        </label>

        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

        <button type="submit" disabled={pendiente}
          className="rounded bg-blue-900 px-4 py-2 text-white disabled:opacity-50">
          {pendiente ? 'Ingresando…' : 'Ingresar'}
        </button>
      </form>
    </main>
  )
}
```

- [ ] **Step 8: Layout e inicio del panel**

Crear `src/app/admin/layout.tsx`:

```tsx
import type { ReactNode } from 'react'
import { salir } from '@/acciones/sesion'
import { exigirAdmin } from '@/lib/sesion'

export default async function LayoutAdmin({ children }: { children: ReactNode }) {
  const admin = await exigirAdmin('ver')

  return (
    <div className="min-h-dvh">
      <header className="flex items-center justify-between border-b px-6 py-3">
        <span className="font-semibold">Conforme</span>
        <div className="flex items-center gap-4 text-sm">
          <span>{admin.nombre} · {admin.rol}</span>
          <form action={salir}>
            <button type="submit" className="underline">Salir</button>
          </form>
        </div>
      </header>
      <main className="p-6">{children}</main>
    </div>
  )
}
```

Crear `src/app/admin/page.tsx`:

```tsx
import { exigirAdmin } from '@/lib/sesion'

export default async function InicioAdmin() {
  const admin = await exigirAdmin('ver')
  return <h1 className="text-xl font-semibold">Hola, {admin.nombre}</h1>
}
```

- [ ] **Step 9: Semilla del primer administrador**

Crear `supabase/semillas/primer-admin.sql`:

```sql
-- Alta del primer administrador de Conforme.
-- 1) Crear el usuario en el panel de Supabase: Authentication → Users → Add user
--    (email real, contraseña, "Auto Confirm User" tildado).
-- 2) Copiar el UUID del usuario y reemplazarlo abajo.
-- 3) Ejecutar este script en el SQL Editor.

insert into admin_usuarios (id, nombre, email, rol, activo)
values (
  '00000000-0000-0000-0000-000000000000',  -- ← reemplazar por el UUID real
  'Nombre Apellido',
  'admin@ejemplo.com',
  'admin',
  true
)
on conflict (id) do update
  set rol = 'admin', activo = true;
```

- [ ] **Step 10: Prueba de extremo a extremo del ingreso**

Crear `playwright.config.ts`:

```ts
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  use: { baseURL: 'http://localhost:3000' },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000/ingresar',
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
```

Crear `tests/e2e/admin-login.spec.ts`:

```ts
import { expect, test } from '@playwright/test'

test('redirige a /ingresar cuando no hay sesión', async ({ page }) => {
  await page.goto('/admin')
  await expect(page).toHaveURL(/\/ingresar/)
})

test('rechaza credenciales inválidas', async ({ page }) => {
  await page.goto('/ingresar')
  await page.getByLabel('Email').fill('nadie@ejemplo.com')
  await page.getByLabel('Contraseña').fill('clave-incorrecta')
  await page.getByRole('button', { name: 'Ingresar' }).click()
  await expect(page.getByRole('alert')).toHaveText('Email o contraseña incorrectos.')
})

test('permite ingresar con el administrador de prueba', async ({ page }) => {
  test.skip(!process.env.ADMIN_EMAIL_PRUEBA, 'Falta ADMIN_EMAIL_PRUEBA en .env.local')

  await page.goto('/ingresar')
  await page.getByLabel('Email').fill(process.env.ADMIN_EMAIL_PRUEBA!)
  await page.getByLabel('Contraseña').fill(process.env.ADMIN_CLAVE_PRUEBA!)
  await page.getByRole('button', { name: 'Ingresar' }).click()
  await expect(page).toHaveURL(/\/admin/)
})
```

Agregar a `.env.local.example`:

```
# Credenciales del administrador usadas por las pruebas E2E
ADMIN_EMAIL_PRUEBA=
ADMIN_CLAVE_PRUEBA=
```

- [ ] **Step 11: Correr las pruebas**

Run: `npm test`
Expected: PASS

Run: `npx playwright install --with-deps chromium` (una sola vez) y después `npm run test:e2e`
Expected: PASS — los tres casos.

- [ ] **Step 12: Commit**

```bash
git add src/middleware.ts src/lib/permisos.ts src/lib/sesion.ts src/acciones/sesion.ts src/app/ingresar src/app/admin supabase/semillas playwright.config.ts tests/unidad/sesion.test.ts tests/e2e/admin-login.spec.ts .env.local.example
git commit -m "feat: autenticación de administrador con roles y protección de rutas"
```

---
## Tarea 12: ABM de empresas y de usuarios administradores

**Files:**
- Create: `src/lib/validaciones/empresa.ts`, `src/lib/auditoria.ts`, `src/acciones/empresas.ts`, `src/acciones/administradores.ts`
- Create: `src/app/admin/empresas/page.tsx`, `src/app/admin/empresas/nueva/page.tsx`, `src/app/admin/usuarios/page.tsx`
- Test: `tests/unidad/validaciones/empresa.test.ts`

**Interfaces:**
- Consumes: `exigirAdmin`, `clienteServicio`, `clienteServidor`, `normalizarCuil`, `cuilValido`.
- Produces:
  - `esquemaEmpresa` (Zod) con `razonSocial`, `cuit`, `nombreCorto`, `textoConformidad`.
  - `crearEmpresa(estado, datos: FormData)` — Server Action.
  - `listarEmpresas(): Promise<Empresa[]>`

- [ ] **Step 1: Escribir el test de validación**

Crear `tests/unidad/validaciones/empresa.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { esquemaEmpresa } from '@/lib/validaciones/empresa'

const base = {
  razonSocial: 'Delta 6 SA',
  cuit: '30-71234567-0',
  nombreCorto: 'Delta 6',
  textoConformidad: 'Presto conformidad.',
}

describe('esquemaEmpresa', () => {
  it('normaliza el CUIT quitando los guiones', () => {
    expect(esquemaEmpresa.parse(base).cuit).toBe('30712345670')
  })

  it('rechaza un CUIT con dígito verificador inválido', () => {
    expect(() => esquemaEmpresa.parse({ ...base, cuit: '30-71234567-9' })).toThrow(/CUIT/)
  })

  it('rechaza una razón social vacía', () => {
    expect(() => esquemaEmpresa.parse({ ...base, razonSocial: '  ' })).toThrow(/[Rr]azón social/)
  })

  it('exige un texto de conformidad no trivial', () => {
    expect(() => esquemaEmpresa.parse({ ...base, textoConformidad: 'ok' })).toThrow(/conformidad/)
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npm test`
Expected: FAIL — `Cannot find module '@/lib/validaciones/empresa'`

- [ ] **Step 3: Implementar la validación**

Crear `src/lib/validaciones/empresa.ts`:

```ts
import { z } from 'zod'
import { cuilValido, normalizarCuil } from '@/lib/cuil'

// El CUIT usa el mismo algoritmo de dígito verificador que el CUIL.
export const esquemaEmpresa = z.object({
  razonSocial: z.string().trim().min(1, 'Ingresá la razón social'),
  cuit: z
    .string()
    .transform((valor) => normalizarCuil(valor))
    .refine((cuit): cuit is string => cuit !== null, 'El CUIT debe tener 11 dígitos')
    .refine((cuit) => cuilValido(cuit), 'El CUIT no es válido: revisá el dígito verificador'),
  nombreCorto: z.string().trim().min(1, 'Ingresá un nombre corto'),
  textoConformidad: z
    .string()
    .trim()
    .min(20, 'El texto de conformidad es el que el empleado acepta: escribilo completo'),
})

export type DatosEmpresa = z.infer<typeof esquemaEmpresa>
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Implementar la Server Action**

Crear `src/acciones/empresas.ts`:

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { registrarEvento } from '@/lib/auditoria'
import { exigirAdmin } from '@/lib/sesion'
import { clienteServicio } from '@/lib/supabase/cliente-servicio'
import { esquemaEmpresa } from '@/lib/validaciones/empresa'

export async function crearEmpresa(_estado: string | null, datos: FormData) {
  const admin = await exigirAdmin('administrar')

  const analisis = esquemaEmpresa.safeParse({
    razonSocial: datos.get('razonSocial'),
    cuit: datos.get('cuit'),
    nombreCorto: datos.get('nombreCorto'),
    textoConformidad: datos.get('textoConformidad'),
  })
  if (!analisis.success) return analisis.error.issues[0].message

  const supabase = clienteServicio()
  const { data, error } = await supabase
    .from('empresas')
    .insert({
      razon_social: analisis.data.razonSocial,
      cuit: analisis.data.cuit,
      nombre_corto: analisis.data.nombreCorto,
      texto_conformidad: analisis.data.textoConformidad,
    })
    .select('id')
    .single()

  if (error) {
    return error.code === '23505'
      ? 'Ya existe una empresa con ese CUIT.'
      : `No se pudo crear la empresa: ${error.message}`
  }

  await registrarEvento({
    actorTipo: 'admin',
    actorId: admin.id,
    accion: 'empresa.crear',
    entidad: 'empresas',
    entidadId: data.id,
    detalle: { cuit: analisis.data.cuit },
  })

  revalidatePath('/admin/empresas')
  redirect('/admin/empresas')
}
```

Crear `src/lib/auditoria.ts`:

```ts
import 'server-only'

import { clienteServicio } from '@/lib/supabase/cliente-servicio'

interface Evento {
  actorTipo: 'admin' | 'empleado' | 'sistema'
  actorId?: string | null
  accion: string
  entidad: string
  entidadId?: string | null
  detalle?: Record<string, unknown>
  ip?: string | null
}

/** Deja constancia de una acción. Nunca corta el flujo si falla el registro. */
export async function registrarEvento(evento: Evento): Promise<void> {
  const supabase = clienteServicio()
  const { error } = await supabase.from('eventos_auditoria').insert({
    actor_tipo: evento.actorTipo,
    actor_id: evento.actorId ?? null,
    accion: evento.accion,
    entidad: evento.entidad,
    entidad_id: evento.entidadId ?? null,
    detalle: evento.detalle ?? {},
    ip: evento.ip ?? null,
  })
  if (error) console.error('No se pudo registrar el evento de auditoría', error)
}
```

- [ ] **Step 6: Listado y alta en la interfaz**

Crear `src/app/admin/empresas/page.tsx`:

```tsx
import Link from 'next/link'
import { formatearCuil } from '@/lib/cuil'
import { exigirAdmin } from '@/lib/sesion'
import { clienteServidor } from '@/lib/supabase/cliente-servidor'

export default async function PaginaEmpresas() {
  const admin = await exigirAdmin('ver')
  const supabase = await clienteServidor()
  const { data: empresas } = await supabase
    .from('empresas')
    .select('id, razon_social, cuit, nombre_corto, activa')
    .order('razon_social')

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Empresas</h1>
        {admin.rol === 'admin' && (
          <Link href="/admin/empresas/nueva" className="rounded bg-blue-900 px-3 py-2 text-sm text-white">
            Nueva empresa
          </Link>
        )}
      </div>

      {empresas?.length ? (
        <table className="w-full text-sm">
          <thead className="text-left text-neutral-500">
            <tr><th className="py-2">Razón social</th><th>CUIT</th><th>Estado</th></tr>
          </thead>
          <tbody>
            {empresas.map((e) => (
              <tr key={e.id} className="border-t">
                <td className="py-2">{e.razon_social}</td>
                <td>{formatearCuil(e.cuit)}</td>
                <td>{e.activa ? 'Activa' : 'Inactiva'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="text-sm text-neutral-600">
          Todavía no hay empresas cargadas. Creá la primera para poder importar su padrón.
        </p>
      )}
    </section>
  )
}
```

Crear `src/app/admin/empresas/nueva/page.tsx` con un formulario que use `crearEmpresa` mediante `useActionState`, con los campos `razonSocial`, `cuit`, `nombreCorto` y `textoConformidad` (este último un `<textarea>` con el texto por defecto de la migración precargado), siguiendo el mismo patrón visual de `src/app/ingresar/page.tsx`.

- [ ] **Step 7: Verificar a mano**

Run: `npm run dev`, ingresar como administrador, crear la empresa de prueba y confirmar que aparece en el listado y que un CUIT repetido da el mensaje esperado.

- [ ] **Step 8: Server Action para invitar administradores**

No hay registro abierto: el alta la hace un `admin` invitando por email.

Crear `src/acciones/administradores.ts`:

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { registrarEvento } from '@/lib/auditoria'
import type { RolAdmin } from '@/lib/permisos'
import { exigirAdmin } from '@/lib/sesion'
import { clienteServicio } from '@/lib/supabase/cliente-servicio'

const esquema = z.object({
  nombre: z.string().trim().min(1, 'Ingresá el nombre'),
  email: z.string().trim().email('Ingresá un email válido'),
  rol: z.enum(['admin', 'operador', 'consulta']),
})

export async function invitarAdministrador(_estado: string | null, datos: FormData) {
  const admin = await exigirAdmin('administrar')

  const analisis = esquema.safeParse({
    nombre: datos.get('nombre'),
    email: datos.get('email'),
    rol: datos.get('rol'),
  })
  if (!analisis.success) return analisis.error.issues[0].message

  const supabase = clienteServicio()

  // Supabase le manda el correo de invitación y la persona define su clave.
  const { data, error } = await supabase.auth.admin.inviteUserByEmail(analisis.data.email)
  if (error) return `No se pudo invitar: ${error.message}`

  const { error: errorFicha } = await supabase.from('admin_usuarios').insert({
    id: data.user.id,
    nombre: analisis.data.nombre,
    email: analisis.data.email,
    rol: analisis.data.rol,
  })
  if (errorFicha) return `Se creó el usuario pero no su ficha: ${errorFicha.message}`

  await registrarEvento({
    actorTipo: 'admin',
    actorId: admin.id,
    accion: 'admin.invitar',
    entidad: 'admin_usuarios',
    entidadId: data.user.id,
    detalle: { rol: analisis.data.rol },
  })

  revalidatePath('/admin/usuarios')
  return null
}

export async function cambiarRol(usuarioId: string, rol: RolAdmin) {
  const admin = await exigirAdmin('administrar')
  if (usuarioId === admin.id) return 'No podés cambiar tu propio rol.'

  const supabase = clienteServicio()
  const { error } = await supabase.from('admin_usuarios').update({ rol }).eq('id', usuarioId)
  if (error) return `No se pudo cambiar el rol: ${error.message}`

  await registrarEvento({
    actorTipo: 'admin',
    actorId: admin.id,
    accion: 'admin.cambiar_rol',
    entidad: 'admin_usuarios',
    entidadId: usuarioId,
    detalle: { rol },
  })

  revalidatePath('/admin/usuarios')
  return null
}

export async function desactivarAdministrador(usuarioId: string) {
  const admin = await exigirAdmin('administrar')
  if (usuarioId === admin.id) return 'No podés desactivarte a vos mismo.'

  const supabase = clienteServicio()
  const { error } = await supabase.from('admin_usuarios').update({ activo: false }).eq('id', usuarioId)
  if (error) return `No se pudo desactivar: ${error.message}`

  await registrarEvento({
    actorTipo: 'admin',
    actorId: admin.id,
    accion: 'admin.desactivar',
    entidad: 'admin_usuarios',
    entidadId: usuarioId,
  })

  revalidatePath('/admin/usuarios')
  return null
}
```

- [ ] **Step 9: Pantalla de usuarios administradores**

Crear `src/app/admin/usuarios/page.tsx`, visible solo con rol `admin` (`await exigirAdmin('administrar')`): tabla con nombre, email, rol (editable con un `<select>` que llama a `cambiarRol`) y estado, más el formulario de invitación. Cada fila del propio usuario muestra los controles deshabilitados, para que nadie se quede afuera por accidente.

- [ ] **Step 10: Verificar los tres roles**

Invitar un usuario `consulta` y otro `operador`. Con cada uno: `consulta` no debe ver el botón "Nueva empresa" ni poder entrar a `/admin/usuarios`; `operador` tampoco debe poder entrar a `/admin/usuarios`, pero sí ver empresas.

- [ ] **Step 11: Commit**

```bash
git add src/lib/validaciones src/lib/auditoria.ts src/acciones/empresas.ts src/acciones/administradores.ts src/app/admin/empresas src/app/admin/usuarios tests/unidad/validaciones
git commit -m "feat: alta de empresas y gestión de usuarios administradores con roles"
```

---

## Tarea 13: Importación del padrón desde CSV

**Files:**
- Create: `src/lib/padron/parse-csv-padron.ts`, `src/acciones/padron.ts`, `src/app/admin/empleados/importar/page.tsx`
- Test: `tests/unidad/padron/parse-csv-padron.test.ts`

**Interfaces:**
- Consumes: `normalizarCuil`, `cuilValido`.
- Produces:
  - `interface FilaPadron { legajo: number; cuil: string; apellidoNombre: string; email: string | null; telefono: string | null; sector: string | null; activo: boolean }`
  - `interface ErrorFila { linea: number; motivo: string; contenido: string }`
  - `parsearCsvPadron(texto: string): { filas: FilaPadron[]; errores: ErrorFila[] }`
  - `importarPadron(empresaId: string, filas: FilaPadron[])` — Server Action.

- [ ] **Step 1: Escribir los tests que fallan**

Crear `tests/unidad/padron/parse-csv-padron.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { parsearCsvPadron } from '@/lib/padron/parse-csv-padron'

const CABECERA = 'legajo;cuil;apellido_nombre;email;telefono;sector;activo'

describe('parsearCsvPadron', () => {
  it('lee una fila completa', () => {
    const { filas, errores } = parsearCsvPadron(
      `${CABECERA}\n201;20-27103275-8;Pérez, Ana;ana@ejemplo.com;3814000000;Administración;SI`,
    )

    expect(errores).toEqual([])
    expect(filas).toEqual([
      {
        legajo: 201,
        cuil: '20271032758',
        apellidoNombre: 'Pérez, Ana',
        email: 'ana@ejemplo.com',
        telefono: '3814000000',
        sector: 'Administración',
        activo: true,
      },
    ])
  })

  it('acepta coma como separador', () => {
    const { filas } = parsearCsvPadron(
      'legajo,cuil,apellido_nombre\n201,20271032758,"Pérez, Ana"',
    )
    expect(filas[0].apellidoNombre).toBe('Pérez, Ana')
  })

  it('deja en null las columnas opcionales ausentes', () => {
    const { filas } = parsearCsvPadron('legajo;cuil;apellido_nombre\n1;27-20012949-6;Gómez, Luis')
    expect(filas[0]).toMatchObject({ email: null, telefono: null, sector: null, activo: true })
  })

  it('interpreta el campo activo en sus variantes habituales', () => {
    const csv = `${CABECERA}\n1;27-20012949-6;A;;;;NO\n2;20-16021001-0;B;;;;0\n3;20-27103275-8;C;;;;S`
    const { filas } = parsearCsvPadron(csv)
    expect(filas.map((f) => f.activo)).toEqual([false, false, true])
  })

  it('reporta un CUIL con dígito verificador inválido sin cortar la importación', () => {
    const csv = `${CABECERA}\n201;20-27103275-9;Pérez, Ana;;;;SI\n202;20-19202141-4;Gómez, Luis;;;;SI`
    const { filas, errores } = parsearCsvPadron(csv)

    expect(filas).toHaveLength(1)
    expect(errores).toHaveLength(1)
    expect(errores[0]).toMatchObject({ linea: 2, motivo: expect.stringMatching(/CUIL/) })
  })

  it('reporta un legajo no numérico', () => {
    const { errores } = parsearCsvPadron(`${CABECERA}\nABC;20-27103275-8;Pérez, Ana;;;;SI`)
    expect(errores[0].motivo).toMatch(/legajo/i)
  })

  it('reporta legajos duplicados dentro del archivo', () => {
    const csv = `${CABECERA}\n201;20-27103275-8;A;;;;SI\n201;20-19202141-4;B;;;;SI`
    const { filas, errores } = parsearCsvPadron(csv)

    expect(filas).toHaveLength(1)
    expect(errores[0].motivo).toMatch(/duplicad/i)
  })

  it('falla con mensaje claro si faltan columnas obligatorias', () => {
    const { errores } = parsearCsvPadron('legajo;nombre\n201;Ana')
    expect(errores[0].motivo).toMatch(/cuil/i)
  })

  it('ignora líneas en blanco', () => {
    const { filas, errores } = parsearCsvPadron(`${CABECERA}\n\n201;20-27103275-8;Ana;;;;SI\n\n`)
    expect(filas).toHaveLength(1)
    expect(errores).toEqual([])
  })
})
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `npm test`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Implementar**

Crear `src/lib/padron/parse-csv-padron.ts`:

```ts
import { cuilValido, normalizarCuil } from '@/lib/cuil'

export interface FilaPadron {
  legajo: number
  cuil: string
  apellidoNombre: string
  email: string | null
  telefono: string | null
  sector: string | null
  activo: boolean
}

export interface ErrorFila {
  /** Número de línea del archivo, contando la cabecera como línea 0. */
  linea: number
  motivo: string
  contenido: string
}

const ALIAS: Record<string, keyof FilaPadron> = {
  legajo: 'legajo',
  nro_legajo: 'legajo',
  numero: 'legajo',
  cuil: 'cuil',
  cuit: 'cuil',
  apellido_nombre: 'apellidoNombre',
  apellido_y_nombre: 'apellidoNombre',
  nombre: 'apellidoNombre',
  email: 'email',
  correo: 'email',
  telefono: 'telefono',
  celular: 'telefono',
  sector: 'sector',
  activo: 'activo',
}

const VERDADEROS = new Set(['si', 'sí', 's', 'true', '1', 'activo'])
const FALSOS = new Set(['no', 'n', 'false', '0', 'inactivo', 'baja'])

/** Parte una línea respetando comillas dobles. */
function partirLinea(linea: string, separador: string): string[] {
  const campos: string[] = []
  let actual = ''
  let entreComillas = false

  for (let i = 0; i < linea.length; i++) {
    const caracter = linea[i]
    if (caracter === '"') {
      if (entreComillas && linea[i + 1] === '"') {
        actual += '"'
        i++
      } else {
        entreComillas = !entreComillas
      }
    } else if (caracter === separador && !entreComillas) {
      campos.push(actual)
      actual = ''
    } else {
      actual += caracter
    }
  }
  campos.push(actual)
  return campos.map((c) => c.trim())
}

function normalizarEncabezado(valor: string): string {
  return valor
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_')
}

export function parsearCsvPadron(texto: string): { filas: FilaPadron[]; errores: ErrorFila[] } {
  const lineas = texto.replace(/^\uFEFF/, '').split(/\r?\n/)
  const primera = lineas.find((l) => l.trim() !== '')
  if (!primera) return { filas: [], errores: [{ linea: 0, motivo: 'El archivo está vacío', contenido: '' }] }

  const separador = (primera.match(/;/g)?.length ?? 0) >= (primera.match(/,/g)?.length ?? 0) ? ';' : ','
  const encabezados = partirLinea(primera, separador).map(normalizarEncabezado)
  const columnas = encabezados.map((h) => ALIAS[h] ?? null)

  const errores: ErrorFila[] = []
  for (const obligatoria of ['legajo', 'cuil', 'apellidoNombre'] as const) {
    if (!columnas.includes(obligatoria)) {
      errores.push({
        linea: 0,
        motivo: `Falta la columna obligatoria "${obligatoria}" en la cabecera`,
        contenido: primera,
      })
    }
  }
  if (errores.length > 0) return { filas: [], errores }

  const filas: FilaPadron[] = []
  const legajosVistos = new Set<number>()
  const indiceCabecera = lineas.indexOf(primera)

  for (let i = indiceCabecera + 1; i < lineas.length; i++) {
    const linea = lineas[i]
    if (linea.trim() === '') continue

    const numeroLinea = i - indiceCabecera
    const campos = partirLinea(linea, separador)
    const crudo: Partial<Record<keyof FilaPadron, string>> = {}
    columnas.forEach((columna, indice) => {
      if (columna) crudo[columna] = campos[indice] ?? ''
    })

    const legajo = Number(crudo.legajo)
    if (!Number.isInteger(legajo) || legajo <= 0) {
      errores.push({ linea: numeroLinea, motivo: `El legajo "${crudo.legajo}" no es un número válido`, contenido: linea })
      continue
    }

    const cuil = normalizarCuil(crudo.cuil ?? '')
    if (!cuil) {
      errores.push({ linea: numeroLinea, motivo: `El CUIL "${crudo.cuil}" no tiene 11 dígitos`, contenido: linea })
      continue
    }
    if (!cuilValido(cuil)) {
      errores.push({ linea: numeroLinea, motivo: `El CUIL "${crudo.cuil}" tiene dígito verificador inválido`, contenido: linea })
      continue
    }

    const apellidoNombre = (crudo.apellidoNombre ?? '').trim()
    if (!apellidoNombre) {
      errores.push({ linea: numeroLinea, motivo: 'Falta el apellido y nombre', contenido: linea })
      continue
    }

    if (legajosVistos.has(legajo)) {
      errores.push({ linea: numeroLinea, motivo: `El legajo ${legajo} está duplicado en el archivo`, contenido: linea })
      continue
    }
    legajosVistos.add(legajo)

    const activoCrudo = (crudo.activo ?? '').trim().toLowerCase()
    const activo = activoCrudo === '' ? true : !FALSOS.has(activoCrudo) && VERDADEROS.has(activoCrudo)

    filas.push({
      legajo,
      cuil,
      apellidoNombre,
      email: crudo.email?.trim() || null,
      telefono: crudo.telefono?.trim() || null,
      sector: crudo.sector?.trim() || null,
      activo,
    })
  }

  return { filas, errores }
}
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Server Action de importación**

Crear `src/acciones/padron.ts`:

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { registrarEvento } from '@/lib/auditoria'
import type { FilaPadron } from '@/lib/padron/parse-csv-padron'
import { exigirAdmin } from '@/lib/sesion'
import { clienteServicio } from '@/lib/supabase/cliente-servicio'

export interface ResultadoImportacion {
  creados: number
  actualizados: number
  sinCambios: number
  posiblesBajas: Array<{ legajo: number; nombre: string }>
  error?: string
}

/**
 * Alta o actualización del padrón de una empresa.
 * Nunca da de baja: los legajos ausentes se devuelven como "posibles bajas"
 * para que el administrador decida.
 */
export async function importarPadron(
  empresaId: string,
  filas: FilaPadron[],
  nombreArchivo: string,
): Promise<ResultadoImportacion> {
  const admin = await exigirAdmin('operar')
  const supabase = clienteServicio()

  let creados = 0
  let actualizados = 0
  let sinCambios = 0

  const { data: legajosPrevios } = await supabase
    .from('legajos')
    .select('id, numero, activo, persona_id, personas(apellido_nombre)')
    .eq('empresa_id', empresaId)

  const previosPorNumero = new Map((legajosPrevios ?? []).map((l) => [l.numero, l]))

  for (const fila of filas) {
    // 1) La persona se identifica por CUIL en todo el sistema.
    const { data: persona } = await supabase
      .from('personas')
      .upsert(
        {
          cuil: fila.cuil,
          apellido_nombre: fila.apellidoNombre,
          email: fila.email,
          telefono: fila.telefono,
        },
        { onConflict: 'cuil' },
      )
      .select('id')
      .single()

    if (!persona) continue

    // 2) El legajo es el vínculo con esta empresa.
    const previo = previosPorNumero.get(fila.legajo)

    if (!previo) {
      const { error } = await supabase.from('legajos').insert({
        empresa_id: empresaId,
        persona_id: persona.id,
        numero: fila.legajo,
        activo: fila.activo,
        sector: fila.sector,
      })
      if (!error) creados++
    } else if (previo.activo !== fila.activo || previo.persona_id !== persona.id) {
      await supabase
        .from('legajos')
        .update({ persona_id: persona.id, activo: fila.activo, sector: fila.sector })
        .eq('id', previo.id)
      actualizados++
    } else {
      sinCambios++
    }
  }

  const numerosImportados = new Set(filas.map((f) => f.legajo))
  const posiblesBajas = (legajosPrevios ?? [])
    .filter((l) => l.activo && !numerosImportados.has(l.numero))
    .map((l) => ({
      legajo: l.numero,
      nombre: (l.personas as { apellido_nombre: string } | null)?.apellido_nombre ?? '—',
    }))

  await supabase.from('importaciones').insert({
    empresa_id: empresaId,
    nombre_archivo: nombreArchivo,
    filas_total: filas.length,
    creados,
    actualizados,
    errores: 0,
    resumen: { sinCambios, posiblesBajas },
    creada_por: admin.id,
  })

  await registrarEvento({
    actorTipo: 'admin',
    actorId: admin.id,
    accion: 'padron.importar',
    entidad: 'empresas',
    entidadId: empresaId,
    detalle: { creados, actualizados, sinCambios, archivo: nombreArchivo },
  })

  revalidatePath('/admin/empleados')
  return { creados, actualizados, sinCambios, posiblesBajas }
}
```

- [ ] **Step 6: Pantalla de importación con vista previa**

Crear `src/app/admin/empleados/importar/page.tsx` como componente cliente que:

1. Deja elegir la empresa (`<select>` cargado desde el servidor).
2. Acepta un archivo `.csv` por `<input type="file">`.
3. Lo lee con `await archivo.text()` y llama a `parsearCsvPadron`.
4. Muestra **antes de confirmar**: cantidad de filas válidas, tabla de los primeros 20 registros, y la lista completa de errores con número de línea y motivo.
5. El botón "Importar" queda deshabilitado si no hay filas válidas.
6. Al confirmar llama a `importarPadron` y muestra el resultado, incluyendo la lista de posibles bajas con la aclaración de que **no** se dieron de baja automáticamente.

- [ ] **Step 7: Probar con un archivo real**

Exportar el padrón desde Tango, importarlo, y verificar que los legajos de la carpeta de ejemplo (1, 2, 4, 6, 8, 11–19, 102–105, 108, 109, 201–203, 303–305) quedan cargados con el CUIL correcto.

- [ ] **Step 8: Commit**

```bash
git add src/lib/padron src/acciones/padron.ts src/app/admin/empleados tests/unidad/padron
git commit -m "feat: importación del padrón de empleados desde CSV de Tango"
```

---

## Tarea 14: Códigos de activación

**Files:**
- Create: `src/lib/codigo-activacion.ts`, `src/acciones/codigos.ts`, `src/app/admin/empleados/page.tsx`, `src/app/admin/empleados/nuevo/page.tsx`
- Modify: `src/acciones/padron.ts` (agrega `guardarEmpleado`)
- Test: `tests/unidad/codigo-activacion.test.ts`

**Interfaces:**
- Consumes: `clienteServicio`, `exigirAdmin`, `registrarEvento`.
- Produces:
  - `generarCodigo(): string` — 8 caracteres de un alfabeto sin ambigüedades.
  - `hashearCodigo(personaId: string, codigo: string): string` — SHA-256 hexadecimal.
  - `generarCodigoActivacion(personaId, motivo)` — Server Action que devuelve el código en claro **una sola vez**.

- [ ] **Step 1: Escribir los tests que fallan**

Crear `tests/unidad/codigo-activacion.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { generarCodigo, hashearCodigo } from '@/lib/codigo-activacion'

describe('generarCodigo', () => {
  it('devuelve 8 caracteres', () => {
    expect(generarCodigo()).toHaveLength(8)
  })

  it('evita caracteres que se confunden al dictarlos', () => {
    for (let i = 0; i < 200; i++) {
      expect(generarCodigo()).not.toMatch(/[O0I1lS5]/)
    }
  })

  it('no repite el mismo código', () => {
    const codigos = new Set(Array.from({ length: 200 }, () => generarCodigo()))
    expect(codigos.size).toBeGreaterThan(190)
  })
})

describe('hashearCodigo', () => {
  it('es determinístico para la misma persona y código', () => {
    expect(hashearCodigo('persona-1', 'ABCD2345')).toBe(hashearCodigo('persona-1', 'ABCD2345'))
  })

  it('cambia si cambia la persona', () => {
    expect(hashearCodigo('persona-1', 'ABCD2345')).not.toBe(hashearCodigo('persona-2', 'ABCD2345'))
  })

  it('no distingue mayúsculas ni espacios en el código ingresado', () => {
    expect(hashearCodigo('persona-1', ' abcd 2345 ')).toBe(hashearCodigo('persona-1', 'ABCD2345'))
  })

  it('devuelve un hexadecimal de 64 caracteres', () => {
    expect(hashearCodigo('persona-1', 'ABCD2345')).toMatch(/^[0-9a-f]{64}$/)
  })
})
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `npm test`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Implementar**

Crear `src/lib/codigo-activacion.ts`:

```ts
import { createHash, randomInt } from 'node:crypto'

/** Sin O/0, I/1/l ni S/5: el código se dicta por teléfono o se copia de un papel. */
const ALFABETO = 'ABCDEFGHJKMNPQRTUVWXYZ2346789'
const LARGO = 8

export function generarCodigo(): string {
  let codigo = ''
  for (let i = 0; i < LARGO; i++) {
    codigo += ALFABETO[randomInt(ALFABETO.length)]
  }
  return codigo
}

/**
 * El id de la persona actúa como sal: dos personas con el mismo código
 * producen hashes distintos, y el hash almacenado no sirve fuera de su fila.
 */
export function hashearCodigo(personaId: string, codigo: string): string {
  const normalizado = codigo.replace(/\s+/g, '').toUpperCase()
  return createHash('sha256').update(`${personaId}:${normalizado}`).digest('hex')
}
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Server Action de generación**

Crear `src/acciones/codigos.ts`:

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { registrarEvento } from '@/lib/auditoria'
import { generarCodigo, hashearCodigo } from '@/lib/codigo-activacion'
import { exigirAdmin } from '@/lib/sesion'
import { clienteServicio } from '@/lib/supabase/cliente-servicio'

const DIAS_VIGENCIA = 30

/** Devuelve el código en claro. Es la ÚNICA vez que existe fuera del hash. */
export async function generarCodigoActivacion(
  personaId: string,
  motivo: 'alta' | 'reset' = 'alta',
): Promise<{ codigo: string } | { error: string }> {
  const admin = await exigirAdmin('operar')
  const supabase = clienteServicio()

  // Anular cualquier código anterior que siga vigente.
  await supabase
    .from('codigos_activacion')
    .update({ anulado_at: new Date().toISOString() })
    .eq('persona_id', personaId)
    .is('usado_at', null)
    .is('anulado_at', null)

  const codigo = generarCodigo()
  const expira = new Date()
  expira.setDate(expira.getDate() + DIAS_VIGENCIA)

  const { error } = await supabase.from('codigos_activacion').insert({
    persona_id: personaId,
    codigo_hash: hashearCodigo(personaId, codigo),
    motivo,
    creado_por: admin.id,
    expira_at: expira.toISOString(),
  })

  if (error) return { error: `No se pudo generar el código: ${error.message}` }

  await registrarEvento({
    actorTipo: 'admin',
    actorId: admin.id,
    accion: motivo === 'alta' ? 'codigo.generar' : 'codigo.resetear',
    entidad: 'personas',
    entidadId: personaId,
  })

  revalidatePath('/admin/empleados')
  return { codigo }
}
```

- [ ] **Step 6: Listado de empleados con generación de códigos**

Crear `src/app/admin/empleados/page.tsx`: tabla por empresa con legajo, nombre, CUIL formateado, estado de la persona (`pendiente` / `activo` / `bloqueado`), si tiene código vigente, y un botón "Generar código" (solo para `operador` y `admin`) que muestre el código en un cuadro destacado con la leyenda **"Anotalo ahora: no se puede volver a ver"** y un botón de copiar.

Incluir filtros por empresa y por estado, y buscador por legajo, nombre o CUIL.

- [ ] **Step 7: Alta y edición manual de empleados**

La importación cubre el alta masiva; esto cubre las correcciones puntuales (un ingreso a mitad de mes, un CUIL mal cargado en Tango).

Agregar a `src/acciones/padron.ts`:

```ts
const esquemaEmpleado = z.object({
  empresaId: z.string().uuid(),
  legajo: z.coerce.number().int().positive('El legajo debe ser un número mayor a cero'),
  cuil: z
    .string()
    .transform((v) => normalizarCuil(v))
    .refine((c): c is string => c !== null, 'El CUIL debe tener 11 dígitos')
    .refine((c) => cuilValido(c), 'El CUIL no es válido: revisá el dígito verificador'),
  apellidoNombre: z.string().trim().min(1, 'Ingresá apellido y nombre'),
  email: z.string().trim().email('Email inválido').optional().or(z.literal('')),
  telefono: z.string().trim().optional(),
  sector: z.string().trim().optional(),
  activo: z.coerce.boolean(),
})

/** Alta o edición de un solo legajo. Reutiliza la persona si el CUIL ya existe. */
export async function guardarEmpleado(_estado: string | null, datos: FormData) {
  const admin = await exigirAdmin('operar')

  const analisis = esquemaEmpleado.safeParse(Object.fromEntries(datos))
  if (!analisis.success) return analisis.error.issues[0].message

  const { empresaId, legajo, cuil, apellidoNombre, email, telefono, sector, activo } = analisis.data
  const supabase = clienteServicio()

  const { data: persona, error: errorPersona } = await supabase
    .from('personas')
    .upsert(
      { cuil, apellido_nombre: apellidoNombre, email: email || null, telefono: telefono || null },
      { onConflict: 'cuil' },
    )
    .select('id')
    .single()

  if (errorPersona || !persona) return `No se pudo guardar la persona: ${errorPersona?.message}`

  const { error } = await supabase.from('legajos').upsert(
    { empresa_id: empresaId, persona_id: persona.id, numero: legajo, sector: sector || null, activo },
    { onConflict: 'empresa_id,numero' },
  )
  if (error) return `No se pudo guardar el legajo: ${error.message}`

  await registrarEvento({
    actorTipo: 'admin',
    actorId: admin.id,
    accion: 'empleado.guardar',
    entidad: 'legajos',
    detalle: { empresaId, legajo, cuil },
  })

  revalidatePath('/admin/empleados')
  return null
}
```

Agregar los imports que faltan al principio del archivo: `import { z } from 'zod'` y `import { cuilValido, normalizarCuil } from '@/lib/cuil'`.

Crear `src/app/admin/empleados/nuevo/page.tsx` con el formulario correspondiente, y un enlace "Editar" en cada fila del listado que abra el mismo formulario precargado.

- [ ] **Step 8: Verificar a mano**

Generar un código para un empleado, confirmar que se muestra una sola vez, que al generar uno nuevo el anterior queda anulado (`select count(*) from codigos_activacion where persona_id = '…' and usado_at is null and anulado_at is null` devuelve 1), y que el valor almacenado es un hash y no el código.

Dar de alta un empleado a mano con un CUIL que ya exista en otra empresa: debe reutilizar la persona (una sola fila en `personas` para ese CUIL) y crear un segundo legajo.

- [ ] **Step 9: Commit**

```bash
git add src/lib/codigo-activacion.ts src/acciones/codigos.ts src/acciones/padron.ts src/app/admin/empleados tests/unidad/codigo-activacion.test.ts
git commit -m "feat: códigos de activación de un solo uso y ABM manual de empleados"
```

---

## Tarea 15: Conexión de carpeta y escaneo

**Files:**
- Create: `src/lib/carpeta/escanear.ts`, `src/lib/carpeta/handle-persistido.ts`, `src/componentes/selector-carpeta.tsx`
- Test: `tests/unidad/carpeta/escanear.test.ts`

**Interfaces:**
- Consumes: `parseNombreRecibo`, `ArchivoEscaneado`.
- Produces:
  - `interface ResultadoEscaneo { archivos: ArchivoEscaneado[]; ignorados: string[] }`
  - `escanearDirectorio(directorio: DirectorioLegible, rutaBase?: string): Promise<ResultadoEscaneo>`
  - `interface DirectorioLegible { values(): AsyncIterable<EntradaLegible> }` — abstracción que permite probar sin navegador.
  - `guardarHandle(handle)` / `recuperarHandle()` sobre IndexedDB.

- [ ] **Step 1: Escribir los tests que fallan**

Crear `tests/unidad/carpeta/escanear.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { escanearDirectorio, type DirectorioLegible } from '@/lib/carpeta/escanear'

function archivoFalso(nombre: string, bytes = 45000) {
  return {
    kind: 'file' as const,
    name: nombre,
    getFile: async () => ({ size: bytes, name: nombre }) as unknown as File,
  }
}

function carpetaFalsa(nombre: string, hijos: unknown[]): DirectorioLegible & { kind: 'directory'; name: string } {
  return {
    kind: 'directory',
    name: nombre,
    async *values() {
      for (const hijo of hijos) yield hijo as never
    },
  }
}

describe('escanearDirectorio', () => {
  it('reconoce los recibos de una carpeta plana', async () => {
    const raiz = carpetaFalsa('202604', [
      archivoFalso('RS_202604_1QA_680_201_20-27103275-8.pdf'),
      archivoFalso('RS_202604_1QA_680_202_20-19202141-4.pdf'),
    ])

    const { archivos, ignorados } = await escanearDirectorio(raiz)

    expect(archivos).toHaveLength(2)
    expect(ignorados).toEqual([])
    expect(archivos[0].datos.legajo).toBe(201)
  })

  it('recorre subcarpetas y arma la ruta relativa', async () => {
    const raiz = carpetaFalsa('Delta 6', [
      carpetaFalsa('202604', [archivoFalso('RS_202604_MEN_679_1_27-20012949-6.pdf')]),
    ])

    const { archivos } = await escanearDirectorio(raiz)

    expect(archivos).toHaveLength(1)
    expect(archivos[0].rutaRelativa).toBe('202604/RS_202604_MEN_679_1_27-20012949-6.pdf')
  })

  it('lista aparte los PDFs que no son recibos', async () => {
    const raiz = carpetaFalsa('202604', [
      archivoFalso('RS_202604_MEN_679_1_27-20012949-6.pdf'),
      archivoFalso('Listado de haberes.pdf'),
    ])

    const { archivos, ignorados } = await escanearDirectorio(raiz)

    expect(archivos).toHaveLength(1)
    expect(ignorados).toEqual(['Listado de haberes.pdf'])
  })

  it('no cuenta como ignorados los archivos que no son PDF', async () => {
    const raiz = carpetaFalsa('202604', [archivoFalso('notas.txt'), archivoFalso('planilla.xlsx')])

    const { archivos, ignorados } = await escanearDirectorio(raiz)

    expect(archivos).toEqual([])
    expect(ignorados).toEqual([])
  })

  it('devuelve vacío para una carpeta sin contenido', async () => {
    const { archivos, ignorados } = await escanearDirectorio(carpetaFalsa('vacia', []))
    expect(archivos).toEqual([])
    expect(ignorados).toEqual([])
  })
})
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `npm test`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Implementar el escaneo**

Crear `src/lib/carpeta/escanear.ts`:

```ts
import type { ArchivoEscaneado } from '@/lib/tango/agrupar-lotes'
import { parseNombreRecibo } from '@/lib/tango/parse-nombre-recibo'

/**
 * Mínimo que necesitamos de FileSystemDirectoryHandle.
 * Declararlo así permite probar el escaneo sin navegador.
 */
export interface EntradaLegible {
  kind: 'file' | 'directory'
  name: string
  getFile?: () => Promise<File>
  values?: () => AsyncIterable<EntradaLegible>
}

export interface DirectorioLegible {
  values(): AsyncIterable<EntradaLegible>
}

export interface ResultadoEscaneo {
  archivos: ArchivoEscaneado[]
  /** PDFs que no responden al patrón de Tango: se muestran, no se suben. */
  ignorados: string[]
}

export async function escanearDirectorio(
  directorio: DirectorioLegible,
  rutaBase = '',
): Promise<ResultadoEscaneo> {
  const archivos: ArchivoEscaneado[] = []
  const ignorados: string[] = []

  for await (const entrada of directorio.values()) {
    const ruta = rutaBase ? `${rutaBase}/${entrada.name}` : entrada.name

    if (entrada.kind === 'directory' && entrada.values) {
      const hijo = await escanearDirectorio({ values: entrada.values.bind(entrada) }, ruta)
      archivos.push(...hijo.archivos)
      ignorados.push(...hijo.ignorados)
      continue
    }

    if (entrada.kind !== 'file' || !entrada.getFile) continue

    const datos = parseNombreRecibo(entrada.name)
    if (!datos) {
      if (entrada.name.toLowerCase().endsWith('.pdf')) ignorados.push(entrada.name)
      continue
    }

    const archivo = await entrada.getFile()
    archivos.push({
      nombre: entrada.name,
      rutaRelativa: ruta,
      bytes: archivo.size,
      datos,
    })
  }

  return { archivos, ignorados }
}
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Persistir el handle de la carpeta**

Crear `src/lib/carpeta/handle-persistido.ts`:

```ts
'use client'

const BASE = 'conforme'
const ALMACEN = 'carpetas'

function abrirBase(): Promise<IDBDatabase> {
  return new Promise((resolver, rechazar) => {
    const peticion = indexedDB.open(BASE, 1)
    peticion.onupgradeneeded = () => peticion.result.createObjectStore(ALMACEN)
    peticion.onsuccess = () => resolver(peticion.result)
    peticion.onerror = () => rechazar(peticion.error)
  })
}

async function operar<T>(modo: IDBTransactionMode, fn: (almacen: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const base = await abrirBase()
  return new Promise((resolver, rechazar) => {
    const peticion = fn(base.transaction(ALMACEN, modo).objectStore(ALMACEN))
    peticion.onsuccess = () => resolver(peticion.result)
    peticion.onerror = () => rechazar(peticion.error)
  })
}

export function soportaCarpetaLocal(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window
}

export async function guardarHandle(empresaId: string, handle: FileSystemDirectoryHandle) {
  await operar('readwrite', (a) => a.put(handle, empresaId))
}

export async function recuperarHandle(empresaId: string): Promise<FileSystemDirectoryHandle | null> {
  const handle = await operar<FileSystemDirectoryHandle | undefined>('readonly', (a) => a.get(empresaId))
  return handle ?? null
}

/** El permiso hay que revalidarlo en cada sesión: el navegador no lo regala. */
export async function asegurarPermiso(handle: FileSystemDirectoryHandle): Promise<boolean> {
  const opciones = { mode: 'read' } as const
  if ((await handle.queryPermission(opciones)) === 'granted') return true
  return (await handle.requestPermission(opciones)) === 'granted'
}
```

- [ ] **Step 6: Componente selector de carpeta con alternativa**

Crear `src/componentes/selector-carpeta.tsx`: componente cliente que, si `soportaCarpetaLocal()`, ofrece "Conectar carpeta" (`showDirectoryPicker`), recuerda el handle por empresa y muestra "Escanear de nuevo"; y si no, muestra un aviso — *"Tu navegador no permite recordar la carpeta. Usá Chrome o Edge, o arrastrá los archivos acá"* — con una zona de arrastre que produce el mismo `ArchivoEscaneado[]`.

- [ ] **Step 7: Verificar contra la carpeta real**

Run: `npm run dev`, conectar `D:\APP\RECIBOS\Ejemplo Delta 6` y confirmar: 28 archivos reconocidos, 0 ignorados, 2 lotes (`Abril 2026 · Mensual · Liq. 679` con 22 y las dos quincenas con 3 cada una).

- [ ] **Step 8: Commit**

```bash
git add src/lib/carpeta src/componentes/selector-carpeta.tsx tests/unidad/carpeta
git commit -m "feat: conexión de carpeta local y escaneo recursivo de recibos"
```

---

## Tarea 16: Cálculo de hash y subida a Storage

**Files:**
- Create: `src/lib/hash.ts`, `src/lib/subida/subir-lote.ts`, `src/acciones/subida.ts`
- Test: `tests/unidad/hash.test.ts`, `tests/unidad/subida/subir-lote.test.ts`

**Interfaces:**
- Consumes: `ArchivoEscaneado`, `clienteServicio`, `exigirAdmin`.
- Produces:
  - `sha256Hex(datos: ArrayBuffer): Promise<string>`
  - `rutaStorage(empresaId, periodo, tipo, datoFijo, legajo, version): string`
  - `subirConLimite<T>(items: T[], limite: number, tarea: (item: T) => Promise<void>, alAvanzar?: (hechos: number) => void): Promise<void>`
  - `pedirUrlsDeSubida(reciboIds)` — Server Action que devuelve URLs firmadas de subida.

- [ ] **Step 1: Escribir los tests que fallan**

Crear `tests/unidad/hash.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { rutaStorage, sha256Hex } from '@/lib/hash'

describe('sha256Hex', () => {
  it('coincide con el vector conocido de la cadena vacía', async () => {
    expect(await sha256Hex(new ArrayBuffer(0)))
      .toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
  })

  it('coincide con el vector conocido de "abc"', async () => {
    expect(await sha256Hex(new TextEncoder().encode('abc').buffer as ArrayBuffer))
      .toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })
})

describe('rutaStorage', () => {
  it('arma la ruta del bucket', () => {
    expect(rutaStorage('emp-1', 202604, '1QA', 680, 201, 1)).toBe('emp-1/202604/1QA-680/201-v1.pdf')
  })

  it('refleja la versión en el nombre', () => {
    expect(rutaStorage('emp-1', 202604, 'MEN', 679, 1, 2)).toBe('emp-1/202604/MEN-679/1-v2.pdf')
  })
})
```

Crear `tests/unidad/subida/subir-lote.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { subirConLimite } from '@/lib/subida/subir-lote'

describe('subirConLimite', () => {
  it('procesa todos los elementos', async () => {
    const hechos: number[] = []
    await subirConLimite([1, 2, 3, 4, 5], 2, async (n) => { hechos.push(n) })
    expect(hechos.sort()).toEqual([1, 2, 3, 4, 5])
  })

  it('nunca supera el límite de concurrencia', async () => {
    let enVuelo = 0
    let pico = 0

    await subirConLimite(Array.from({ length: 20 }, (_, i) => i), 5, async () => {
      enVuelo++
      pico = Math.max(pico, enVuelo)
      await new Promise((r) => setTimeout(r, 5))
      enVuelo--
    })

    expect(pico).toBeLessThanOrEqual(5)
    expect(pico).toBeGreaterThan(1)
  })

  it('informa el avance', async () => {
    const avances: number[] = []
    await subirConLimite([1, 2, 3], 1, async () => {}, (hechos) => avances.push(hechos))
    expect(avances).toEqual([1, 2, 3])
  })

  it('propaga el error y no deja tareas colgadas', async () => {
    await expect(
      subirConLimite([1, 2, 3], 2, async (n) => {
        if (n === 2) throw new Error('falló el 2')
      }),
    ).rejects.toThrow('falló el 2')
  })
})
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `npm test`
Expected: FAIL — módulos inexistentes.

- [ ] **Step 3: Implementar**

Crear `src/lib/hash.ts`:

```ts
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
```

Crear `src/lib/subida/subir-lote.ts`:

```ts
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
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Server Action que prepara la subida**

Crear `src/acciones/subida.ts`:

```ts
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
      return { error: `No se pudo autorizar la subida de ${archivo.nombreOriginal}: ${errorFirma?.message}` }
    }

    destinos.push({ legajoNumero: archivo.legajoNumero, rutaStorage: ruta, token: firmada.token, version })
  }

  return { liquidacionId: liquidacion.id, destinos }
}
```

- [ ] **Step 6: Conectar la subida en la interfaz**

En la pantalla de ingesta: para cada archivo del lote, leer el `ArrayBuffer`, calcular `sha256Hex`, cotejar con `cotejarLote`, pedir los destinos con `prepararSubida`, y subir con `supabase.storage.from('recibos').uploadToSignedUrl(ruta, token, archivo)` usando `subirConLimite(..., 5, ...)` y una barra de progreso. Reintentar hasta 3 veces por archivo con espera creciente (1 s, 2 s, 4 s) antes de dar el archivo por fallido.

- [ ] **Step 7: Commit**

```bash
git add src/lib/hash.ts src/lib/subida src/acciones/subida.ts tests/unidad/hash.test.ts tests/unidad/subida
git commit -m "feat: hash SHA-256, rutas de storage y subida con límite de concurrencia"
```

---

## Tarea 17: Revisión y publicación del lote

**Files:**
- Create: `src/acciones/liquidaciones.ts`, `src/app/admin/liquidaciones/page.tsx`, `src/app/admin/liquidaciones/ingesta/page.tsx`, `src/app/admin/liquidaciones/[id]/page.tsx`
- Create: `supabase/migrations/0006_publicar.sql`
- Test: `tests/integracion/publicar.test.ts`

**Interfaces:**
- Consumes: todo lo anterior.
- Produces:
  - `registrarRecibos(liquidacionId, recibos)` — Server Action que inserta las filas ya subidas.
  - `publicarLiquidacion(liquidacionId)` — Server Action.
  - Función SQL `publicar_liquidacion(uuid, uuid)` que hace el cambio de estado y el versionado en una sola transacción.

- [ ] **Step 1: Escribir la migración con la función de publicación**

Crear `supabase/migrations/0006_publicar.sql`:

```sql
-- Publica una liquidación en una sola transacción:
-- marca como reemplazados los recibos anteriores del mismo legajo,
-- deja vigente la última versión y cambia el estado del lote.

create or replace function publicar_liquidacion(
  p_liquidacion uuid,
  p_admin uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_estado estado_liquidacion;
  v_publicados integer;
begin
  select estado into v_estado
  from liquidaciones where id = p_liquidacion
  for update;

  if v_estado is null then
    raise exception 'La liquidación no existe';
  end if;

  if v_estado = 'publicada' then
    raise exception 'La liquidación ya está publicada';
  end if;

  -- Deja una sola versión vigente por legajo: la más alta.
  update recibos r
  set estado = 'reemplazado'
  where r.liquidacion_id = p_liquidacion
    and r.estado = 'vigente'
    and r.version < (
      select max(r2.version) from recibos r2
      where r2.liquidacion_id = r.liquidacion_id and r2.legajo_id = r.legajo_id
    );

  update liquidaciones
  set estado = 'publicada',
      publicada_at = now(),
      publicada_por = p_admin
  where id = p_liquidacion;

  select count(*) into v_publicados
  from recibos
  where liquidacion_id = p_liquidacion and estado = 'vigente';

  return v_publicados;
end;
$$;

revoke all on function publicar_liquidacion(uuid, uuid) from public, anon, authenticated;
```

- [ ] **Step 2: Aplicar la migración**

`apply_migration` con `name = 0006_publicar`.

- [ ] **Step 3: Escribir la Server Action**

Crear `src/acciones/liquidaciones.ts`:

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { registrarEvento } from '@/lib/auditoria'
import { exigirAdmin } from '@/lib/sesion'
import { clienteServicio } from '@/lib/supabase/cliente-servicio'

export interface ReciboSubido {
  legajoNumero: number
  rutaStorage: string
  nombreOriginal: string
  sha256: string
  bytes: number
  cuilArchivo: string
  version: number
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
```

- [ ] **Step 4: Escribir la prueba de integración**

Crear `tests/integracion/publicar.test.ts` con el mismo patrón de sembrado que `rls.test.ts`, verificando:

```ts
it('publicar deja una sola versión vigente por legajo', async () => {
  // Sembrar dos versiones del mismo legajo en la misma liquidación.
  // Llamar a publicar_liquidacion.
  // Esperar: v2 vigente, v1 reemplazado, liquidación publicada, publicada_at no nulo.
})

it('publicar dos veces la misma liquidación falla', async () => {
  // Segunda llamada a publicar_liquidacion → error 'ya está publicada'.
})

it('una liquidación en borrador no es visible para el empleado', async () => {
  // Cliente autenticado como empleado: select sobre recibos devuelve [].
})
```

- [ ] **Step 5: Correr las pruebas**

Run: `npx dotenv -e .env.local -- npm run test:integracion`
Expected: PASS

- [ ] **Step 6: Pantalla de ingesta**

Crear `src/app/admin/liquidaciones/ingesta/page.tsx`, que encadena todo el flujo en una sola pantalla con pasos numerados:

1. **Empresa** — selector.
2. **Carpeta** — `SelectorCarpeta`; al escanear, muestra "28 recibos reconocidos · 0 archivos ignorados".
3. **Lotes** — una tarjeta por lote con `describirLote()` y su cantidad de recibos; el administrador elige cuál procesar.
4. **Cotejo** — calcula los hashes, consulta padrón y recibos existentes, corre `cotejarLote` y muestra los diagnósticos agrupados por severidad. Los bloqueantes en rojo, arriba, con el detalle completo. `CUIL_NO_COINCIDE` va primero de todos.
5. **Subida** — habilitada solo si `hayBloqueantes === false`; barra de progreso y detalle por archivo.
6. **Publicación** — resumen final (cuántos se suben, cuántos se saltean por `YA_SUBIDO`, cuántos son reemplazo) y el botón **Publicar**, con confirmación que aclara que a partir de ese momento los empleados van a ver los recibos.

- [ ] **Step 7: Prueba de extremo a extremo con los archivos reales**

Run: `npm run dev`. Con la empresa y el padrón cargados, procesar `D:\APP\RECIBOS\Ejemplo Delta 6`: escanear, cotejar, subir y publicar el lote `Abril 2026 · Primera quincena · Liq. 680`. Verificar en Supabase que hay 3 recibos vigentes y que la liquidación quedó `publicada` con `publicada_at`.

Repetir el escaneo sin cambiar nada: los 3 archivos deben aparecer como `YA_SUBIDO` y no debe crearse ninguna fila nueva.

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/0006_publicar.sql src/acciones/liquidaciones.ts src/app/admin/liquidaciones tests/integracion/publicar.test.ts
git commit -m "feat: registro de recibos y publicación transaccional de liquidaciones"
```

---

## Tarea 18: Despliegue en Vercel

**Files:**
- Create: `vercel.json`, `README.md`
- Modify: `.env.local.example`

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: el proyecto desplegado y accesible.

- [ ] **Step 1: Verificar que todo pasa localmente**

Run: `npm test`
Expected: PASS

Run: `npm run build`
Expected: build exitoso, sin advertencias de TypeScript.

- [ ] **Step 2: Documentar el proyecto**

Crear `README.md` con: qué es Conforme, cómo levantarlo en local, cómo aplicar las migraciones en orden, cómo crear el primer administrador (referencia a `supabase/semillas/primer-admin.sql`), qué navegador hace falta para conectar la carpeta, y la lista de variables de entorno con su explicación.

- [ ] **Step 3: Subir el repositorio**

```bash
git push -u origin main
```

- [ ] **Step 4: Crear el proyecto en Vercel**

Importar `infosystuc-sys/recibos` desde el panel de Vercel en el equipo `infosystuc-4207's projects`. Framework: Next.js (se detecta solo).

- [ ] **Step 5: Cargar las variables de entorno en Vercel**

Para los tres entornos (Production, Preview, Development):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` — **sin** el prefijo `NEXT_PUBLIC_`
- `EMPLEADO_EMAIL_DOMAIN`

- [ ] **Step 6: Verificar el despliegue**

Abrir la URL de producción, comprobar que `/admin` redirige a `/ingresar`, ingresar con el administrador y confirmar que el listado de empresas carga.

- [ ] **Step 7: Confirmar que la clave de servicio no se filtró al navegador**

En la aplicación desplegada, abrir las herramientas de desarrollo → Network → buscar en los archivos JS descargados la cadena `service_role`.
Expected: **cero coincidencias**. Si aparece alguna, hay un `import` de `cliente-servicio` desde un componente cliente: corregirlo antes de seguir.

- [ ] **Step 8: Commit**

```bash
git add README.md vercel.json
git commit -m "docs: instrucciones de instalación y despliegue"
git push
```

---

## Verificación final de la Fase 1A

Antes de dar la fase por terminada, confirmar cada punto con su comando:

- [ ] `npm test` — todas las pruebas unitarias en verde.
- [ ] `npx dotenv -e .env.local -- npm run test:integracion` — RLS y publicación en verde.
- [ ] `npm run test:e2e` — ingreso de administrador en verde.
- [ ] `npm run build` — sin errores.
- [ ] Escaneo de `Ejemplo Delta 6`: 28 reconocidos, 0 ignorados, 3 lotes.
- [ ] Re-escaneo del mismo lote: todo `YA_SUBIDO`, sin filas nuevas en la base.
- [ ] Un archivo con el CUIL cambiado a mano dispara `CUIL_NO_COINCIDE` y bloquea la publicación.
- [ ] Búsqueda de `service_role` en el JS servido: cero coincidencias.
- [ ] `select count(*) from storage.buckets where id = 'recibos' and public = true` devuelve 0.

## Qué queda para la Fase 1B (portal del empleado)

Activación con CUIL y código · definición de clave · listado de recibos por empresa y período · visor PDF con URL firmada · registro de conformidad con auditoría · comprobante descargable · descarga habilitada tras conformar · tablero de seguimiento de firmas y exportaciones. Se planifica en un documento aparte.
