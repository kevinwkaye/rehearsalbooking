# The Bunkface Booking Boutique

A deliberately simple, mobile-first rehearsal room booking app. One administrator creates accounts; each band picks its name from a list, enters its admin-issued password and books a full day.

## Everyday workflow

1. An administrator creates a band name, member count, colour and password from **Admin → Create a band account**.
2. The administrator privately gives the band its name and password.
3. A band visits the site, chooses its name from the drop-down and enters its password. No email or registration is required.
4. The band taps an available date, chooses a rehearsal start time and confirms. The **entire day** is reserved instantly and other bands cannot book it.
5. Bands may edit or cancel only their own bookings. Everyone can see confirmed bookings.
6. Admin can change band names, colours and passwords, deactivate accounts and edit bookings.

## Development

Requires Node.js 20+.

```bash
npm install
cp .env.example .env
# Enter your VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm run dev
npm test
npm run build
```

The app will show a configuration screen until Supabase is connected. See [DEPLOYMENT.md](DEPLOYMENT.md) for the migration, Edge Functions and first-admin steps.

## Architecture

- React + Vite + TypeScript, served statically by Cloudflare Pages.
- Supabase email/password Auth behind the scenes: each band uses an **internal synthetic login email** derived from its band UUID. Bands never see or supply an email address.
- Admin uses a separate admin email and password.
- Admin-only Supabase Edge Function provisions band accounts and changes their passwords. Passwords are handled by Supabase Auth and are never stored in application tables or embedded in the frontend.
- PostgreSQL RLS and SECURITY DEFINER functions enforce permissions and prevent double bookings.
- Push notifications are optional, with an in-app notification fallback. iPhone push needs the installed home-screen PWA.
- No custom domain, SMTP, IMAP or Proton Mail integration is needed. Help contact: bunkface_booking_boutique@proton.me.

## Security notes

- **Disable public signups** in Supabase Authentication settings. The second migration also rejects untrusted new Auth registrations.
- Never expose `SUPABASE_SERVICE_ROLE_KEY` in Vite or Cloudflare's public build variables.
- Only one administrator may exist. Run `npm run bootstrap:admin` once, following DEPLOYMENT.md.
- Band accounts are shared accounts, not individual member identities. Anyone with a band's password can act as that band.
- Password changes may not immediately sign out every already-authenticated device. Deactivate an account to block booking access immediately when necessary.
- The public RPC returns only active band names, IDs and colours. It does not expose passwords or actual email addresses.

## Tests

`npm test` validates calendar calculations and source-level authentication/registration invariants. **Live Supabase integration and browser testing must also be completed before production use.** See TESTING.md.
