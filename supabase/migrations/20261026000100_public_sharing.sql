-- M4: public sharing. Public data leaves the database only through the
-- whitelisted security definer functions below; anon still has no table access.

-- 1. Random public code per certificate, used in portfolio URLs instead of the
--    certificate id. Existing rows get their own value (volatile default).
alter table public.certificates
  add column public_id text not null default replace(gen_random_uuid()::text, '-', '');
alter table public.certificates
  add constraint certificates_public_id_key unique (public_id),
  add constraint certificates_public_id_format check (public_id ~ '^[0-9a-f]{32}$');

-- 2. Share slugs: 22 base62 characters from the server's CSPRNG.
alter table public.shares
  add constraint shares_public_slug_format check (public_slug ~ '^[0-9A-Za-z]{22}$');

-- 3. Shares are revoke-only: a revoked link can never come back, and the
--    identity of a share (slug, owner, scope, certificate) is immutable.
--    Re-enabling always creates a new row with a new slug.
create function public.guard_share_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.public_slug <> old.public_slug
    or new.user_id <> old.user_id
    or new.scope <> old.scope
    or new.certificate_id is distinct from old.certificate_id then
    raise exception 'share identity cannot change' using errcode = '42501';
  end if;
  if not old.is_active and new.is_active then
    raise exception 'revoked shares cannot be reactivated' using errcode = '42501';
  end if;
  if old.is_active and not new.is_active then
    new.revoked_at := pg_catalog.now();
  end if;
  if not new.is_active then
    new.revoked_at := coalesce(old.revoked_at, new.revoked_at);
  end if;
  return new;
end;
$$;

create trigger guard_share_update
  before update on public.shares
  for each row execute function public.guard_share_update();

revoke all on function public.guard_share_update() from public, anon, authenticated;

-- 4. Private helpers, not exposed through the API.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- The only shape in which a certificate is ever made public. Lists every
-- allowed field explicitly; no ids, owner, storage paths, files or AI content.
create function private.public_certificate_json(
  c public.certificates,
  show_credential_id boolean,
  show_images boolean
)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'public_id', c.public_id,
    'title', c.title,
    'issuer_name', c.issuer_name,
    'source_platform', c.source_platform,
    'description', c.description,
    'issued_at', c.issued_at,
    'expiration_status', c.expiration_status,
    'expires_at', c.expires_at,
    'credential_url', c.credential_url,
    'credential_id', case when show_credential_id then c.credential_id end,
    'skills', coalesce((
      select jsonb_agg(s.name order by s.name)
      from public.certificate_skills cs
      join public.skills s on s.id = cs.skill_id
      where cs.certificate_id = c.id
    ), '[]'::jsonb),
    'image_key', case when show_images then (
      select f.public_key
      from public.certificate_files f
      where f.certificate_id = c.id and f.kind = 'badge_image'
      order by f.created_at desc
      limit 1
    ) end
  );
$$;

revoke all on function private.public_certificate_json(public.certificates, boolean, boolean)
  from public, anon, authenticated;

-- 5. Public portfolio: display name plus every certificate not hidden from it.
create function public.get_public_portfolio(p_slug text)
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

-- 6. Single-certificate share. "Hidden from portfolio" does not block it:
--    the owner explicitly created this link.
create function public.get_public_certificate(p_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  s public.shares;
  c public.certificates;
begin
  if p_slug is null or p_slug !~ '^[0-9A-Za-z]{22}$' then
    return null;
  end if;

  select * into s
  from public.shares
  where public_slug = p_slug and scope = 'certificate' and is_active;
  if not found then
    return null;
  end if;

  select * into c
  from public.certificates
  where id = s.certificate_id and user_id = s.user_id;
  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'display_name', (select p.display_name from public.profiles p where p.id = s.user_id),
    'certificate', private.public_certificate_json(c, s.show_credential_id, s.show_images)
  );
end;
$$;

-- 7. Storage path for a public badge image. Service role only (the path
--    contains the user id). Never resolves original files.
create function public.resolve_public_image(p_slug text, p_key text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select f.storage_path
  from public.shares s
  join public.certificates c on c.user_id = s.user_id
  join public.certificate_files f on f.certificate_id = c.id
  where s.public_slug = p_slug
    and s.is_active
    and s.show_images
    and f.public_key = p_key
    and f.kind = 'badge_image'
    and f.mime_type in ('image/png', 'image/jpeg', 'image/webp')
    and (
      (s.scope = 'portfolio' and not c.hidden_from_portfolio)
      or (s.scope = 'certificate' and c.id = s.certificate_id)
    )
  limit 1;
$$;

revoke all on function public.get_public_portfolio(text) from public;
revoke all on function public.get_public_certificate(text) from public;
revoke all on function public.resolve_public_image(text, text) from public, anon, authenticated;

grant execute on function public.get_public_portfolio(text) to anon, authenticated;
grant execute on function public.get_public_certificate(text) to anon, authenticated;
grant execute on function public.resolve_public_image(text, text) to service_role;
