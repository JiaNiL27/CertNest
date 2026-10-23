-- Triggers: profile on signup, updated_at, owner consistency.

-- Create a profile row for every new auth user.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    left(btrim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), 80)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep updated_at current.
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

create trigger set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.certificates
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.generated_contents
  for each row execute function public.set_updated_at();

-- A row's user_id must equal the owner of the certificate it points to.
-- Security definer so the check uses real ownership, not what RLS lets the
-- caller see.
create function public.enforce_certificate_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.certificate_id is not null and not exists (
    select 1
    from public.certificates c
    where c.id = new.certificate_id
      and c.user_id = new.user_id
  ) then
    raise exception 'certificate owner mismatch'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger enforce_certificate_owner
  before insert or update on public.certificate_files
  for each row execute function public.enforce_certificate_owner();
create trigger enforce_certificate_owner
  before insert or update on public.shares
  for each row execute function public.enforce_certificate_owner();
create trigger enforce_certificate_owner
  before insert or update on public.generated_contents
  for each row execute function public.enforce_certificate_owner();

-- Trigger functions are not meant to be called directly.
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.enforce_certificate_owner() from public, anon, authenticated;
