-- Row level security. Private data is protected only by these policies.
-- anon gets no policy and no table privileges at all; public pages will go
-- through whitelisted security definer functions (M4).

alter table public.profiles enable row level security;
alter table public.certificates enable row level security;
alter table public.certificate_files enable row level security;
alter table public.shares enable row level security;
alter table public.skills enable row level security;
alter table public.certificate_skills enable row level security;
alter table public.generated_contents enable row level security;

-- Explicit table privileges instead of relying on default grants.
revoke all on
  public.profiles,
  public.certificates,
  public.certificate_files,
  public.shares,
  public.skills,
  public.certificate_skills,
  public.generated_contents
from anon, authenticated;

grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on
  public.certificates,
  public.certificate_files,
  public.shares,
  public.certificate_skills,
  public.generated_contents
to authenticated;
grant select on public.skills to authenticated;

grant all on
  public.profiles,
  public.certificates,
  public.certificate_files,
  public.shares,
  public.skills,
  public.certificate_skills,
  public.generated_contents
to service_role;

-- profiles: own row, select and update only.

create policy "profiles_select_own" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));
create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- certificates
create policy "certificates_select_own" on public.certificates
  for select to authenticated
  using (user_id = (select auth.uid()));
create policy "certificates_insert_own" on public.certificates
  for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "certificates_update_own" on public.certificates
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "certificates_delete_own" on public.certificates
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- certificate_files
create policy "certificate_files_select_own" on public.certificate_files
  for select to authenticated
  using (user_id = (select auth.uid()));
create policy "certificate_files_insert_own" on public.certificate_files
  for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "certificate_files_update_own" on public.certificate_files
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "certificate_files_delete_own" on public.certificate_files
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- shares
create policy "shares_select_own" on public.shares
  for select to authenticated
  using (user_id = (select auth.uid()));
create policy "shares_insert_own" on public.shares
  for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "shares_update_own" on public.shares
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "shares_delete_own" on public.shares
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- generated_contents
create policy "generated_contents_select_own" on public.generated_contents
  for select to authenticated
  using (user_id = (select auth.uid()));
create policy "generated_contents_insert_own" on public.generated_contents
  for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "generated_contents_update_own" on public.generated_contents
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "generated_contents_delete_own" on public.generated_contents
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- certificate_skills: allowed when the certificate belongs to the caller.
create policy "certificate_skills_select_own" on public.certificate_skills
  for select to authenticated
  using (exists (
    select 1 from public.certificates c
    where c.id = certificate_id and c.user_id = (select auth.uid())
  ));
create policy "certificate_skills_insert_own" on public.certificate_skills
  for insert to authenticated
  with check (exists (
    select 1 from public.certificates c
    where c.id = certificate_id and c.user_id = (select auth.uid())
  ));
create policy "certificate_skills_update_own" on public.certificate_skills
  for update to authenticated
  using (exists (
    select 1 from public.certificates c
    where c.id = certificate_id and c.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.certificates c
    where c.id = certificate_id and c.user_id = (select auth.uid())
  ));
create policy "certificate_skills_delete_own" on public.certificate_skills
  for delete to authenticated
  using (exists (
    select 1 from public.certificates c
    where c.id = certificate_id and c.user_id = (select auth.uid())
  ));

-- skills: read-only for signed-in users. Writes go through ensure_skills().

create policy "skills_select_authenticated" on public.skills
  for select to authenticated
  using (true);
