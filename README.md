# CertNest

A personal certificate collection. Requirements and security rules live in `docs/PLAN.md`.

Stack: Next.js (App Router, TypeScript strict), Tailwind CSS, shadcn/ui, Supabase (Auth, Postgres, Storage), zod, Vitest.

## Setup

1. Install Node.js LTS, then install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.local.example` to `.env.local` and fill in the keys from the **certnest-dev** project
   (Supabase Dashboard → Project Settings → API). `SUPABASE_SERVICE_ROLE_KEY` is server-only: never
   prefix it with `NEXT_PUBLIC_` and never import `src/lib/supabase/admin.ts` from client code.

3. In the Supabase Dashboard → Authentication → URL Configuration, set Site URL to
   `http://localhost:3000` and add `http://localhost:3000/auth/callback` to Redirect URLs.

## Connect the dev project and apply migrations

All database changes are migrations in `supabase/migrations/`. Only ever link the dev project.

```bash
npx supabase login
npx supabase link --project-ref wvoffnlgxdrbzoziexvt
npm run db:push
```

`supabase db reset --linked` wipes the linked database. Only run it against certnest-dev, and only
after confirming.

## Run

```bash
npm run dev
```

Open http://localhost:3000. Sign-up sends a confirmation email (Supabase's built-in mailer is
rate-limited, so use a real inbox sparingly).

## Tests

Tests run against certnest-dev and refuse to start if `.env.local` points anywhere else. They create
throwaway confirmed users through the admin API (no email is sent) and delete them afterwards.

```bash
npm run test:unit  # file type detection, EXIF stripping, form validation (no network besides the env check)
npm run test:db    # RLS, storage, constraints, ensure_skills, uploads/downloads/deletes, library queries
npm run test:app   # next build, then: no service role key in .next/static, protected routes redirect to /login
npm test           # all three
```

## Badge details and status

Clicking a card opens Badge Details in a dialog (same URL); `/certificates/[id]` shows the same view
as a full page. Display rules live in `src/lib/certificates/display.ts`: status is
"Expires {date}", "Expired" (from the day after `expires_at`, UTC), "Does not expire" or
"Status unknown", plus "Issuer link available" when a credential URL exists. CertNest never shows
"Verified" because certificate data is self-reported. Missing fields show "Not provided".

## Public sharing

Owners manage links in `/settings/sharing` (display name, portfolio on/off, new link, options) and
from Share Badge in Badge Details. Public pages:

- `/p/{slug}`: portfolio (badges not hidden from it, plus a skills tab)
- `/p/{slug}/{public_id}`: one badge from the portfolio (`public_id` is a random code, not the id)
- `/b/{slug}`: a single shared badge (works even if hidden from the portfolio)
- `/p|b/{slug}/img/{key}`: badge images, only when the share allows images; never PDFs

Public data comes only from `get_public_portfolio` / `get_public_certificate` (whitelisted fields,
anon key, no session). `resolve_public_image` is service-role only. Invalid or revoked links get
HTTP 404 from the proxy. Pages are `noindex` and never cached; turned-off links can't be revived.

## AI post drafts

`/certificates/{id}` and the Share Badge panel can draft a LinkedIn post with AI
(`POST /api/ai/generate`, streamed text). Only the certificate's own fields are sent (no name,
email, links or Credential ID); the prompt forbids invented facts and "verified" claims. Drafts are
saved per language in `generated_contents` (owner-only, never public). Each user gets 10
generations per rolling hour, enforced in the database (`consume_ai_quota`); failures before any
text is produced are refunded.

The provider is chosen with `AI_PROVIDER` (`src/lib/ai/provider.ts`). Development uses the Gemini
free tier (`GEMINI_API_KEY` from https://aistudio.google.com) — Google may use free-tier prompts,
so use test data only. The default model is `gemini-flash-lite-latest`, falling back to
`gemini-flash-latest` when the first is overloaded or doesn't start answering within 15 seconds
(SDK retries are off so requests never hang). Production refuses Gemini unless `AI_ALLOW_GEMINI_IN_PRODUCTION=true` (paid
key). **Before launch:** switch to a paid provider (Gemini paid or Claude).

## Files

Uploads go through `POST /api/files` (multipart: `certificate_id`, `original`, `badge`); the owner
downloads via `GET /api/files?id=…`, which redirects to a 60-second signed URL. File types are
detected from magic bytes (PDF, PNG, JPEG, WebP), the limit is 10 MB per file, and images are
re-encoded with `sharp` to strip EXIF/GPS metadata. Each certificate keeps at most one original file
and one badge image; an image original without a badge image also gets a separate badge copy.

Other checks: `npm run typecheck`, `npm run lint`.
