# Conforme — Distribución de recibos de sueldo con conformidad digital

**Diseño / Especificación** · 2026-08-25 · Estado: aprobado para planificación

---

## 1. Problema

Los recibos de sueldo se liquidan en **Tango Sueldos**, que exporta un PDF por empleado a una carpeta del disco. Hoy la entrega es manual: separar los archivos por legajo, hacerlos llegar a cada persona y juntar las firmas en papel. No hay trazabilidad de quién recibió qué ni cuándo, y la prueba de conformidad es un papel archivado.

## 2. Objetivo

Un sistema que tome esa carpeta tal como Tango la deja, publique cada recibo al empleado que corresponde, registre su conformidad con valor probatorio, y le muestre a la administración el estado de firmas en tiempo real.

## 3. Alcance

**Dentro:**

- Panel de administración web (multi-empresa) para importar el padrón, ingestar los PDFs desde una carpeta local, revisar y publicar liquidaciones, y seguir el estado de conformidad.
- Aplicación del empleado (web + PWA instalable en Android/iPhone) para ver, conformar y descargar sus recibos.
- Registro inmutable de conformidad con comprobante descargable.
- Avisos por email y push, con WhatsApp preparado pero inactivo.

**Fuera (explícitamente):**

- Liquidación de sueldos: la hace Tango. Este sistema solo distribuye su salida.
- Lectura del contenido de los PDFs. Toda la clasificación sale del nombre del archivo.
- Otros documentos que no sean recibos (prefijo `RS`).
- Firma digital con certificado (Ley 25.506) o firma dibujada en pantalla.
- Aplicación nativa publicada en Google Play.

## 4. Decisiones tomadas

| # | Decisión | Elegido |
|---|---|---|
| 1 | Cómo llegan los PDFs a la nube | Panel web + carpeta local recordada por el navegador (File System Access API) |
| 2 | Login del empleado | CUIL + clave propia, activada con código de un solo uso |
| 3 | Origen del padrón | Importación CSV/Excel exportado de Tango |
| 4 | Multi-empresa | Sí, varias empresas por CUIT |
| 5 | Conformidad | Tilde explícito + auditoría completa (hora de servidor, IP, dispositivo, hash del PDF) |
| 6 | Descarga | Ve el recibo online sin restricción; la descarga se habilita al conformar |
| 7 | Avisos | Email + push en fase 2; WhatsApp preparado, activable después |
| 8 | Android | PWA instalable, sin Play Store |
| 9 | Publicación | Manual y explícita, separada de la subida, por lote |
| 10 | Documentos | Solo recibos de sueldo (`RS`) |
| 11 | Escala objetivo | 100 a 500 empleados, varias empresas |
| 12 | Administradores | Varios usuarios con roles: `admin`, `operador`, `consulta` |
| 13 | CUIL en dos empresas | Una sola cuenta; ve los recibos de todas sus empresas |
| 14 | Desacuerdo del empleado | Conforma igual y deja una observación aparte, que llega al panel |
| 15 | Arquitectura | Una app Next.js en Vercel + Supabase (Auth, Postgres, Storage) |

## 5. Arquitectura

Una única aplicación **Next.js 16 (App Router, TypeScript)** desplegada en Vercel, con dos zonas de ruta:

- `/admin` — panel de administración.
- `/mi` — aplicación del empleado (PWA).

**Supabase** provee autenticación, Postgres y almacenamiento de archivos.

Reparto de responsabilidades:

- **Lecturas** — el cliente consulta Supabase directamente con la sesión del usuario. La visibilidad la garantiza **RLS en Postgres**, no el código de la aplicación.
- **Escrituras sensibles** (publicar un lote, registrar una conformidad, emitir un enlace de descarga, generar códigos de activación) — pasan por **Server Actions / Route Handlers** en Vercel que usan la clave de servicio. Esa clave nunca llega al navegador.
- **Archivos** — bucket privado. Cada descarga se sirve con una URL firmada de 60 segundos, emitida por el servidor después de verificar el derecho de acceso.

