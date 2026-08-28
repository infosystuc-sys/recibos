# Conforme — Estado del proyecto y cómo continuar

> **Documento de traspaso.** Si estás retomando este proyecto en una conversación nueva, leé
> esto primero y después el spec. Última actualización: 2026-08-28, commit `abd55e3`.
> **Fase 1A completa (falta solo Vercel). Fase 1B en curso — ver §4.**

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
| Rama principal | `main` — la de trabajo `fase1a-admin-ingesta` se mergeó por fast-forward. Fase 1B se commitea directo en `main`. |
| HEAD | `abd55e3` |
| Commits | 47 (más el `4e4a815` de base). Pusheados hasta `1bcfd56`; los de Fase 1B (`8eb669e`…`abd55e3`) **sin pushear**. |
| Tests | **78 unitarios** + **13 de integración** (6 RLS + 4 publicación + 3 conformidad) + **3 E2E** de ingreso, todos verdes |
| TypeScript | `npx tsc --noEmit` limpio, modo estricto |
| Build | `npm run build` verde |
| GitHub | **`main` pusheado** a `infosystuc-sys/recibos` |
| Vercel | **pendiente** — ya existe un proyecto llamado `recibos` (no visible en el team vía MCP; ver §7) |
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

**Base de datos** (`supabase/migrations/`) — los seis archivos **ya se aplicaron y
verificaron** en `twejfeghrujsqzzuzvtf` (ver §3):

- `0001_esquema_base.sql` — empresas, personas, legajos, admin_usuarios, codigos_activacion
- `0002_liquidaciones.sql` — liquidaciones, recibos, conformidades (inmutables), observaciones
- `0003_operacion.sql` — notificaciones, push_subscriptions, eventos_auditoria, importaciones
- `0004_storage.sql` — bucket privado `recibos`
- `0005_rls.sql` — funciones auxiliares y 21 políticas RLS
- `0006_publicar.sql` — función `publicar_liquidacion(uuid, uuid)`, transaccional

**Clientes de Supabase** (`src/lib/supabase/`) — `tipos.ts` generado del esquema,
`cliente-navegador.ts` / `cliente-servidor.ts` / `cliente-servicio.ts`.

**Autenticación admin** — `src/lib/sesion.ts` (`obtenerAdmin` / `exigirAdmin`),
`src/proxy.ts`, `src/acciones/sesion.ts`, pantalla `/ingresar`, layout e inicio de `/admin`.

**ABM admin** — `src/lib/auditoria.ts`, `src/acciones/empresas.ts`,
`src/acciones/administradores.ts`, pantallas `/admin/empresas`, `/admin/empresas/nueva`,
`/admin/usuarios`. Nav del layout condicionada por rol.

**Importación de padrón** — `src/acciones/padron.ts` (`importarPadron`), pantalla
`/admin/empleados/importar` (vista previa + errores + posibles bajas).

**Empleados y códigos** — `src/acciones/codigos.ts` (`generarCodigoActivacion`),
`guardarEmpleado` en `padron.ts`, listado `/admin/empleados` (filtros + buscador + generar
código) y ABM manual `/admin/empleados/nuevo`.

**Carpeta local** — `src/lib/carpeta/handle-persistido.ts` (IndexedDB por empresa) y
`src/componentes/selector-carpeta.tsx` (todavía sin usar: lo consume la pantalla de ingesta
de la Tarea 17).

**Subida** — `src/acciones/subida.ts` (`prepararSubida`: liquidación borrador + URLs
firmadas) y `src/lib/subida/subir-a-storage.ts` (`hashDeArchivo`, `subirArchivoFirmado` con
reintentos).

**Ingesta y publicación** — `src/acciones/liquidaciones.ts` (`datosCotejo`,
`registrarRecibos`, `publicarLiquidacion`) y las pantallas `/admin/liquidaciones` (listado),
`/admin/liquidaciones/ingesta` (flujo de 6 pasos) y `/admin/liquidaciones/[id]` (detalle +
Publicar). `selector-carpeta` ganó una tercera vía: `<input webkitdirectory>`.

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

Del plan de 18 tareas, están completas **la 1 a la 17**. Falta solo la **18** (despliegue).

