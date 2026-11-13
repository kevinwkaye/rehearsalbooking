# BBBWP0.4 | consolidated release | 88 Bunkspace

**Date:** 13 November 2026.  
**Release branch:** `BBBWP0.4-release`  
**App:** https://88-bunkspace.pages.dev/  
**Legacy site:** https://bunkface-booking-boutique.pages.dev/ (retain during PWA migration)
**Supabase project:** `cpkywxtecixgmdsnfcun`

## Consolidated work package

All of today's user-requested changes are treated as one acceptance package, **BBBWP0.4**. The earliest changes were released earlier today in preparatory PRs and are part of the base branch; the remaining changes are pending under BBBWP0.4.

### Already merged into main earlier today (included in consolidated UAT)
- BBBWP0.3.1: fix mobile account-status text overflow, make support email clickable/configurable; new standalone How-to guide linked by a question mark from header and login; centre logo during mobile refresh; update favicon and Android monochrome notification badge.
- BBBWP0.3.2: use the full 88 Bunkspace artwork for the installed PWA icon rather than a cropped part. Keep the mini favicon and Android notification status glyph separately optimised.

### New changes in this release branch
1. On cancellation of a **confirmed booking**, notify every currently approved member of the affected band (including cancelling member) using in-app notifications and the existing push dispatch pipeline.
2. Retain room-available alerts to other bands, **without exposing the cancelling band's private reason**.
3. On decline of a **pending practice request**, notify the other approved members of the band that their request has been cancelled. Do not send a redundant message to the person declining; their UI displays the outcome.
4. In both flows, use an optional text reason limited to **200 characters**, with a live counter and explicit confirmation. Enforce the same length server-side and retain old RPC signatures for stale clients.
5. Add **Clear notifications** beside Enable/Disable phone alerts in the bell panel; user confirmation required. Only the user's notices already present at the time of clearing are removed. Pending votes, subscriptions, and bookings are unaffected.
6. Update the static help page, mobile styles, automated tests and user-journey acceptance checklist.

## Release gates

- [ ] GitHub Actions on BBBWP0.4 passes all tests and production build.
- [ ] Database migrations have passed a rollback-only transaction; no production bookings or profiles changed by testing.
- [ ] Functional rollback script `ops/BBBWP0.4_rollback.sql` checked.
- [ ] Apply `202611130001_bbbwp04_cancellation_and_decline_reasons.sql` then `202611130002_bbbwp04_clear_notifications.sql`.
- [ ] Confirm function grants for the new RPCs deny anonymous users, and each security-definer function checks approved/authenticated user and band membership.
- [ ] Preserve existing records, count users and bookings before/after.
- [ ] Merge release PR, check new and original Cloudflare sites' production build, and verify the static help page still opens.
- [ ] User to run Android and multi-account scenario-based UAT: see `BBBWP0.3.1_UAT_SCENARIOS.md` section F.

## Pending configuration, separate from code

Gmail SMTP was set up by the user, but the exact public support mailbox was **not provided**. The contact link reads `VITE_SUPPORT_EMAIL` in Cloudflare Production. Without it, the deactivated-account page safely says to contact the administrator. Configure the actual mailbox in **both** Cloudflare projects and redeploy before claiming full sign-off.

Do not delete or rename existing bookings, people, bands, Supabase project or Cloudflare site. No new Supabase Edge Function deployment is required.

## Rollback

The original RPCs were preserved as wrappers. Apply `ops/BBBWP0.4_rollback.sql` only if cancellation or voting breaks; it returns previous behaviour without dropping bookings or deleting notices. The new `clear_my_notifications(uuid)` function may be left in place during a frontend rollback because it is scoped to the caller's own notices. Restore the previously verified Cloudflare build if necessary. Once a notification is genuinely cleared by a user it cannot be restored through this code rollback: confirm only intentionally.

## User acceptance criteria

All affected-band members must receive a cancellation notice. Every other approved member of a band must receive a decline notice. Reasons must never leak to other bands. The new Clear notifications action must never close pending votes. Mobile forms and logo must fit at common viewport widths. Test push delivery on actual phones and allow for device notification permission settings.
