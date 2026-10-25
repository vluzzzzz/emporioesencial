-- ============================================================================
--  ESENCIAL EMPORIO · Pedidos por aprobar y comisión del vendedor
--  ----------------------------------------------------------------------------
--  Dos cosas:
--   1. Cada venta que registra un vendedor entra como PENDIENTE. El
--      administrador después la acepta o la deniega.
--   2. Cada venta guarda la comisión que le toca al vendedor, según cuánto
--      cuesta el producto.
--
--  La escala, por unidad vendida:
--      hasta $10.500 ............ $1.300
--      hasta $22.500 ............ $1.800
--      hasta $32.500 ............ $2.300
--      de $33.000 en adelante ... $2.800
--
--  Pégalo en Supabase → SQL Editor y dale Run. Es seguro correrlo dos veces.
-- ============================================================================


-- ── 1 · Estado del pedido ───────────────────────────────────────────────────
alter table public.ventas add column if not exists estado text not null default 'pendiente';
alter table public.ventas add column if not exists comision int not null default 0;
alter table public.ventas add column if not exists resuelto_en timestamptz;
alter table public.ventas add column if not exists resuelto_por uuid references auth.users(id);
alter table public.ventas add column if not exists motivo text not null default '';

alter table public.ventas drop constraint if exists ventas_estado_chk;
alter table public.ventas add  constraint ventas_estado_chk
  check (estado in ('pendiente','aceptado','denegado'));

create index if not exists ventas_estado_idx on public.ventas(estado, created_at desc);

-- Lo que ya estaba cargado se da por aceptado: son ventas viejas.
update public.ventas set estado = 'aceptado' where estado = 'pendiente' and created_at < now() - interval '1 day';


-- ── 2 · Cuánto se le paga al vendedor por unidad ────────────────────────────
create or replace function public.comision_por_unidad(precio int)
returns int language sql immutable as $$
  select case
    when precio is null or precio <= 0 then 0
    when precio < 11000 then 1300
    when precio < 23000 then 1800
    when precio < 33000 then 2300
    else 2800
  end;
$$;


-- ── 3 · Precios y comisión, siempre desde el catálogo ───────────────────────
--  Reemplaza al disparador de supabase/precios-fijos.sql y le suma la
--  comisión. El vendedor no puede escribir ninguno de los dos.
create or replace function public.venta_precios_del_catalogo()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  precio_real   int;
  despacho_real int;
begin
  if not public.es_admin() then
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
    -- Un vendedor nunca da por aceptado su propio pedido.
    if tg_op = 'INSERT' then new.estado := 'pendiente'; end if;
  end if;

  new.total    := new.cantidad * new.precio_unitario + new.costo_despacho;
  new.comision := new.cantidad * public.comision_por_unidad(new.precio_unitario);
  return new;
end $$;

drop trigger if exists venta_precios on public.ventas;
create trigger venta_precios
  before insert or update on public.ventas
  for each row execute function public.venta_precios_del_catalogo();

-- Pone la comisión a las ventas que ya estaban cargadas.
update public.ventas
set comision = cantidad * public.comision_por_unidad(precio_unitario)
where comision = 0;


-- ── 4 · Permisos: solo el administrador acepta o deniega ────────────────────
drop policy if exists "ventas admin" on public.ventas;
create policy "ventas admin" on public.ventas
  for all to authenticated using ( public.es_admin() ) with check ( public.es_admin() );

-- El vendedor puede ver las suyas, pero no cambiarles el estado.
drop policy if exists "ventas lectura" on public.ventas;
create policy "ventas lectura" on public.ventas
  for select to authenticated using ( vendedor_id = auth.uid() or public.es_admin() );

-- ============================================================================
--  LISTO. Los pedidos nuevos entran como pendientes y el administrador los
--  resuelve desde Vendedores → Pedidos.
-- ============================================================================
