-- ============================================================================
--  ESENCIAL EMPORIO · Que se pueda borrar a una persona del equipo
--  ----------------------------------------------------------------------------
--  Borrar un vendedor fallaba con:
--
--    update or delete on table "users" violates foreign key constraint
--    ... is still referenced from table "ventas"
--
--  La API borra las ventas que esa persona registró, pero quedaban otras
--  columnas apuntándole desde ventas de terceros:
--
--    · ventas.vendido_por  — el moderador que cargó una venta en el mostrador
--    · ventas.resuelto_por — el administrador que aceptó o denegó un pedido
--    · pagos.pagado_por    — quien marcó una transferencia
--    · guias.creada_por    — quien armó una guía de despacho
--
--  Ninguna decía qué hacer al borrar al usuario, así que Postgres frenaba el
--  borrado entero. Y está bien que no se borren esas ventas: son de otros
--  vendedores y su comisión tiene que quedar.
--
--  La huella pasa a quedar en nulo: la venta sigue, pero ya no dice quién la
--  tocó. Es lo mismo que hace el disparador del administrador oculto.
--
--  Pégalo en Supabase → SQL Editor y dale Run. Es seguro correrlo dos veces.
-- ============================================================================


-- ── 1 · Las huellas se sueltan, los datos quedan ────────────────────────────
do $$
declare
  f record;
begin
  for f in
    select c.conname, c.conrelid::regclass as tabla, a.attname as columna
    from pg_constraint c
    join unnest(c.conkey) k(att) on true
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.att
    where c.contype = 'f'
      and c.confrelid = 'auth.users'::regclass
      and c.confdeltype = 'a'   -- 'a' = no action, el que frena el borrado
      and c.conrelid in (
        'public.ventas'::regclass,
        'public.pagos'::regclass,
        'public.guias'::regclass
      )
  loop
    execute format('alter table %s drop constraint %I', f.tabla, f.conname);
    execute format(
      'alter table %s add constraint %I foreign key (%I) references auth.users(id) on delete set null',
      f.tabla, f.conname, f.columna);
    raise notice 'Soltada la huella %.% ', f.tabla, f.columna;
  end loop;
end $$;


-- ── 2 · Comprobación ────────────────────────────────────────────────────────
--  Todas tienen que decir "set null". La única que puede seguir en
--  "no action" es ventas.vendedor_id, y esa es a propósito: antes de borrar
--  a alguien hay que decidir qué pasa con sus ventas, y eso lo hace la API.
select
  c.conrelid::regclass::text as tabla,
  a.attname                  as columna,
  case c.confdeltype
    when 'a' then 'no action'
    when 'r' then 'restrict'
    when 'n' then 'set null'
    when 'c' then 'cascade'
    else c.confdeltype::text
  end as al_borrar
from pg_constraint c
join unnest(c.conkey) k(att) on true
join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.att
where c.contype = 'f' and c.confrelid = 'auth.users'::regclass
order by 1, 2;

-- ============================================================================
--  LISTO. Vendedores → Equipo → el lápiz → Eliminar ya funciona.
-- ============================================================================