### Autenticación por CUIL sobre Supabase Auth

Supabase Auth exige un email. Los empleados entran con CUIL. Se resuelve con un **email sintético interno** derivado del CUIL normalizado (`27200129496@empleados.conforme.local`), invisible para el empleado: la pantalla de login pide CUIL, la aplicación traduce. Esto conserva Auth, RLS y JWT sin construir un sistema de sesiones propio.

El email real del empleado, cuando existe, vive en `personas.email` y se usa solo para notificaciones y recuperación opcional de clave — nunca como identificador de login.

### La carpeta configurable

Se usa la **File System Access API** (`showDirectoryPicker`). El administrador elige la carpeta una vez; el handle se persiste en IndexedDB y el permiso se re-valida al volver. En cada liquidación se re-escanea detectando novedades.

Disponible en Chrome y Edge sobre Windows, que es el entorno de administración. **Fallback obligatorio** para el resto de los navegadores: arrastrar y soltar archivos o una carpeta, con exactamente el mismo procesamiento posterior.

## 6. Modelo de datos

Postgres en Supabase. Todos los identificadores son `uuid` salvo donde se indique. Todas las tablas llevan `created_at timestamptz not null default now()`.

### `empresas`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `razon_social` | text | |
| `cuit` | char(11) | único, sin guiones |
| `nombre_corto` | text | el que se muestra en la interfaz |
| `texto_conformidad` | text | texto legal configurable por empresa |
| `logo_url` | text | opcional |
| `activa` | boolean | default true |

### `personas` — identidad del empleado

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `cuil` | char(11) | **único global**, sin guiones |
| `apellido_nombre` | text | |
| `email` | text | opcional, para avisos |
| `email_verificado` | boolean | default false |
| `telefono` | text | opcional |
| `auth_user_id` | uuid | único, nulo hasta que activa su cuenta |
| `estado` | enum | `pendiente` / `activo` / `bloqueado` |

Una persona por CUIL en todo el sistema. La importación siempre ocurre dentro de una empresa; si el CUIL ya existe, se reutiliza la persona y se le agrega el legajo, avisando al administrador.

### `legajos` — vínculo persona ↔ empresa

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `empresa_id` | uuid FK | |
| `persona_id` | uuid FK | |
| `numero` | integer | el legajo de Tango |
| `activo` | boolean | default true |
| `sector` | text | opcional |
| `fecha_ingreso` | date | opcional |

Restricción única: `(empresa_id, numero)`. Índice por `persona_id`.

### `codigos_activacion`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `persona_id` | uuid FK | |
| `codigo_hash` | text | hash del código; el texto plano se muestra una sola vez al generarlo |
| `motivo` | enum | `alta` / `reset` |
| `creado_por` | uuid FK admin | |
| `expira_at` | timestamptz | +30 días |
| `usado_at` | timestamptz | nulo mientras no se usa |

Un solo código activo por persona: generar uno nuevo invalida el anterior.

### `liquidaciones` — el lote

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `empresa_id` | uuid FK | |
| `periodo` | integer | `AAAAMM`, ej. `202604` |
| `tipo` | enum | `1QA` / `2QA` / `MEN` |
| `dato_fijo` | integer | número de liquidación de Tango, ej. `680` |
| `estado` | enum | `borrador` / `publicada` / `anulada` |
| `creada_por` / `publicada_por` | uuid FK admin | |
| `publicada_at` | timestamptz | |

Restricción única: `(empresa_id, periodo, tipo, dato_fijo)`.

### `recibos`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `liquidacion_id` | uuid FK | |
| `legajo_id` | uuid FK | |
| `version` | integer | default 1 |
| `storage_path` | text | ruta en el bucket |
| `nombre_original` | text | nombre del archivo tal como vino de Tango |
| `sha256` | char(64) | del contenido del PDF |
| `bytes` | integer | |
| `cuil_archivo` | char(11) | el CUIL leído del nombre, para auditar discrepancias |
| `estado` | enum | `vigente` / `reemplazado` |
| `subido_at` / `subido_por` | | |

