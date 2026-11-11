# Deployment: The Bunkface Booking Boutique

**IMPORTANT: This is the individual-member version.** Do not follow obsolete shared-band-login instructions. The live project is 
- GitHub: https://github.com/kevinwkaye/rehearsalbooking
- Cloudflare Pages: https://bunkface-booking-boutique.pages.dev/
- Supabase project: `cpkywxtecixgmdsnfcun`

## Current state and requirements

The Supabase live project already has migrations 001–004 and an administrator account. **Do not re-run them and do not bootstrap a second administrator.** Email/password signup is enabled; users register individually and choose one band. Member approval is required. No SMTP is configured, so members' email addresses are unverified; the administrator must vet registrations.

The Cloudflare Pages site builds from `main`. Keep the BBBWP0.1 pull request in draft until the migration, integration and phone checks are ready. The app's new frontend and database migration must be released together; deploying either alone will break booking requests. Plan a short, low-traffic release window and back up the database first.

## Deploy BBBWP0.1 when approved

1. Confirm the GitHub PR CI is green and carry out a backup/check of current bookings and account mappings.
2. Securely configure the **three Vault secrets** specified in [PUSH_NOTIFICATIONS.md](PUSH_NOTIFICATIONS.md). These secrets are not in GitHub. The public VAPID key is already included in `src/pushPublicKey.ts`.
3. In Supabase, apply the **new** SQL migrations in this exact order, only once each:
   - `supabase/migrations/202611110005_unanimous_band_confirmation.sql`
   - `supabase/migrations/202611110006_push_delivery_webhook.sql`
4. Deploy the updated `supabase/functions/push-dispatch/index.ts` with **JWT verification OFF for this webhook function only**. It verifies its own private shared webhook header. Keep `admin-member-access` with JWT verification ON.
5. Merge the BBBWP0.1 pull request into `main` once the backend is ready. Allow Cloudflare Pages to build the production frontend, then verify the deployed commit.
6. Test one-member booking, two-member unanimous approval, decline, competing requests, moving/cancelling bookings, permissions, and phone notifications before inviting all bands.

**Cloudflare Pages settings:** Vite, `npm run build`, output `dist`, production branch `main`; `VITE_SUPABASE_URL=https://cpkywxtecixgmdsnfcun.supabase.co` and `VITE_SUPABASE_ANON_KEY` set to the project's publishable key. Do **not** put a service role key, VAPID private key or dispatch secret in a public `VITE_` variable. The public VAPID key is bundled in source; no extra frontend variable is required.

**Supabase:** The existing admin-member-access function and admin account should be retained. The new approval RPCs use the currently approved user roster, **not the informational member count**. The new migration revokes the old direct booking RPC; this is why frontend and SQL changes must be coordinated. Applying 005/006 to production is not a harmless dry-run. Use a staging environment for integration verification where feasible.

### No-email limitation

Do not enable Supabase Confirm email unless transactional SMTP is configured. Without SMTP there is no automatic account-verification or self-service recovery email. The admin can issue a private temporary password using the protected admin function.

### Rollback and monitoring

The migrations add tables, functions, triggers and changes to booking permissions. Reverting the frontend alone is **not a complete rollback**. Prepare a tested database restore or a deliberate SQL rollback before proceeding; do not casually restore an older UI while new server rules are active. Check Supabase function logs, Postgres `net._http_response`, saved push subscriptions and GitHub/Cloudflare build status after release.

See [BBBWP0.1_RELEASE_CHECKLIST.md](BBBWP0.1_RELEASE_CHECKLIST.md) for sign-off status.
