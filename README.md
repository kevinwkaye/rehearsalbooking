# The Bunkface Booking Boutique

A simple, mobile-first practice-space booking PWA.

**Current model: individual member accounts.** Every person creates an account with **name, email and password**, then selects an administrator-created band **once**. Only the administrator can reassign the member to a different band. New accounts require admin approval.

Approved members see the shared month calendar, book an available **full day** with a start time, and can edit or cancel bookings for their own band. The room cannot be double-booked. No member-by-member booking approval is required.

## Deployment

Follow [DEPLOYMENT.md](DEPLOYMENT.md) for the **current three-migration individual-account setup**, admin bootstrap, Supabase authentication settings and Cloudflare Pages configuration. Older shared-band-login instructions are obsolete.

See also [ADMIN_GUIDE.md](ADMIN_GUIDE.md) and [TESTING.md](TESTING.md).

## Local development

Node.js 20+:
```sh
npm install
cp .env.example .env
# Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm run dev
npm test
npm run build
```

React + TypeScript + Vite, Supabase Auth / PostgreSQL, optional PWA push notifications, Cloudflare Pages. No domain or paid Proton plan required. Without SMTP the MVP uses unverified emails and admin-assisted password recovery. Keep secret keys and passwords out of GitHub and frontend variables.
