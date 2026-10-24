-- ============================================================================
--  ESENCIAL EMPORIO · Pasar las rutas de imagen a .webp
--  ----------------------------------------------------------------------------
--  Las fotos del repositorio se convirtieron a WebP (pesan 73% menos). Los
--  productos que ya están cargados siguen apuntando a los archivos viejos
--  (.jpeg / .png), que ya no existen, así que se ven rotos.
--
--  Esto reescribe la extensión en los productos y en las categorías. Solo
--  toca las rutas de images/emporio-images: las fotos que subiste desde la
--  web ya son WebP y viven en Supabase Storage, no se tocan.
--
--  Pegalo en Supabase → SQL Editor y dale Run. Es seguro correrlo dos veces.
-- ============================================================================

-- ── Imagen principal del producto ───────────────────────────────────────────
update public.products
set image = regexp_replace(image, '^(images/emporio-images/[0-9.]+)\.(jpeg|jpg|png)$', '\1.webp')
where image ~ '^images/emporio-images/[0-9.]+\.(jpeg|jpg|png)$';

-- ── Galería (arreglo de rutas) ──────────────────────────────────────────────
update public.products p
set gallery = sub.nueva
from (
  select id, array_agg(
           regexp_replace(foto, '^(images/emporio-images/[0-9.]+)\.(jpeg|jpg|png)$', '\1.webp')
           order by orden
         ) as nueva
  from public.products, unnest(gallery) with ordinality as g(foto, orden)
  group by id
) as sub
where p.id = sub.id and p.gallery is not null and array_length(p.gallery, 1) > 0;

-- ── Imágenes del hero ───────────────────────────────────────────────────────
update public.products
set hero_image = regexp_replace(hero_image, '^(images/emporio-images/[0-9.]+)\.(jpeg|jpg|png)$', '\1.webp')
where hero_image ~ '^images/emporio-images/[0-9.]+\.(jpeg|jpg|png)$';

update public.products
set featured_image = regexp_replace(featured_image, '^(images/emporio-images/[0-9.]+)\.(jpeg|jpg|png)$', '\1.webp')
where featured_image ~ '^images/emporio-images/[0-9.]+\.(jpeg|jpg|png)$';

-- ── Banners y categorías guardados en site_config ───────────────────────────
update public.site_config
set value = replace(replace(replace(value::text, '.jpeg"', '.webp"'), '.jpg"', '.webp"'), '.png"', '.webp"')::jsonb
where key in ('banners', 'categorias', 'categorias_arbol')
  and value::text ~ 'emporio-images/[0-9.]+\.(jpeg|jpg|png)';

-- ============================================================================
--  LISTO. Recargá la tienda con Ctrl+F5 y las fotos vuelven a verse.
-- ============================================================================
