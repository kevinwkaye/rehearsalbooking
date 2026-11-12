# BBBWP0.2 | 88 Bunkspace | Release checklist

**Status:** Draft implementation, NOT deployed. Gmail SMTP and device tests outstanding.

## Scope

- Account-level approval with checkbox selection of 1–20 bands at registration.
- The administrator alone can add or remove band memberships later.
- Existing approved members and confirmed bookings are preserved. The selected band determines whose votes are required.
- Pending approval notices sent to Adam's in-app inbox and subscribed phone, with a clickable count and band-level highlighting.
- Opening notifications marks the currently queued notifications read, not a practice vote or an account approval.
- Android notification clicks focus/open the app and deep-link to notification panel or pending approvals.
- Swipe left/right for month changes; no navigation before the current London month.
- Self-service password reset UI using Supabase Auth email recovery; Gmail SMTP credentials and real mail delivery pending.
- App renamed **88 Bunkspace** (band **88 Bunkface** unchanged), locally hosted LEMONMILK supplied by client, and five new band colours.

## Checks before merge

- [x] Local Node tests pass (29 checks).
- [x] Draft GitHub PR created, main/Cloudflare unchanged.
- [x] GitHub Actions CI build and TypeScript check passed for initial commit.
- [x] Single-transaction migration dry-run compiled on Supabase and rolled back.
- [x] Synthetic signup test selected two bands, created pending profile, notified admin, then rolled back.
- [x] Multi-band administrator booking, two-person confirmation and cross-band denial passed in rollback-only SQL test.
- [x] Final updated migration dry-run compiled successfully and rolled back.
- [x] Confirmed that pending signups do not invalidate current votes and approval does invalidate affected pending votes (rollback-only).
- [x] Functional rollback and re-enable SQL passed in the same rolled-back transaction.
- [x] GitHub Actions TypeScript/build tests passed after migration refinements.
- [ ] Configure Gmail SMTP in Supabase (user to create account and app password privately).
- [ ] Test real password recovery delivery, expiry and app redirect.
- [ ] Test Android notification taps from foreground/background/closed app, and iPhone regression.
- [ ] Manually verify typography and calendar at 390px.
- [ ] Save prior GitHub commit, Cloudflare deployment ID, migration versions and backup/export.
- [ ] Merge only when complete, apply migration in compatible order, deploy Edge Function then confirm Cloudflare.
- [ ] Post-release smoke test and rollback readiness review.

## Rollback

`ops/BBBWP0.2_rollback.sql` returns the database to functional compatibility with BBBWP0.1, including its two-argument booking API and post-signup band choice. **It does not remove memberships, accounts, bookings or history.** Then restore the last known-good Cloudflare deployment. `ops/BBBWP0.2_reenable.sql` restores the stricter BBBWP0.2 colour palette for re-release. The push Edge Function and Service Worker should be restored to recorded versions if required. Test rollback before merge.

**Known limitation:** LEMONMILK's supplied free private-use version lacks extended lower-case character coverage. Fallback fonts will render missing glyphs; visually inspect member names and account forms. Review the licence if usage changes to commercial.

## Licensing and release caution

GitHub repository `kevinwkaye/rehearsalbooking` is currently **public**. The client's supplied LEMONMILK font files have been included in this draft branch as self-hosted assets. Personal/non-commercial use is allowed by the supplied readme, but it does not explicitly grant public redistribution rights. Before merge/go-live, confirm whether the public repository may redistribute those binary assets or make appropriate licensed/private-hosting arrangements. No font file is included as a separate end-user download.
