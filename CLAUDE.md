# 88 Bunkspace: maintainer handover

Last updated: 17 November 2026. Update this file and the release notes after every work package so context is never lost again.

The code on `main`, the migrations in `supabase/migrations/` and the deployed database are the source of truth. Older docs in this repo (README.md, DEPLOYMENT.md, the BBBWP0.1 and BBBWP0.2 checklists) still describe the retired shared-band-account model, a single administrator, no SMTP and the old URL. Do not follow them where they disagree with the code.

## Ground rules

1. Inspect `main`, migrations, Edge Functions, tests and recent PRs before changing anything.
2. Start each task by describing current behaviour, proposed change, affected files, migrations, tests, risks and rollback.
3. Never reset, truncate, seed over or replace production data. Real users and client bookings must survive every update.
4. Make the smallest sensible change. No redesigns, hosting changes, new auth model or extra complexity without approval.
5. Check authorisation, band membership, booking conflicts, notification recipient scope, mobile usability, accessibility and failure states for every relevant change.
6. Run `npm test` and `npm run build`. Add a regression test for each bug. Report what was tested and what still needs real-device or production checks.
7. Use a feature branch and PR for non-trivial changes. Explain deployment order and rollback. Never claim a deployment or push delivery worked without confirming it.
8. British English. No em dashes. Plain, approachable copy.
9. Never expose secrets. No service-role key, VAPID private key, dispatch secret, SMTP or DB password in frontend variables, this repo, logs or docs. **This repository is public.**

## Owner decisions (17 November 2026)

