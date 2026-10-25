-- ============================================================================
--  ESENCIAL EMPORIO · El stock se descuenta solo
--  ----------------------------------------------------------------------------
--  Qué hace:
--   1. Cuando el administrador ACEPTA un pedido, le resta las unidades
--      vendidas al producto. Si después lo deniega o lo elimina, se las
--      devuelve.
--   2. Cuando el stock llega a 0, el producto queda AGOTADO solo. Si le
--      cargás unidades de nuevo, vuelve a la venta solo.
--
--  Los productos sin stock cargado (en blanco) no llevan inventario: nunca
--  se tocan ni se agotan.
--
--  Pegalo en Supabase → SQL Editor y dale Run. Es seguro correrlo dos veces.
-- ============================================================================


-- ── 1 · Agotado automático al llegar a cero ─────────────────────────────────
create or replace function public.producto_stock_a_disponible()
returns trigger language plpgsql as $$
begin
  if new.stock_qty is not null then
    new.in_stock := new.stock_qty > 0;
  end if;
  return new;
end $$;

drop trigger if exists producto_stock on public.products;
create trigger producto_stock
  before insert or update of stock_qty on public.products
  for each row execute function public.producto_stock_a_disponible();

-- Pone al día lo que ya estaba cargado.
update public.products
set in_stock = stock_qty > 0
where stock_qty is not null and in_stock is distinct from (stock_qty > 0);


-- ── 2 · Mover unidades de un producto ───────────────────────────────────────
--  Un número negativo descuenta, uno positivo devuelve. Nunca baja de cero.
create or replace function public.mover_stock(p_id uuid, p_slug text, delta int)
returns void language plpgsql security definer set search_path = public as $$
begin
  if delta = 0 then return; end if;
  update public.products
  set stock_qty = greatest(0, stock_qty + delta)
  where stock_qty is not null
    and ( (p_id is not null and id = p_id) or (p_id is null and slug = p_slug) );
end $$;


-- ── 3 · El pedido aceptado descuenta; el resto devuelve ─────────────────────
create or replace function public.venta_ajusta_stock()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  antes  int := 0;  -- unidades que el pedido ya tenía descontadas
  ahora  int := 0;  -- unidades que tiene que tener descontadas
begin
  if tg_op in ('UPDATE','DELETE') and old.estado = 'aceptado' then
    antes := coalesce(old.cantidad, 0);
  end if;
  if tg_op in ('INSERT','UPDATE') and new.estado = 'aceptado' then
    ahora := coalesce(new.cantidad, 0);
  end if;

  -- Si cambió de producto, se le devuelve al viejo y se le descuenta al nuevo.
  if tg_op = 'UPDATE' and antes > 0
     and ( old.producto_id is distinct from new.producto_id
        or old.producto_slug is distinct from new.producto_slug ) then
    perform public.mover_stock(old.producto_id, old.producto_slug, antes);
    antes := 0;
  end if;

  if tg_op = 'DELETE' then
    perform public.mover_stock(old.producto_id, old.producto_slug, antes);
    return old;
  end if;

  perform public.mover_stock(new.producto_id, new.producto_slug, antes - ahora);
  return new;
end $$;

drop trigger if exists venta_stock on public.ventas;
create trigger venta_stock
  after insert or update or delete on public.ventas
  for each row execute function public.venta_ajusta_stock();

-- ============================================================================
--  LISTO. Cargá las unidades de cada producto desde Editar → el producto, y
--  de ahí en más la cuenta se mantiene sola.
-- ============================================================================
