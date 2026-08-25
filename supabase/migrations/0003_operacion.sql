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
