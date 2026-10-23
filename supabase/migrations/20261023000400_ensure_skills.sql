-- The only write path into public.skills.
-- Trims, lowercases for matching, de-duplicates, max 30 names per call.
-- Returns the skill rows for all requested names (existing or new).
create function public.ensure_skills(names text[])
returns setof public.skills
language plpgsql
security definer
set search_path = ''
as $$
declare
  cleaned text[];
begin
  if (select auth.uid()) is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  if names is null or pg_catalog.cardinality(names) = 0 then
    return;
  end if;

  if pg_catalog.cardinality(names) > 30 then
    raise exception 'too many skills (max 30)' using errcode = '22023';
  end if;

  -- Trimmed, non-empty names; first spelling wins for each normalized name.
  select pg_catalog.array_agg(n order by ord)
  into cleaned
  from (
    select distinct on (pg_catalog.lower(pg_catalog.btrim(raw)))
      pg_catalog.btrim(raw) as n, ord
    from pg_catalog.unnest(names) with ordinality as t(raw, ord)
    where raw is not null and pg_catalog.btrim(raw) <> ''
    order by pg_catalog.lower(pg_catalog.btrim(raw)), ord
  ) d;

  if cleaned is null then
    return;
  end if;

  if exists (select 1 from pg_catalog.unnest(cleaned) n where pg_catalog.char_length(n) > 60) then
    raise exception 'skill name too long (max 60)' using errcode = '22023';
  end if;

  insert into public.skills (name, normalized_name)
  select n, pg_catalog.lower(n)
  from pg_catalog.unnest(cleaned) as n
  on conflict (normalized_name) do nothing;

  return query
  select s.*
  from public.skills s
  where s.normalized_name = any (
    select pg_catalog.lower(n) from pg_catalog.unnest(cleaned) as n
  );
end;
$$;

revoke all on function public.ensure_skills(text[]) from public, anon;
grant execute on function public.ensure_skills(text[]) to authenticated;
