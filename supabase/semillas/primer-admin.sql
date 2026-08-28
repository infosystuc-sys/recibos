-- Alta del primer administrador de Conforme.
-- 1) Crear el usuario en el panel de Supabase: Authentication → Users → Add user
--    (email real, contraseña, "Auto Confirm User" tildado).
-- 2) Copiar el UUID del usuario y reemplazarlo abajo.
-- 3) Ejecutar este script en el SQL Editor.

insert into admin_usuarios (id, nombre, email, rol, activo)
values (
  '00000000-0000-0000-0000-000000000000',  -- ← reemplazar por el UUID real
  'Nombre Apellido',
  'admin@ejemplo.com',
  'admin',
  true
)
on conflict (id) do update
  set rol = 'admin', activo = true;
