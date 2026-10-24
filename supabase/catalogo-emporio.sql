-- ============================================================================
--  ESENCIAL EMPORIO · Carga del catálogo (23 productos)
--  ----------------------------------------------------------------------------
--  Corré primero supabase/setup-emporio.sql. Después pegá esto en
--  Supabase → SQL Editor y dale Run.
--
--  Sube los 23 productos que hoy están escritos en js/sd.js a la base, para
--  que puedas editarlos desde /admin: nombre, precio, descripción, fotos y
--  características. Las imágenes apuntan a los archivos del repositorio.
--
--  Es seguro correrlo varias veces: actualiza lo que ya existe y no duplica.
-- ============================================================================

insert into public.products
  (slug, name, category, description, image, features, gallery, position, image_scale, in_stock)
values
  ('soplador-bateria', 'Soplador / Ventilador a Batería 18V', 'herramientas', 'Soplador inalámbrico potente de 18V. Ideal para limpieza y secado. Incluye batería y cargador.', 'images/emporio-images/1.jpeg', array['Batería 18V','Inalámbrico','Incluye cargador','Alto rendimiento']::text[], array[]::text[], 1, 0.85, true),
  ('set-cocina-silicona', 'Set de Cocina de Silicona 12 Piezas', 'cocina', 'Set completo de utensilios de cocina de silicona con mango de madera. Resistentes al calor y antiadherentes.', 'images/emporio-images/2.jpeg', array['12 piezas','Silicona apta para alimentos','Mango de madera','Incluye soporte']::text[], array[]::text[], 2, 0.85, true),
  ('calentador-cera', 'Calentador de Cera Profesional', 'belleza', 'Calentador de cera profesional para todo tipo de ceras. Incluye contenedor de aluminio y control de temperatura.', 'images/emporio-images/3.jpeg', array['Uso profesional','Control de temperatura','Contenedor de aluminio','Tapa transparente']::text[], array[]::text[], 3, 0.85, true),
  ('limpiavidrios-telescopico', 'Limpiavidrios Telescópico', 'limpieza', 'Limpiavidrios telescópico extensible de 21 a 86 cm. Mango antideslizante y correa de seguridad.', 'images/emporio-images/4.jpeg', array['Extensible 21–86 cm','Mango antideslizante','Correa de seguridad','Liviano']::text[], array[]::text[], 4, 0.85, true),
  ('botella-sorbete-colocolo', 'Botella con Sorbete Colo-Colo', 'cocina', 'Botella de hidratación Colo-Colo con sorbete y tapa con cierre. Libre de BPA.', 'images/emporio-images/5.jpeg', array['Diseño Colo-Colo','Con sorbete','Tapa con cierre','Libre de BPA']::text[], array[]::text[], 5, 0.85, true),
  ('bolsa-reutilizable-colocolo', 'Bolsa Reutilizable Colo-Colo', 'hogar', 'Bolsa reutilizable resistente con diseño Colo-Colo. Asas reforzadas para el día a día.', 'images/emporio-images/6.jpeg', array['Reutilizable','Resistente','Diseño Colo-Colo','Asas reforzadas']::text[], array[]::text[], 6, 0.85, true),
  ('mug-termico-colocolo', 'Mug Térmico Colo-Colo', 'cocina', 'Mug térmico de acero inoxidable que mantiene la temperatura. Diseño Colo-Colo Eterno Campeón.', 'images/emporio-images/7.jpeg', array['Mantiene la temperatura','Acero inoxidable','Diseño Colo-Colo','Tapa segura']::text[], array[]::text[], 7, 0.85, true),
  ('cojin-cuello-colocolo', 'Cojín de Cuello Colo-Colo', 'hogar', 'Cojín de cuello cómodo para viajes y descanso, con diseño Colo-Colo.', 'images/emporio-images/8.jpeg', array['Cómodo','Para viajes','Diseño Colo-Colo','Suave al tacto']::text[], array[]::text[], 8, 0.85, true),
  ('jarro-cerveza-colocolo', 'Jarro de Cerveza Colo-Colo', 'cocina', 'Jarro de vidrio resistente de gran capacidad con diseño Colo-Colo Eterno Campeón.', 'images/emporio-images/9.jpeg', array['Vidrio resistente','Gran capacidad','Diseño Colo-Colo','Asa firme']::text[], array[]::text[], 9, 0.85, true),
  ('tabla-picar-colocolo', 'Tabla de Picar de Madera Colo-Colo', 'cocina', 'Tabla de picar de madera con grabado Colo-Colo y colgador de cuero. Resistente para el uso diario.', 'images/emporio-images/10.jpeg', array['Madera resistente','Grabado Colo-Colo','Uso diario','Con colgador']::text[], array['images/emporio-images/10.2.png','images/emporio-images/10.3.png','images/emporio-images/10.4.png']::text[], 10, 0.85, true),
  ('schopero-colocolo', 'Schopero 500 ml Colo-Colo', 'cocina', 'Schopero de vidrio de 500 ml con asa y diseño Colo-Colo. Ideal para la previa.', 'images/emporio-images/11.jpeg', array['500 ml','Vidrio resistente','Diseño Colo-Colo','Asa cómoda']::text[], array[]::text[], 11, 0.85, true),
  ('mug-rosado-colocolo', 'Mug 1200 ml Colo-Colo Campeonas', 'cocina', 'Mug de 1200 ml con bombilla y asa, edición Campeonas. Libre de BPA.', 'images/emporio-images/12.jpeg', array['1200 ml','Con bombilla','Libre de BPA','Edición Campeonas']::text[], array[]::text[], 12, 0.85, true),
  ('cojin-escudo-colocolo', 'Cojín Escudo Colo-Colo', 'hogar', 'Cojín decorativo con forma de escudo Colo-Colo. Suave y resistente.', 'images/emporio-images/13.jpeg', array['Forma de escudo','Suave','Diseño Colo-Colo','Decorativo']::text[], array[]::text[], 13, 0.85, true),
  ('set-tazones-colocolo', 'Set 4 Tazones Cerámica Colo-Colo', 'cocina', 'Set de 4 tazones de cerámica de 400 ml con soporte, diseño Colo-Colo.', 'images/emporio-images/14.jpeg', array['4 tazones','Cerámica 400 ml','Con soporte','Diseño Colo-Colo']::text[], array[]::text[], 14, 0.85, true),
  ('llavero-colocolo', 'Llavero Colo-Colo', 'accesorios', 'Llavero metálico resistente con diseño Colo-Colo. Compacto y elegante.', 'images/emporio-images/15.jpeg', array['Diseño Colo-Colo','Resistente','Compacto','Metálico']::text[], array[]::text[], 15, 0.85, true),
  ('vaso-sorbete-colocolo', 'Vaso con Sorbete y Tapa Colo-Colo', 'cocina', 'Vaso con tapa y sorbete, diseño Colo-Colo. Reutilizable y práctico.', 'images/emporio-images/16.jpeg', array['Con sorbete','Tapa con cierre','Diseño Colo-Colo','Reutilizable']::text[], array[]::text[], 16, 0.85, true),
  ('set-vaso-destapador-colocolo', 'Set Vaso de Cerveza + Destapador Colo-Colo', 'cocina', 'Set de regalo con vaso de cerveza y destapador, diseño Colo-Colo.', 'images/emporio-images/17.jpeg', array['Vaso de cerveza','Incluye destapador','Set de regalo','Diseño Colo-Colo']::text[], array[]::text[], 17, 0.85, true),
  ('billetera-colocolo', 'Billetera Colo-Colo', 'accesorios', 'Billetera de material PU con varios compartimentos y diseño Colo-Colo. Incluye caja de regalo.', 'images/emporio-images/18.jpeg', array['Material PU','Varios compartimentos','Diseño Colo-Colo','Caja de regalo']::text[], array[]::text[], 18, 0.85, true),
  ('vaso-schopero-campeon-colocolo', 'Vaso Schopero Campeón Colo-Colo', 'cocina', 'Vaso schopero de vidrio resistente con diseño "Campeón hay uno solo" Colo-Colo.', 'images/emporio-images/19.jpeg', array['Vidrio resistente','Campeón hay uno solo','Diseño Colo-Colo','Gran capacidad']::text[], array[]::text[], 19, 0.85, true),
  ('shaker-colocolo', 'Botella Shaker Deportiva Colo-Colo', 'cocina', 'Botella deportiva tipo shaker con tapa hermética y asa, diseño Colo-Colo.', 'images/emporio-images/20.jpeg', array['Botella deportiva','Tapa hermética','Diseño Colo-Colo','Con asa']::text[], array[]::text[], 20, 0.85, true),
  ('schopero-frozen-colocolo', 'Schopero Frozen Colo-Colo', 'cocina', 'Schopero congelable con gel interior que mantiene tu bebida fría. Diseño Colo-Colo.', 'images/emporio-images/21.jpeg', array['Se congela','Mantiene frío','Diseño Colo-Colo','Gel interior']::text[], array[]::text[], 21, 0.85, true),
  ('gorro-colocolo', 'Gorro Bucket Colo-Colo', 'accesorios', 'Gorro bucket de algodón con bordado Colo-Colo. Talla única.', 'images/emporio-images/22.jpeg', array['Gorro bucket','Bordado Colo-Colo','Talla única','Algodón']::text[], array[]::text[], 22, 0.85, true),
  ('adorno-escudo-colocolo', 'Adorno Escudo Colo-Colo Eterno Campeón', 'hogar', 'Adorno decorativo del escudo Colo-Colo en 3D, Eterno Campeón. Base estable para repisa o escritorio.', 'images/emporio-images/23.jpeg', array['Escudo 3D','Eterno Campeón','Decorativo','Base estable']::text[], array['images/emporio-images/23.1.jpeg']::text[], 23, 0.85, true)
