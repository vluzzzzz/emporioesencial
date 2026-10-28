-- ============================================================================
--  ESENCIAL EMPORIO · Ocultar un producto sin eliminarlo
--  ----------------------------------------------------------------------------
--  Qué hace:
--   · Agrega la columna `oculto` a products.
--   · Un producto con oculto = true NO aparece en la web pública (catálogo,
--     buscador, categorías, hero ni similares), pero sigue existiendo en la
--     base y en el panel de edición, en gris, con el cartel "Producto oculto".
--   · Al volver a mostrarlo, reaparece tal cual estaba: fotos, precio y stock
--     no se tocan.
--
--  No es lo mismo que agotado: agotado = stock 0 (se muestra con el cartel
--  AGOTADO); oculto = no se muestra en absoluto.
--
--  Pégalo en Supabase → SQL Editor y dale Run. Es seguro correrlo dos veces.
-- ============================================================================

alter table public.products
  add column if not exists oculto boolean not null default false;

-- Índice chico para las consultas que filtran por visibilidad.
create index if not exists products_oculto_idx on public.products(oculto);

-- ── Comprobación ────────────────────────────────────────────────────────────
--  Al terminar tiene que decir: columna oculto SÍ
select
  case when exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'products'
      and column_name  = 'oculto'
  ) then 'columna oculto SÍ' else 'columna oculto NO' end as instalado;

-- ============================================================================
--  LISTO. En la web, con "Editar" prendido, cada tarjeta tiene un ojito
--  arriba a la izquierda: lo apagás y el producto desaparece de la tienda;
--  lo volvés a prender y regresa.
-- ============================================================================
