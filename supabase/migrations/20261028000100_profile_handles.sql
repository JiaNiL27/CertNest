-- M8: optional custom portfolio address, /u/{handle}.
-- The random /p/{slug} link stays the default; a handle is opt-in and works
-- only while the portfolio is on.

-- 1. Format and reserved words (shared by the column check and the trigger).
create function private.handle_is_valid(p_handle text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_handle ~ '^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])$'
    and p_handle !~ '--'
    and p_handle <> all (array[
      'admin', 'administrator', 'api', 'app', 'auth', 'b', 'badge', 'badges', 'certificates',
      'certnest', 'dashboard', 'help', 'login', 'logout', 'me', 'new', 'p', 'portfolio',
      'privacy', 'profile', 'root', 'settings', 'signup', 'skills', 'staff', 'support',
      'system', 'terms', 'u', 'user', 'users', 'www'
    ]);
$$;

revoke all on function private.handle_is_valid(text) from public, anon, authenticated;

alter table public.profiles add column handle text;
alter table public.profiles
  add constraint profiles_handle_format check (handle is null or private.handle_is_valid(handle));
create unique index profiles_handle_key on public.profiles (handle);

-- 2. Released handles stay reserved for their previous owner for 90 days, so
--    nobody else can pick one up and receive that person's visitors.
create table public.handle_reservations (
  handle text primary key,
  user_id uuid not null references auth.users on delete cascade,
  released_at timestamptz not null default now()
);

alter table public.handle_reservations enable row level security;
revoke all on public.handle_reservations from anon, authenticated;
grant all on public.handle_reservations to service_role;
-- No policies: only the trigger below (security definer) touches it.

create function public.guard_profile_handle()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
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
  return new;
end;
$$;

create trigger guard_profile_handle
  before update of handle on public.profiles
  for each row execute function public.guard_profile_handle();

revoke all on function public.guard_profile_handle() from public, anon, authenticated;

-- 3. Public portfolio by handle. Same whitelisted shape as
--    get_public_portfolio; null unless the owner's portfolio link is active.
--    Never returns the random slug.
create function public.get_public_portfolio_by_handle(p_handle text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  owner uuid;
  s public.shares;
begin
  if p_handle is null or not private.handle_is_valid(pg_catalog.lower(p_handle)) then
    return null;
  end if;

  select p.id into owner from public.profiles p where p.handle = pg_catalog.lower(p_handle);
  if owner is null then
    return null;
  end if;

  select * into s
  from public.shares
  where user_id = owner and scope = 'portfolio' and is_active;
  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'display_name', (select p.display_name from public.profiles p where p.id = owner),
    'certificates', coalesce((
      select jsonb_agg(
        private.public_certificate_json(c, s.show_credential_id, s.show_images)
        order by c.created_at desc
      )
      from public.certificates c
      where c.user_id = owner and not c.hidden_from_portfolio
    ), '[]'::jsonb)
  );
end;
$$;

-- 4. Badge image by handle. Service role only (returns a storage path).
create function public.resolve_public_image_by_handle(p_handle text, p_key text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select f.storage_path
  from public.profiles p
  join public.shares s
    on s.user_id = p.id and s.scope = 'portfolio' and s.is_active and s.show_images
  join public.certificates c on c.user_id = p.id and not c.hidden_from_portfolio
  join public.certificate_files f on f.certificate_id = c.id
  where p.handle = pg_catalog.lower(p_handle)
    and f.public_key = p_key
    and f.kind = 'badge_image'
    and f.mime_type in ('image/png', 'image/jpeg', 'image/webp')
  limit 1;
$$;

revoke all on function public.get_public_portfolio_by_handle(text) from public;
revoke all on function public.resolve_public_image_by_handle(text, text) from public, anon, authenticated;
grant execute on function public.get_public_portfolio_by_handle(text) to anon, authenticated;
grant execute on function public.resolve_public_image_by_handle(text, text) to service_role;
