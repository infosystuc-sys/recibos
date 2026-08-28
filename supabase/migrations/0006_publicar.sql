-- Publica una liquidación en una sola transacción:
-- marca como reemplazados los recibos anteriores del mismo legajo,
-- deja vigente la última versión y cambia el estado del lote.

create or replace function publicar_liquidacion(
  p_liquidacion uuid,
  p_admin uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_estado estado_liquidacion;
  v_publicados integer;
begin
  select estado into v_estado
  from liquidaciones where id = p_liquidacion
  for update;

  if v_estado is null then
    raise exception 'La liquidación no existe';
  end if;

  if v_estado = 'publicada' then
    raise exception 'La liquidación ya está publicada';
  end if;

  -- Deja una sola versión vigente por legajo: la más alta.
  update recibos r
  set estado = 'reemplazado'
  where r.liquidacion_id = p_liquidacion
    and r.estado = 'vigente'
    and r.version < (
      select max(r2.version) from recibos r2
      where r2.liquidacion_id = r.liquidacion_id and r2.legajo_id = r.legajo_id
    );

  update liquidaciones
  set estado = 'publicada',
      publicada_at = now(),
      publicada_por = p_admin
  where id = p_liquidacion;

  select count(*) into v_publicados
  from recibos
  where liquidacion_id = p_liquidacion and estado = 'vigente';

  return v_publicados;
end;
$$;

revoke all on function publicar_liquidacion(uuid, uuid) from public, anon, authenticated;