Restricciones: única `(liquidacion_id, legajo_id, version)`; única parcial `(liquidacion_id, legajo_id) where estado = 'vigente'`.

### `conformidades` — **append-only**

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `recibo_id` | uuid FK | **único**: una conformidad por versión de recibo |
| `persona_id` | uuid FK | |
| `sha256_documento` | char(64) | copia del hash del PDF aceptado |
| `texto_legal` | text | copia íntegra del texto vigente al momento de firmar |
| `created_at` | timestamptz | hora del servidor, nunca del cliente |
| `ip` | inet | |
| `user_agent` | text | |
| `comprobante_codigo` | text | único, legible, ej. `CNF-2026-0001832` |

Un trigger `BEFORE UPDATE OR DELETE` lanza excepción. No hay política de RLS que permita modificarla desde ningún rol.

### `observaciones`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `recibo_id` / `persona_id` | uuid FK | |
| `texto` | text | del empleado |
| `estado` | enum | `abierta` / `resuelta` |
| `respuesta` | text | del administrador |
| `resuelta_por` / `resuelta_at` | | |

No bloquea la conformidad ni la descarga: es un canal de reclamo paralelo.

### `notificaciones` — cola

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `persona_id` | uuid FK | |
| `liquidacion_id` / `recibo_id` | uuid FK | nulos según el caso |
| `canal` | enum | `email` / `push` / `whatsapp` |
| `tipo` | enum | `publicacion` / `recordatorio` |
| `estado` | enum | `encolada` / `enviando` / `enviada` / `fallida` / `descartada` |
| `intentos` | integer | |
| `proximo_intento_at` | timestamptz | backoff exponencial |
| `proveedor_msg_id` / `error` | text | |

### `push_subscriptions`

`persona_id`, `endpoint` (único), `p256dh`, `auth`, `user_agent`, `last_seen_at`. Una persona puede tener varios dispositivos.

### `admin_usuarios`

`id` (= `auth.users.id`), `nombre`, `email`, `rol` (`admin` / `operador` / `consulta`), `activo`.

### `eventos_auditoria` — **append-only**

`id` bigserial, `actor_tipo` (`admin` / `empleado` / `sistema`), `actor_id`, `accion`, `entidad`, `entidad_id`, `detalle` jsonb, `ip`, `created_at`.

### `importaciones`

`empresa_id`, `nombre_archivo`, `filas_total`, `creados`, `actualizados`, `errores`, `resumen` jsonb, `creada_por`.

### Almacenamiento de archivos

Bucket **privado** `recibos`. Ruta:

```
{empresa_id}/{periodo}/{tipo}-{dato_fijo}/{legajo}-v{version}.pdf
```

Ejemplo: `a1b2.../202604/1QA-680/201-v1.pdf`

Sin acceso público en ninguna circunstancia. Toda lectura pasa por una URL firmada de 60 segundos emitida por el servidor.

## 7. Seguridad y RLS

RLS activa en **todas** las tablas, denegando por defecto. Políticas:

- **Empleado** (`auth.uid()` → `personas.auth_user_id`):
  - `SELECT` sobre `legajos` propios, y sobre `recibos` de liquidaciones **publicadas** que correspondan a esos legajos.
  - `SELECT` sobre sus `conformidades` y `observaciones`; `INSERT` de observaciones propias.
  - **Sin** `INSERT` directo de conformidades: se registran por Server Action para sellar hora, IP y hash del lado del servidor.
  - Sin acceso de ningún tipo a datos de otras personas.
- **Administradores** (existe fila activa en `admin_usuarios`):
  - `consulta`: solo `SELECT`.
  - `operador`: además importa padrón, sube archivos, publica liquidaciones, genera códigos de activación, responde observaciones.
  - `admin`: todo lo anterior más alta/baja de empresas y de usuarios administradores.
- **Nadie** puede `UPDATE` ni `DELETE` sobre `conformidades` ni `eventos_auditoria`.

Otras medidas:

