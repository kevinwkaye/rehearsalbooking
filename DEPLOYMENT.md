# Deployment: The Bunkface Booking Boutique

This version is **admin-provisioned**: band accounts are created only by the administrator. There is no user registration page and no email signup process.

## 1. Supabase

Create a free Supabase project. Apply these SQL migrations **in order** using Supabase SQL Editor or Supabase CLI:

1. `supabase/migrations/202611110001_init.sql`
2. `supabase/migrations/202611110002_admin_managed_band_login.sql`

The first migration supplies the booking tables, policies and booking RPCs. The second disables public band registration and adds the safe public band-name listing RPC.

**Important:** In Supabase Authentication settings, disable **Allow new users to sign up**. Normal band account creation uses a service-role-only Admin API, not public signup. Do not enable anonymous signups or public OAuth registrations.

The first-admin bootstrap must happen **after both migrations**. If upgrading from the older self-registration version with existing band accounts, the old credentials will not work with the new drop-down until those accounts are re-provisioned. This is not an automatic account migration.

## 2. Administrator account

Ensure `npm install` has completed. In a local terminal, set these environment variables **privately**:

- `SUPABASE_URL`: Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Server-only service role key
- `ADMIN_EMAIL`: The administrator's email address (for example, the Proton Mail account)
- `ADMIN_PASSWORD`: A strong password of at least 12 characters

Run:

```bash
npm run bootstrap:admin
```

This script creates the **one and only** administrator, confirms the login email without sending mail, and creates an approved admin profile. Never put these secrets in `.env` files committed to GitHub. The script refuses to create a second administrator.

If an administrator was already bootstrapped on a previous version, **do not** run it again. Existing admin credentials remain valid.

## 3. Deploy administrator Edge Function

Deploy `supabase/functions/admin-band-account/index.ts` with Supabase CLI:

```bash
npx supabase functions deploy admin-band-account
```

The function requires the existing Supabase secret values `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` and must have JWT verification enabled. Set the server secret `APP_ORIGIN` to the full deployed Cloudflare Pages URL (or `http://localhost:5173` for local development).

The function independently validates the signed-in user's profile and rejects calls from anyone but the sole approved administrator. It can create a band or set a band's password. Passwords are processed only inside the trusted Auth Admin API.

If upgrading, the old `admin-recovery` function is no longer used; remove any old deployed instance after verifying the new workflow.

## 4. Cloudflare Pages

Link GitHub repository `kevinwkaye/rehearsalbooking` to Cloudflare Pages.

- Framework preset: Vite
- Build command: `npm run build`
- Build output directory: `dist`
- Environment variable: `VITE_SUPABASE_URL` = your Supabase project URL
- Environment variable: `VITE_SUPABASE_ANON_KEY` = your publishable/anon key

The `.pages.dev` URL is sufficient. A custom domain is optional. `public/_redirects` supports SPA routing.

Set `APP_ORIGIN` in Supabase Edge Function secrets to the actual HTTPS Pages origin, and redeploy if necessary.

**Never add `SUPABASE_SERVICE_ROLE_KEY` to Cloudflare frontend environment variables.**

## 5. Create the first band

1. Visit your app's Cloudflare URL.
2. Select **Administrator login**.
3. Enter the administrator email/password.
4. Open **Admin** and complete **Create a band account**: band name, member count, colour and password.
5. Give the band its name and password privately.
6. Log out. The band name should now appear in the main public drop-down.
7. Select the band, enter the password and test a rehearsal booking.
8. Confirm another band cannot reserve the same day.

The `@accounts.example.com` internal Auth aliases are synthetic identifiers and are **not for email delivery**. Do not try to send messages to them. Band members do not need email accounts.

## 6. Password changes

The administrator opens **Admin → Change password** for a band and assigns a new password (at least 10 characters). Share it privately. If a band loses access or a device is compromised, deactivate the band first to prevent new bookings while arranging replacement credentials. Existing sessions may remain active after a password change until their token is refreshed or expires.

## 7. Push notifications (optional)

Deploy `supabase/functions/push-dispatch` from the project and supply valid VAPID key secrets as described in that source. Test end-to-end on actual devices. An app cannot send push until browser permission is granted. iPhones require the app installed to the Home Screen for Web Push.

The application remains fully usable if notifications are disabled or unavailable. Confirmed bookings are always visible in the calendar.

## 8. Acceptance checklist

- [ ] The public screen shows a band drop-down and password field, **no registration**.
- [ ] Admin email login works via the separate link.
- [ ] Only an admin can create band accounts and change passwords.
- [ ] Newly created bands immediately appear in the drop-down.
- [ ] A wrong band password is rejected.
- [ ] Bookings reserve the entire date, with no double booking even under concurrent requests.
- [ ] A band can only edit or cancel its own bookings.
- [ ] Deactivated bands disappear from the public login list and cannot book.
- [ ] In-app and device notifications are verified.
- [ ] Phone and desktop rendering have been tested.

## Free-tier limitations

Supabase free projects can be paused after inactivity. Free hosting and push delivery have service and browser limitations. These should be understood before promising continuous availability.

## November update: admin membership, account deletion and calendar

After the original three migrations, apply the new migration:

`supabase/migrations/202611110004_admin_band_members_and_deletion.sql`

The migration safely permits the administrator to have a band membership, corrects admin booking restrictions and provides admin-only deletion of bands with history preservation. Existing data is not erased.

Redeploy `admin-member-access` using the updated function source. It now supports deleting individual member authentication accounts, as well as password resets. The Admin UI never permits deleting the sole administrator.

When the administrator is a member of 88 Bunkface, their `profiles.band_id` must be assigned to that band in the database. This is managed as an admin-only assignment. No other user should be manually given administrator privileges.

See [PUSH_NOTIFICATIONS.md](PUSH_NOTIFICATIONS.md) for the future device-notification setup. Without the VAPID public/private keys, configured server-side dispatch, and a database webhook, notifications outside the app are not active yet.
