# Testing checklist

## Automatic checks

Run `npm test`, `npx tsc -b --noEmit` (or `npm run build`) and any configured GitHub Actions checks.

The fast test suite covers local calendar/time calculations and the admin-managed login contract. It is **not** a substitute for live database and device integration testing.

## Supabase and browser acceptance

1. Verify unauthenticated `list_login_bands` returns approved band names/colours, but never passwords, emails or user IDs.
2. Confirm public `auth.signUp()` attempts are blocked by the trigger and by disabled signups in Supabase settings.
3. Verify login dropdown excludes deactivated accounts.
4. Verify an ordinary band account cannot invoke `admin-band-account` for create or password changes.
5. Admin creates two differently coloured bands and privately sets passwords.
6. Band A signs in by choosing the name and entering the password. Wrong password fails.
7. Band A reserves a full day. Band B sees the booking and cannot reserve the same date.
8. Trigger simultaneous booking requests to the same date from both bands; exactly one succeeds.
9. Band A reschedules its booking. If the destination is taken, its original booking is unchanged.
10. Band A cancels. Band B can subsequently book the freed date.
11. Band B cannot edit or cancel Band A's booking by crafting direct API requests.
12. Admin changes Band A's password, tests new credentials and deactivates Band A when needed.
13. Calendar reads and writes are correct around British Summer Time changes.
14. Test iPhone, Android, mobile browser and desktop, including install and notification permission handling.
15. Confirm in-app notifications still work when browser push notifications are disabled.
16. Verify administrator role cannot be granted by editing user metadata from the frontend.

Record the manual test evidence before treating the deployment as production-ready.


## Whole-band proposal checks
- Set a band to two expected members and approve two real accounts in that band. A proposal should be pending after the first member creates it.
- Both members can view the proposal and confirmation progress. Only the second member has Confirm/Decline enabled.
- Confirming creates one full-day booking; declining creates none. A third vote or duplicate confirm must be rejected safely.
- Competing pending requests can exist for the same day, but only one can become confirmed.
- An admin **not in the band** does not receive a voting request. Adam **in 88 Bunkface** votes as a member.
- With an expected count of four but only one approved member, a new request is blocked until remaining members are approved or the admin updates the count.
- Changing a member's band, deactivating an account or adjusting the band count invalidates pending requests.
- Push notifications are tested separately on real Android and iPhone devices after private secrets are set; in-app notifications must always work.
