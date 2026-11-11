# BBBWP0.1 phone push notifications

The app already uses in-app notifications. Device push requires three confidential settings and a working database event trigger. Notifications sent to a band are addressed to **each approved member account** and their individually subscribed devices; the admin is not an extra approver for other bands.

## Architecture

- `src/pushPublicKey.ts`: **public** VAPID key used by browsers for subscriptions. This is safe to commit.
- `public/sw.js`: receives push notifications and opens the app's notifications panel (`?notifications=1`).
- `public.push_subscriptions`: stores each member's phone/browser subscription.
- `public.notifications`: messages from booking proposals, confirmations, declines and changes.
- `202611110006_push_delivery_webhook.sql`: installs `pg_net`, reads a dispatch secret from Vault and queues the push Edge Function when a new notification is inserted.
- `supabase/functions/push-dispatch/index.ts`: checks the shared secret, reads encrypted push credentials from Supabase Vault via the **service-role-only** `bunkface_push_config()` RPC, sends encrypted push to each target subscription and marks successful sends.

## Private setup (do not put keys in chat or GitHub)

A separate private handoff contains the VAPID public key, VAPID private key and random dispatch secret. **The dispatcher in BBBWP0.1 reads ALL THREE from Supabase Vault. Edge Function environment variables alone are not sufficient.** An `APP_ORIGIN` secret is relevant to the separate admin-member-access function; the push dispatcher does not use it.

In Supabase Dashboard → SQL Editor, use private values from the handoff to create these secrets **once**. The SQL below contains placeholders, never actual secrets:

```sql
select vault.create_secret('INSERT_VAPID_PUBLIC_KEY', 'bunkface_vapid_public_key', 'Public VAPID key');
select vault.create_secret('INSERT_VAPID_PRIVATE_KEY', 'bunkface_vapid_private_key', 'Private VAPID key');
select vault.create_secret('INSERT_DISPATCH_SECRET', 'bunkface_push_dispatch_secret', 'Private push webhook authentication');
```

Do **not** create duplicates with the same name. Verify only the secret **names**, not decrypted values, when checking configuration. The public key must exactly match `src/pushPublicKey.ts`. The webhook secret should be a high-entropy random string of 32+ characters. The private key must never be exposed in frontend code.

After the migration and Vault configuration, deploy `push-dispatch` with **Verify JWT OFF** (the private `x-bunkface-secret` header authenticates the database trigger). All other functions keep their usual authentication checks. The Edge Function's `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` must be available through its trusted server environment. Don't set a public Vite variable for either secret.

## Phone setup and tests

- **Android:** Open the deployed HTTPS site in Chrome, log in, tap the bell → **Enable phone alerts**, and allow notifications. Each device must opt in independently.
- **iPhone:** Open in Safari, Share → **Add to Home Screen**, then open that installed app, log in and enable phone alerts. Ordinary Safari tabs cannot receive this installed-PWA push flow.
- Start with **two approved people in the same band**. Enable push on the second member's phone. The first proposes a practice. Verify the second phone receives the alert with the app closed; tapping it should reveal the confirmation panel. Confirm from the second device and verify the date becomes booked.
- Also test Decline, single-member immediate booking, a competing band's request, and revoked permissions. An inability to send push must never roll back an otherwise valid booking action.

## Diagnostics and limitations

Use Supabase Edge Function logs, `net._http_response`, the saved `push_subscriptions` count and device notification permissions. An in-app notification is always the fallback. This version is best-effort push delivery; a temporary push-service failure does **not** guarantee an automatic retry, so add monitored retry handling before promising guaranteed alerts.
