# The Bunkface Booking Boutique

A simple, mobile-first rehearsal room booking app for bands sharing one practice space. One admin, one shared login per band, and one confirmed booking per day.

**Stack:** React + TypeScript + Vite; Supabase Auth/PostgreSQL; Cloudflare Pages; optional Web Push via Supabase Edge Functions.

## Quick start

```bash
npm install
cp .env.example .env
# Enter your Supabase public URL and anon/publishable key in .env
npm run dev
npm test
npm run build
```

The UI shows a configuration screen until Supabase is connected. Production credentials are **never** committed.

Read [DEPLOYMENT.md](DEPLOYMENT.md) before setting up database, authentication, and Cloudflare. See [ADMIN_GUIDE.md](ADMIN_GUIDE.md) for first-account bootstrap and day-to-day management.

## Rules

- Each band registers with contact name, email, band name, member count and password.
- New accounts cannot access the calendar until approved by the sole administrator.
- Each band shares one account across any number of devices.
- Each booking reserves an entire **Europe/London calendar day**, even though it has a start time.
- A PostgreSQL partial unique index prevents two confirmed bookings on the same date.
- Owner or admin can cancel/reschedule a booking; failed moves preserve the original date.
- Notifications are stored in-app and can optionally be pushed to subscribed devices.
- Account recovery links are manually issued by the admin and can be sent from **bunkface_booking_boutique@proton.me**. No Proton SMTP required.

## Scope and limits

MVP only. No individual band-member approvals, multi-room scheduling, payments, chat or recurring bookings. Public sign-up has Supabase Auth rate limiting, but **email ownership is not verified** without SMTP: the admin should verify registrations before approval. Configure CAPTCHA/abuse protection before wider public exposure.

The free Supabase tier can pause after low activity. Cloudflare Pages does not require a custom domain. Web Push is subject to device support and user permission; for iOS, users must add the PWA to their Home Screen. **Live database and real-device integration testing still require deployment credentials.**

## Project files

- `src/App.tsx`: calendar, booking modal, authentication, admin, audit activity and notifications
- `src/styles.css`: dark responsive interface
- `supabase/migrations/`: schema, RLS and atomic booking functions
- `supabase/functions/admin-recovery/`: trusted manual recovery-link generation
- `supabase/functions/push-dispatch/`: Web Push dispatcher for database webhooks
- `public/`: manifest, service worker and SVG app icon
- `tests/`: core calendar and date tests

## Security

No service-role key or private VAPID key is used in the browser. All booking changes go through security-definer database RPC functions with explicit role checks. The database prevents duplicate active dates. Public registration always creates a **pending band**, never an admin. The sole admin is promoted only from the Supabase SQL editor during setup.

## Contact

bunkface_booking_boutique@proton.me