- Claude may push branches, open PRs and merge its own PRs to `main`.
- Claude manages Supabase (migrations, functions, keep-alive) independently.
- Cloudflare Pages deploys automatically from `main`. Any merge to `main` rebuilds production.
- A UAT environment is approved. Supabase Branching is not available on the Free plan, so UAT means a separate environment (see Open items).
- No test band or test accounts exist in production. Do not add test bands to the client-facing app without the owner first getting the client's permission.
- Testing on real devices is done by the owner and the client, both on Android.
- All change requests and bug reports come from the client (the owner's mate) via the owner. Write for the owner.
- The legacy URL `bunkface-booking-boutique.pages.dev` can be closed off. Do it carefully: redirect first so installed PWAs and push subscriptions on the old origin are moved over, not broken.
- 88 Bunkspace is an exception to the owner's general Flip Fella design rule. Keep its own charcoal, LEMONMILK, five-colour look.
- This file lives in the repo as the handover.

## Project identity

| Item | Value |
|---|---|
| App | 88 Bunkspace (formerly The Bunkface Booking Boutique, BBB) |
| Original band | 88 Bunkface (a band, not the app) |
| Repo | https://github.com/kevinwkaye/rehearsalbooking (public, default branch `main`) |
| Production | https://88-bunkspace.pages.dev/ |
| Legacy | https://bunkface-booking-boutique.pages.dev/ (to be retired) |
| Supabase | project ref `cpkywxtecixgmdsnfcun`, Free plan |
| Hosting | Cloudflare Pages (frontend), Supabase (Auth, Postgres, RLS, RPC, Edge Functions) |

Internal names (`package.json` name, `supabase/config.toml` project_id, some docs) still say Bunkface. Rename only as a separate, safe maintenance change.

## Stack and commands

React 19, Vite 6, TypeScript 5.7, Supabase JS v2, Lucide React. Node 20+ (CI uses 22).

```
npm install
cp .env.example .env   # public values only, never commit .env
npm run dev
npm test
npm run build
```

`npm run bootstrap:admin` is historical. Never run it against production.

There is no `package-lock.json`, so every Cloudflare build resolves the newest compatible dependency versions.

Key files: `src/App.tsx` (almost the whole UI), `src/domain.mjs`, `src/supabase.ts`, `src/types.ts`, `src/styles.css`, `public/sw.js` (service worker, push and notification clicks), `public/help.html`, `supabase/migrations/`, `supabase/functions/admin-member-access` (JWT on), `supabase/functions/push-dispatch` (JWT off, checks its own shared webhook header), `ops/` (rollback and emergency SQL), `.github/workflows/check.yml` (tests and build on push and PR).

Tests in `tests/` are static checks: they read source and migration files and match patterns. They do not run SQL or render the UI. Behaviour against a real database still needs UAT or live verification.

Public frontend variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. The public VAPID key is bundled in `src/pushPublicKey.ts`. Private secrets live in Supabase secret storage or Vault (see PUSH_NOTIFICATIONS.md).

## Business rules

**Accounts and bands**
- Individual email and password accounts. Registration lets people tick one or more bands. An administrator approves.
- Users can belong to several bands. Admins create, edit and remove bands and members, approve registrations and book for their own band.
- Admin membership of a band and admin-wide access are different things.
- Roles in `profiles.role`: `band`, `admin`, `superadmin`. `is_admin()` is true for admin and superadmin. Do not create a hidden superadmin or assume old test accounts exist.
- Password recovery uses Supabase Auth with privately configured Gmail SMTP.

**Bookings**
- One confirmed band booking per calendar date (`one_confirmed_booking_per_day` partial unique index on `bookings(practice_date) where status='confirmed'`). Start time is informational and does not split the day.
- Dates use Europe/London.
- A band request stays pending until every approved band member confirms. A decline cancels it. Pending requests do not reserve the room.
- Decline and cancellation reasons are optional, maximum 200 characters.
- Amendments (`update_booking`) allow same-day time changes, ignore no-op edits, and notify only approved members of the affected band. Band members and admins can amend.
- Preserve historical rehearsal, confirmation and audit records.

**Notifications**
- In-app notification centre (bell) plus optional web push.
- Band notifications go to that band's members only. Being an admin does not mean receiving every band's alerts.
- Tapping a notification should clear that one, not everything when the bell opens.
- Quick actions: Enable phone notifications, Disable phone notifications, Clear notifications.
- Android push taps should open the right place in the app (`notificationclick` in `public/sw.js`). iPhone push needs the home-screen PWA.
- Creating an in-app notification does not prove a phone received a push.

## UX and brand

- Mobile first, around 390 px wide. Many users are not technically confident.
- Dark charcoal background, 88 Bunkspace logo, favicon and PWA icons, LEMONMILK font.
- LEMONMILK has private-use licence limits. The font files are in `public/fonts/` in a public repo (see Open items).
- Band palette: `#A30000`, `#D84797`, `#FF7700`, `#00AFB5`, `#7DDF64` (check `src/App.tsx` for the live list).
- Month calendar without unnecessary scrolling, swipe between months, no navigating before the current month, past days clearly distinct.
- The ? / How it works page is for ordinary users, no admin instructions.
- Banners must stay aligned when text wraps (the green banner close X was a past bug).
- It is a PWA. Do not advertise a native install.

## Deployment

- Frontend: merge to `main`, Cloudflare Pages builds and deploys automatically (Vite, `npm run build`, output `dist`).
- Database: forward-only migrations in `supabase/migrations/`. Check migration history before applying. Never reapply old migrations.
- Edge Functions: deploy the changed function and keep `verify_jwt` settings as in `supabase/config.toml`.
- Combined changes: make the backend backwards compatible first, then merge the frontend.
- After deploying: check the site, Supabase logs, `net._http_response` for push dispatch, and Cloudflare build status. Have the owner do the Android check.

## Release history

| Package | Summary | Status |
|---|---|---|
| BBBWP0.1 | MVP booking, admin, calendar, unanimous confirmation, push | Superseded by later work |
| BBBWP0.2 | Rename to 88 Bunkspace, individual and multi-band membership, approvals, LEMONMILK, palette, calendar gestures, password recovery | Deployed by 12 Nov 2026 |
| BBBWP0.3 | New logo, app and notification icons | Deployed |
| BBBWP0.4 | Cancellation and decline notifications with reasons, read and clear controls, simpler help, calendar styling | Deployed |
| BBBWP0.4.1 / 0.4.2 | UI and notification refinements, notification preferences, cross-band alert restriction | Deployed to both Pages addresses, 13 Nov 2026 |
| PR #15, 17 Nov 2026 | Fix same-day amendment error (unsupported "Rehearsal moved" event), band-only amendment notifications, no-op suppression. Migration `202611170001` | Merged at `3a0140b`, migration reported applied. Real same-day amendment and Android push still unverified |

## Open items

1. Verify PR #15 live: same-day time change, move to a free date, move to an occupied date, no-op edit, unauthorised edit, notification text and recipients, Android push.
2. Moving a booking onto a date that already has a confirmed booking hits the unique index and probably shows the raw database error. Check and give a friendly message.
3. Show/hide password toggles are not implemented. Every password field in `src/App.tsx` is a plain `type="password"`.
4. Confirm in UAT or live: admin notification preferences, banner close alignment, Android deep links from push.
5. Free plan has no backups. Set up a regular database export.
6. Free plan pauses after a week of low database activity. Set up a keep-alive.
7. UAT environment: options are a second free Supabase project or a local Postgres in Claude's workspace for migration tests.
8. LEMONMILK font files are publicly downloadable from this public repo. Decide whether the repo should be private or the fonts handled differently.
9. Add a `package-lock.json` so production builds are repeatable.
10. Retire the legacy Pages URL with a redirect.
11. Refresh README.md, DEPLOYMENT.md and old checklists. Docs only, no migrations.

## Change format the owner prefers

1. Understanding: the bug or feature in plain words.
2. Cause and current implementation: files, functions, migrations, with uncertainty called out.
3. Change: exactly what will change and what is left alone.
4. Validation: automated tests plus manual mobile steps, including negative and multi-band cases.
5. Deployment: branch, PR, migrations, functions, Pages deploy, checks, rollback.
6. Result: only verified outcomes, plus the real-world checks still needed.

The aim is a reliable app a bandmate can use half asleep while carrying a bass amp.
