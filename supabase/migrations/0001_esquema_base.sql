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
