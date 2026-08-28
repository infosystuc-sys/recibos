-- Límite de intentos para frenar fuerza bruta en login y activación del
-- empleado (spec §260). Sin estado en memoria: se cuenta contra esta tabla.

create table intentos (
  id         bigserial primary key,
  clave      text not null,
  created_at timestamptz not null default now()
);

comment on table intentos is
  'Registro efímero de intentos. `clave` es del estilo "activar:cuil:2027..." o "login:ip:1.2.3.4". Se purga por el cron.';

create index intentos_clave_idx on intentos (clave, created_at desc);

alter table intentos enable row level security;
-- Sin políticas: solo la clave de servicio la toca.

-- Registra un intento y devuelve cuántos hubo con esa clave en la ventana.
create or replace function registrar_intento(
  p_clave   text,
  p_ventana interval
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cuenta integer;
begin
  insert into intentos (clave) values (p_clave);
  select count(*) into v_cuenta
  from intentos
  where clave = p_clave and created_at > now() - p_ventana;
  return v_cuenta;
end;
$$;

revoke all on function registrar_intento(text, interval) from public, anon, authenticated;