on conflict (slug) do update set
  name        = excluded.name,
  category    = excluded.category,
  description = excluded.description,
  image       = excluded.image,
  features    = excluded.features,
  gallery     = excluded.gallery,
  position    = excluded.position;

-- Precio de cada producto (un tramo de 1 unidad)
insert into public.price_tiers (product_id, qty, price, active)
select p.id, v.qty, v.price, true
from (values
  ('soplador-bateria', 1, 29990),
  ('set-cocina-silicona', 1, 10000),
  ('calentador-cera', 1, 12990),
  ('limpiavidrios-telescopico', 1, 4990),
  ('botella-sorbete-colocolo', 1, 7990),
  ('bolsa-reutilizable-colocolo', 1, 3990),
  ('mug-termico-colocolo', 1, 8990),
  ('cojin-cuello-colocolo', 1, 9990),
  ('jarro-cerveza-colocolo', 1, 7490),
  ('tabla-picar-colocolo', 1, 11990),
  ('schopero-colocolo', 1, 6990),
  ('mug-rosado-colocolo', 1, 14990),
  ('cojin-escudo-colocolo', 1, 10990),
  ('set-tazones-colocolo', 1, 15990),
  ('llavero-colocolo', 1, 2990),
  ('vaso-sorbete-colocolo', 1, 5990),
  ('set-vaso-destapador-colocolo', 1, 12990),
  ('billetera-colocolo', 1, 9990),
  ('vaso-schopero-campeon-colocolo', 1, 6490),
  ('shaker-colocolo', 1, 10990),
  ('schopero-frozen-colocolo', 1, 9990),
  ('gorro-colocolo', 1, 8990),
  ('adorno-escudo-colocolo', 1, 13990)
) as v(slug, qty, price)
join public.products p on p.slug = v.slug
on conflict (product_id, qty) do update set
  price  = excluded.price,
  active = true;

-- ============================================================================
--  LISTO. Entrá a /admin → Catálogo y vas a ver los 23 productos para editar.
-- ============================================================================
