-- ============================================================================
--  ESENCIAL EMPORIO · Base de datos nueva (catálogo para el hogar)
--  ----------------------------------------------------------------------------
--  Un solo archivo. Crea TODO lo que necesita la web, vacío y sin productos
--  de ejemplo. Después cargás tus productos desde /admin.
--
--  CÓMO USARLO
--   1. Creá un proyecto NUEVO en Supabase (no uses el de la web anterior).
--   2. Abajo, en el PASO 0, poné tu correo (y el del cliente) en MINÚSCULAS.
--   3. Supabase → SQL Editor → New query → pegá todo esto → Run.
--   4. Authentication → Users → Add user: creá el usuario admin con ese correo.
--      (Opcional: Authentication → Providers → Email: desactivá "Confirm email".)
--   5. Settings → API: copiá Project URL y anon public key a
--      js/supabase-config.js.
--
--  Es seguro correrlo varias veces.
-- ============================================================================


-- ── PASO 0 · Quién es administrador ─────────────────────────────────────────
--  Solo estos correos pueden editar el catálogo desde /admin. El resto, aunque
--  tenga sesión, no puede escribir. Poné los correos reales, en minúsculas.
create or replace function public.es_admin()
returns boolean language sql stable as $$
  select lower(auth.jwt() ->> 'email') in (
    'tu-correo@ejemplo.com',
    'correo-del-cliente@ejemplo.com'
  );
$$;

-- El "dueño" es el único que puede encender/apagar el modo mantenimiento.
create or replace function public.es_owner()
returns boolean language sql stable as $$
  select lower(auth.jwt() ->> 'email') = 'tu-correo@ejemplo.com';
$$;


-- ── 1 · Productos ───────────────────────────────────────────────────────────
--  La categoría es texto libre: la definís vos desde /admin (Cocina, Belleza,
--  Herramientas, Limpieza, etc.). Sin candado de categorías fijas.
create table if not exists public.products (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,
  name          text not null,
  category      text not null default 'otros',
  description   text default '',
  image         text default '',
  image_scale   numeric default 0.85,
  in_stock      boolean default true,
  features      text[] default '{}',
  gallery       text[] default '{}',
  colors        jsonb  default '[]'::jsonb,
  position      int    default 0,
  -- venta: precio anterior (para el chip de descuento) y stock real
  compare_at_price int,
  stock_qty        int,
  -- carrusel principal (HERO). Si is_hero = false se ignora.
  is_hero       boolean default false,
  hero_name     text,
  hero_bg_label text,
  hero_image    text,
  hero_scale    numeric,
  hero_offset_x int,
  hero_offset_y int,
  hero_order    int,
  -- carrusel de destacados. Si is_featured = false se ignora.
  is_featured   boolean default false,
  featured_tag  text,
  featured_name text,
  featured_image text,
  featured_order int,
  created_at    timestamptz default now()
);

alter table public.products drop constraint if exists products_compare_at_price_chk;
alter table public.products add  constraint products_compare_at_price_chk
  check (compare_at_price is null or compare_at_price > 0);
alter table public.products drop constraint if exists products_stock_qty_chk;
alter table public.products add  constraint products_stock_qty_chk
  check (stock_qty is null or stock_qty >= 0);


-- ── 2 · Precio ──────────────────────────────────────────────────────────────
--  El precio vive en price_tiers. Para un precio simple alcanza con el tramo
--  de 1 unidad; el panel lo arma solo al guardar el producto.
create table if not exists public.price_tiers (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products(id) on delete cascade,
  qty         int  not null,
  price       int  not null,
  active      boolean not null default true,
  unique (product_id, qty)
);
create index if not exists price_tiers_product_idx on public.price_tiers(product_id);


-- ── 3 · Configuración del sitio (banners, categorías, filas) ────────────────
create table if not exists public.site_config (
  key        text primary key,
  value      jsonb       not null,
  updated_at timestamptz not null default now()
);

create or replace function public.site_config_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists site_config_touch on public.site_config;
create trigger site_config_touch
  before update on public.site_config
  for each row execute function public.site_config_touch();


