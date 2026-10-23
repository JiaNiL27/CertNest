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
npm run test:db    # RLS, storage, constraints, ensure_skills
npm run test:app   # next build, then: no service role key in .next/static, /dashboard redirects to /login
npm test           # both
```

Other checks: `npm run typecheck`, `npm run lint`.
