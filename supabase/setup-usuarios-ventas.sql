-- ============================================================================
--  ESENCIAL EMPORIO · Usuarios, vendedores y ventas
--  ----------------------------------------------------------------------------
--  Corre PRIMERO supabase/setup-emporio.sql y DESPUÉS este archivo.
--
--  CÓMO USARLO
--   1. Abajo, en el PASO 0, pon tu correo de administrador en MINÚSCULAS.
--   2. Supabase → SQL Editor → New query → pega todo esto → Run.
--   3. Authentication → Users → Add user: crea tu usuario con ese correo.
--      (Authentication → Providers → Email: desactiva "Confirm email".)
--   4. Vuelve a correr el bloque del PASO 4 si creaste el usuario después.
--
--  Es seguro correrlo varias veces.
-- ============================================================================


-- ── PASO 0 · Correo del administrador dueño ─────────────────────────────────
create or replace function public.correo_owner()
returns text language sql immutable as $$
  select 'tu-correo@ejemplo.com';
$$;


-- ── 1 · Perfiles (quién es quién) ───────────────────────────────────────────
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  nombre      text not null default '',
  telefono    text not null default '',
  observacion text not null default '',
  rol         text not null default 'vendedor',
  activo      boolean not null default true,
  created_at  timestamptz not null default now()
);

alter table public.profiles drop constraint if exists profiles_rol_chk;
alter table public.profiles add  constraint profiles_rol_chk
  check (rol in ('admin','vendedor'));

create index if not exists profiles_rol_idx on public.profiles(rol);


-- ── 2 · Perfil automático al crear un usuario ───────────────────────────────
create or replace function public.crear_perfil()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, nombre, telefono, observacion, rol)
  values (
    new.id,
    lower(new.email),
    coalesce(new.raw_user_meta_data ->> 'nombre', ''),
    coalesce(new.raw_user_meta_data ->> 'telefono', ''),
    coalesce(new.raw_user_meta_data ->> 'observacion', ''),
    case when lower(new.email) = public.correo_owner() then 'admin'
         else coalesce(new.raw_user_meta_data ->> 'rol', 'vendedor') end
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists crear_perfil on auth.users;
create trigger crear_perfil
  after insert on auth.users
  for each row execute function public.crear_perfil();


-- ── 3 · Quién es admin / vendedor ───────────────────────────────────────────
create or replace function public.es_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select p.rol = 'admin' and p.activo from public.profiles p where p.id = auth.uid()),
    lower(auth.jwt() ->> 'email') = public.correo_owner()
  );
$$;

create or replace function public.es_vendedor()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select p.activo and p.rol in ('admin','vendedor') from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

create or replace function public.es_owner()
returns boolean language sql stable security definer set search_path = public as $$
  select lower(coalesce(auth.jwt() ->> 'email','')) = public.correo_owner();
$$;


-- ── 4 · Perfil para los usuarios que ya existían ────────────────────────────
--  Los usuarios creados ANTES de correr este archivo no pasaron por el
--  trigger. Esto les arma el perfil que falta. Por defecto quedan como
--  vendedores; el rol se cambia después desde /admin → Usuarios.
insert into public.profiles (id, email, nombre, telefono, observacion, rol)
select u.id, lower(u.email),
       coalesce(u.raw_user_meta_data ->> 'nombre', ''),
       coalesce(u.raw_user_meta_data ->> 'telefono', ''),
       coalesce(u.raw_user_meta_data ->> 'observacion', ''),
       coalesce(u.raw_user_meta_data ->> 'rol', 'vendedor')
from auth.users u
on conflict (id) do nothing;

-- Asegurar perfil y rol del dueño
insert into public.profiles (id, email, nombre, rol)
select u.id, lower(u.email), coalesce(u.raw_user_meta_data ->> 'nombre',''), 'admin'
from auth.users u
where lower(u.email) = public.correo_owner()
on conflict (id) do update set rol = 'admin', activo = true;


-- ── 5 · Comunas de la Quinta Región y su costo de despacho ──────────────────
create table if not exists public.comunas (
  id        uuid primary key default gen_random_uuid(),
  nombre    text unique not null,
  costo     int  not null default 0 check (costo >= 0),
  activa    boolean not null default true,
  position  int  not null default 0
);

