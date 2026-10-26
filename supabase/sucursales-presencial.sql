-- ============================================================================
--  ESENCIAL EMPORIO · Sucursales, moderadores y entrega presencial
--  ----------------------------------------------------------------------------
--  Hasta ahora toda venta se despachaba a una comuna. Esto suma la otra
--  mitad: el cliente retira en la sucursal.
--
--   1. SUCURSALES. Las crea el administrador, igual que las comunas.
--   2. MODERADOR. Un rol nuevo, atado a una sucursal. Es quien está en la
--      caja. Varios moderadores pueden compartir la misma sucursal.
--   3. El vendedor marca el pedido como PRESENCIAL y elige la sucursal. El
--      pedido nace con un código de retiro de 4 dígitos.
--   4. El moderador de esa sucursal lo ve en su lista. Cuando el cliente
--      llega, lo busca por el código, por el nombre del cliente o por el del
--      vendedor, y marca ENTREGADO. Recién ahí la comisión le queda al
--      vendedor.
--
--  Dos ejes separados, a propósito:
--    · `estado`  (pendiente / aceptado / denegado) sigue siendo el del dinero.
--    · `entrega` (por_retirar / entregado / no_retirado) es el del mostrador.
--  El moderador mueve los dos a la vez al entregar, así el cálculo de
--  comisión que ya existe no cambia en ninguna parte.
--
--  Corre PRIMERO supabase/setup-usuarios-ventas.sql, supabase/pedidos-comisiones.sql
--  y supabase/stock-automatico.sql. Después pega esto en Supabase → SQL Editor
--  y dale Run. Es seguro correrlo dos veces.
-- ============================================================================


