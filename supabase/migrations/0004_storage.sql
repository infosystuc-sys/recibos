-- Conforme — bucket privado de recibos.
-- Sin políticas para anon ni authenticated: TODO el acceso pasa por el
-- servidor con la clave de servicio, que emite URLs firmadas de 60 segundos.
-- Un bucket sin políticas es un bucket al que nadie llega desde el navegador.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('recibos', 'recibos', false, 10485760, array['application/pdf'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
