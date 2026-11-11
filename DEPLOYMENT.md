# Deploy The Bunkface Booking Boutique

**CURRENT VERSION: Individual member accounts.** Each musician registers using their name, email and password, selects one admin-created band, and waits for administrator approval. Only the administrator can change an existing band assignment. Bookings reserve the full day immediately.

## 1. Supabase
Use project `cpkywxtecixgmdsnfcun`, URL `https://cpkywxtecixgmdsnfcun.supabase.co`.

In Supabase Authentication, enable **email/password registration** and **Allow new users to sign up**. Without SMTP, turn **Confirm email** OFF for the MVP. Registered email ownership is unverified, so the administrator must verify who is joining before approval.

Apply these three SQL migrations **in order**, only once each, from the GitHub `supabase/migrations/` folder using Supabase SQL Editor or CLI:

1. `202611110001_init.sql`
2. `202611110002_admin_managed_band_login.sql`
3. `202611110003_individual_members.sql`

Migration 002 is a historical intermediate version. **Do not stop after 002**. Migration 003 enables individual signup and multiple members per band. If upgrading an existing live database, check its migration history before replaying scripts.

## 2. Bootstrap the sole administrator
After all migrations, run `npm install` in a private local checkout and set environment variables **locally**, never in GitHub or ChatGPT:
- `SUPABASE_URL`: `https://cpkywxtecixgmdsnfcun.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY`: secret project key from Supabase Settings
- `ADMIN_EMAIL`: e.g. `bunkface_booking_boutique@proton.me`
- `ADMIN_PASSWORD`: strong password of at least 12 characters

Run `npm run bootstrap:admin` once. It refuses to create a second administrator. If you have already bootstrapped the administrator, do not run it again. Never expose the service-role key in frontend environment variables.

## 3. Edge Functions
Use Supabase CLI authenticated to your project:
```sh
npx supabase login
npx supabase link --project-ref cpkywxtecixgmdsnfcun
npx supabase functions deploy admin-member-access
```
Leave JWT verification enabled. The current `admin-member-access` function allows the administrator to reset a member's password and force them to change it on their next login. The old `admin-band-account` and `admin-recovery` functions are obsolete.

For a deployed website, set the server-side Edge Function secret `APP_ORIGIN` to the exact HTTPS Pages origin, e.g. `https://your-project.pages.dev`. Keep private Supabase keys in Supabase server-side secrets only.

Push notification function deployment and VAPID configuration are optional for initial booking tests; in-app notifications still work.

## 4. Cloudflare Pages
Connect GitHub repo `kevinwkaye/rehearsalbooking` and deploy branch `main`. Framework: **Vite**. Build: `npm run build`. Output: `dist`.

Configure **only public** environment variables:
- `VITE_SUPABASE_URL=https://cpkywxtecixgmdsnfcun.supabase.co`
- `VITE_SUPABASE_ANON_KEY`: publishable/anon key from Supabase Project Settings → API Keys

Never put the service-role key in Cloudflare frontend variables. Rebuild after changing variables. A `.pages.dev` URL is sufficient: no domain purchase or Proton upgrade is required.

## 5. First-use test
1. Admin signs in and creates a couple of bands, setting name, member count and colour (not passwords).
2. Person signs up with their name, email and password.
3. On first login they choose a band exactly once.
4. Admin verifies that person and approves membership.
5. Member signs in, books a free day and a start time; the whole day is reserved.
6. Test another band cannot claim the same day, and verify cancellation, rescheduling, membership lock and admin reassignment.

## 6. Email limitation and security
With email confirmation disabled, registered addresses are **unverified**. Admin approval is required before booking. Without SMTP, self-service password recovery emails will not be delivered; the administrator can issue a temporary password through the admin function and share it privately using the Proton Mail contact address. Test registration abuse controls before allowing public signup.

The CI build passing is **not** proof that the live database, auth, notifications and phone UX have been verified. Test them against a live project before inviting real bands. Free Supabase projects may pause after inactivity.
