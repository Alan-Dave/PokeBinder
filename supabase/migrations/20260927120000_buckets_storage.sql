-- Buckets de Supabase Storage, creados antes desde el panel.
--
-- Esta migración deja su configuración versionada: si el proyecto se recrea,
-- los buckets quedan idénticos. Es idempotente; sobre un proyecto donde ya
-- existen, lleva sus valores a los de este archivo.
--
--   * Images: imágenes del catálogo, una carpeta por idioma
--     (en, es, fr, ja, pt, zh). Cada imagen pesa ~15 KB; 1 MiB deja margen.
--   * Assets: íconos, música y efectos de sonido de la interfaz.
--
-- Los tipos MIME se restringen en el servidor. SVG queda fuera a propósito:
-- puede llevar JavaScript incrustado (XSS almacenado).
--
-- Acceso: ambos buckets son privados y storage.objects no tiene políticas para
-- ellos. Con la clave anónima o de usuario no se lee, sube, reemplaza ni borra
-- nada. Solo service_role, desde el servidor o los scripts de ingesta, opera
-- sobre los archivos; el navegador recibe URLs firmadas con vencimiento.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('Images', 'Images', false, 1048576, array['image/webp']),
  ('Assets', 'Assets', false, 5242880, array['image/x-icon', 'audio/wav', 'audio/mpeg'])
on conflict (id) do update set
  public             = excluded.public,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
