-- Ruta de la imagen de cada carta en el bucket privado Images.
--
-- Solo ~20.800 de las 95.000 cartas tienen imagen (el resto queda NULL): el
-- release de imágenes no cubre el catálogo completo, y no se reconstruye la
-- ruta a partir del nombre porque no siempre coincide con el archivo real.
-- La columna la llena ingesta/emparejar_imagenes.py, emparejando por
-- coincidencia de sufijo contra storage.objects. Ver ese script para el detalle.
--
-- El bucket es privado: esta columna solo guarda la ruta, no una URL. La ruta
-- sin firmar no sirve para nada sin pasar por el servidor, que la firma con
-- la clave secreta antes de mandarla al navegador.

alter table public.cartas
  add column imagen_path text
    check (imagen_path is null or imagen_path like idioma || '/%');