-- ── 4 · Reseñas (con moderación) ────────────────────────────────────────────
create table if not exists public.reviews (
  id           uuid primary key default gen_random_uuid(),
  product_slug text not null,
  name         text not null default '',
  stars        int  not null default 5 check (stars between 1 and 5),
  text         text not null default '',
  color        text default '',
  verified     boolean not null default false,
  images       jsonb not null default '[]',
  fecha        date not null default current_date,
  position     int  not null default 0,
  status       text not null default 'aprobada',
  ip_hash      text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'reviews_status_chk') then
    alter table public.reviews add constraint reviews_status_chk check (status in ('pendiente','aprobada'));
  end if;
end $$;

create index if not exists reviews_slug   on public.reviews (product_slug, position);
create index if not exists reviews_status on public.reviews (status, product_slug);
create index if not exists reviews_ip     on public.reviews (ip_hash, created_at);


-- ── 5 · Modo mantenimiento ──────────────────────────────────────────────────
create table if not exists public.app_flags (
  id         int primary key default 1,
  locked     boolean not null default false,
  mensaje    text    not null default '',
  updated_at timestamptz not null default now(),
  constraint app_flags_una_fila check (id = 1)
);
insert into public.app_flags (id, locked, mensaje)
values (1, false, '') on conflict (id) do nothing;


-- ── 6 · Permisos (RLS): lectura pública, escritura solo admin ───────────────
alter table public.products    enable row level security;
alter table public.price_tiers enable row level security;
alter table public.site_config enable row level security;
alter table public.reviews     enable row level security;
alter table public.app_flags   enable row level security;

-- products
drop policy if exists "products public read" on public.products;
create policy "products public read" on public.products
  for select to anon, authenticated using ( true );
drop policy if exists "products admin write" on public.products;
create policy "products admin write" on public.products
  for all to authenticated using ( public.es_admin() ) with check ( public.es_admin() );

-- price_tiers
drop policy if exists "tiers public read" on public.price_tiers;
create policy "tiers public read" on public.price_tiers
  for select to anon, authenticated using ( true );
drop policy if exists "tiers admin write" on public.price_tiers;
create policy "tiers admin write" on public.price_tiers
  for all to authenticated using ( public.es_admin() ) with check ( public.es_admin() );

-- site_config
drop policy if exists "site_config public read" on public.site_config;
create policy "site_config public read" on public.site_config
  for select to anon, authenticated using ( true );
drop policy if exists "site_config admin write" on public.site_config;
create policy "site_config admin write" on public.site_config
  for all to authenticated using ( public.es_admin() ) with check ( public.es_admin() );

-- reviews: el público ve las aprobadas; el admin las ve y edita todas
drop policy if exists "reviews lee aprobadas" on public.reviews;
create policy "reviews lee aprobadas" on public.reviews
  for select to anon, authenticated
  using ( status = 'aprobada' or public.es_admin() );
drop policy if exists "reviews admin write" on public.reviews;
create policy "reviews admin write" on public.reviews
  for all to authenticated using ( public.es_admin() ) with check ( public.es_admin() );

-- app_flags: todos leen, solo el dueño escribe
drop policy if exists "app_flags lectura" on public.app_flags;
create policy "app_flags lectura" on public.app_flags
  for select to anon, authenticated using ( true );
drop policy if exists "app_flags escritura" on public.app_flags;
create policy "app_flags escritura" on public.app_flags
  for update to authenticated using ( public.es_owner() ) with check ( public.es_owner() );


-- ── 7 · Almacenamiento de imágenes (bucket público) ─────────────────────────
insert into storage.buckets (id, name, public)
values ('site-images', 'site-images', true)
on conflict (id) do nothing;

drop policy if exists "site-images public read" on storage.objects;
create policy "site-images public read" on storage.objects
  for select using ( bucket_id = 'site-images' );

drop policy if exists "site-images admin write" on storage.objects;
create policy "site-images admin write" on storage.objects
  for all to authenticated
  using      ( bucket_id = 'site-images' and public.es_admin() )
  with check ( bucket_id = 'site-images' and public.es_admin() );

-- ============================================================================
--  LISTO. La base queda vacía y lista. Ahora:
--   · Entrá a /admin con el usuario que creaste y cargá tus productos.
--   · Mientras no haya productos cargados, la web muestra los de ejemplo
--     (las 4 fotos del emporio) definidos en js/sd.js.
-- ============================================================================
