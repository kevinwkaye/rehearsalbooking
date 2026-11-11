# Test plan and current verification scope

## Automated

`npm test` runs dependency-free unit tests for UK calendar date keys, month grid, leap days, London time at a BST boundary and 30-minute time selections.

`npm run build` performs TypeScript checking and a Vite production build (requires `npm install`).

## Integration tests requiring Supabase

These need a deployed or local Supabase project with the migration applied. They cannot be convincingly tested against a fabricated client-side database.

1. Register two bands with distinct emails and case-insensitively distinct names; reject duplicate band names.
2. Check both new profiles have `role=band`, `status=pending`. They cannot read bands or bookings.
3. Promote a sole admin using the SQL editor. Approve both profiles; verify read access then activates.
4. Create a booking as Band A; Band B should see it but must not be able to change it.
5. In parallel, as Band A and Band B, attempt to create a booking for the same date: exactly one may succeed.
6. Try inserting directly into `bookings` and updating another band's booking with client credentials: expect RLS/permissions failure.
7. Reschedule Band A into a date occupied by Band B: original booking must stay intact.
8. Cancel a booking, then rebook its date with another band. Verify the cancelled history remains.
9. As an approved band, invoke admin status/edit RPCs: expect rejection. As a pending member, invoke booking RPCs: expect rejection.
10. Change an approved band to deactivated; its existing session must no longer access the calendar or RPCs.
11. Generate a recovery link using the admin's JWT; ensure a band user's JWT gets 403.
12. Test booking notifications through Realtime and device push, if enabled.
13. Repeat dates around March and October BST clock changes and around New Year.

## Physical devices

- iPhone Safari and Home Screen installation, Web Push permission and receiving a notification.
- Android Chrome installation, permission and receiving a notification.
- Small screen calendar readability, date picker and time dropdown.
- Multiple band devices connected simultaneously.

Any missing service credentials, unavailable deployments or missing physical-device testing must be reported before production handover. Do not describe tests as passing without running them.
