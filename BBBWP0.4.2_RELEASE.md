# BBBWP0.4.2 | Band-only booking notifications

## Changes

- Booking alerts are no longer broadcast to unrelated bands. Affected-band confirmations and cancellations are unchanged.
- Admins and Superadmins can independently opt in to all-band confirmed bookings and all-band cancellations. Both default to OFF.
- New member registration alerts remain ON by default but each admin may disable them.
- Settings are in the Notifications bell panel and affect new in-app and phone push notifications. They do not erase historical messages.
- Preference records have owner-only row-level security. The old broad broadcast function is no longer callable directly by app users.

## Release verification

- [ ] Automated tests and production build pass.
- [ ] Supabase migration passes a rollback-only trial.
- [ ] Apply migration, verify admin and Superadmin counts and booking totals unchanged.
- [ ] Merge PR and verify both Cloudflare sites deploy.
- [ ] Member A confirms: only Band A receives member alerts.
- [ ] Band B unrelated members receive no new booking or cancellation alerts.
- [ ] Admin default choices: registrations ON, all bookings OFF, all cancellations OFF.
- [ ] Admin opts into bookings or cancellations: only opted-in admins receive the corresponding room-wide alert.
- [ ] Cancellation reason reaches only affected band, never other admins.
- [ ] Declining pending practice still notifies the affected band.
- [ ] Account registrations continue to await approval even if an admin disables registration alerts.
- [ ] Preferences save, reopen and persist after sign-out.
- [ ] Push alerts and mobile panel layout verified on real device.

Existing notices were sent under the previous rules. The fix stops future unrelated-band notices; the existing Clear notifications button can remove old messages.

## Contingency

If the all-band admin alerts malfunction, apply `ops/BBBWP0.4.2_emergency_disable_cross_band_alerts.sql` to disable all optional room-wide alerts without affecting member notifications or booking records.
