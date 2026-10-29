-- ============================================================================
--  ESENCIAL EMPORIO · Venta local en el mostrador
--  ----------------------------------------------------------------------------
--  Corrige a supabase/sucursales-presencial.sql, que daba por hecho que el
--  vendedor cerraba el trato antes y el cliente iba después a retirar. El
--  negocio funciona al revés.
--
--  El cliente llega a la sucursal sin aviso y dice de parte de qué vendedor
--  viene. La persona del mostrador lo atiende, le vende ahí mismo y recién
--  después carga los productos a nombre de ese vendedor. Ya está pagado y ya
--  está entregado: no hay nada que esperar ni que aprobar.
--
--   1. Se va el código de retiro y todo el eje de entrega.
--   2. `tipo` pasa a decir LOCAL o DELIVERY, como lo nombra el negocio.
--   3. Una venta local puede llevar varios productos: son varias filas con el
--      mismo `ticket_id`.
--   4. La venta local nace aceptada, así la comisión se acredita al instante.
--
--  EL ORDEN IMPORTA. Los disparadores viejos leen columnas que este archivo
--  borra, así que lo primero es desengancharlos. Si se borra una columna con
--  el disparador puesto, la tabla queda trabada: cualquier cambio falla con
--  «record "new" has no field "entrega"».
--
--  Corre PRIMERO supabase/sucursales-presencial.sql. Después pega esto en
--  Supabase → SQL Editor y dale Run. Es seguro correrlo dos veces, y también
--  sirve para destrabar una corrida que quedó por la mitad.
-- ============================================================================


-- ── 1 · Desenganchar los disparadores viejos ────────────────────────────────
drop trigger if exists venta_precios on public.ventas;
drop trigger if exists venta_guardia on public.ventas;
drop trigger if exists venta_stock   on public.ventas;


-- ── 2 · Fuera los pedidos de prueba ─────────────────────────────────────────
--  Eran pedidos esperando un retiro que ya no existe. Tenían stock reservado,
--  así que primero se lo devolvemos al catálogo: sin el disparador puesto,
--  nadie lo haría por nosotros.
--
--  Va dentro de un bloque porque en la segunda corrida la columna ya no está.
do $$
begin
  -- Las dos columnas, no una: si una corrida se cortó entre un borrado y el
  -- otro, preguntar por una sola dejaría pasar una consulta que no compila.
  if (
    select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'ventas'
      and column_name in ('codigo_retiro','entrega')
  ) = 2 then
    update public.products p
    set stock_qty = p.stock_qty + v.unidades
    from (
      select producto_slug, sum(cantidad) as unidades
      from public.ventas
      where coalesce(codigo_retiro, '') <> ''
        and (estado = 'aceptado' or entrega = 'por_retirar')
      group by producto_slug
    ) v
    where p.slug = v.producto_slug and p.stock_qty is not null;

    delete from public.ventas where coalesce(codigo_retiro, '') <> '';
  end if;
end $$;

drop index  if exists public.ventas_codigo_vivo_idx;
drop index  if exists public.ventas_caja_idx;
alter table public.ventas drop constraint if exists ventas_entrega_chk;

alter table public.ventas drop column if exists entrega;
alter table public.ventas drop column if exists codigo_retiro;
alter table public.ventas drop column if exists entregado_en;
alter table public.ventas drop column if exists entregado_por;


-- ── 3 · Local o delivery ────────────────────────────────────────────────────
alter table public.ventas drop constraint if exists ventas_tipo_chk;

update public.ventas
set tipo = case when tipo in ('presencial','local') then 'local' else 'delivery' end
where tipo is distinct from (case when tipo in ('presencial','local') then 'local' else 'delivery' end);

alter table public.ventas alter column tipo set default 'delivery';
alter table public.ventas add  constraint ventas_tipo_chk check (tipo in ('delivery','local'));


-- ── 4 · Un ticket, varias líneas ────────────────────────────────────────────
--  Cada producto sigue siendo una fila: así el disparador del stock y la
--  escala de comisión funcionan sin tocarse. El ticket solo las agrupa a la
--  hora de mostrarlas.
alter table public.ventas add column if not exists ticket_id   uuid;
alter table public.ventas add column if not exists vendido_por uuid references auth.users(id);

create index if not exists ventas_ticket_idx on public.ventas(ticket_id) where ticket_id is not null;
create index if not exists ventas_local_idx  on public.ventas(sucursal_id, created_at desc) where tipo = 'local';