| Tarea | Qué falta | Depende de |
|---|---|---|
| ~~10~~ | ✅ Hecha. `tipos.ts` + `cliente-navegador/servidor/servicio.ts` (`c63bda4`) | — |
| ~~11~~ | ✅ Hecha. `sesion.ts`, `proxy.ts` (ver desvío abajo), ingreso, layout `/admin`, semilla, E2E verde (`4cb0a24`, `c552815`) | — |
| ~~12~~ | ✅ Hecha. `auditoria.ts`, `acciones/empresas.ts`, `acciones/administradores.ts`, pantallas `/admin/empresas` y `/admin/usuarios`, nav por rol. Verificada end-to-end (`f9f1199`) | — |
| ~~13~~ | ✅ Hecha. `acciones/padron.ts` (`importarPadron`), pantalla `/admin/empleados/importar` con vista previa. Verificada end-to-end (`ce3154d`) | — |
| ~~14~~ | ✅ Hecha. `acciones/codigos.ts`, `guardarEmpleado`, listado `/admin/empleados` con filtros + generación de códigos, ABM manual `/admin/empleados/nuevo`. Verificada end-to-end (`a1a979d`) | — |
| ~~15~~ | ✅ Hecha. `carpeta/handle-persistido.ts` (IndexedDB), `componentes/selector-carpeta.tsx` (FS Access API + fallback de arrastre), `tipos/file-system-access.d.ts`. Verificada contra la carpeta real (`cc34697`) | — |
| ~~16~~ | ✅ Hecha. `acciones/subida.ts` (`prepararSubida`), `lib/subida/subir-a-storage.ts` (hash + subida firmada con reintentos). Round-trip de Storage verificado (`9b93be4`) | — |
| ~~17~~ | ✅ Hecha. `0006_publicar.sql` (aplicada), `acciones/liquidaciones.ts`, pantallas `/admin/liquidaciones/{,ingesta,[id]}`. Flujo completo verificado end-to-end (`328906e`) | — |
| 18 | **Solo Vercel.** README y push a `main` hechos. Falta: resolver el proyecto `recibos` que ya existe fuera del team, cargar las 4 variables en los 3 entornos, y verificar (redirección, login, grep de `service_role` = 0). Ver §7. | — |

### Fase 1B — portal del empleado (en curso, sin plan formal)

Se empezó a construir directamente contra el spec (`§10`, `§11`). Hecho y verificado
end-to-end contra Supabase real:

| Parte | Archivos | Commit |
|---|---|---|
| Activación (CUIL + código → clave ≥8) y login por CUIL | `acciones/activacion.ts`, `acciones/sesion-empleado.ts`, `lib/sesion-empleado.ts`, `/activar`, `/mi/ingresar`, `proxy.ts` (protege `/mi`) | `8eb669e` |
| Listado `/mi`, visor con iframe + URL firmada, conformidad con auditoría completa (hora, SHA-256 del PDF exacto, IP, UA, copia del texto legal), descarga gateada, comprobante PDF (`pdf-lib`) | `acciones/recibos-empleado.ts`, `/mi/(privado)/**` | `46dd731` |
| Tablero de conformidad en `/admin/liquidaciones/[id]` (% conformado, pendientes, export CSV) | `[id]/page.tsx`, `[id]/seguimiento.csv/route.ts` | `ece84b6` |
| Test de inmutabilidad de conformidades | `tests/integracion/conformidad.test.ts` | `abd55e3` |

`/` pasó a ser una landing («Soy empleado» / «Administración»).

**Falta de la Fase 1B / Fase 2:**

- **Rate limiting** en login y activación (spec §260). No implementado.
- «Recordar a los pendientes» y **PDF combinado de constancias** (necesitan el canal de
  notificaciones → Fase 2).
- **PWA instalable** + push (Fase 2).
- **Observaciones** del empleado (spec las pone en Fase 2).
- El label «Corregido — requiere nueva conformidad» es aproximado (usa `version > 1`); no
  distingue si la v1 llegó a conformarse.

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
- **`codigos_activacion` sigue sin política RLS de lectura** (la Tarea 14 lo confirmó como
  deliberado). El listado de empleados consulta el estado "código vigente" con
  `clienteServicio()` desde el Server Component, después de `exigirAdmin`. Si en algún
  momento se agrega `admin_lee_codigos ... using (es_admin())`, ese caso puede volver a
  `clienteServidor()`.
