This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Wovo AI setup

Required environment variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-side only)
- `NEXT_PUBLIC_STARTER_PRICE_ID`
- `NEXT_PUBLIC_PRO_PRICE_ID`
- `NEXT_PUBLIC_AGENCY_PRICE_ID`
- `STRIPE_SECRET_KEY` (server-side only)
- `STRIPE_WEBHOOK_SECRET` (server-side only)
- `WOVO_ADMIN_EMAIL`
- `OPENAI_API_KEY` (server-side only; used by `/api/wovo-ai/generate` and `/api/wovo-ai/generate-image`)

Supabase SQL setup:

1. Apply all SQL migration files in `supabase/migrations/` (in order).
2. Then apply `supabase/wovo-ai-schema.sql` if needed for:
   - `public.business_settings`
   - `public.generations`
   - RLS policies for both tables.

Validation query (run in Supabase SQL editor):

```sql
-- 1) Confirm subscriptions table exists
select to_regclass('public.subscriptions') as subscriptions_table;

-- 2) Confirm consume_generation_credit(uuid) function exists
select
  n.nspname as schema,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as args
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'consume_generation_credit'
  and pg_get_function_identity_arguments(p.oid) = 'uuid';

-- 3) Confirm generations table exists
select to_regclass('public.generations') as generations_table;
```

Applying migrations before calling `/api/wovo-ai/generate` or `/api/wovo-ai` prevents the `PGRST202` runtime failure shown in the UI.

## DB migration required (before Wovo AI API deploys)

For any release that includes Wovo AI API changes, run this migration gate in CI/CD **before** the deploy step.

1. Apply all SQL files in `supabase/migrations/` in lexical order.
2. Run the validation queries below.
3. Fail the pipeline immediately if any query does not pass.

Example CI/CD gate:

```bash
set -euo pipefail

# 1) Apply migrations in order.
for migration in $(find supabase/migrations -maxdepth 1 -type f -name '*.sql' | sort); do
  psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "$migration"
done

# 2) Validation checks (must all pass).
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 <<'SQL'
do $$
begin
  -- Check function signature: consume_generation_credit(uuid)
  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'consume_generation_credit'
      and pg_get_function_identity_arguments(p.oid) = 'uuid'
  ) then
    raise exception 'Missing function public.consume_generation_credit(uuid)';
  end if;

  -- Check required tables.
  if to_regclass('public.subscriptions') is null then
    raise exception 'Missing table public.subscriptions';
  end if;

  if to_regclass('public.generations') is null then
    raise exception 'Missing table public.generations';
  end if;
end
$$;
SQL
```

If the migration gate fails, block deployment until the schema is corrected.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
