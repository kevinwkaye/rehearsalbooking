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
- [x] Dry-run migrations 005 and 006 on the existing Supabase database inside an explicit rolled-back transaction; schema and RPCs compiled and were rolled back.
- [x] Rollback-only database integration test: a single approved member auto-confirms, two approved members require both votes, and a decline prevents booking.
- [x] Check that a competing band's request for an already-confirmed date is blocked and the confirmed-date unique index remains. [ ] Simultaneous final-vote race using separate sessions still to be tested.
- [x] Rollback-only test: Adam's band-affiliated identity can propose; moving another member invalidates a pending request; another band cannot read the proposal. [ ] Real browser approval UX still to be tested.
- [ ] Configure the VAPID public/private and dispatch secret in Supabase Vault (privately).
- [ ] Deploy new push-dispatch function and verify database trigger delivery and logging.
- [ ] Verify actual iPhone Home Screen PWA and Android push delivery, including notification taps opening the confirmation panel.
- [x] Reversible functional rollback/re-enable SQL tested inside a rolled-back transaction. [ ] Before client go-live, establish a restorable backup and record previous Cloudflare deployment ID.
- [ ] Merge PR to `main` and confirm the Cloudflare Pages deployment is successful.

**Do not report BBBWP0.1 as production-ready until the pending checks are complete.**

## Release policy

No separate UAT environment. This shared project is for pre-client tests. All future changes are versioned as `BBBWPx.y`, with exact GitHub and Cloudflare release identifiers, additive migrations where possible, a verified backup/export, functional rollback SQL and tested recovery. See [BBBWP0.1_RELEASE_POLICY.md](BBBWP0.1_RELEASE_POLICY.md) and `ops/BBBWP0.1_rollback.sql`.

Database integration tests for 005/006 were run using Adam and the existing approved test account in an explicit transaction with `ROLLBACK`. Post-check confirmed zero test bookings remain and the test user retained their original band. **No migrations 005/006 have been applied permanently.**
