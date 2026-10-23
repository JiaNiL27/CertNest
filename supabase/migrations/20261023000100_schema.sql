-- CertNest core schema: enums, tables, constraints, indexes.

create type public.expiration_status as enum ('has_date', 'never', 'unknown');
create type public.verification_status as enum ('unverified', 'issuer_link_available', 'verified');
create type public.share_scope as enum ('portfolio', 'certificate');

-- Public display name. Never stores email.
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.certificates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  issuer_name text not null check (char_length(issuer_name) between 1 and 200),
  source_platform text,
  description text check (char_length(description) <= 5000),
  credential_id text,
  credential_url text check (credential_url ~ '^https?://'),
  issued_at date,
  expiration_status public.expiration_status not null default 'unknown',
  expires_at date,
  verification_status public.verification_status not null default 'unverified',
  field_sources jsonb not null default '{}',
  hidden_from_portfolio boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint certificates_expires_at_matches_status
    check ((expiration_status = 'has_date') = (expires_at is not null)),
  constraint certificates_expires_after_issued
    check (expires_at is null or issued_at is null or expires_at >= issued_at)
);
-- "Expired" is not stored; compute expires_at < current_date when displaying.

create index certificates_user_id_idx on public.certificates (user_id);

create table public.certificate_files (
  id uuid primary key default gen_random_uuid(),
  certificate_id uuid not null references public.certificates on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  kind text not null check (kind in ('original', 'badge_image')),
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null
    check (mime_type in ('application/pdf', 'image/png', 'image/jpeg', 'image/webp')),
  file_size bigint not null check (file_size > 0 and file_size <= 10485760),
  public_key text not null unique,
  created_at timestamptz not null default now()
);

create index certificate_files_user_id_idx on public.certificate_files (user_id);
create index certificate_files_certificate_id_idx on public.certificate_files (certificate_id);

create table public.shares (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  scope public.share_scope not null,
  certificate_id uuid references public.certificates on delete cascade,
  public_slug text not null unique,
  is_active boolean not null default true,
  show_credential_id boolean not null default false,
  show_images boolean not null default true,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  constraint shares_scope_matches_certificate
    check ((scope = 'portfolio') = (certificate_id is null)),
  constraint shares_inactive_has_revoked_at
    check (is_active or revoked_at is not null)
);

create index shares_user_id_idx on public.shares (user_id);
create unique index one_active_portfolio on public.shares (user_id)
  where scope = 'portfolio' and is_active;
create unique index one_active_cert_share on public.shares (certificate_id)
  where scope = 'certificate' and is_active;

create table public.skills (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  normalized_name text not null unique
);

create table public.certificate_skills (
  certificate_id uuid not null references public.certificates on delete cascade,
  skill_id uuid not null references public.skills on delete cascade,
  primary key (certificate_id, skill_id)
);

create index certificate_skills_skill_id_idx on public.certificate_skills (skill_id);

create table public.generated_contents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  certificate_id uuid not null references public.certificates on delete cascade,
  content_type text not null
    check (content_type in ('linkedin_post', 'course_summary', 'skills_summary', 'resume_bullets')),
  language text not null default 'en',
  tone text,
  content text not null check (char_length(content) <= 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (certificate_id, content_type, language)
);

create index generated_contents_user_id_idx on public.generated_contents (user_id);