-- ── 5 · Precios, comisión y estado ──────────────────────────────────────────
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
    new.ticket_id := null;
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


-- ── 6 · El stock vuelve a seguir al estado ──────────────────────────────────
--  Como la venta local nace aceptada, el stock baja al guardarla. Ya no hace
--  falta reservar nada por adelantado.
--
--  Sigue todo adentro del disparador a propósito: como función suelta quedaba
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


-- ── 7 · El moderador registra, no edita ─────────────────────────────────────
--  RLS decide por fila, no por columna. Sin esto, un moderador podría cambiar
--  de vendedor una venta ya cargada y moverle la comisión a otro.
create or replace function public.venta_guardia_moderador()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.es_admin() or not public.es_moderador() then return new; end if;
  raise exception 'Una venta local no se edita: si quedó mal, anúlala y cárgala de nuevo';
end $$;


-- ── 8 · Volver a enganchar los disparadores ─────────────────────────────────
--  El nombre importa: con el mismo momento, Postgres los corre en orden
--  alfabético, y `venta_guardia` tiene que frenar al moderador antes de que
--  `venta_precios` recalcule nada.
create trigger venta_guardia
  before update on public.ventas
  for each row execute function public.venta_guardia_moderador();

create trigger venta_precios
  before insert or update on public.ventas
  for each row execute function public.venta_precios_del_catalogo();

create trigger venta_stock
  after insert or update or delete on public.ventas
  for each row execute function public.venta_ajusta_stock();


-- ── 9 · Permisos ────────────────────────────────────────────────────────────
--  El moderador carga ventas locales de su sucursal a nombre de cualquier
--  vendedor. Es toda la gracia del mostrador: el cliente dice de parte de
--  quién viene y la caja se la acredita.
drop policy if exists "ventas caja marca" on public.ventas;

drop policy if exists "ventas local alta" on public.ventas;
create policy "ventas local alta" on public.ventas
  for insert to authenticated with check (
    public.es_moderador()
    and tipo = 'local'
    and sucursal_id = public.sucursal_actual()
    and vendido_por = auth.uid()
  );

drop policy if exists "ventas caja" on public.ventas;
create policy "ventas caja" on public.ventas
  for select to authenticated using (
    public.es_moderador()
    and tipo = 'local'
    and sucursal_id = public.sucursal_actual()
  );

-- Anular es como se corrige un error de tipeo: devuelve el stock y le quita
-- la comisión al vendedor. Solo sobre lo que cargó esa misma persona.
drop policy if exists "ventas caja anula" on public.ventas;
create policy "ventas caja anula" on public.ventas
  for delete to authenticated using (
    public.es_moderador()
    and tipo = 'local'
    and vendido_por = auth.uid()
  );

-- `es_vendedor()` no incluye al moderador, así que la política "ventas alta"
-- de siempre le sigue cerrando el paso a registrar un delivery.


-- ── 10 · El moderador necesita ver a los vendedores ─────────────────────────
--  Para elegir de parte de quién viene el cliente. Solo los vendedores
--  activos: la política de admin sigue siendo la única que deja tocar un
--  perfil.
drop policy if exists "perfiles caja" on public.profiles;
create policy "perfiles caja" on public.profiles
  for select to authenticated using (
    public.es_moderador() and rol = 'vendedor' and activo and not oculto
  );


-- ── 11 · Comprobación ───────────────────────────────────────────────────────
--  Tiene que decir: venta_guardia SÍ · venta_precios SÍ · venta_stock SÍ
select
  (select count(*) from public.ventas where tipo = 'local')      as locales,
  (select count(*) from public.ventas where tipo = 'delivery')   as deliverys,
  (select count(*) from public.sucursales)                       as sucursales,
  (select count(*) from public.profiles where rol = 'moderador') as moderadores,
  (select string_agg(tgname || ' SÍ', ' · ' order by tgname)
     from pg_trigger
    where tgrelid = 'public.ventas'::regclass and not tgisinternal) as disparadores;

-- ============================================================================
--  LISTO.
--   · El moderador entra con el botón VENTA LOCAL de la barra.
--   · Arma el pedido con el catálogo, elige el vendedor y guarda.
--   · La comisión queda acreditada en el acto.
--
--  OJO: este archivo deja el stock con el sistema viejo (descuenta solo al
--  aceptar). Si lo corrés de nuevo, después corré `stock-inmediato.sql` para
--  que el stock baje apenas se registra la venta.
-- ============================================================================
