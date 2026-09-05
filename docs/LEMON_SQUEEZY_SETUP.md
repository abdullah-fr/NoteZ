# Lemon Squeezy billing setup

This repository now contains the local billing integration. Nothing in this file contains credentials.

## Products already created

Map the four Lemon Squeezy variant IDs to these server-side secrets:

- `LEMON_SQUEEZY_PRO_MONTHLY_VARIANT_ID` — NoteZ Pro Monthly, $9/month
- `LEMON_SQUEEZY_PRO_YEARLY_VARIANT_ID` — NoteZ Pro Yearly, $72/year
- `LEMON_SQUEEZY_MAX_MONTHLY_VARIANT_ID` — NoteZ Max Monthly, $19/month
- `LEMON_SQUEEZY_MAX_YEARLY_VARIANT_ID` — NoteZ Max Yearly, $180/year

Also configure these Supabase Edge Function secrets:

- `LEMON_SQUEEZY_API_KEY`
- `LEMON_SQUEEZY_STORE_ID`
- `LEMON_SQUEEZY_WEBHOOK_SIGNING_SECRET`
- `LEMON_SQUEEZY_TEST_MODE=true` while testing
- `NOTEZ_APP_URL` — the exact NoteZ app URL used for checkout redirects

Keep these values in Supabase Edge Function secrets. Do not prefix them with `VITE_`, put them in browser code, or commit them.

## Password signup and direct checkout

The paid Pricing buttons now open signup first. When Supabase returns a session, NoteZ sends the new user directly to the selected Lemon checkout; after payment, Lemon returns the signed-in user to the dashboard.

To make password signup return a session without an email-confirmation screen, disable `Confirm email` in Supabase Authentication settings for the Email provider. This is a project-wide setting, not a per-checkout setting. If it remains enabled, Supabase intentionally returns no session and the normal email-confirmation screen remains required; client code must not bypass that server-side auth policy.

Google signup already returns through the same selected-plan checkout path and does not require an additional NoteZ confirmation screen.

Before testing Google, make sure the deployed app's `/auth/callback` URL is included in Supabase Authentication URL Configuration / Redirect URLs.

## Tomorrow's deployment order

1. Run the migration file `20260906000000_lemon_squeezy_billing.sql` in the Supabase SQL Editor (or apply it with the Supabase CLI).
2. Deploy `create-lemon-checkout` and `lemon-squeezy-webhook`.
3. Add the secrets above to Supabase.
4. Create a Lemon Squeezy webhook pointing to:

   `https://<project-ref>.supabase.co/functions/v1/lemon-squeezy-webhook`

   Select the subscription events handled by the function: created, updated, cancelled, resumed, expired, paused, unpaused, and plan changed.
5. Test checkout from NoteZ's Pricing page in Test Mode. Use a fresh test account so the checkout custom data can be linked to that NoteZ user.

For local Edge Function testing, use `LEMON_SQUEEZY_TEST_MODE=true`, the local app URL, and a local webhook tunnel only if you decide to run the Supabase functions locally. No local deployment is required for these code changes.

## Going live

When switching to live payments, use the live store's API key, webhook signing secret, and live variant IDs. Set `LEMON_SQUEEZY_TEST_MODE=false`, update `NOTEZ_APP_URL`, and create a live webhook. The application code does not need a separate live copy.
