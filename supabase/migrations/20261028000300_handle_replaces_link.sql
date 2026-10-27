-- A custom address replaces the random portfolio link: one portfolio, one
-- address. While a handle is set, /p/{slug} is invalid. When the handle is
-- removed, the old random link does NOT come back: a new one is issued.
-- (Single-badge links /b/{slug} are unaffected.)

-- 1. 22 base62 characters from the CSPRNG behind gen_random_uuid().
create function private.random_base62(len integer default 22)
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  bytes bytea := pg_catalog.decode(
    pg_catalog.replace(pg_catalog.gen_random_uuid()::text || pg_catalog.gen_random_uuid()::text, '-', ''),
    'hex'
  );
  result text := '';
begin
  for i in 0 .. len - 1 loop
    result := result || pg_catalog.substr(alphabet, (pg_catalog.get_byte(bytes, i) % 62) + 1, 1);
  end loop;
  return result;
end;
$$;

revoke all on function private.random_base62(integer) from public, anon, authenticated;

-- 2. Random-link reads ignore portfolios whose owner has a custom address.
create or replace function public.get_public_portfolio(p_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  s public.shares;
begin
  if p_slug is null or p_slug !~ '^[0-9A-Za-z]{22}$' then
    return null;
  end if;

  select * into s
  from public.shares
  where public_slug = p_slug and scope = 'portfolio' and is_active;
  if not found then
    return null;
  end if;

  -- Replaced by the owner's custom address.
  if exists (select 1 from public.profiles p where p.id = s.user_id and p.handle is not null) then
    return null;
  end if;

  return jsonb_build_object(
    'display_name', (select p.display_name from public.profiles p where p.id = s.user_id),
    'certificates', coalesce((
      select jsonb_agg(
        private.public_certificate_json(c, s.show_credential_id, s.show_images)
        order by c.created_at desc
      )
      from public.certificates c
      where c.user_id = s.user_id and not c.hidden_from_portfolio
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.resolve_public_image(p_slug text, p_key text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select f.storage_path
  from public.shares s
  join public.profiles p on p.id = s.user_id
  join public.certificates c on c.user_id = s.user_id
  join public.certificate_files f on f.certificate_id = c.id
  where s.public_slug = p_slug
    and s.is_active
    and s.show_images
    and f.public_key = p_key
    and f.kind = 'badge_image'
    and f.mime_type in ('image/png', 'image/jpeg', 'image/webp')
    and (
      (s.scope = 'portfolio' and not c.hidden_from_portfolio and p.handle is null)
      or (s.scope = 'certificate' and c.id = s.certificate_id)
    )
  limit 1;
$$;

-- 3. Removing the handle replaces the active portfolio link with a new one.
create or replace function public.guard_profile_handle()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_share public.shares;
begin
  if new.handle is not distinct from old.handle then
    return new;
  end if;

  if new.handle is not null then
    new.handle := pg_catalog.lower(new.handle);
    if exists (
      select 1 from public.handle_reservations r
      where r.handle = new.handle
        and r.user_id <> new.id
        and r.released_at > pg_catalog.now() - interval '90 days'
    ) then
      raise exception 'handle reserved' using errcode = '23505';
    end if;
    -- Taking back your own reserved handle clears the reservation.
    delete from public.handle_reservations where handle = new.handle;
  end if;

  if old.handle is not null then
    insert into public.handle_reservations (handle, user_id, released_at)
    values (old.handle, old.id, pg_catalog.now())
    on conflict (handle) do update
      set user_id = excluded.user_id, released_at = excluded.released_at;
  end if;

  -- Handle removed: never revive the random link that was in use before.
  if new.handle is null then
    select * into current_share
    from public.shares
    where user_id = new.id and scope = 'portfolio' and is_active;
    if found then
      update public.shares
      set is_active = false, revoked_at = pg_catalog.now()
      where id = current_share.id;
      insert into public.shares (user_id, scope, public_slug, show_credential_id, show_images)
      values (
        new.id, 'portfolio', private.random_base62(22),
        current_share.show_credential_id, current_share.show_images
      );
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.guard_profile_handle() from public, anon, authenticated;
