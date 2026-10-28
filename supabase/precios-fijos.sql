-- ============================================================================
--  ESENCIAL EMPORIO · Los precios de una venta los fija el catálogo
--  ----------------------------------------------------------------------------
--  En la web el vendedor ya no puede escribir el precio ni el despacho: los ve
--  pero no los toca. Esto lo asegura también en la base, por si alguien
--  manipula el formulario desde el navegador.
--
--  Al registrar una venta, el precio se toma del producto y el despacho de la
--  comuna, se venga lo que se venga desde la web. El total se recalcula.
--
--  Pégalo en Supabase → SQL Editor y dale Run. Es seguro correrlo dos veces.
-- ============================================================================

create or replace function public.venta_precios_del_catalogo()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  precio_real  int;
  despacho_real int;
begin
  -- Un administrador sí puede corregir una venta a mano.
  if public.es_admin() then
    new.total := new.cantidad * new.precio_unitario + new.costo_despacho;
    return new;
  end if;

  select t.price into precio_real
  from public.price_tiers t
  join public.products p on p.id = t.product_id
  where p.slug = new.producto_slug and t.qty = 1 and t.active
  limit 1;

  select c.costo into despacho_real
  from public.comunas c
  where c.nombre = new.comuna and c.activa
  limit 1;

  new.precio_unitario := coalesce(precio_real, new.precio_unitario);
  new.costo_despacho  := coalesce(despacho_real, new.costo_despacho);
  new.total := new.cantidad * new.precio_unitario + new.costo_despacho;
  return new;
end $$;

drop trigger if exists venta_precios on public.ventas;
create trigger venta_precios
  before insert or update on public.ventas
  for each row execute function public.venta_precios_del_catalogo();

-- ============================================================================
--  LISTO. De aquí en adelante, el precio de una venta sale siempre del
--  catálogo y el despacho de la tabla de comunas.
-- ============================================================================