- Clave de servicio de Supabase únicamente en variables de entorno del servidor de Vercel.
- Límite de intentos por IP y por CUIL en login y en activación, para impedir fuerza bruta sobre pares CUIL + código.
- Códigos de activación hasheados, de un solo uso, con vencimiento.
- Ningún CUIL ni dato personal en rutas ni en parámetros de URL.
- Cabeceras de seguridad estándar y CSP.

**Limitación conocida y aceptada:** el bloqueo de descarga previo a la conformidad es funcional, no criptográfico. Un usuario técnico puede extraer el PDF que está visualizando. Blindarlo exigiría rasterizar cada recibo, y se descarta por desproporcionado.

## 8. Flujo de ingesta y publicación

### 8.1 Parseo del nombre

```
^RS_(\d{6})_(1QA|2QA|MEN)_(\d+)_(\d+)_(\d{2}-\d{8}-\d)\.pdf$
```

Grupos: `periodo`, `tipo`, `dato_fijo`, `legajo`, `cuil`. Sin distinguir mayúsculas. El CUIL se normaliza a 11 dígitos sin guiones. Todo archivo que no cumpla el patrón se descarta del recuento principal y queda listado aparte como "ignorado".

### 8.2 Pasos

1. **Elegir empresa** — el nombre del archivo no dice a qué empresa pertenece; lo define la carpeta que se está importando.
2. **Conectar carpeta** — una sola vez; queda recordada.
3. **Escanear** — recorrido recursivo, filtrado por el patrón.
4. **Agrupar** en lotes por `(periodo, tipo, dato_fijo)`.
5. **Cotejar contra el padrón**, con estos diagnósticos:
   - `LEGAJO_INEXISTENTE` — bloqueante.
   - `CUIL_NO_COINCIDE` — el legajo existe pero con otro CUIL. **Bloqueante y prioritario**: es el error más caro posible (entregarle a una persona el recibo de otra).
   - `EMPLEADO_INACTIVO` — advertencia.
   - `FALTA_EN_LOTE` — legajo activo del padrón sin recibo en este lote. Advertencia.
   - `DUPLICADO_EN_LOTE` — bloqueante.
   - `YA_SUBIDO` — mismo SHA-256 ya presente. Se saltea, no es error.
   - `REEMPLAZO` — mismo legajo y liquidación con hash distinto. Se ofrece publicar como versión nueva.
6. **Subir** — el SHA-256 se calcula en el navegador antes de subir. Concurrencia de 5, reintentos con backoff, progreso visible, reanudable tras un corte. Idempotente: re-escanear no duplica.
7. **Revisar** — el lote queda en `borrador`, invisible para los empleados. Los diagnósticos bloqueantes deben resolverse (crear el empleado, corregir el padrón o excluir el archivo) antes de habilitar la publicación.
8. **Publicar** — en una transacción: `liquidaciones.estado = 'publicada'`, los recibos pasan a ser visibles, y se encolan las notificaciones.

### 8.3 Corrección de un recibo ya publicado

Subir un archivo distinto para el mismo legajo y liquidación crea la **versión v2**. La v1 pasa a `reemplazado` y conserva intacta su conformidad. Al empleado le aparece "recibo corregido — requiere nueva conformidad". **Nunca se sobrescribe ni se borra un documento ya firmado.**

## 9. Padrón e importación

Importación de CSV/Excel exportado de Tango, con mapeo de columnas configurable (mínimo: legajo, CUIL, apellido y nombre; opcional: email, teléfono, sector, fecha de ingreso, activo).

Vista previa obligatoria antes de confirmar: cuántos se crean, cuántos se actualizan, cuántos quedan igual, cuántas filas tienen error y por qué. Los legajos activos en el sistema que no vengan en el archivo se listan como posibles bajas, pero **no** se dan de baja automáticamente.

Cada importación queda registrada en `importaciones` con su resumen.

También hay ABM manual de empleados para correcciones puntuales.

## 10. Flujo del empleado

**Activación:** CUIL + código de activación → define clave (mínimo 8 caracteres) → sesión iniciada. Luego se le ofrece instalar la app en la pantalla de inicio, con instrucciones ilustradas según Android o iPhone.

