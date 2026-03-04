# Wovo AI Billing & Admin Testing

## Required environment variables

Set these before running locally/deploying:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `NEXT_PUBLIC_APP_URL` (e.g. `http://localhost:3000`)
- `NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID`
- `NEXT_PUBLIC_STRIPE_PRO_PRICE_ID`
- `NEXT_PUBLIC_STRIPE_AGENCY_PRICE_ID`
- `WOVO_ADMIN_EMAILS` (comma-separated list, e.g. `payton@wovomedia.com`)

## Apply DB migrations

1. Use `supabase/migrations/*` as the canonical billing schema source and apply them in filename order.
2. Do not apply `supabase/schema.sql` for billing bootstrap (legacy only).
3. Confirm `public.subscriptions` exists and includes credit-tracking columns (`credits_total`, `credits_remaining`, `weekly_limit`, `weekly_used`) and that `public.consume_generation_credit(uuid)` exists.

## Checkout flow test

1. Sign in at `/wovo-ai`.
2. Ensure "Choose a plan to continue" appears for unsubscribed users.
3. Click one of:
   - Subscribe Starter
   - Subscribe Pro
   - Subscribe Agency
4. Verify button enters loading state and request hits `POST /api/stripe/checkout`.
5. Confirm browser redirects to Stripe Checkout from returned `{ url }`.

## Billing portal test

1. Sign in with a user that has/does not have an existing `stripe_customer_id`.
2. Click **Manage Billing**.
3. Verify request hits `POST /api/stripe/portal` and redirects from returned `{ url }`.
4. For users missing `stripe_customer_id`, verify one is created automatically server-side.

## Webhook test (optional)

1. Forward Stripe events to local app (`/api/stripe/webhook`).
2. Trigger:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
3. Confirm subscription + usage rows update accordingly in Supabase.

## Admin bypass test

1. Add your login email to `WOVO_ADMIN_EMAILS`.
2. Sign in as that user and call `GET /api/wovo-ai/subscription`:
   - expect `status: "admin"`
   - expect `plan_key: "admin"`
   - expect high credit limit and `can_generate: true`
3. Call `POST /api/wovo-ai` repeatedly:
   - generation should not be blocked by subscription/credit checks.
