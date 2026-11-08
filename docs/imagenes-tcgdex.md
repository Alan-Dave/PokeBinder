# Imágenes del catálogo desde TCGdex (PBI-x2)

Solo ~22 % de las cartas tiene imagen en el bucket `Images`: es lo que trae el
zip del release `images` que sube `ingesta/subir_imagenes.py`. Para el resto el
catálogo pide una miniatura a TCGdex, sin guardar nada en Supabase.

## Cómo se decide qué imagen se muestra

Componente `components/ImagenCarta.tsx`, en este orden:

1. La imagen firmada del bucket, si la carta tiene `imagen_path`.
2. La miniatura de `/api/cartas/{id}/imagen-hd?tam=min`, que sale de TCGdex.
3. El texto "Sin imagen", si ninguna carga.

TCGdex tampoco tiene imagen para todo (por ejemplo, la promo `cel25cc-CC008`
responde la carta sin campo `image`). Esas cartas siguen sin imagen: la única
forma de cubrirlas es sumar otra fuente al bucket.

## La ruta `/api/cartas/{id}/imagen-hd`

| Parámetro | Valores | Resultado |
|---|---|---|
| (sin `tam`) o `tam=hd` | imagen grande (`high.webp`, ~65 KB) | 200 / 404 |
| `tam=min` | miniatura (`low.webp`, ~18 KB) | 200 / 404 |
| otro valor | lista cerrada, validada con zod | 400 |

- El navegador manda solo el id numérico y el tamaño; nunca una URL (regla 4).
- Cada tamaño tiene su propia entrada en la caché temporal del servidor.
- La respuesta lleva `Cache-Control: public, max-age=86400`: una carta ya vista
  no vuelve a pedirse en un día.

## Límite de peticiones (hallazgo F2 de `qa-seguridad.md`)

La ruta no exige sesión, así que cualquiera podía provocar descargas a TCGdex.
Ahora hay un límite de 240 peticiones por minuto por IP (`lib/limite-peticiones.ts`):
una página del catálogo pide hasta 30 miniaturas, de modo que alcanza para
navegar con normalidad. Al pasarse responde `429` con `Retry-After`.

**Alcance real:** la cuenta vive en la memoria del proceso. En Vercel cada
instancia lleva la suya, así que es una defensa parcial; un límite en el borde
de la plataforma sigue siendo lo ideal. La IP se toma de `x-forwarded-for`,
válida detrás de Vercel o Azure App Service; sin esa cabecera todos comparten
una sola cuenta.

## Dependencia externa

La app consulta TCGdex mientras el visitante navega: si TCGdex cae o se
demora, las miniaturas no aparecen (el resto del catálogo funciona). El host
está fijo en el código, no se siguen redirecciones y hay tiempo y tamaño
máximos.