- `guardarEmpleado` usa `z.coerce.boolean()` para `activo`: el checkbox del form manda
  `activo=si` cuando está tildado y nada cuando no. `Boolean("si")`=true,
  `Boolean(undefined)`=false. **No cambiar el `value` del checkbox a `"false"`**: cualquier
  string no vacío coerciona a `true`.
- **`entorno.ts` entra entero al bundle de cliente** porque `cliente-navegador.ts` importa
  `leerEntornoPublico` de ahí, y eso arrastra `esquemaServidor` con el string
  `"SUPABASE_SERVICE_ROLE_KEY"` (el **nombre**, no el valor). No filtra nada sensible; la
  clave de servicio no aparece en el JS de cliente (verificado). Si molesta, separar en
  `entorno-publico.ts` / `entorno-servidor.ts`.
- `registrarRecibos` (Tarea 17) baja la versión vigente anterior de cada legajo antes de
  insertar la nueva. `publicar_liquidacion` repite ese `update` como red de seguridad: bajo
  el índice `recibo_vigente_unico` nunca puede haber dos vigentes, así que en la práctica
  ese `update` de la función es un no-op. No lo saques: cubre inserciones hechas por fuera
  de `registrarRecibos`.
- La política `empleado_lee_sus_recibos` **no filtra `estado`**: un empleado ve también las
  versiones `reemplazado` de sus recibos. La Fase 1B lo resuelve **filtrando `estado` en las
  consultas** (`/mi`, viewer, conformar) — la política sigue permisiva a propósito para que
  el histórico de conformidades que apunta a una v1 reemplazada siga resolviendo.
- **Tests que crean conformidades no se pueden limpiar** con la clave de servicio (el trigger
  de inmutabilidad rechaza el DELETE). `conformidad.test.ts` usa un fixture permanente de
  ids fijos. Para borrar residuo de test a mano:
  `alter table conformidades disable trigger conformidades_inmutables; delete …; alter table conformidades enable trigger conformidades_inmutables;`
  vía Management API (corre como `postgres`).
- `activarCuenta` e `ingresarEmpleado` devuelven `{ error, cuil, codigo }` en el estado
  porque **React 19 resetea el form tras cada submit** (incluso fallido); sin eso, el
  empleado pierde lo tipeado al equivocarse una vez. Los forms de admin tienen el mismo
  patrón latente pero sus flujos no lo exponen.

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
| GitHub | https://github.com/infosystuc-sys/recibos | **`main` pusheado** (41 commits). `origin` configurado y trackeando. |
| Supabase | https://supabase.com/dashboard/project/twejfeghrujsqzzuzvtf | **Operativo** vía Personal Access Token (CLI + Management API). Org `uthumtopjpmokeguoiew`. Conector MCP: sigue sin conectar. |
| Vercel | https://vercel.com/infosystuc-4207s-projects/recibos | Team `team_Pgq151Al9nDgNFPO8prQAb78` (plan Hobby). **`create_git_project` devolvió 409 "recibos already exists"**, pero `list_projects`/`get_project` del team no lo ven → el proyecto existe en otra cuenta (probablemente la personal del usuario autenticado en el conector MCP de Vercel). Hay que resolverlo desde el panel. |

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

**Lo que falta de la Tarea 18** (todo en Vercel; el código y el push ya están):

1. **Resolver el proyecto `recibos` en Vercel.** Ya existe uno con ese nombre pero no está
   en el team `infosystuc-4207's projects`. Desde el panel: o moverlo al team, o borrarlo y
   reimportarlo, o crear el del team con otro nombre. Debe quedar linkeado a
   `infosystuc-sys/recibos`, rama de producción `main`.
2. **Cargar 4 variables** en Production, Preview y Development:
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY` (sin `NEXT_PUBLIC_`), `EMPLEADO_EMAIL_DOMAIN`.
   Los valores están en `.env.local` local.
3. **Verificar el deploy:** `/admin` redirige a `/ingresar`; login con
   `taroriva5199@gmail.com` funciona; el listado de empresas carga; y en el JS servido
   **no aparece `service_role`** (0 coincidencias — ya verificado sobre el build local).

**Después del deploy**, la Fase 1B sigue con: rate limiting en login/activación, y de ahí a
la Fase 2 (notificaciones con Resend, PWA + push, observaciones del empleado, recordatorios
por Vercel Cron). El hardening diferido de la Fase 1A (§5) es opcional y se puede intercalar.

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
