-- ============================================================================
--  ESENCIAL EMPORIO · Vendedor de prueba con ventas de septiembre y octubre
--  ----------------------------------------------------------------------------
--  Crea un vendedor llamado "Usuario Prueba" con unas 30 ventas repartidas
--  entre septiembre y lo que va de octubre, para ver cómo queda el calendario
--  y la cuenta de comisiones.
--
--  Entra con:  prueba@esencialemporio.cl  /  prueba1234
--
--  Corre primero supabase/pedidos-comisiones.sql.
--  Pega esto en Supabase → SQL Editor y dale Run.
--
--  PARA BORRARLO después, corre el bloque del final de este archivo.
-- ============================================================================

do $$
declare
  uid uuid;
  base date := date_trunc('month', current_date)::date - interval '1 month';
begin
  -- ── El usuario ────────────────────────────────────────────────────────────
  select id into uid from auth.users where email = 'prueba@esencialemporio.cl';

  if uid is null then
    uid := gen_random_uuid();
    -- Los campos de token van en '' y NO en null: el login de Supabase los
    -- lee como texto y con null responde "Database error querying schema".
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      confirmation_token, recovery_token, email_change,
      email_change_token_new, email_change_token_current,
      phone_change, phone_change_token, reauthentication_token
    ) values (
      '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
      'prueba@esencialemporio.cl', crypt('prueba1234', gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"nombre":"Usuario Prueba","rol":"vendedor"}'::jsonb,
      '', '', '', '', '', '', '', ''
    );
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at)
    values (gen_random_uuid(), uid, uid::text,
            json_build_object('sub', uid::text, 'email', 'prueba@esencialemporio.cl')::jsonb,
            'email', now(), now());
  end if;

  insert into public.profiles (id, email, nombre, telefono, observacion, rol, activo)
  values (uid, 'prueba@esencialemporio.cl', 'Usuario Prueba', '+56 9 7777 7777',
          'Cuenta de prueba, se puede borrar', 'vendedor', true)
  on conflict (id) do update set nombre = 'Usuario Prueba', rol = 'vendedor', activo = true;

  -- ── Las ventas ────────────────────────────────────────────────────────────
  delete from public.ventas where vendedor_id = uid;

  insert into public.ventas (
    vendedor_id, vendedor_nombre, producto_slug, producto_nombre,
    cantidad, precio_unitario, comuna, costo_despacho, total,
    cliente_nombre, cliente_telefono, cliente_email, cliente_direccion,
    metodo_pago, notas, estado, created_at
  )
  select
    uid, 'Usuario Prueba', v.slug, v.nombre,
    v.cant, v.precio, v.comuna, v.envio, 0,
    v.cliente, '+56 9 ' || lpad((1000 + v.n * 7)::text, 4, '0') || ' ' || lpad((2000 + v.n * 13)::text, 4, '0'),
    '', v.calle || ' ' || (100 + v.n * 3),
    v.pago, '', v.estado,
    (base + make_interval(days => v.dia - 1) + make_interval(hours => v.hora, mins => v.n * 7))::timestamptz
  from (values
    -- ── Mes pasado ──────────────────────────  dia  hora
    (1,  'soplador-bateria','Soplador / Ventilador a Batería 18V',      1, 29990, 'Viña del Mar',3000,'Marcela Rojas',  'Av. Libertad',      'Transferencia','aceptado',  2, 10),
    (2,  'set-cocina-silicona','Set de Cocina de Silicona 12 Piezas',   2, 10000, 'Valparaíso',  3000,'Jorge Pérez',    'Calle Prat',        'Efectivo',     'aceptado',  3, 11),
    (3,  'mug-termico-colocolo','Mug Térmico Colo-Colo',                1,  8990, 'Quilpué',     3000,'Daniela Soto',   'Los Carrera',       'Transferencia','aceptado',  5, 16),
    (4,  'tabla-picar-colocolo','Tabla de Picar de Madera Colo-Colo',   1, 11990, 'Viña del Mar',3000,'Pablo Muñoz',    'Av. San Martín',    'Transferencia','aceptado',  5, 18),
    (5,  'set-tazones-colocolo','Set 4 Tazones Cerámica Colo-Colo',     1, 15990, 'Concón',      3500,'Carla Vidal',    'Av. Borgoño',       'Débito o crédito','aceptado', 8, 12),
    (6,  'limpiavidrios-telescopico','Limpiavidrios Telescópico',       3,  4990, 'Villa Alemana',3500,'Rodrigo Díaz',  'Av. Valparaíso',    'Efectivo',     'aceptado',  9, 15),
    (7,  'calentador-cera','Calentador de Cera Profesional',            1, 12990, 'Viña del Mar',3000,'Fernanda Lagos', 'Av. Agua Santa',    'Transferencia','aceptado', 11, 10),
    (8,  'cojin-escudo-colocolo','Cojín Escudo Colo-Colo',              2, 10990, 'Valparaíso',  3000,'Ignacio Reyes',  'Subida Ecuador',    'Transferencia','aceptado', 12, 17),
    (9,  'adorno-escudo-colocolo','Adorno Escudo Colo-Colo Eterno Campeón',1,13990,'Quilpué',    3000,'Paula Herrera',  'Blanco Encalada',   'Transferencia','denegado', 14, 13),
    (10, 'botella-sorbete-colocolo','Botella con Sorbete Colo-Colo',    2,  7990, 'Viña del Mar',3000,'Cristián Fuentes','Av. Marina',       'Efectivo',     'aceptado', 15, 11),
    (11, 'shaker-colocolo','Botella Shaker Deportiva Colo-Colo',        1, 10990, 'Limache',     4000,'Valentina Cruz', 'Urmeneta',          'Transferencia','aceptado', 17, 14),
    (12, 'mug-rosado-colocolo','Mug 1200 ml Colo-Colo Campeonas',       1, 14990, 'Valparaíso',  3000,'Andrés Pino',    'Av. Brasil',        'Transferencia','aceptado', 19, 16),
    (13, 'soplador-bateria','Soplador / Ventilador a Batería 18V',      1, 29990, 'Quintero',    4500,'Camila Torres',  'Av. Normandie',     'Débito o crédito','aceptado',20, 10),
    (14, 'gorro-colocolo','Gorro Bucket Colo-Colo',                     2,  8990, 'Viña del Mar',3000,'Sebastián Lara', 'Av. Libertad',      'Efectivo',     'aceptado', 22, 18),
    (15, 'set-vaso-destapador-colocolo','Set Vaso de Cerveza + Destapador Colo-Colo',1,12990,'Villa Alemana',3500,'Javiera Núñez','Av. Valparaíso','Transferencia','aceptado',23,12),
    (16, 'jarro-cerveza-colocolo','Jarro de Cerveza Colo-Colo',         3,  7490, 'Valparaíso',  3000,'Matías Salinas', 'Av. Pedro Montt',   'Transferencia','aceptado', 25, 15),
    (17, 'billetera-colocolo','Billetera Colo-Colo',                    1,  9990, 'Concón',      3500,'Antonia Rivas',  'Av. Borgoño',       'Transferencia','aceptado', 26, 11),
    (18, 'schopero-colocolo','Schopero 500 ml Colo-Colo',               4,  6990, 'Quilpué',     3000,'Felipe Vargas',  'Los Carrera',       'Efectivo',     'aceptado', 28, 17),
    -- ── Este mes ────────────────────────────
    (19, 'set-cocina-silicona','Set de Cocina de Silicona 12 Piezas',   1, 10000, 'Viña del Mar',3000,'Rocío Espinoza', 'Av. San Martín',    'Transferencia','aceptado', 32, 10),
    (20, 'soplador-bateria','Soplador / Ventilador a Batería 18V',      1, 29990, 'Valparaíso',  3000,'Diego Araya',    'Calle Prat',        'Transferencia','aceptado', 33, 13),
    (21, 'mug-rosado-colocolo','Mug 1200 ml Colo-Colo Campeonas',       2, 14990, 'Quilpué',     3000,'Francisca Olea', 'Blanco Encalada',   'Efectivo',     'aceptado', 35, 16),
    (22, 'tabla-picar-colocolo','Tabla de Picar de Madera Colo-Colo',   1, 11990, 'Concón',      3500,'Nicolás Bravo',  'Av. Borgoño',       'Transferencia','aceptado', 36, 11),
    (23, 'vaso-sorbete-colocolo','Vaso con Sorbete y Tapa Colo-Colo',   3,  5990, 'Viña del Mar',3000,'Isidora Campos', 'Av. Marina',        'Transferencia','aceptado', 38, 15),
    (24, 'cojin-cuello-colocolo','Cojín de Cuello Colo-Colo',           1,  9990, 'Limache',     4000,'Tomás Riquelme', 'Urmeneta',          'Débito o crédito','aceptado',39,12),
    (25, 'calentador-cera','Calentador de Cera Profesional',            2, 12990, 'Valparaíso',  3000,'Catalina Soto',  'Av. Brasil',        'Transferencia','aceptado', 41, 17),
    (26, 'set-tazones-colocolo','Set 4 Tazones Cerámica Colo-Colo',     1, 15990, 'Villa Alemana',3500,'Martín Guzmán', 'Av. Valparaíso',    'Transferencia','aceptado', 42, 10),
    (27, 'adorno-escudo-colocolo','Adorno Escudo Colo-Colo Eterno Campeón',1,13990,'Viña del Mar',3000,'Josefa Molina','Av. Agua Santa',    'Efectivo',     'pendiente',44, 14),
    (28, 'llavero-colocolo','Llavero Colo-Colo',                        5,  2990, 'Quilpué',     3000,'Benjamín Ortiz', 'Los Carrera',       'Transferencia','pendiente',45, 18),
    (29, 'schopero-frozen-colocolo','Schopero Frozen Colo-Colo',        2,  9990, 'Valparaíso',  3000,'Emilia Castro',  'Subida Ecuador',    'Transferencia','pendiente',46, 11),
    (30, 'soplador-bateria','Soplador / Ventilador a Batería 18V',      1, 29990, 'Concón',      3500,'Gabriel Fuentes','Av. Borgoño',       'Transferencia','pendiente',47, 16)
  ) as v(n, slug, nombre, cant, precio, comuna, envio, cliente, calle, pago, estado, dia, hora)
  -- Solo las que caen en un día que ya pasó.
  where (base + make_interval(days => v.dia - 1))::date <= current_date;

  raise notice 'Listo: Usuario Prueba con sus ventas cargadas.';
end $$;


-- ============================================================================
--  PARA BORRAR LA PRUEBA, descomenta y corre esto:
-- ----------------------------------------------------------------------------
-- delete from public.ventas   where vendedor_id = (select id from auth.users where email = 'prueba@esencialemporio.cl');
-- delete from public.profiles where id          = (select id from auth.users where email = 'prueba@esencialemporio.cl');
-- delete from auth.users      where email       = 'prueba@esencialemporio.cl';
-- ============================================================================
