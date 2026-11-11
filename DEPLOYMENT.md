# Deployment instructions

This app is designed for free-tier **Supabase + Cloudflare Pages**, without a custom domain or SMTP.

## 1. Supabase project

Create a new Supabase project and save its URL and **anon/publishable public key**. In **Authentication → Providers → Email**, enable email/password and **disable Confirm email** for the no-SMTP MVP. Disable anonymous sign-in and any providers you don't need.

**Important:** this means registering does not prove the registrant owns the email address. Administrator approval is mandatory and the administrator must verify the band/contact out of band. Consider Supabase CAPTCHA/Turnstile before making registration public beyond a small trusted group. Supabase's abuse and rate-limit defaults alone are not guaranteed spam protection.

Run the SQL in `supabase/migrations/202611110001_init.sql` in the Supabase SQL Editor, or apply via Supabase CLI migrations. It creates tables, policies, booking functions and the registration trigger.

**Never publish the service-role key.** Don't commit `.env` or recovery links. Service-role and VAPID private keys belong in Supabase Edge Function secrets, never `VITE_*` variables.

## 2. Bootstrap the ONE administrator

1. Temporarily visit the app's **Register a band** screen and register your administrator email with an invented temporary band name such as `Initial Admin Setup`. Give it 1 member and a strong password.
2. Run the following in Supabase SQL Editor, replacing the email with the exact administrator email. The SQL editor uses privileged project access; **never expose this operation via the app**.

```sql
do $$
declare v_user uuid; v_band uuid;
begin
  if exists(select 1 from public.profiles where role='admin') then raise exception 'An administrator already exists'; end if;
  select id,band_id into v_user,v_band from public.profiles where lower(email)=lower('YOUR_ADMIN_EMAIL') and role='band';
  if v_user is null then raise exception 'Register the admin email first'; end if;
  update public.profiles set role='admin',band_id=null,status='approved' where id=v_user;
  delete from public.bands where id=v_band;
end $$;
```

3. Log out and back in. Your account should now see the **Admin** navigation item.
4. Do not promote another account. The database has a unique index allowing only one administrator.

## 3. Cloudflare Pages

From Cloudflare's **Workers & Pages → Create → Pages → Connect to Git**, connect `kevinwkaye/rehearsalbooking`, choose the `main` branch and configure:

- Framework: Vite
- Build command: `npm run build`
- Output directory: `dist`
- Environment: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`

No custom domain is needed: Cloudflare provides `https://<your-project>.pages.dev` automatically. In **Supabase → Authentication → URL Configuration**, set the Site URL to that Pages URL and allow it under Redirect URLs. Include the preview URL if testing preview deployments.

## 4. Manual password recovery (no Proton SMTP)

Deploy the Edge Function:

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase functions deploy admin-recovery
npx supabase secrets set APP_ORIGIN=https://YOUR-APP.pages.dev
```

The app authenticates the admin user JWT within the function and generates a one-use Supabase recovery link using the service key. The admin clicks **Recovery link** on the band's account, copies the link and sends it manually from `bunkface_booking_boutique@proton.me` after verifying the band's contact. The band uses the link to set a new password. This workflow is intended for a small, trusted group.

Important: make sure recovery URLs resolve to the configured Site URL and are allowed as Supabase auth redirects. Keep links private, and do not copy them into public issues, chat logs or build logs.

## 5. Optional Web Push

In-app notifications work without push configuration. For push:

1. Generate VAPID public/private key pair using `npx web-push generate-vapid-keys` in a separate local shell.
2. Add the **public** key as `VITE_VAPID_PUBLIC_KEY` in Cloudflare Pages and rebuild.
3. Configure Supabase Edge Function secrets `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_CONTACT=mailto:bunkface_booking_boutique@proton.me` and `PUSH_DISPATCH_SECRET` (a long, random secret).
4. Deploy `push-dispatch` with `npx supabase functions deploy push-dispatch --no-verify-jwt`.
5. In Supabase **Database Webhooks**, create a webhook on **public.notifications**, event **INSERT**, pointing to the `push-dispatch` Edge Function. Add HTTP header `x-bunkface-secret` with exactly the same value as the Edge Function secret. Use POST, content type JSON. Ensure the Edge Function is configured with `verify_jwt=false` (the handler validates the secret).
6. Enable notifications on a real iPhone or Android device, create a booking from another account, and verify delivery. iOS requires the web app to be added to the Home Screen before enabling notifications.

The dispatcher re-reads the trusted notification record and sends it to all subscriptions belonging to the account. Failed push delivery does not affect confirmed bookings. The Web Push integration is supplied but **cannot be treated as tested on real devices without live credentials**.

## 6. QA before handing to client

- Admin login, account promotion and approvals
- Multiple band registrations including duplicate names
- Sign-in on two phones sharing the same band account
- Book today and a future date
- Attempt the same day as a different band
- Cancel / reschedule; check cross-account calendar refresh
- Open a booked date as non-owner; confirm no controls are offered
- Check past dates, British Summer Time, month changes
- Try API writes as pending band and another band; expect rejection
- Test password recovery link after admin verification
- Test push notification opt-in and receipt on each physical device

## 7. Free-tier limitations

Supabase free projects can pause after low activity over roughly a week. Monitor your project and understand how to restore it. The Pages address is free; no Proton upgrade is needed. The free tier may not meet a strict uninterrupted-availability requirement.
