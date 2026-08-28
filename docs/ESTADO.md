# Conforme — Estado del proyecto y cómo continuar

> **Documento de traspaso.** Si estás retomando este proyecto en una conversación nueva, leé
> esto primero y después el spec. Última actualización: 2026-08-28, commit `ce3154d`.

---

## 1. Qué es Conforme

Una aplicación que distribuye los recibos de sueldo que exporta **Tango Sueldos** a los
empleados, y registra su **conformidad** con valor probatorio.

El administrador conecta la carpeta donde Tango deja los PDFs, la app los clasifica leyendo
el nombre del archivo, los cotea contra el padrón, los sube a Supabase Storage y publica la
liquidación. El empleado entra con su CUIL desde el celular, lee su recibo, presta
conformidad y recién entonces puede descargarlo.

**Formato del nombre de archivo de Tango** — de acá sale toda la clasificación:

```
RS_202604_1QA_680_201_20-27103275-8.pdf
│  │      │   │   │   └─ CUIL
│  │      │   │   └───── legajo
│  │      │   └───────── dato fijo (número de liquidación)
│  │      └───────────── tipo: 1QA / 2QA / MEN
│  └──────────────────── período AAAAMM
└─────────────────────── prefijo de recibo de sueldo
```

**Documentos de referencia, en orden de autoridad:**

1. `docs/superpowers/specs/2026-08-25-conforme-recibos-design.md` — **el spec**. Es la
   autoridad: cuando el plan y el spec se contradicen, manda el spec.
2. `docs/superpowers/plans/2026-08-25-conforme-fase1a-admin-ingesta.md` — el plan de
   implementación de la Fase 1A, 18 tareas con código y tests completos.
3. Este documento — qué se hizo, qué falta, y qué se decidió sobre la marcha.

---

## 2. Estado actual

| | |
|---|---|
| Rama | `fase1a-admin-ingesta` (creada desde `main` en `4e4a815`) |
| HEAD | `ce3154d` |
| Commits en la rama | 29 |
| Tests | **78 unitarios** (14 archivos) + **6 de integración RLS** + **3 E2E** de ingreso, todos verdes |
| TypeScript | `npx tsc --noEmit` limpio, modo estricto |
| Build | `npm run build` verde |
| Sin subir | La rama **no** se pusheó a GitHub todavía |
| Migraciones | **0001–0005 aplicadas** en `twejfeghrujsqzzuzvtf` y verificadas |
| Tipos | `src/lib/supabase/tipos.ts` generado del esquema vivo |

### Lo que está hecho y revisado

**Lógica de negocio pura** (`src/lib/`) — sin dependencias de React, Supabase ni red:

| Archivo | Qué hace |
|---|---|
| `cuil.ts` | Normaliza, formatea y valida CUIL con el dígito verificador módulo 11 de AFIP |
| `periodo.ts` | `202604` → `"Abril 2026"` |
| `tango/parse-nombre-recibo.ts` | Nombre de archivo → período, tipo, dato fijo, legajo, CUIL |
| `tango/agrupar-lotes.ts` | Agrupa archivos escaneados en liquidaciones |
| `tango/cotejar-lote.ts` | Los 7 diagnósticos contra el padrón, incluido `CUIL_NO_COINCIDE` |
| `padron/parse-csv-padron.ts` | Importador del CSV de Tango con errores por fila |
| `codigo-activacion.ts` | Genera y hashea códigos de activación de un solo uso |
| `carpeta/escanear.ts` | Escaneo recursivo de la carpeta, probable sin navegador |
| `hash.ts` | SHA-256 y armado de rutas de Storage |
| `subida/subir-lote.ts` | Subida con límite de concurrencia que se detiene ante un fallo |
| `validaciones/empresa.ts` | Esquema Zod de empresa (el CUIT usa el mismo algoritmo que el CUIL) |
| `permisos.ts` | Matriz de roles `admin` / `operador` / `consulta` |
| `entorno.ts` | Validación Zod de variables de entorno |

**Base de datos** (`supabase/migrations/`) — los cinco archivos **ya se aplicaron y
verificaron** en `twejfeghrujsqzzuzvtf` (ver §3):

- `0001_esquema_base.sql` — empresas, personas, legajos, admin_usuarios, codigos_activacion
- `0002_liquidaciones.sql` — liquidaciones, recibos, conformidades (inmutables), observaciones
- `0003_operacion.sql` — notificaciones, push_subscriptions, eventos_auditoria, importaciones
- `0004_storage.sql` — bucket privado `recibos`
- `0005_rls.sql` — funciones auxiliares y 21 políticas RLS

