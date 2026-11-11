# BBBWP0.1 release checklist (pre-production)

## Verified
- [x] Source files committed to a **separate draft GitHub pull request**.
- [x] 23 local source/date tests pass.
- [x] GitHub Actions: dependency installation, tests, TypeScript check and production React build pass.
- [x] Verified new database migrations 005–006 are **not** applied to the live Supabase project; existing booking records are untouched.
- [x] Verified push-dispatch function is already deployed at version 1; the new version requires deployment alongside migration 006.
- [x] Current push subscriptions in the live database: 0 at time of preflight.
- [x] Updated documentation to reflect **individual member accounts**, currently approved member unanimity and **all three push credentials in Vault**.

## Pending before production release
- [ ] Exercise migration 005 and 006 on a safe staging database or an approved release window, verifying RLS and RPCs.
- [ ] Integration test: one approved band member confirms immediately; 2+ approved members require all votes; a decline rejects the request.
- [ ] Integration test competing final confirmations; verify only one confirmed booking per date.
- [ ] Test account approval/reassignment and membership invalidation, including Adam being an ordinary member of 88 Bunkface for voting.
- [ ] Configure the VAPID public/private and dispatch secret in Supabase Vault (privately).
- [ ] Deploy new push-dispatch function and verify database trigger delivery and logging.
- [ ] Verify actual iPhone Home Screen PWA and Android push delivery, including notification taps opening the confirmation panel.
- [ ] Back up production data, plan migration/Cloudflare deployment sequence, and prepare rollback.
- [ ] Merge PR to `main` and confirm the Cloudflare Pages deployment is successful.

**Do not report BBBWP0.1 as production-ready until the pending checks are complete.**
