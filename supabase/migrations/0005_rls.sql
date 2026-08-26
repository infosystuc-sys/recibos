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

-- Rompen la recursión mutua entre las políticas de recibos y liquidaciones:
-- una función SECURITY DEFINER corre como dueño de las tablas y no reaplica RLS.
-- La política de `liquidaciones` necesita saber si la persona tiene un recibo
-- en esa liquidación (lo que exige leer `recibos`), y la política de `recibos`
-- necesita saber si su liquidación está publicada (lo que exige leer
-- `liquidaciones`). Si cada política consulta la tabla del otro directamente,
-- Postgres evalúa una política dentro de la otra en un ciclo y corta con
-- «infinite recursion detected in policy for relation». Envolver cada
-- consulta en una función SECURITY DEFINER evita el ciclo porque la función
-- corre con los privilegios de su dueño y RLS no se le vuelve a aplicar.
-- No lo reemplaces por un `exists` directo entre las dos tablas: es lo que
-- causaba la recursión.
create or replace function liquidacion_publicada(p_liquidacion uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from liquidaciones q
    where q.id = p_liquidacion and q.estado = 'publicada'
  );
$$;

create or replace function persona_tiene_recibo_en(p_liquidacion uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from recibos r
    join legajos l on l.id = r.legajo_id
    where r.liquidacion_id = p_liquidacion and l.persona_id = persona_actual()
  );
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
-- Usa persona_tiene_recibo_en() en lugar de un exists directo sobre `recibos`
-- para no generar recursión con la política de esa tabla (ver comentario arriba).
create policy empleado_lee_sus_liquidaciones on liquidaciones
  for select to authenticated using (
    estado = 'publicada' and persona_tiene_recibo_en(liquidaciones.id)
  );

-- Solo recibos propios de liquidaciones publicadas.
-- El exists sobre `legajos` no genera recursión (esa tabla no consulta
-- `recibos` en su política) y se deja tal cual. La condición sobre la
-- liquidación pasa por liquidacion_publicada() en lugar de un exists directo
-- sobre `liquidaciones`, por la misma razón que arriba.
create policy empleado_lee_sus_recibos on recibos
  for select to authenticated using (
    exists (
      select 1 from legajos l
      where l.id = recibos.legajo_id and l.persona_id = persona_actual()
    )
    and liquidacion_publicada(recibos.liquidacion_id)
  );

create policy empleado_lee_sus_conformidades on conformidades
  for select to authenticated using (persona_id = persona_actual());

create policy empleado_lee_sus_observaciones on observaciones
  for select to authenticated using (persona_id = persona_actual());

-- El with check exige, además de que la observación quede a nombre de la
-- propia persona, que el recibo referenciado sea realmente suyo: si no,
-- un empleado podría atar un reclamo al recibo de un tercero.
create policy empleado_crea_sus_observaciones on observaciones
  for insert to authenticated with check (
    persona_id = (select persona_actual())
    and exists (
      select 1 from recibos r
      join legajos l on l.id = r.legajo_id
      where r.id = observaciones.recibo_id and l.persona_id = (select persona_actual())
    )
  );

create policy empleado_gestiona_sus_push on push_subscriptions
  for all to authenticated
  using (persona_id = persona_actual())
  with check (persona_id = persona_actual());

-- Deliberadamente NO existe política de INSERT sobre conformidades:
-- se registran por Server Action con la clave de servicio, que es la única
-- forma de sellar hora, IP y hash del lado del servidor.
