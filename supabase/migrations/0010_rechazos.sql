-- Rechazo del empleado a un recibo. Espejo de `conformidades`: solo inserción,
-- inmutable, una fila por recibo. Conformar y rechazar son excluyentes (lo
-- garantiza la Server Action, no el esquema).

create table rechazos (
  id         uuid primary key default gen_random_uuid(),
  recibo_id  uuid not null unique references recibos (id) on delete restrict,
  persona_id uuid not null references personas (id) on delete restrict,
  motivo     text not null,
  ip         inet,
  user_agent text,
  created_at timestamptz not null default now(),
  constraint motivo_no_vacio check (length(btrim(motivo)) >= 3)
);

comment on table rechazos is
  'Rechazo del empleado a la versión vigente de un recibo. Solo inserción; un trigger impide UPDATE y DELETE.';

create index rechazos_persona_idx on rechazos (persona_id);

create trigger rechazos_inmutables
  before update or delete on rechazos
  for each row execute function impedir_modificacion();

create trigger rechazos_inmutables_truncate
  before truncate on rechazos
  for each statement execute function impedir_modificacion();

alter table rechazos enable row level security;

create policy admin_lee_rechazos on rechazos
  for select to authenticated using ((select es_admin()));

create policy empleado_lee_sus_rechazos on rechazos
  for select to authenticated using (persona_id = (select persona_actual()));

-- Sin política de INSERT: los rechazos se registran por Server Action con la
-- clave de servicio, que sella hora e IP del lado del servidor.