insert into public.comunas (nombre, costo, position) values
  ('Valparaíso', 3000, 1),  ('Viña del Mar', 3000, 2),  ('Concón', 3500, 3),
  ('Quilpué', 3000, 4),     ('Villa Alemana', 3500, 5), ('Limache', 4000, 6),
  ('Olmué', 4500, 7),       ('Quintero', 4500, 8),      ('Puchuncaví', 5000, 9),
  ('Casablanca', 4500, 10), ('Quillota', 4000, 11),     ('La Cruz', 4000, 12),
  ('La Calera', 4500, 13),  ('Nogales', 5000, 14),      ('Hijuelas', 5000, 15),
  ('San Antonio', 5000, 16),('Cartagena', 5000, 17),    ('El Tabo', 5500, 18),
  ('El Quisco', 5500, 19),  ('Algarrobo', 5500, 20),    ('Santo Domingo', 6000, 21),
  ('San Felipe', 5500, 22), ('Putaendo', 6000, 23),     ('Santa María', 6000, 24),
  ('Catemu', 6000, 25),     ('Panquehue', 6000, 26),    ('Llaillay', 5500, 27),
  ('Los Andes', 5500, 28),  ('San Esteban', 6000, 29),  ('Calle Larga', 6000, 30),
  ('Rinconada', 6000, 31),  ('La Ligua', 6000, 32),     ('Cabildo', 6500, 33),
  ('Papudo', 6500, 34),     ('Zapallar', 6500, 35),     ('Petorca', 7000, 36)
on conflict (nombre) do nothing;


-- ── 6 · Ventas registradas por los vendedores ───────────────────────────────
create table if not exists public.ventas (
  id               uuid primary key default gen_random_uuid(),
  vendedor_id      uuid not null references auth.users(id) on delete restrict,
  vendedor_nombre  text not null default '',
  producto_id      uuid references public.products(id) on delete set null,
  producto_slug    text not null default '',
  producto_nombre  text not null,
  cantidad         int  not null default 1 check (cantidad > 0),
  precio_unitario  int  not null default 0 check (precio_unitario >= 0),
  comuna           text not null default '',
  costo_despacho   int  not null default 0 check (costo_despacho >= 0),
  total            int  not null default 0 check (total >= 0),
  cliente_nombre   text not null default '',
  cliente_telefono text not null default '',
  cliente_email    text not null default '',
  cliente_direccion text not null default '',
  metodo_pago      text not null default '',
  notas            text not null default '',
  created_at       timestamptz not null default now()
);

create index if not exists ventas_vendedor_idx on public.ventas(vendedor_id, created_at desc);
create index if not exists ventas_fecha_idx    on public.ventas(created_at desc);


-- ── 7 · Permisos ────────────────────────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.comunas  enable row level security;
alter table public.ventas   enable row level security;

drop policy if exists "perfil propio" on public.profiles;
create policy "perfil propio" on public.profiles
  for select to authenticated using ( id = auth.uid() or public.es_admin() );

drop policy if exists "perfiles admin" on public.profiles;
create policy "perfiles admin" on public.profiles
  for all to authenticated using ( public.es_admin() ) with check ( public.es_admin() );

drop policy if exists "comunas lectura" on public.comunas;
create policy "comunas lectura" on public.comunas
  for select to anon, authenticated using ( true );

drop policy if exists "comunas admin" on public.comunas;
create policy "comunas admin" on public.comunas
  for all to authenticated using ( public.es_admin() ) with check ( public.es_admin() );

drop policy if exists "ventas lectura" on public.ventas;
create policy "ventas lectura" on public.ventas
  for select to authenticated using ( vendedor_id = auth.uid() or public.es_admin() );

drop policy if exists "ventas alta" on public.ventas;
create policy "ventas alta" on public.ventas
  for insert to authenticated with check ( vendedor_id = auth.uid() and public.es_vendedor() );

drop policy if exists "ventas admin" on public.ventas;
create policy "ventas admin" on public.ventas
  for all to authenticated using ( public.es_admin() ) with check ( public.es_admin() );

-- ============================================================================
--  LISTO.
--   · El dueño entra a /admin y ve las pestañas Usuarios, Ventas y Despacho.
--   · Desde Usuarios crea vendedores (correo, nombre, teléfono, observación).
--   · El vendedor entra en la misma web y ve el botón PRODUCTO VENDIDO.
-- ============================================================================
