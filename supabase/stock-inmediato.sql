-- ============================================================================
--  ESENCIAL EMPORIO · El stock se descuenta apenas se registra la venta
--  ----------------------------------------------------------------------------
--  Antes: el stock bajaba recién cuando el administrador ACEPTABA el pedido.
--  Ahora: baja en el momento en que el vendedor lo registra (queda pendiente),
--         y vuelve solo si el pedido se deniega o se elimina.
--
--  Además rechaza una venta que pida más unidades de las que hay, así dos
--  vendedores no pueden vender la última unidad al mismo tiempo.
--
--  Los productos con el stock en blanco no llevan inventario: nunca se tocan
--  ni se agotan.
--
--  Pégalo en Supabase → SQL Editor y dale Run. Se puede correr dos veces.
--
--  OJO: si más adelante volvés a correr `venta-local.sql`, ese archivo deja el
--  sistema viejo (descuenta solo al aceptar). Después de correrlo, volvé a
--  correr ESTE archivo.
-- ============================================================================

begin;


-- ── 1 · Cuántas unidades descontó ya cada venta ─────────────────────────────
--  Sirve para no descontar dos veces al aprobar y para devolver exactamente lo
--  que corresponde al denegar. El vendedor no la puede tocar: el disparador
--  siempre la reescribe.
alter table public.ventas
  add column if not exists stock_aplicado int not null default 0;


-- ── 2 · Poner al día lo que ya existe ───────────────────────────────────────
--  Las ventas aceptadas YA tenían el stock descontado con el sistema viejo.
update public.ventas
set stock_aplicado = coalesce(cantidad, 0)
where estado = 'aceptado' and stock_aplicado = 0;

--  Las pendientes que ya existen todavía no lo tenían descontado: se les
--  descuenta ahora, de una vez, para que queden reservadas como las nuevas.
with pendientes as (
  select p.id as pid, sum(v.cantidad) as cant
  from public.ventas v
  join public.products p
    on (v.producto_id is not null and p.id = v.producto_id)
    or (v.producto_id is null and p.slug = v.producto_slug)
  where v.estado = 'pendiente'
    and v.stock_aplicado = 0
    and p.stock_qty is not null
  group by p.id
)
update public.products p
set stock_qty = greatest(0, p.stock_qty - pendientes.cant)
from pendientes
where p.id = pendientes.pid;

update public.ventas v
set stock_aplicado = coalesce(v.cantidad, 0)
from public.products p
where v.estado = 'pendiente'
  and v.stock_aplicado = 0
  and p.stock_qty is not null
  and ( (v.producto_id is not null and p.id = v.producto_id)
     or (v.producto_id is null and p.slug = v.producto_slug) );


-- ── 3 · El disparador ───────────────────────────────────────────────────────
--  Corre ANTES de guardar la fila (y después de `venta_guardia` y
--  `venta_precios` por el orden alfabético de los nombres). Bloquea la fila
--  del producto para que dos ventas simultáneas no puedan pasar las dos.
create or replace function public.venta_ajusta_stock()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  antes   int := 0;  -- unidades que esta venta ya tenía descontadas
  ahora   int := 0;  -- unidades que tiene que tener descontadas
  paso    int;       -- negativo = descontar · positivo = devolver
  v_id    uuid;
  v_nom   text;
  v_stock int;
begin
  -- Lo que la fila tenía descontado antes del cambio.
  if tg_op in ('UPDATE', 'DELETE') then
    antes := coalesce(old.stock_aplicado, 0);
  end if;

  -- Borrar la venta devuelve todo y termina.
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

  -- Una venta ocupa stock desde que se registra. Solo la denegada no ocupa.
  if new.estado in ('pendiente', 'aceptado') then
    ahora := coalesce(new.cantidad, 0);
  end if;

  -- Se bloquea el producto para leer su stock real sin carreras.
  select p.id, p.name, p.stock_qty
    into v_id, v_nom, v_stock
  from public.products p
  where (new.producto_id is not null and p.id = new.producto_id)
     or (new.producto_id is null and p.slug = new.producto_slug)
  for update;

  -- Producto sin control de stock (stock_qty en blanco): no se lleva cuenta.
  if v_id is null or v_stock is null then
    ahora := 0;
  end if;

  -- Si la venta pasó a otro producto, se le devuelve al anterior.
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

  paso := antes - ahora;

  if paso <> 0 and v_id is not null and v_stock is not null then
    if paso > 0 then
      -- Devolver unidades.
      update public.products set stock_qty = v_stock + paso where id = v_id;
    elsif v_stock >= -paso then
      -- Descontar.
      update public.products set stock_qty = v_stock + paso where id = v_id;
    else
      raise exception 'No hay stock suficiente de % (quedan % unidades)',
        v_nom, v_stock
        using errcode = 'check_violation';
    end if;
  end if;

  new.stock_aplicado := ahora;
  return new;
end $$;

drop trigger if exists venta_stock on public.ventas;
create trigger venta_stock
  before insert or update or delete on public.ventas
  for each row execute function public.venta_ajusta_stock();


commit;


-- ── 4 · Comprobación ────────────────────────────────────────────────────────
--  Tiene que decir: columna SÍ · disparador SÍ
select
  case when exists (
         select 1 from information_schema.columns
         where table_schema = 'public' and table_name = 'ventas'
           and column_name = 'stock_aplicado')
       then 'columna stock_aplicado SÍ' else 'columna stock_aplicado NO' end
  || ' · ' ||
  case when exists (
         select 1 from pg_trigger
         where tgname = 'venta_stock' and not tgisinternal)
       then 'disparador venta_stock SÍ' else 'disparador venta_stock NO' end
  as instalado;

-- ============================================================================
--  LISTO. Desde ahora:
--    · El vendedor registra la venta → el stock baja al instante.
--    · El admin acepta → el stock no se mueve (ya estaba descontado).
--    · El admin deniega o se borra la venta → el stock vuelve.
--    · Si no alcanzan las unidades, la base rechaza la venta con el aviso.
-- ============================================================================
