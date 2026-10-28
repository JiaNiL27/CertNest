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
npm run test:e2e   # next build, then Playwright (desktop + Pixel 7 emulation) with axe checks
```

End-to-end tests (`e2e/`) start a production server on port 3200 with the test-only AI provider
(`AI_PROVIDER=mock`, `CERTNEST_E2E=true`), create confirmed throwaway users through the admin API,
and delete them afterwards. First run only: `npx playwright install chromium`. Sign-up and email
verification need a real inbox and stay a manual check.

## Badge details and status

Clicking a card opens Badge Details in a dialog (same URL); `/certificates/[id]` shows the same view
as a full page. Display rules live in `src/lib/certificates/display.ts`: status is
"Expires {date}", "Expired" (from the day after `expires_at`, UTC), "Does not expire" or
"Status unknown", plus "Issuer link available" when a credential URL exists. CertNest never shows
"Verified" because certificate data is self-reported. Missing fields show "Not provided".

## Public sharing

Owners manage links in `/settings/sharing` (display name, portfolio on/off, new link, options) and
from Share Badge in Badge Details. Public pages:

- `/p/{slug}` and `/p/{slug}/skills`: portfolio (badges not hidden from it) and its skills
- `/u/{handle}`, `/u/{handle}/skills`, `/u/{handle}/badges/{public_id}`: the portfolio at an
  optional custom address. It replaces the random `/p/` link, which stops working; removing the
  address issues a new random link (DB trigger), never the old one. Works only while the portfolio
  is on; released handles stay reserved for their previous owner for 90 days
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

**Fill from file:** after choosing a certificate file in the add/edit form, "Fill from file" sends
it to `POST /api/ai/extract` (multipart `file`; same type/size checks as uploads, images stripped
of metadata first, nothing stored). The model returns title, issuer, dates, Credential ID, URL and
skills as JSON; `src/lib/ai/extract.ts` re-checks every value (real dates, `https` only, length
limits) and drops the rest. Found fields replace what's in the form and are marked "Suggested by
AI, please check" until edited; `field_sources` records them as `ai_suggested`. Shares the hourly
limit with post drafts.

**Suggest with AI:** when the description or skills are empty, the form can ask
`POST /api/ai/draft-fields` (JSON: title, issuer, platform, which fields) to draft them from the
title and organization only. This is the one place AI writes content that isn't on the certificate:
it only fills empty fields, the text is marked "Written by AI, not from your certificate" until
edited, `field_sources` records `ai_generated`, and `src/lib/ai/draft-fields.ts` drops answers
that claim "verified"/"accredited", are too long, or have too many skills (max 8). Same hourly
limit.

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