-- ── 1 · Las sucursales ──────────────────────────────────────────────────────
create table if not exists public.sucursales (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null unique,
  direccion  text not null default '',
  comuna     text not null default '',
  telefono   text not null default '',
  activa     boolean not null default true,
  position   int  not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists sucursales_orden_idx on public.sucursales(position);


-- ── 2 · El rol moderador y su sucursal ──────────────────────────────────────
alter table public.profiles add column if not exists sucursal_id uuid
  references public.sucursales(id) on delete set null;

alter table public.profiles drop constraint if exists profiles_rol_chk;
alter table public.profiles add  constraint profiles_rol_chk
  check (rol in ('admin','vendedor','moderador'));

-- Un moderador sin sucursal no sabría qué caja atender: lo frena la base, no
-- solo el formulario.
alter table public.profiles drop constraint if exists profiles_sucursal_chk;
alter table public.profiles add  constraint profiles_sucursal_chk
  check (rol <> 'moderador' or sucursal_id is not null);

create index if not exists profiles_sucursal_idx on public.profiles(sucursal_id);

create or replace function public.es_moderador()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select p.activo and p.rol = 'moderador' from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

create or replace function public.sucursal_actual()
returns uuid language sql stable security definer set search_path = public as $$
  select p.sucursal_id from public.profiles p where p.id = auth.uid() and p.activo;
$$;


-- ── 3 · El pedido presencial ────────────────────────────────────────────────
alter table public.ventas add column if not exists tipo          text not null default 'despacho';
alter table public.ventas add column if not exists entrega       text not null default '';
alter table public.ventas add column if not exists sucursal_id   uuid references public.sucursales(id) on delete restrict;
alter table public.ventas add column if not exists codigo_retiro text not null default '';
alter table public.ventas add column if not exists entregado_en  timestamptz;
alter table public.ventas add column if not exists entregado_por uuid references auth.users(id);

alter table public.ventas drop constraint if exists ventas_tipo_chk;
alter table public.ventas add  constraint ventas_tipo_chk
  check (tipo in ('despacho','presencial'));

alter table public.ventas drop constraint if exists ventas_entrega_chk;
alter table public.ventas add  constraint ventas_entrega_chk
  check (entrega in ('','por_retirar','entregado','no_retirado'));

-- Un pedido presencial sin sucursal no lo puede atender nadie.
alter table public.ventas drop constraint if exists ventas_sucursal_chk;
alter table public.ventas add  constraint ventas_sucursal_chk
  check (tipo <> 'presencial' or sucursal_id is not null);

create index if not exists ventas_caja_idx on public.ventas(sucursal_id, entrega, created_at desc);

-- El código solo tiene que ser único entre los pedidos que todavía esperan al
-- cliente. Los ya entregados pueden repetirlo sin molestar a nadie.
create unique index if not exists ventas_codigo_vivo_idx
  on public.ventas(codigo_retiro) where entrega = 'por_retirar';


-- ── 4 · Precios, comisión y código de retiro ────────────────────────────────
--  Reemplaza al disparador de supabase/pedidos-comisiones.sql. Conserva todo
--  lo que ya hacía y le suma la rama presencial.
create or replace function public.venta_precios_del_catalogo()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  precio_real   int;
  despacho_real int;
  candidato     text;
  intento       int := 0;
begin
  if new.tipo is null or new.tipo not in ('despacho','presencial') then
    new.tipo := 'despacho';
  end if;

  -- Los precios se leen del catálogo solo al registrar el pedido. Antes se
  -- releían en cada cambio, y eso ahora sería un problema: cuando el moderador
  -- marca una entrega, un precio de catálogo que subió en el medio le
  -- cambiaría el total a un pedido ya cobrado.
  if tg_op = 'INSERT' and not public.es_admin() then
    select t.price into precio_real
    from public.price_tiers t
    join public.products p on p.id = t.product_id
    where p.slug = new.producto_slug and t.qty = 1 and t.active
    limit 1;
    new.precio_unitario := coalesce(precio_real, new.precio_unitario);

    if new.tipo = 'despacho' then
      select c.costo into despacho_real
      from public.comunas c
      where c.nombre = new.comuna and c.activa
      limit 1;
      new.costo_despacho := coalesce(despacho_real, new.costo_despacho);
    end if;

    -- Un vendedor nunca da por aceptado su propio pedido.
    new.estado := 'pendiente';
  end if;

  if new.tipo = 'presencial' then
    -- No hay envío que cobrar: el cliente va al mostrador.
    new.costo_despacho := 0;
    new.comuna := '';
    if tg_op = 'INSERT' then
      new.entrega := 'por_retirar';
      loop
        intento := intento + 1;
        candidato := lpad((floor(random() * 10000))::int::text, 4, '0');
        exit when intento > 80 or not exists (
          select 1 from public.ventas
          where codigo_retiro = candidato and entrega = 'por_retirar'
        );
      end loop;
      new.codigo_retiro := candidato;
    end if;
  else
    new.entrega := '';
    new.codigo_retiro := '';
    new.sucursal_id := null;
    new.entregado_en := null;
    new.entregado_por := null;
  end if;

  new.total    := new.cantidad * new.precio_unitario + new.costo_despacho;
  new.comision := new.cantidad * public.comision_por_unidad(new.precio_unitario);
  return new;
end $$;

drop trigger if exists venta_precios on public.ventas;
create trigger venta_precios
  before insert or update on public.ventas
  for each row execute function public.venta_precios_del_catalogo();


-- ── 5 · El moderador solo marca la entrega ──────────────────────────────────
--  RLS decide por fila, no por columna. Sin esto, un moderador podría subirse
--  la cantidad de un pedido de su propia sucursal.
--
--  El nombre importa: con el mismo momento, Postgres corre los disparadores en
--  orden alfabético, y `venta_guardia` tiene que mirar la fila antes de que
--  `venta_precios` recalcule el total.
create or replace function public.venta_guardia_moderador()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.es_admin() or not public.es_moderador() then return new; end if;

  if old.tipo <> 'presencial' or old.sucursal_id is distinct from public.sucursal_actual() then
    raise exception 'Ese pedido no es de tu sucursal';
  end if;

  if new.vendedor_id     is distinct from old.vendedor_id
  or new.producto_id     is distinct from old.producto_id
  or new.producto_slug   is distinct from old.producto_slug
  or new.cantidad        is distinct from old.cantidad
  or new.precio_unitario is distinct from old.precio_unitario
  or new.costo_despacho  is distinct from old.costo_despacho
  or new.cliente_nombre  is distinct from old.cliente_nombre
  or new.cliente_telefono is distinct from old.cliente_telefono
  or new.tipo            is distinct from old.tipo
  or new.sucursal_id     is distinct from old.sucursal_id
  or new.codigo_retiro   is distinct from old.codigo_retiro
  or new.created_at      is distinct from old.created_at then
    raise exception 'En la caja solo se marca la entrega';
  end if;

  return new;
end $$;

drop trigger if exists venta_guardia on public.ventas;
create trigger venta_guardia
  before update on public.ventas
  for each row execute function public.venta_guardia_moderador();


-- ── 6 · El stock se reserva al registrar el presencial ──────────────────────
--  Reemplaza al disparador de supabase/stock-automatico.sql. Antes solo
--  descontaba al aceptar; ahora el pedido presencial reserva sus unidades
--  apenas se registra, para que el cliente no llegue y no haya producto.
--  Si nadie lo retira, el moderador lo cierra y el stock vuelve solo.
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
  if tg_op in ('UPDATE','DELETE')
     and ( old.estado = 'aceptado' or (old.tipo = 'presencial' and old.entrega = 'por_retirar') ) then
    antes := coalesce(old.cantidad, 0);
  end if;
  if tg_op in ('INSERT','UPDATE')
     and ( new.estado = 'aceptado' or (new.tipo = 'presencial' and new.entrega = 'por_retirar') ) then
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


-- ── 7 · Permisos ────────────────────────────────────────────────────────────
alter table public.sucursales enable row level security;

-- Las ve todo el equipo: el vendedor necesita elegir una al registrar.
drop policy if exists "sucursales lectura" on public.sucursales;
create policy "sucursales lectura" on public.sucursales
  for select to authenticated using ( true );

drop policy if exists "sucursales admin" on public.sucursales;
create policy "sucursales admin" on public.sucursales
  for all to authenticated using ( public.es_admin() ) with check ( public.es_admin() );

-- La caja ve y marca solo los pedidos presenciales de su propia sucursal.
drop policy if exists "ventas caja" on public.ventas;
create policy "ventas caja" on public.ventas
  for select to authenticated using (
    public.es_moderador()
    and tipo = 'presencial'
    and sucursal_id = public.sucursal_actual()
  );

drop policy if exists "ventas caja marca" on public.ventas;
create policy "ventas caja marca" on public.ventas
  for update to authenticated using (
    public.es_moderador()
    and tipo = 'presencial'
    and sucursal_id = public.sucursal_actual()
  ) with check (
    tipo = 'presencial'
    and sucursal_id = public.sucursal_actual()
  );

-- `es_vendedor()` manda en quién puede registrar pedidos. El moderador no
-- entra: su trabajo es entregar, no vender.
create or replace function public.es_vendedor()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select p.activo and p.rol in ('admin','vendedor') from public.profiles p where p.id = auth.uid()),
    false
  );
