# The Bunkface Booking Boutique

Mobile-first rehearsal room booking for bands sharing one space. Live site: https://bunkface-booking-boutique.pages.dev/

## Current account model

Each musician registers with **their own name, email and password**. On first login they choose an administrator-created band; the selection is locked unless the administrator changes it. An administrator must approve accounts before they can book. Adam is the sole administrator and is also assigned to 88 Bunkface.

## BBBWP0.1 (pre-release)

- A registered, approved band member chooses a date and start time and requests a rehearsal.
- The proposer is automatically recorded as **confirmed**.
- A **single approved member** in a band confirms immediately. With **two or more approved members**, every other currently approved member must confirm; a decline closes the request.
- The band's expected member count is informational only and does not prevent requests. Membership changes invalidate pending requests so the roster can be recaptured.
- Pending requests don't block dates; only confirmed rehearsals reserve the whole day. Database uniqueness prevents overlapping confirmed bookings.
- The shared calendar starts at the current month and fits the viewport. Admin can manage bands, account approval/reassignment/deletion and existing bookings.
- Members see in-app notifications; optional phone push requires server-side configuration and device permission.

**Do not deploy the BBBWP0.1 frontend until the database migrations are ready.** See [BBBWP0.1_RELEASE_CHECKLIST.md](BBBWP0.1_RELEASE_CHECKLIST.md) and [DEPLOYMENT.md](DEPLOYMENT.md). This work package is on a draft pull request, not live yet.

## Development

Requires Node.js 20 or later.

```sh
npm install
cp .env.example .env
# Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (publishable key only)
npm test
npm run build
npm run dev
```

Stack: React / TypeScript / Vite, Supabase Auth and PostgreSQL, Cloudflare Pages, optional Web Push. No custom domain or paid email plan is required for this MVP. Email addresses are not verified without SMTP, so the administrator must verify members before approval and handle password resets privately.

Never commit secrets. The public VAPID key can be in source, but the **VAPID private key and push webhook secret must remain private**.

See [ADMIN_GUIDE.md](ADMIN_GUIDE.md), [PUSH_NOTIFICATIONS.md](PUSH_NOTIFICATIONS.md) and [TESTING.md](TESTING.md).
