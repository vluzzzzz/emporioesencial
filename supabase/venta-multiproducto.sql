-- ============================================================================
--  ESENCIAL EMPORIO · Un pedido de delivery con varios productos
--  ----------------------------------------------------------------------------
--  Antes, el pedido del vendedor era un producto por venta: si el cliente se
--  llevaba tres cosas, eran tres pedidos sueltos y tres despachos cobrados.
--
--  Ahora el vendedor arma un solo pedido con todas las líneas, igual que la
--  caja. Este archivo habilita eso en la base:
--
--    · El pedido de delivery conserva su `ticket_id`, así el administrador lo
--      ve como una sola venta y lo aprueba o deniega completo.
--    · El despacho se sigue cobrando una sola vez (lo manda la primera línea).
--
--  Pégalo en Supabase → SQL Editor y dale Run. Es seguro correrlo dos veces.
--
--  OJO: si más adelante volvés a correr `venta-local.sql`, ese archivo vuelve
--  al sistema viejo y los pedidos con varios productos se separan. Después de
--  correrlo, volvé a correr ESTE archivo y `stock-inmediato.sql`.
-- ============================================================================

begin;


-- ── El disparador que lee precios y arma el total ───────────────────────────
--  Es el mismo de `venta-local.sql`, con un solo cambio: el delivery ya no
--  pierde el `ticket_id` al guardarse.
create or replace function public.venta_precios_del_catalogo()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  precio_real   int;
  despacho_real int;
begin
  if new.tipo is null or new.tipo not in ('delivery','local') then
    new.tipo := 'delivery';
  end if;

  -- Los precios se leen del catálogo solo al registrar. Releerlos en cada
  -- cambio haría que un precio que subió en el medio le moviera el total a
  -- una venta ya cobrada.
  if tg_op = 'INSERT' and not public.es_admin() then
    select t.price into precio_real
    from public.price_tiers t
    join public.products p on p.id = t.product_id
    where p.slug = new.producto_slug and t.qty = 1 and t.active
    limit 1;
    new.precio_unitario := coalesce(precio_real, new.precio_unitario);

    if new.tipo = 'delivery' then
      select c.costo into despacho_real
      from public.comunas c
      where c.nombre = new.comuna and c.activa
      limit 1;
      new.costo_despacho := coalesce(despacho_real, new.costo_despacho);
    end if;
  end if;

  if new.tipo = 'local' then
    -- Se lo lleva en la mano: no hay envío que cobrar ni comuna a la que ir.
    new.costo_despacho := 0;
    new.comuna := '';
    new.cliente_direccion := '';
  else
    -- El pedido a domicilio sí puede llevar varias líneas: el ticket las
    -- agrupa a la hora de mostrarlas y de aprobarlas.
    new.sucursal_id := null;
  end if;

  if tg_op = 'INSERT' then
    -- La venta local ya se cobró y ya se entregó en el mostrador, así que la
    -- comisión se acredita al instante. El pedido del vendedor, en cambio,
    -- sigue esperando que el administrador lo apruebe.
    if new.tipo = 'local' and (public.es_admin() or public.es_moderador()) then
      new.estado := 'aceptado';
    elsif not public.es_admin() then
      new.estado := 'pendiente';
    end if;
  end if;

  new.total    := new.cantidad * new.precio_unitario + new.costo_despacho;
  new.comision := new.cantidad * public.comision_por_unidad(new.precio_unitario);
  return new;
end $$;


commit;


-- ── Comprobación ────────────────────────────────────────────────────────────
--  Tiene que decir: disparador venta_precios SÍ
select
  case when exists (
         select 1 from pg_trigger
         where tgname = 'venta_precios' and not tgisinternal)
       then 'disparador venta_precios SÍ' else 'disparador venta_precios NO' end
  as instalado;

-- ============================================================================
--  LISTO. Desde ahora el vendedor puede registrar un pedido con varios
--  productos y el administrador lo ve (y lo aprueba) como una sola venta.
-- ============================================================================