**Clientes de Supabase** (`src/lib/supabase/`) — `tipos.ts` generado del esquema,
`cliente-navegador.ts` / `cliente-servidor.ts` / `cliente-servicio.ts`.

**Autenticación admin** — `src/lib/sesion.ts` (`obtenerAdmin` / `exigirAdmin`),
`src/proxy.ts`, `src/acciones/sesion.ts`, pantalla `/ingresar`, layout e inicio de `/admin`.

**ABM admin** — `src/lib/auditoria.ts`, `src/acciones/empresas.ts`,
`src/acciones/administradores.ts`, pantallas `/admin/empresas`, `/admin/empresas/nueva`,
`/admin/usuarios`. Nav del layout condicionada por rol.

**Importación de padrón** — `src/acciones/padron.ts` (`importarPadron`), pantalla
`/admin/empleados/importar` (vista previa + errores + posibles bajas).

**Verificación contra datos reales:** el parser reconoce los 28 PDFs de
`D:\APP\RECIBOS\Ejemplo Delta 6` sin ignorar ninguno.

```bash
npx tsx scripts/verificar-carpeta-ejemplo.ts "D:/APP/RECIBOS/Ejemplo Delta 6"
```

---

## 3. El bloqueo de Supabase — RESUELTO (2026-08-28)