**Inicio:** recibos agrupados por período, el más reciente primero, con estado visible: *Pendiente de conformidad* (destacado), *Conformado el DD/MM*, *Corregido — requiere nueva conformidad*. Si tiene legajos en más de una empresa, se muestran separados por empresa.

**Ver el recibo:** visor PDF embebido (pdf.js) con zoom, servido por URL firmada. Botón de descarga visible pero deshabilitado con la leyenda "Disponible al prestar conformidad".

**Conformar:** pantalla dedicada con el texto legal completo de la empresa, período y liquidación identificados, tilde explícito y botón de confirmación.

**Después de conformar:** descarga habilitada de forma permanente, más el comprobante de conformidad descargable. Historial completo sin vencimiento.

**Observación:** en cualquier momento puede dejar un reclamo escrito sobre un recibo. No afecta la conformidad ni la descarga; llega al panel destacado.

**Clave olvidada:** circuito principal — el administrador genera un código nuevo desde el panel (queda auditado quién y cuándo). Si la persona tiene email verificado, además puede autogestionarlo.

## 11. Conformidad y auditoría

Al conformar, la Server Action registra del lado del servidor:

- hora del servidor en `America/Argentina/Buenos_Aires` (nunca la del dispositivo);
- **SHA-256 del PDF exacto** aceptado, que prueba *qué documento* se firmó;
- IP, dispositivo y navegador;
- copia íntegra del texto legal vigente en ese momento.

Validaciones: el recibo debe pertenecer a un legajo de esa persona, la liquidación debe estar publicada, la versión debe ser la vigente, y no debe existir ya una conformidad para esa versión.

**Comprobante:** PDF descargable con empresa, empleado, legajo, período, liquidación, hash del documento, fecha y hora, dispositivo e identificador único de comprobante.

**Panel de seguimiento:** por liquidación, porcentaje conformado, lista filtrable de pendientes, acción "recordar a los pendientes", exportación a Excel y a PDF del conjunto de constancias.

**Nota legal:** este diseño define el mecanismo de prueba, no dictamina su validez jurídica. El texto de conformidad debe ser validado por el contador o estudio jurídico del cliente; por eso es configurable por empresa.

## 12. Notificaciones

Cola en base de datos con reintentos y backoff exponencial; nunca envío directo sin registro.

- **Email** — Resend, con dominio propio verificado (SPF/DKIM). 3.000 mensajes gratuitos por mes, suficiente para la escala objetivo.
- **Push** — Web Push con VAPID y service worker de la PWA. Sin costo. En iPhone requiere que el empleado haya agregado la app a la pantalla de inicio.
- **WhatsApp** — interfaz `CanalNotificacion` implementada con un adaptador inactivo. El canal aparece en el panel deshabilitado, indicando qué falta configurar. Se activa por variables de entorno cuando exista la cuenta de Meta Business, sin modificar el resto del sistema.

Recordatorios automáticos a los pendientes a los 3 y a los 7 días (configurable), mediante tarea programada de Vercel Cron, que también procesa reintentos.

## 13. Roles

| Acción | `consulta` | `operador` | `admin` |
|---|---|---|---|
| Ver liquidaciones y estado de firmas | Sí | Sí | Sí |
| Exportar constancias | Sí | Sí | Sí |
| Importar padrón / ABM empleados | — | Sí | Sí |
| Escanear y subir recibos | — | Sí | Sí |
| Publicar liquidación | — | Sí | Sí |
| Generar códigos de activación | — | Sí | Sí |
| Responder observaciones | — | Sí | Sí |
| Alta/baja de empresas | — | — | Sí |
| Alta/baja de usuarios administradores | — | — | Sí |

**Primer administrador:** se crea con una migración/semilla inicial (no hay registro abierto de administradores). A partir de ahí, los usuarios `admin` invitan al resto.