$$;


-- ── 8 · El perfil nuevo también trae sucursal ───────────────────────────────
--  El alta de usuarios pasa por este disparador, que lee la metadata que manda
--  api/crear-vendedor.js.
create or replace function public.crear_perfil()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  rol_nuevo text;
  suc       uuid;
begin
  rol_nuevo := case when lower(new.email) = public.correo_owner() then 'admin'
                    else coalesce(new.raw_user_meta_data ->> 'rol', 'vendedor') end;
  if rol_nuevo not in ('admin','vendedor','moderador') then rol_nuevo := 'vendedor'; end if;

  begin
    suc := nullif(new.raw_user_meta_data ->> 'sucursal_id', '')::uuid;
  exception when others then suc := null;
  end;
  if rol_nuevo <> 'moderador' then suc := null; end if;
  if rol_nuevo = 'moderador' and suc is null then rol_nuevo := 'vendedor'; end if;

  insert into public.profiles (id, email, nombre, telefono, observacion, rol, sucursal_id)
  values (
    new.id,
    lower(new.email),
    coalesce(new.raw_user_meta_data ->> 'nombre', ''),
    coalesce(new.raw_user_meta_data ->> 'telefono', ''),
    coalesce(new.raw_user_meta_data ->> 'observacion', ''),
    rol_nuevo,
    suc
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists crear_perfil on auth.users;
create trigger crear_perfil
  after insert on auth.users
  for each row execute function public.crear_perfil();


-- ── 9 · Comprobación ────────────────────────────────────────────────────────
select
  (select count(*) from public.sucursales) as sucursales,
  (select count(*) from public.ventas where tipo = 'presencial') as presenciales,
  (select count(*) from public.profiles where rol = 'moderador') as moderadores;

-- ============================================================================
--  LISTO.
--   1. Vendedores → Despacho: crea tus sucursales.
--   2. Vendedores → Equipo: crea el moderador y elige su sucursal.
--   3. El vendedor ya puede registrar pedidos para retirar en sucursal.
--   4. El moderador entra con el botón CAJA de la barra.
-- ============================================================================
