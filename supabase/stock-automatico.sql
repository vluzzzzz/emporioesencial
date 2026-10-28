-- ============================================================================
--  ESENCIAL EMPORIO · El stock se descuenta solo
--  ----------------------------------------------------------------------------
--  Qué hace:
--   1. Cuando el administrador ACEPTA un pedido, le resta las unidades
--      vendidas al producto. Si después lo deniega o lo elimina, se las
--      devuelve.
--   2. Cuando el stock llega a 0, el producto queda AGOTADO solo. Si le
--      cargas unidades de nuevo, vuelve a la venta solo.
--
--  Los productos sin stock cargado (en blanco) no llevan inventario: nunca
--  se tocan ni se agotan.
--
--  Pégalo en Supabase → SQL Editor y dale Run. Es seguro correrlo dos veces.
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


-- ── 2 · El pedido aceptado descuenta; el resto devuelve ─────────────────────
--  Todo va dentro del disparador a propósito. Como función suelta quedaba
--  expuesta en la API y cualquiera podía mover el stock desde afuera.
create or replace function public.venta_ajusta_stock()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  antes int := 0;  -- unidades que el pedido ya tenía descontadas
  ahora int := 0;  -- unidades que tiene que tener descontadas
  paso  int;
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
    update public.products
    set stock_qty = greatest(0, stock_qty + antes)
    where stock_qty is not null
      and ( (old.producto_id is not null and id = old.producto_id)
         or (old.producto_id is null and slug = old.producto_slug) );
    antes := 0;
  end if;

  if tg_op = 'DELETE' then
    if antes <> 0 then
      update public.products
      set stock_qty = greatest(0, stock_qty + antes)
      where stock_qty is not null
        and ( (old.producto_id is not null and id = old.producto_id)
           or (old.producto_id is null and slug = old.producto_slug) );
    end if;
    return old;
  end if;

  paso := antes - ahora;
  if paso <> 0 then
    update public.products
    set stock_qty = greatest(0, stock_qty + paso)
    where stock_qty is not null
      and ( (new.producto_id is not null and id = new.producto_id)
         or (new.producto_id is null and slug = new.producto_slug) );
  end if;
  return new;
end $$;

drop trigger if exists venta_stock on public.ventas;
create trigger venta_stock
  after insert or update or delete on public.ventas
  for each row execute function public.venta_ajusta_stock();

-- Por si quedó la versión anterior, que sí era llamable desde la API.
drop function if exists public.mover_stock(uuid, text, int);


-- ── 3 · Comprobación ────────────────────────────────────────────────────────
--  Al terminar tiene que decir: producto_stock SÍ · venta_stock SÍ
select
  case when exists (select 1 from pg_trigger where tgname = 'producto_stock' and not tgisinternal)
       then 'producto_stock SÍ' else 'producto_stock NO' end
  || ' · ' ||
  case when exists (select 1 from pg_trigger where tgname = 'venta_stock' and not tgisinternal)
       then 'venta_stock SÍ' else 'venta_stock NO' end as instalado;

-- ============================================================================
--  LISTO. Carga las unidades de cada producto desde Editar → el producto, y
--  de ahí en más la cuenta se mantiene sola.
-- ============================================================================
