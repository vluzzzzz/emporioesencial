-- ============================================================================
--  ESENCIAL EMPORIO · Guía de despacho para el repartidor
--  ----------------------------------------------------------------------------
--  Cada guía es un link que el administrador le pasa al repartidor. Adentro
--  van solo los datos que el repartidor necesita: a dónde va, a quién le
--  entrega y a quién le pregunta. Nunca la comisión ni la ganancia.
--
--  Los datos se guardan copiados dentro de la guía. Así el link sigue
--  sirviendo aunque después se edite o se borre el pedido, y el que abre el
--  link no puede llegar a la tabla de ventas.
--
--  El administrador apaga el link cuando quiere: con activa = false deja de
--  abrirse para todos.
--
--  Pégalo en Supabase → SQL Editor y dale Run. Es seguro correrlo dos veces.
-- ============================================================================

create extension if not exists pgcrypto;

create table if not exists public.guias (
  id          uuid primary key default gen_random_uuid(),
  venta_id    uuid references public.ventas(id) on delete set null,
  datos       jsonb not null,
  activa      boolean not null default true,
  creada_por  uuid references auth.users(id),
  created_at  timestamptz not null default now()
);

create index if not exists guias_venta_idx on public.guias(venta_id);

alter table public.guias enable row level security;

-- El administrador hace de todo con sus guías.
drop policy if exists "guias admin" on public.guias;
create policy "guias admin" on public.guias
  for all to authenticated using ( public.es_admin() ) with check ( public.es_admin() );

-- Cualquiera con el link abre la guía, mientras esté encendida. El link es
-- un uuid: sin tenerlo no hay forma de listar ni adivinar las demás.
drop policy if exists "guias link" on public.guias;
create policy "guias link" on public.guias
  for select to anon, authenticated using ( activa );

-- ============================================================================
--  LISTO. El botón "Guía para el repartidor" vive en Vendedores → el pedido.
-- ============================================================================
