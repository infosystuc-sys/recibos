# Conforme — Estado del proyecto y cómo continuar

> **Documento de traspaso.** Si estás retomando este proyecto en una conversación nueva, leé
> esto primero y después el spec. Última actualización: 2026-08-27, commit `8e6c83b`.

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
| HEAD | `8e6c83b` |
| Commits en la rama | 22 |
| Tests | **78 pasando**, 14 archivos |
| TypeScript | `npx tsc --noEmit` limpio, modo estricto |
| Sin subir | La rama **no** se pusheó a GitHub todavía |

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

**Base de datos** (`supabase/migrations/`) — los cinco archivos están escritos y revisados,
pero **NUNCA SE EJECUTARON**:

- `0001_esquema_base.sql` — empresas, personas, legajos, admin_usuarios, codigos_activacion
- `0002_liquidaciones.sql` — liquidaciones, recibos, conformidades (inmutables), observaciones
- `0003_operacion.sql` — notificaciones, push_subscriptions, eventos_auditoria, importaciones
- `0004_storage.sql` — bucket privado `recibos`
- `0005_rls.sql` — funciones auxiliares y 21 políticas RLS

**Verificación contra datos reales:** el parser reconoce los 28 PDFs de
`D:\APP\RECIBOS\Ejemplo Delta 6` sin ignorar ninguno.

```bash
npx tsx scripts/verificar-carpeta-ejemplo.ts "D:/APP/RECIBOS/Ejemplo Delta 6"
```

---

## 3. EL BLOQUEO — leer antes de intentar continuar

**El conector MCP de Supabase no tiene permiso sobre el proyecto `twejfeghrujsqzzuzvtf`.**
Está autenticado con la cuenta `tango.puntohogar@gmail.com` (organización
`qfitoytticndeccbeutq`), que no es dueña de ese proyecto.

Consecuencia: **las migraciones nunca se aplicaron y no existen los tipos generados**
(`src/lib/supabase/tipos.ts`). Todo lo que falta depende de eso.

### Cómo destrabar

**Opción A — autorizar el conector** con la cuenta dueña de `twejfeghrujsqzzuzvtf`.
Es la más cómoda: permite aplicar migraciones, generar tipos y consultar el esquema.

**Opción B — manual**, sin depender del conector:

1. Panel de Supabase → SQL Editor → pegar y ejecutar **en orden** los cinco archivos de
   `supabase/migrations/`.
2. Generar los tipos:
   ```bash
   npx supabase login
   npx supabase gen types typescript --project-id twejfeghrujsqzzuzvtf > src/lib/supabase/tipos.ts
   ```
3. Copiar `.env.local.example` a `.env.local` y completar las tres claves desde
   Settings → API. **Las claves nunca se pegan en el chat ni se commitean.**

### Al aplicar por primera vez, verificar esto

El SQL está revisado por dos pasadas pero nunca se ejecutó. Los puntos que solo se ven al
correrlo:

| Qué | Comando |
|---|---|
| Las 13 tablas existen | `select table_name from information_schema.tables where table_schema='public' order by 1;` |
| RLS activa en las 13 | `select relname, relrowsecurity from pg_class where relnamespace='public'::regnamespace and relkind='r' order by 1;` |
| **La recursión de RLS está rota** (solo se ve en ejecución) | Con un JWT de empleado: `select id from recibos;` — no debe dar «infinite recursion detected in policy» |
| Las 6 funciones son SECURITY DEFINER | `select proname, prosecdef, provolatile, proconfig from pg_proc where pronamespace='public'::regnamespace and proname in ('es_admin','puede_operar','es_admin_pleno','persona_actual','liquidacion_publicada','persona_tiene_recibo_en');` |
| El bucket es privado | `select id, public, file_size_limit from storage.buckets where id='recibos';` |
| Inmutabilidad de conformidades | El bloque `do $$ … $$` del Step 3 de la Tarea 7 del plan |
| `0004_storage.sql` puede escribir en `storage.buckets` | Si da `permission denied`, crear el bucket desde el panel con `public = false` |

Después, correr el test de aislamiento:

```bash
npm install -D dotenv-cli
npx dotenv -e .env.local -- npm run test:integracion
```

---

## 4. Qué falta

Del plan de 18 tareas, están completas la 1 a la 9. De las tareas 10 a 16 se extrajeron y
completaron **solo los módulos de lógica pura** (los Steps 1 a 4 de cada una). Falta:

| Tarea | Qué falta | Depende de |
|---|---|---|
| 10 | Steps 5-8: los tres clientes de Supabase y `src/lib/supabase/tipos.ts` | Tipos generados |
| 11 | Steps 5-12: `sesion.ts`, `middleware.ts`, pantalla de ingreso, layout de `/admin`, semilla del primer admin, E2E | Tarea 10 |
| 12 | Steps 5-11: Server Actions de empresas, `auditoria.ts`, pantallas, gestión de usuarios administradores | Tarea 11 |
| 13 | Steps 5-8: Server Action `importarPadron` y pantalla de importación | Tarea 11 |
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

11. **Pendiente conocido (C5):** `src/app/page.tsx` sigue siendo la página de ejemplo de
    `create-next-app`. La Tarea 11 debe reemplazarla por una redirección a `/admin`.

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
| Supabase | https://supabase.com/dashboard/project/twejfeghrujsqzzuzvtf | **Sin permiso** desde el conector MCP |
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

**El próximo paso concreto**, una vez destrabado Supabase, es la **Tarea 10, Steps 5 a 8**:
generar `src/lib/supabase/tipos.ts` y crear los tres clientes
(`cliente-navegador.ts`, `cliente-servidor.ts`, `cliente-servicio.ts`). A partir de ahí, la
Tarea 11 desbloquea todo el resto.

## 9. Comandos

```bash
npm test                  # tests unitarios (78)
npm run test:integracion  # RLS — necesita .env.local y el esquema aplicado
npm run test:e2e          # Playwright — necesita la Tarea 11
npm run build             # build de producción
npm run dev               # servidor de desarrollo
npm run tipos             # regenerar tipos desde el esquema de Supabase
npx tsc --noEmit          # chequeo de tipos
```
