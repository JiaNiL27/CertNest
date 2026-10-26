-- M5: per-user hourly limit for AI generation.
-- Rows are only written through the security definer functions below, so a
-- user can't insert, edit or delete their own history to reset the limit.

create table public.ai_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  feature text not null check (feature in ('linkedin_post')),
  created_at timestamptz not null default now()
);

create index ai_requests_user_created_idx on public.ai_requests (user_id, created_at desc);

alter table public.ai_requests enable row level security;

revoke all on public.ai_requests from anon, authenticated;
grant select on public.ai_requests to authenticated;
grant all on public.ai_requests to service_role;

create policy "ai_requests_select_own" on public.ai_requests
  for select to authenticated
  using (user_id = (select auth.uid()));

-- The limit lives in the database, not in the request, so callers can't raise it.
create function private.ai_hourly_limit()
returns integer
language sql
immutable
set search_path = ''
as $$ select 10 $$;

revoke all on function private.ai_hourly_limit() from public, anon, authenticated;

-- Remaining generations in the current rolling hour (read-only).
create function public.ai_quota_remaining()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select greatest(
    private.ai_hourly_limit() - (
      select count(*)::integer
      from public.ai_requests r
      where r.user_id = (select auth.uid())
        and r.created_at > pg_catalog.now() - interval '1 hour'
    ),
    0
  );
$$;

-- Atomically checks the limit and records one request. Returns the request
-- id, or null when the limit is reached. A per-user advisory lock makes
-- concurrent calls queue instead of all passing the check.
create function public.consume_ai_quota(p_feature text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  used integer;
  new_id uuid;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(uid::text, 0));

  select count(*) into used
  from public.ai_requests
  where user_id = uid and created_at > pg_catalog.now() - interval '1 hour';

  if used >= private.ai_hourly_limit() then
    return null;
  end if;

  insert into public.ai_requests (user_id, feature)
  values (uid, p_feature)
  returning id into new_id;
  return new_id;
end;
$$;

-- Gives a request back when generation failed before producing anything.
-- Service role only: if users could call it they could reset their own limit.
create function public.refund_ai_request(p_id uuid, p_user_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.ai_requests
  where id = p_id
    and user_id = p_user_id
    and created_at > pg_catalog.now() - interval '5 minutes';
$$;

revoke all on function public.ai_quota_remaining() from public, anon;
revoke all on function public.consume_ai_quota(text) from public, anon;
revoke all on function public.refund_ai_request(uuid, uuid) from public, anon, authenticated;
grant execute on function public.ai_quota_remaining() to authenticated;
grant execute on function public.consume_ai_quota(text) to authenticated;
grant execute on function public.refund_ai_request(uuid, uuid) to service_role;