**Empleado dado de baja:** conserva el acceso a su historial completo de recibos y constancias. `legajos.activo = false` solo lo excluye de los cotejos y de los avisos de nuevas liquidaciones; nunca le quita lo ya publicado. Para cortar el acceso se usa `personas.estado = 'bloqueado'`, que es una acción explícita y auditada.

## 14. Interfaz e identidad

**Nombre:** Conforme.

**Estética:** sobria y de tono institucional. Tipografía neutra de alta legibilidad, fondo claro con un acento azul profundo, uso generoso del espacio en blanco, sin ilustraciones decorativas. Se trata de información salarial y de un registro con efectos legales: la interfaz debe transmitir seriedad.

**Del lado del empleado:** tipografía de mayor tamaño, objetivos táctiles amplios, jerarquía visual clara y una sola acción principal por pantalla. Muchos accederán desde un celular, en el trabajo y con poco tiempo.

Modo oscuro incluido en ambas zonas.

**Stack de interfaz:** Tailwind CSS + shadcn/ui, pdf.js para el visor, service worker con Serwist para la PWA.

## 15. Estrategia de pruebas

Concentrada donde el error tiene consecuencias reales:

- **Parser de nombres** — casos límite tomados de los archivos reales: legajo `1` frente a `201`, CUIL con y sin guiones, prefijos distintos de `RS`, nombres malformados, extensiones en mayúsculas.
- **Cotejo contra padrón** — cada diagnóstico del punto 8.2, en particular `CUIL_NO_COINCIDE`.
- **Idempotencia** — escanear y subir dos veces no duplica ni altera nada.
- **Aislamiento (RLS)** — pruebas que intentan activamente leer recibos de otra persona, de otra empresa y de liquidaciones en borrador, y verifican que la base los rechaza.
- **Reglas de conformidad** — no se puede firmar dos veces la misma versión, no se puede descargar sin firmar, no se puede alterar ni borrar una constancia, la v2 exige conformidad nueva.
- **Recorrido completo** con Playwright: importar padrón → escanear → publicar → el empleado activa su cuenta, conforma y descarga.

## 16. Entrega por fases

**Fase 1 — Núcleo funcional**
Empresas y usuarios administradores con roles · importación de padrón · conexión de carpeta, escaneo, cotejo, subida · revisión y publicación de lotes · activación y login del empleado · ver, conformar y descargar · comprobante de conformidad · tablero de pendientes y exportaciones. Sin notificaciones: el aviso se hace por los canales actuales.

**Fase 2 — Avisos y reclamos**
Email con Resend · push y PWA instalable · recordatorios automáticos · observaciones del empleado y su gestión.

**Fase 3 — Opcional**
WhatsApp (requiere cuenta de Meta Business) · recuperación de clave por email autogestionada · métricas de adopción.

## 17. Riesgos y dependencias externas

| Riesgo / dependencia | Tratamiento |
|---|---|
| Texto de conformidad sin validación jurídica | Configurable por empresa; debe validarlo el contador o estudio del cliente antes de producción |
| File System Access API solo en Chrome/Edge | Fallback de arrastrar y soltar con idéntico procesamiento |
| Bloqueo de descarga no criptográfico | Limitación aceptada y documentada |
| Email a dominio propio (SPF/DKIM) | Trámite de DNS previo a la fase 2 |
| WhatsApp requiere cuenta Meta verificada | Aislado en fase 3 tras una interfaz de canal |
| Push en iPhone requiere instalar la PWA | Se guía la instalación en el primer ingreso; el email cubre a quien no instale |
| Storage de Supabase (1 GB en plan gratuito) | Aprox. 22.000 recibos de 45 KB; suficiente para la escala objetivo con margen de años |

## 18. Configuración

Variables de entorno:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY              # solo servidor
EMPLEADO_EMAIL_DOMAIN                  # dominio del email sintético de login
RESEND_API_KEY                         # fase 2
EMAIL_FROM                             # fase 2
VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY   # fase 2
CRON_SECRET                            # protege el endpoint de tareas programadas
WHATSAPP_*                             # fase 3, ausentes = canal deshabilitado
```
