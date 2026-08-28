-- Índices sobre las FK que sí se filtran en consultas reales, y la última
-- política que reevaluaba auth.uid() por fila.

create index if not exists notificaciones_persona_idx     on notificaciones (persona_id);
create index if not exists notificaciones_liquidacion_idx on notificaciones (liquidacion_id);
create index if not exists notificaciones_recibo_idx      on notificaciones (recibo_id);
create index if not exists observaciones_recibo_idx       on observaciones (recibo_id);
create index if not exists observaciones_persona_idx      on observaciones (persona_id);
create index if not exists importaciones_empresa_idx      on importaciones (empresa_id);

drop policy admin_lee_su_ficha on admin_usuarios;
create policy admin_lee_su_ficha on admin_usuarios
  for select to authenticated
  using (id = (select auth.uid()) or (select es_admin_pleno()));
