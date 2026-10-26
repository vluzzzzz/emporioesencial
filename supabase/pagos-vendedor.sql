-- ============================================================================
--  ESENCIAL EMPORIO · Pagos al vendedor
--  ----------------------------------------------------------------------------
--  El sistema ya calcula lo que hay que pagarle a cada vendedor, pero ahí se
--  terminaba: no había dónde anotar que ese pago ya se hizo. A fin de mes el
--  administrador miraba los números, transfería, y no le quedaba registro de
--  a quién le pagó, cuánto ni cuándo.
--
--   1. DATOS BANCARIOS. Opcionales, para que transferir sea de una.
--   2. PAGOS. Una fila por vendedor y por mes, con la foto de lo que se
--      transfirió ese día.
--
--  La foto no se recalcula nunca. Si después de pagar entra otra venta de ese
--  mismo mes, el monto guardado no se mueve: dice lo que realmente se
--  transfirió. La diferencia aparece en el panel como saldo pendiente.
--
--  Corre PRIMERO supabase/venta-local.sql. Después pega esto en Supabase →
--  SQL Editor y dale Run. Es seguro correrlo dos veces.
-- ============================================================================


-- ── 1 · Dónde transferirle a cada uno ───────────────────────────────────────
--  Va aparte de `profiles` a propósito. La política "perfiles caja" le deja
--  al moderador leer los perfiles de los vendedores, para poder elegirlos en
--  el mostrador. Si la cuenta bancaria viviera ahí, se la estaría mostrando
--  también. Las reglas de acceso deciden por fila, no por columna, así que la
--  única forma limpia de separarlo es otra tabla.
create table if not exists public.datos_bancarios (
  vendedor_id uuid primary key references auth.users(id) on delete cascade,
  banco       text not null default '',
  tipo_cuenta text not null default '',
  numero      text not null default '',
  rut         text not null default '',
  titular     text not null default '',
  correo      text not null default '',
  updated_at  timestamptz not null default now(),
  created_at  timestamptz not null default now()
);

alter table public.datos_bancarios enable row level security;

drop policy if exists "banco admin" on public.datos_bancarios;
create policy "banco admin" on public.datos_bancarios
  for all to authenticated using ( public.es_admin() ) with check ( public.es_admin() );

-- Cada uno ve dónde le van a depositar, y nada más.
drop policy if exists "banco propio" on public.datos_bancarios;
create policy "banco propio" on public.datos_bancarios
  for select to authenticated using ( vendedor_id = auth.uid() );


-- ── 2 · Lo que ya se pagó ───────────────────────────────────────────────────
create table if not exists public.pagos (
  id              uuid primary key default gen_random_uuid(),
  vendedor_id     uuid not null references auth.users(id) on delete cascade,
  periodo         text not null,
  monto           int  not null default 0 check (monto >= 0),
  monto_local     int  not null default 0 check (monto_local >= 0),
  monto_delivery  int  not null default 0 check (monto_delivery >= 0),
  ventas          int  not null default 0,
  nota            text not null default '',
  pagado_en       timestamptz not null default now(),
  pagado_por      uuid references auth.users(id),
  created_at      timestamptz not null default now()
);

-- El mes, en formato 2026-10. Un pago por vendedor y por mes: volver a
-- marcarlo actualiza el que ya está, no suma otro.
alter table public.pagos drop constraint if exists pagos_periodo_chk;
alter table public.pagos add  constraint pagos_periodo_chk
  check (periodo ~ '^[0-9]{4}-[0-9]{2}$');

create unique index if not exists pagos_vendedor_periodo_idx
  on public.pagos(vendedor_id, periodo);
create index if not exists pagos_periodo_idx on public.pagos(periodo);

alter table public.pagos enable row level security;

drop policy if exists "pagos admin" on public.pagos;
create policy "pagos admin" on public.pagos
  for all to authenticated using ( public.es_admin() ) with check ( public.es_admin() );

-- El vendedor ve si ya le pagaron el mes. Es la pregunta que hace por
-- mensaje todos los meses: que la responda la página.
drop policy if exists "pagos propios" on public.pagos;
create policy "pagos propios" on public.pagos
  for select to authenticated using ( vendedor_id = auth.uid() );


-- ── 3 · Comprobación ────────────────────────────────────────────────────────
select
  (select count(*) from public.pagos)            as pagos,
  (select count(*) from public.datos_bancarios)  as cuentas_cargadas,
  (select count(*) from public.profiles where rol = 'vendedor') as vendedores;

-- ============================================================================
--  LISTO.
--   · Vendedores → Equipo: cárgale la cuenta a cada vendedor.
--   · Vendedores → Pagos: elige el mes, abre a uno y marca el pago.
-- ============================================================================
