# BBBWP0.2 | 88 Bunkspace | Cloudflare Pages address migration

**Status:** Prepared only. Neither URL nor production database has been migrated.
**Target:** `https://88-bunkspace.pages.dev/`, subject to availability in the Cloudflare account.
**Existing:** `https://bunkface-booking-boutique.pages.dev/`. KEEP IT RUNNING during and after the transition.
**Source:** GitHub `kevinwkaye/rehearsalbooking`, production branch `main`.
**Supabase project:** `cpkywxtecixgmdsnfcun`. Reuse the same project. Do not create another database.

## Important Cloudflare limitation

Cloudflare Pages does **not** support changing an existing `*.pages.dev` subdomain in place:
https://developers.cloudflare.com/pages/platform/known-issues/

Create an **additional** Pages project named `88-bunkspace`, without deleting the existing project. If unavailable, agree an alternative and update all the URLs below.

## Phase 1: Prepare new Pages project without replacing the live site

1. Cloudflare dashboard → Workers & Pages → Create → Pages → Connect to Git.
2. Select the existing GitHub repository `kevinwkaye/rehearsalbooking`. Keep `main` as the production branch.
3. Set project name to `88-bunkspace`, if Cloudflare accepts it.
4. Framework: Vite (or custom). Build command: `npm run build`. Build output directory: `dist`. Root directory: repository root.
5. Copy the **frontend** build environment variables from the existing project's Production settings:
   - `VITE_SUPABASE_URL` (same Supabase URL)
   - `VITE_SUPABASE_ANON_KEY` (same public anon/publishable key)
   - `VITE_VAPID_PUBLIC_KEY` (if configured on the existing project)
   Copy the actual values directly within Cloudflare, never to GitHub or chat. **Never** add a `service_role`, Gmail SMTP password, or private VAPID key to Pages.
6. Confirm a successful initial deployment. Before BBBWP0.2 merges, the new site will still display BBBWP0.1 and must not be treated as final.
7. Record the old and new Cloudflare project names, production deployment IDs, and build environment variable names (not secret values).

## Phase 2: BBBWP0.2 coordinated release gate

Do not release before:
- Version-specific GitHub Actions build/tests pass.
- Live database backup/export is verified restorable and previous deployment ID is recorded.
- Supabase migration has passed rollback-only tests and the functional rollback SQL is accessible.
- The LEMONMILK public redistribution/licence question has been resolved (source repository is public).
- Gmail SMTP setup is verified by **an actual recovery email** received by an authorised test account, without posting a password or recovery link to chat.
- A phone can be used for Android notification navigation regression tests.

Deployment order must keep front-end and RPCs compatible:
1. Apply the BBBWP0.2 database migration (backward-compatible stage).
2. Deploy the matching server-side function updates.
3. Verify no old booking or login flow is broken.
4. Merge the verified BBBWP0.2 PR to `main`, triggering a deploy on **both** Pages projects.
5. Check production deployments on **both** projects, verify the new site's name, registration and login, then validate booking permissions.
6. Use Supabase Authentication → URL Configuration to set `https://88-bunkspace.pages.dev/` as the **Site URL**, keeping `https://bunkface-booking-boutique.pages.dev/**` in **Redirect URLs** alongside `https://88-bunkspace.pages.dev/**`. Actual password recovery uses `window.location.origin` and `/?reset=1`; test delivery, expiry and redirects from both origins.
7. Re-test Android push links from the new origin. Browser Push subscriptions belong to an origin; users must opt in to alerts again on the new address.
8. Retain the old Pages site during transition. An installed PWA from the old origin and existing push notifications may still need it. Do not remove it without a separately planned migration/decommissioning decision.

## Acceptance checks

- New URL resolves over HTTPS and displays 88 Bunkspace.
- Existing accounts sign in to the same Supabase project; no user migration needed.
- A user can select multiple bands, the administrator receives an approval alert, and the booking workflow is unaffected.
- Password reset email redirects back to the right origin.
- An Android push sent to a subscription on the new origin opens its installed PWA.
- The old site remains accessible and functional while users transition.

## Rollback

1. Restore BBBWP0.2 database RPC compatibility using `ops/BBBWP0.2_rollback.sql`; keep membership, booking and notification data. Do not wipe tables.
2. Restore the previously recorded Cloudflare production deployments on both projects (or disable the new project if its site is faulty).
3. Set Supabase **Site URL** back to `https://bunkface-booking-boutique.pages.dev/`, while temporarily retaining both Redirect URL allow-list entries to avoid breaking already-sent emails.
4. Restore old Edge Function version if necessary and re-test login and booking.
5. Do not delete the old project, new memberships or user accounts.

**Required manual Cloudflare action:** There is no Cloudflare dashboard connection available in the current ChatGPT session. The project owner must create the additional Cloudflare Pages project or connect a supported browser/Cloudflare automation capability.
