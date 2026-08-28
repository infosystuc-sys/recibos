-- Hardening de la Fase 1A/1B (hallazgos diferidos de docs/ESTADO.md §5).
-- No cambia el modelo de acceso: lo endurece y lo hace más rápido.

-- 1) search_path fijo en las funciones trigger (function_search_path_mutable).
create or replace function tocar_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function impedir_modificacion()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception
    'La tabla % es de solo inserción: no se puede % una fila.',
    tg_table_name, lower(tg_op);
end;
$$;

-- 2) Los triggers de inmutabilidad también cubren TRUNCATE.
create trigger conformidades_inmutables_truncate
  before truncate on conformidades
  for each statement execute function impedir_modificacion();

create trigger auditoria_inmutable_truncate
  before truncate on eventos_auditoria
  for each statement execute function impedir_modificacion();

-- 3) La secuencia del comprobante pertenece a su columna.
alter sequence comprobante_seq owned by conformidades.comprobante_codigo;

-- 4) Las funciones SECURITY DEFINER no las ejecuta `anon` (siguen disponibles
--    para `authenticated`, que las necesita al evaluar las políticas RLS).
revoke execute on function es_admin() from anon, public;
revoke execute on function puede_operar() from anon, public;
revoke execute on function es_admin_pleno() from anon, public;
revoke execute on function persona_actual() from anon, public;
revoke execute on function liquidacion_publicada(uuid) from anon, public;
revoke execute on function persona_tiene_recibo_en(uuid) from anon, public;
grant execute on function es_admin() to authenticated;
grant execute on function puede_operar() to authenticated;
grant execute on function es_admin_pleno() to authenticated;
grant execute on function persona_actual() to authenticated;
grant execute on function liquidacion_publicada(uuid) to authenticated;
grant execute on function persona_tiene_recibo_en(uuid) to authenticated;

-- 5) Políticas del empleado: envolver las llamadas a función en (select …)
--    para que el planner las evalúe una vez por consulta (auth_rls_initplan),
--    y que `recibos` solo devuelva la versión vigente.
drop policy empleado_lee_sus_legajos on legajos;
create policy empleado_lee_sus_legajos on legajos
  for select to authenticated using (persona_id = (select persona_actual()));

drop policy empleado_lee_su_persona on personas;
create policy empleado_lee_su_persona on personas
  for select to authenticated using (id = (select persona_actual()));

drop policy empleado_lee_sus_empresas on empresas;
create policy empleado_lee_sus_empresas on empresas
  for select to authenticated using (
    exists (
      select 1 from legajos l
      where l.empresa_id = empresas.id and l.persona_id = (select persona_actual())
    )
  );

drop policy empleado_lee_sus_liquidaciones on liquidaciones;
create policy empleado_lee_sus_liquidaciones on liquidaciones
  for select to authenticated using (
    estado = 'publicada' and (select persona_tiene_recibo_en(liquidaciones.id))
  );

drop policy empleado_lee_sus_recibos on recibos;
create policy empleado_lee_sus_recibos on recibos
  for select to authenticated using (
    estado = 'vigente'
    and exists (
      select 1 from legajos l
      where l.id = recibos.legajo_id and l.persona_id = (select persona_actual())
    )
    and (select liquidacion_publicada(recibos.liquidacion_id))
  );

drop policy empleado_lee_sus_conformidades on conformidades;
create policy empleado_lee_sus_conformidades on conformidades
  for select to authenticated using (persona_id = (select persona_actual()));

drop policy empleado_lee_sus_observaciones on observaciones;
create policy empleado_lee_sus_observaciones on observaciones
  for select to authenticated using (persona_id = (select persona_actual()));

drop policy empleado_gestiona_sus_push on push_subscriptions;
create policy empleado_gestiona_sus_push on push_subscriptions
  for all to authenticated
  using (persona_id = (select persona_actual()))
  with check (persona_id = (select persona_actual()));