**Cómo se destrabó:** el usuario generó un **Personal Access Token** de Supabase
(`Account → Access Tokens`) de una cuenta con acceso a la organización
`uthumtopjpmokeguoiew` (nombre «infosystuc's Org»), que **sí** es dueña de
`twejfeghrujsqzzuzvtf`. Con `SUPABASE_ACCESS_TOKEN` seteado:

- La CLI (`npx supabase …`) y la **Management API**
  (`POST https://api.supabase.com/v1/projects/twejfeghrujsqzzuzvtf/database/query`)
  quedan operativas para SQL y generación de tipos.
- El **conector MCP de Supabase sigue sin conectar** en las sesiones de Claude Code — no
  se usó. Si se necesita, hay que reconectarlo en claude.ai con una cuenta miembro de esa
  organización y reiniciar la sesión.

El token es del usuario y es revocable; no está en el repo. Para reusarlo hay que pedírselo
de nuevo o que autorice el conector.

### Lo que se aplicó y verificó

- Migraciones **0001–0005** corridas en orden vía Management API. Registradas a mano en
  `supabase_migrations.schema_migrations` (versiones `0001`…`0005`) para que un futuro
  `supabase db push` no las reejecute.
- 13 tablas con RLS activa. 6 funciones `SECURITY DEFINER` estables con `search_path=public`.
  Bucket `recibos` privado (10 MB, solo `application/pdf`). Triggers de inmutabilidad
  (`conformidades_inmutables`, `auditoria_inmutable`) presentes.
- **Recursión de RLS: no ocurre.** `set local role authenticated` + `request.jwt.claims`
  y `select id from recibos` / `liquidaciones` devuelven vacío sin
  «infinite recursion detected in policy». Las dos funciones puente cumplen su función.
- Advisors: solo los hallazgos ya listados en el §5 como diferidos
  (`function_search_path_mutable` en `tocar_updated_at` e `impedir_modificacion`,
  `*_security_definer_function_executable` sin `revoke execute`, `auth_rls_initplan`,
  `multiple_permissive_policies`). Ninguno bloqueante.

### Claves y entorno

`.env.local` está creado (gitignored) con `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY` (legacy JWT), `SUPABASE_SERVICE_ROLE_KEY` (legacy JWT),
`EMPLEADO_EMAIL_DOMAIN` y las credenciales E2E (`ADMIN_EMAIL_PRUEBA` / `ADMIN_CLAVE_PRUEBA`).
Se usan las claves **legacy** (`eyJ…`) porque el plan y `entorno.ts` esperan esos nombres;
el proyecto también tiene claves nuevas `sb_publishable_` / `sb_secret_` sin usar.

### Primer administrador

Creado en `twejfeghrujsqzzuzvtf`:

| | |
|---|---|
| auth user id | `56aa2962-d4c0-47d9-81ae-5506415d63aa` |
| email | `taroriva5199@gmail.com` |
| nombre / rol | `Administrador` / `admin` |
| contraseña | está en `.env.local` como `ADMIN_CLAVE_PRUEBA` — **el usuario debería cambiarla** |

`supabase/semillas/primer-admin.sql` quedó como plantilla genérica para futuros despliegues.

### Test de integración (RLS) — corrido, 6/6 verde (2026-08-28)

```bash
set -a; . ./.env.local; set +a      # bash: cargar las vars
npm run test:integracion
```

Confirma en la práctica lo que ya se había verificado a mano: el empleado ve su recibo
publicado y **no** el de otro, no ve recibos de liquidaciones en borrador, no ve datos de
terceros, no puede insertar conformidades ni leer `admin_usuarios`. No hizo falta
`dotenv-cli`. Ojo: corre contra el **mismo** proyecto que la app (no hay base separada, ver
trampa #4); su limpieza es best-effort y acotada a los ids que crea.

---

## 4. Qué falta

Del plan de 18 tareas, están completas **la 1 a la 13**. De las tareas 14 a 16 se
extrajeron y completaron **solo los módulos de lógica pura** (los Steps 1 a 4 de cada una).
Falta:

| Tarea | Qué falta | Depende de |
|---|---|---|
| ~~10~~ | ✅ Hecha. `tipos.ts` + `cliente-navegador/servidor/servicio.ts` (`c63bda4`) | — |
| ~~11~~ | ✅ Hecha. `sesion.ts`, `proxy.ts` (ver desvío abajo), ingreso, layout `/admin`, semilla, E2E verde (`4cb0a24`, `c552815`) | — |
| ~~12~~ | ✅ Hecha. `auditoria.ts`, `acciones/empresas.ts`, `acciones/administradores.ts`, pantallas `/admin/empresas` y `/admin/usuarios`, nav por rol. Verificada end-to-end (`f9f1199`) | — |
| ~~13~~ | ✅ Hecha. `acciones/padron.ts` (`importarPadron`), pantalla `/admin/empleados/importar` con vista previa. Verificada end-to-end (`ce3154d`) | — |
| 14 | Steps 5-9: Server Action `generarCodigoActivacion`, listado de empleados, ABM manual | Tarea 11 |
| 15 | Steps 5-8: `handle-persistido.ts` (IndexedDB) y el componente `selector-carpeta.tsx` | Tarea 11 |
| 16 | Steps 5-7: Server Action `prepararSubida` y la subida desde la interfaz | Tarea 11 |
| 17 | Completa: migración `0006_publicar.sql`, `registrarRecibos`, `publicarLiquidacion`, pantalla de ingesta | Tareas 10-16 |
| 18 | Completa: README, push, proyecto en Vercel, variables, verificación de despliegue | Todo lo anterior |

Después de la Fase 1A queda por planificar la **Fase 1B: el portal del empleado**
(activación con CUIL y código, listado de recibos, visor PDF, conformidad con auditoría,
comprobante descargable, tablero de seguimiento de firmas).

---

## 5. Decisiones tomadas que NO están en el plan

**Importante:** estas decisiones corrigen defectos del plan. Si alguien lee el plan sin leer
esto, va a re-introducir los errores.

1. **`publicada_coherente` (migración 0002).** El plan definía
   `check ((estado='publicada') = (publicada_at is not null))`, que obliga a **borrar la
   fecha de publicación** para anular una liquidación — destruye evidencia en un sistema
   cuyo valor es probatorio. Corregido en el archivo a
   `check (estado <> 'publicada' or publicada_at is not null)`.

2. **Recursión mutua de RLS (migración 0005).** Las políticas de `recibos` y `liquidaciones`
   se consultaban entre sí, lo que hace que Postgres corte con «infinite recursion detected
   in policy for relation». Se agregaron dos funciones `SECURITY DEFINER` —
   `liquidacion_publicada(uuid)` y `persona_tiene_recibo_en(uuid)` — y cada política llama a
   la función en vez de consultar la otra tabla. **No las "simplifiques": existen para eso.**

3. **`empleado_crea_sus_observaciones`** ahora valida que el `recibo_id` pertenezca al
   empleado. Antes cualquiera podía atar una observación al recibo de un tercero.

4. **`subirConLimite` se detiene ante un fallo.** El plan tenía un comentario que prometía
   que al fallar una tarea no se arrancaban nuevas, y el código no lo cumplía: los demás
   trabajadores seguían subiendo después de que la promesa ya había rechazado. Se agregó una
   bandera compartida y un test que lo verifica. También rechaza `limite < 1`, que antes
   terminaba "con éxito" sin subir nada.

5. **Columna `activo` del padrón.** Un valor desconocido (`"Vigente"`, `"Alta"`, `"2"`) se
   interpretaba como `false` en silencio, dando de baja a un empleado activo sin avisar.
   Ahora genera un `ErrorFila` y la fila no se importa. El campo **vacío** sigue
   significando activo.

6. **Alfabeto de códigos de activación.** Se sacó la `V`: el código se dicta por teléfono y
   B/V son homófonas en español rioplatense.

7. **Fixture de CUIT del plan corregida.** El plan usaba `30-71234567-0`, que es inválido
   (el dígito verificador correcto es 1), y un texto de conformidad de 19 caracteres contra
   un mínimo de 20. Se corrigió la fixture del test, no la implementación.

8. **Numeración de línea del CSV.** La cabecera es la línea 1 y la primera fila de datos la
   2 — la numeración que ve el usuario al abrir el archivo.

9. **Script `tipos` de `package.json`** usa el project-id fijo, no `$SUPABASE_PROJECT_ID`:
   las variables de shell no expanden en Windows.

10. **Nombres en inglés que se dejan así a propósito:** `endpoint`, `p256dh`, `auth`,
    `user_agent`, `storage_path`. Son nombres del protocolo Web Push y de la API de Storage.
    La regla de "todo en español" aplica al dominio, no a protocolos ajenos.

11. ~~**Pendiente conocido (C5):** `src/app/page.tsx` era la página de ejemplo de
    `create-next-app`.~~ Resuelto en la Tarea 11: `page.tsx` ahora hace
    `redirect('/admin')` y el layout raíz quedó en castellano (`lang="es"`, metadata
    «Conforme»).

12. **Desvío de la Tarea 11: `middleware` → `proxy`.** Next.js 16 deprecó el archivo
    `middleware` y lo renombró a `proxy` (misma función y comportamiento; corre en runtime
    Node por defecto). El plan pedía `src/middleware.ts`; se creó `src/proxy.ts` con
    `export async function proxy`. Si se regenera el plan, no volver a `middleware.ts`.

13. **E2E: margen de 20 s en la aserción de `/admin`.** La primera visita compila la ruta
    en el dev server y Turbopack en frío tarda ~5 s, más que el timeout de 5 s de Playwright.
    No es un bug de la app.

14. **`sesion.ts` usa `getUser()`**, no `getClaims()`. La doc actual de Supabase ya
    recomienda `getClaims()` para proteger páginas, pero `getUser()` (que valida contra el
    servidor de Auth) es igual de seguro y es lo que pide el plan. Cambiar a `getClaims()`
    es una optimización opcional, no una corrección.

### Hallazgos menores diferidos

Para triaje en la revisión final, ninguno bloqueante:

- El flag `/i` del parser aplica a todo el nombre, no solo a la extensión.
- `datoFijo` y `legajo` aceptan ceros a la izquierda (`_00201_` → 201).
- Llamadas a función en las políticas RLS sin envolver en `(select …)` — afecta rendimiento
  con muchos recibos.
- Sin `revoke execute` sobre las funciones `SECURITY DEFINER`.
- `comprobante_seq` sin `owned by`; triggers de inmutabilidad no cubren `TRUNCATE`.
- `recibos.cuil_archivo` sin check de 11 dígitos (deliberado: guarda el valor crudo para
  auditar discrepancias).
- `escanear.ts`: `ignorados` guarda solo el nombre, no la ruta relativa; sin límite de
  profundidad ni detección de ciclos.
- CSV: campos entre comillas con salto de línea literal; `trim()` sobre campos citados; sin
  test de fila con menos campos que la cabecera.
- `puede_operar()` está definida y todavía sin uso (la usa la Fase 1B).
- **`importarPadron` pisa `email`/`telefono` de `personas` con `null`** si el CSV no trae
  esas columnas (upsert por `cuil`). Tango siempre exporta las mismas columnas, así que en
  la práctica no se pierde nada, pero un CSV recortado a mano sí borraría los contactos.
- `importarPadron` hace un round-trip por fila (upsert persona + insert/update legajo). Con
  padrones grandes conviene lotear. No bloquea a la escala esperada (decenas–cientos).
- El registro en `importaciones` guarda `errores: 0` siempre: la pantalla filtra las filas
  con error antes de confirmar, así que el Server Action nunca las ve.

---

## 6. Trampas conocidas

1. **Los PDFs de `Ejemplo Delta 6` tienen CUILes, nombres y sueldos de personas reales.**
   El `.gitignore` los excluye con `*.pdf` y `/Ejemplo*/`. **Antes de cada commit**, correr
   `git diff --cached --name-only` y confirmar que no entra ninguno. No se verificó si el
   repositorio de GitHub es público o privado.

2. **`create-next-app` puede pisar el `.gitignore`.** Si se vuelve a andamiar algo,
   verificar que sigan las reglas de PDFs.

3. **Windows.** Bash es Git Bash; PowerShell es 5.1 (sin `&&`, sin ternarios, sin `??`). Los
   scripts de npm no deben usar variables de shell.

4. **El test de integración corre contra el mismo proyecto Supabase que la aplicación.** No
   hay base separada. Su limpieza está acotada a los ids que él mismo crea, pero conviene
   tenerlo presente antes de correrlo contra datos reales.

5. **La carpeta configurable usa la File System Access API**, que solo existe en Chrome y
   Edge. El fallback de arrastrar y soltar es obligatorio, no opcional.

---

## 7. Infraestructura

| Servicio | URL | Estado verificado |
|---|---|---|
| GitHub | https://github.com/infosystuc-sys/recibos | Accesible; `origin` configurado; **vacío**, nada pusheado |
| Supabase | https://supabase.com/dashboard/project/twejfeghrujsqzzuzvtf | **Operativo** vía Personal Access Token (CLI + Management API). Org `uthumtopjpmokeguoiew`. Conector MCP: sigue sin conectar. |
| Vercel | https://vercel.com/infosystuc-4207s-projects/recibos | Equipo correcto (`team_Pgq151Al9nDgNFPO8prQAb78`, plan Hobby); el proyecto **todavía no existe** |

La CLI de Vercel no está instalada. `gh` tampoco.

---

## 8. Cómo continuar

El plan se venía ejecutando con la skill **`superpowers:subagent-driven-development`**: un
subagente implementador por tarea, una revisión por tarea, y ciclo de arreglos hasta que la
revisión queda limpia.

- El registro de avance vive en
  `.superpowers/sdd/2026-08-25-conforme-fase1a-admin-ingesta/progress.md`.
  **Está fuera del control de versiones** (`.gitignore` excluye `.superpowers/`), así que no
  viaja con el repositorio: por eso lo esencial está volcado en este documento.
- Para extraer el texto de una tarea del plan a un archivo de brief hay un script en esa
  misma carpeta: `extraer-brief.sh <plan> <numero> <destino>`. Es necesario porque el plan
  está en español y el script que trae la skill busca encabezados en inglés (`## Task N`).

**El próximo paso concreto** es la **Tarea 14** (códigos de activación). Ya están
`src/lib/codigo-activacion.ts` y su test; faltan los Steps 5-9: la Server Action
`generarCodigoActivacion` en `src/acciones/codigos.ts`, el listado de empleados
`src/app/admin/empleados/page.tsx` (con generación de códigos), el alta/edición manual
(`guardarEmpleado` en `src/acciones/padron.ts` + `src/app/admin/empleados/nuevo/page.tsx`).
Nota: la Tarea 13 ya creó `/admin/empleados/importar`; el link de nav "Importar padrón"
seguramente se reacomode bajo un "Empleados" cuando exista el listado.

Notas para retomar:

- Supabase se opera con `SUPABASE_ACCESS_TOKEN` (pedírselo al usuario o que autorice el
  conector MCP). Con eso: `npm run tipos` regenera tipos; para SQL suelto, la Management API
  `POST /v1/projects/twejfeghrujsqzzuzvtf/database/query`.
- Antes de tocar SQL nuevo, seguir el flujo imperativo de la skill de Supabase: iterar con
  `execute_sql` / Management API y recién al final generar el archivo de migración
  (`0006_publicar.sql` es de la Tarea 17).
- El `.superpowers/` local se perdió entre sesiones; este documento es la única fuente de
  avance. Si se quiere volver a `subagent-driven-development`, hay que regenerar los briefs.

## 9. Comandos

```bash
npm test                  # tests unitarios (78)
npm run test:integracion  # RLS (6) — cargar antes: set -a; . ./.env.local; set +a  (bash)
npm run test:e2e          # Playwright — 3 casos de ingreso, verdes. Misma carga de vars.
                          # Tareas 12 y 13 se verificaron con scripts ad-hoc (ya borrados),
                          # no hay E2E permanente para empresas/usuarios/padrón todavía.
npm run build             # build de producción
npm run dev               # servidor de desarrollo
npm run tipos             # regenerar tipos desde el esquema de Supabase
npx tsc --noEmit          # chequeo de tipos
```
