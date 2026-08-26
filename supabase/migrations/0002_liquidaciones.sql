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
  -- No exige lo contrario (que anulada/borrador tengan publicada_at nulo):
  -- una liquidación publicada y luego anulada conserva su publicada_at
  -- original como evidencia de cuándo se publicó de verdad.
  constraint publicada_coherente check (estado <> 'publicada' or publicada_at is not null)
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
