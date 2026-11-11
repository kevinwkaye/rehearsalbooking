# Push notifications: final setup

The app uses encrypted Web Push and in-app notifications. Proposals notify **other members of the proposing band**, not every band and not a separate administrator. Once everyone approves, booking confirmation alerts are sent.

## What is already in source control
- `src/pushPublicKey.ts` contains the **public** VAPID key. The private counterpart must never go in the website or repository.
- `public/sw.js` displays notifications and opens the app's confirmation panel when tapped.
- `supabase/functions/push-dispatch` encrypts and delivers a stored notification to each device subscription.
- `supabase/migrations/202611110006_push_delivery_webhook.sql` installs `pg_net` and an INSERT trigger on `public.notifications` to call that function.

## Remaining private configuration
1. The administrator uses the private handoff `Bunkface_push_notification_private_setup.txt` provided separately. Do **not** commit or paste its contents into chat.
2. In Supabase Dashboard → **Edge Functions → Secrets**, add the values from that file for `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_CONTACT`, `PUSH_DISPATCH_SECRET` and `APP_ORIGIN`.
3. In Supabase Dashboard → **SQL Editor**, store the **same** `PUSH_DISPATCH_SECRET` in Vault by running privately (replace the placeholder; do not commit this SQL with the secret):

   ```sql
   select vault.create_secret('THE_SECRET_FROM_PRIVATE_FILE', 'bunkface_push_dispatch_secret', 'Shared push webhook authentication secret');
   ```

   Only do this once, otherwise multiple named secrets cause ambiguity. The database migration looks it up by name at delivery time.
4. Ensure `push-dispatch` Edge Function is deployed with **Verify JWT OFF**, since only the database trigger calls it using the separate shared `x-bunkface-secret` header. Other Supabase Edge Functions should keep JWT verification enabled.
5. Once the private secrets are set, any new in-app notification inserts an asynchronous request for the dispatcher. Supabase Edge Function logs and `net._http_response` help troubleshoot failures.

## Device setup
- **Android:** Open the app in Chrome, log in, tap bell → **Enable phone alerts**, and allow browser permission. The PWA can also be installed.
- **iPhone:** Open in Safari → Share → **Add to Home Screen**. Launch the installed app from the Home Screen, sign in, tap bell → **Enable phone alerts**, and allow permission. iOS notifications require an installed Home Screen web app.
- Each approved user and each device must enable alerts independently. The app remains usable if permission is denied.

## Test
1. Create two approved accounts in the same band and set its expected member count to 2. Enable alerts on the second account's phone.
2. Propose a future rehearsal from the first account. The second account should receive a push notification, even if the app is closed.
3. Tap the notification to open the confirmation panel, then Confirm. The calendar should only now mark the date as booked.
4. Test Decline and a competing band requesting the same day.
5. If the phone doesn't alert, check notification permission, saved subscription count, Supabase Edge Function logs and the webhook/secret configuration.

**Do not send your private VAPID or webhook keys in chat or commit them to GitHub.**
