# Conforme

Aplicación que distribuye los recibos de sueldo que exporta **Tango Sueldos** a los
empleados y registra su **conformidad** con valor probatorio.

El administrador conecta la carpeta donde Tango deja los PDFs; la app los clasifica leyendo
el nombre del archivo, los cotea contra el padrón de la empresa, los sube a Supabase Storage
(bucket privado) y publica la liquidación. El empleado entra con su CUIL desde el celular,
lee su recibo, presta conformidad y recién entonces puede descargarlo.

> Esta es la **Fase 1A**: alta de empresas y usuarios, importación del padrón, códigos de
> activación, y toda la ingesta hasta la publicación. El portal del empleado (Fase 1B) se
> planifica aparte. Estado y decisiones de implementación: `docs/ESTADO.md`.

## Formato del nombre de archivo de Tango

De acá sale toda la clasificación:

```
RS_202604_1QA_680_201_20-27103275-8.pdf
│  │      │   │   │   └─ CUIL
│  │      │   │   └───── legajo
│  │      │   └───────── número de liquidación (dato fijo)
│  │      └───────────── tipo: 1QA / 2QA / MEN
│  └──────────────────── período AAAAMM
└─────────────────────── prefijo de recibo de sueldo
```

## Stack

- **Next.js 16** (App Router, Server Actions, runtime Node).
- **Supabase** — Postgres con RLS, Auth y Storage.
- **Tailwind CSS 4**, **Zod 4**, **Vitest**, **Playwright**.

## Puesta en marcha local

Requisitos: Node 20+ y una cuenta de Supabase con acceso al proyecto.

```bash
npm install
cp .env.local.example .env.local   # completar las claves (ver abajo)
npm run dev                        # http://localhost:3000
```

### Aplicar las migraciones

Los archivos de `supabase/migrations/` se aplican **en orden** (`0001` … `0006`). Opciones:

- **CLI:** `npx supabase link --project-ref <ref>` y `npx supabase db push`.
- **Panel:** SQL Editor → pegar y ejecutar cada archivo en orden.

Después, regenerar los tipos:

```bash
npm run tipos   # escribe src/lib/supabase/tipos.ts
```

### Crear el primer administrador

No hay registro abierto. El primer admin se crea a mano:

1. Panel de Supabase → **Authentication → Users → Add user** (email real, contraseña,
   *Auto Confirm User* tildado).
2. Copiar el UUID del usuario en `supabase/semillas/primer-admin.sql` y ejecutarlo en el
   SQL Editor.

El resto de los administradores se dan de alta por invitación desde `/admin/usuarios`.

## Variables de entorno

| Variable | Para qué |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase. Va al navegador. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave anónima. Va al navegador; el acceso lo limita RLS. |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave de servicio: **ignora RLS**. Solo servidor — **sin** el prefijo `NEXT_PUBLIC_`. Nunca debe llegar al navegador. |
| `EMPLEADO_EMAIL_DOMAIN` | Dominio del email sintético con el que los empleados entran por CUIL. No necesita existir: nunca se le envía correo. Por defecto `empleados.conforme.local`. |
| `ADMIN_EMAIL_PRUEBA` / `ADMIN_CLAVE_PRUEBA` | Solo para la prueba E2E de ingreso. Opcionales: si faltan, ese caso se saltea. |

## Conexión de la carpeta

La forma cómoda de conectar la carpeta usa la **File System Access API**, que solo existe en
**Chrome y Edge de escritorio**. En otros navegadores hay dos alternativas: arrastrar la
carpeta a la zona de arrastre, o elegirla con el selector de archivos (`<input>` de
directorio). Las tres producen el mismo resultado.

## Pruebas

```bash
npm test                  # unitarias (lógica pura, sin red)
npm run test:integracion  # RLS y publicación — necesita .env.local y el esquema aplicado
npm run test:e2e          # Playwright — ingreso de administrador
npm run build             # build de producción (incluye chequeo de TypeScript)
```

Para las de integración y E2E, cargar antes las variables de entorno
(`set -a; . ./.env.local; set +a` en bash). Corren contra el **mismo** proyecto Supabase que
la aplicación: su limpieza está acotada a los identificadores que crean.

## Despliegue en Vercel

Framework autodetectado (Next.js). Cargar las cuatro variables de entorno
(`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
`EMPLEADO_EMAIL_DOMAIN`) en Production, Preview y Development. Tras el deploy, verificar que
`/admin` redirige a `/ingresar` y que no aparece la cadena `service_role` en el JavaScript
servido al navegador.
