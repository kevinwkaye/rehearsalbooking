# 88 Bunkspace | Scenario-based UAT checklist

**Release:** BBBWP0.3.1 help/contact tidy-up, following BBBWP0.3.
**Test on:** https://88-bunkspace.pages.dev/ (Android Chrome/PWA and a desktop browser)
**Roles:** Admin, approved member of one band, approved member of two bands, pending member, deactivated member.
**Before testing:** Use dedicated test accounts and future rehearsal dates. Do **not** delete real band members or bookings. Record screenshots, date tested, expected and actual outcomes and any issues.

## A. Getting in

- [ ] **A1 New member registers for one band.** Sign up with a new email and tick one band. **Expected:** Account pending; cannot book until approved. Admin sees a pending-approval count.
- [ ] **A2 New member registers for two bands.** Tick two bands during signup. **Expected:** Both appear in admin review; only one account approval required.
- [ ] **A3 No band selected.** Submit registration without ticking a band. **Expected:** Validation stops registration.
- [ ] **A4 Admin approves member.** Approve a pending member. **Expected:** Member can log in, and only assigned bands are accessible.
- [ ] **A5 Reject and deactivate account.** Use a test member. **Expected:** No calendar booking access. Re-approval/reactivation restores access appropriately; no accidental new booking.
- [ ] **A6 Forgotten password.** Request recovery for a test account. **Expected:** Email arrives, link leads to the correct 88 Bunkspace address, new password works, old password no longer does.
- [ ] **A7 Expired or invalid reset link.** Use an invalid/old link. **Expected:** Clear error; account stays secure.

## B. The calendar

- [ ] **B1 Find a date.** Open the calendar, tap a future empty day. **Expected:** Booking form opens for that date.
- [ ] **B2 Month swipe.** Swipe left/right on Android, then use month arrows on desktop. **Expected:** Exactly one month changes, vertical scrolling still works, no months before current.
- [ ] **B3 Past day.** Tap an earlier date. **Expected:** Cannot create a rehearsal.
- [ ] **B4 Already booked day.** Open another band's confirmed date. **Expected:** Correct band and time visible; user cannot take or alter it.
- [ ] **B5 Mobile layout.** Check around 390px and 320px wide. **Expected:** Calendar fits, no horizontal overflow or clipped controls.

## C. Band booking and approval

- [ ] **C1 One registered approved band member.** Request a rehearsal. **Expected:** Automatically confirmed; day becomes unavailable to others.
- [ ] **C2 Two approved band members.** One requests. **Expected:** Request appears pending, proposer already counts as confirmed, other member receives an alert.
- [ ] **C3 Second member confirms.** Confirm via Notifications. **Expected:** Booking becomes confirmed and the calendar shows the correct band and start time.
- [ ] **C4 Member declines.** Submit a separate test request then decline. **Expected:** Request closes; date not reserved.
- [ ] **C5 Competing bands on same day.** Two bands propose an available date. **Expected:** First to complete confirmations wins; no double confirmed booking.
- [ ] **C6 Edit and cancel.** Use the owning band. **Expected:** New date/time persists; cancelled date becomes available; other bands cannot edit/cancel.
- [ ] **C7 Multi-band member books.** Select one of two assigned bands. **Expected:** Only selected band's members count towards confirmations.
- [ ] **C8 Remove one of two band assignments.** Admin removes one band from a test account. **Expected:** Member retains the other band, cannot book for removed band even after stale session refresh.
- [ ] **C9 Remove final band.** Admin tries to clear the last checkbox. **Expected:** Saving blocked; admin must reassign or delete the account.
- [ ] **C10 No 'Awaiting band' ghost.** Repeat membership changes, refresh and inspect calendar. **Expected:** No pending request created by an unassigned member.
- [ ] **C11 Membership changes mid-request.** Create a request waiting for bandmate confirmation, then adjust approved members. **Expected:** Old request invalidated; fresh request required.

## D. Alerts and admin

- [ ] **D1 New signup alert.** Register a test member. **Expected:** Admin receives in-app notice and, with phone alerts enabled, Android push; pending count links to member.
- [ ] **D2 Bell clears unread state.** Open bell. **Expected:** Unread marker clears, history remains, outstanding approval/booking actions remain open.
- [ ] **D3 Phone push opens app.** Tap Android notification when app is foreground, background, then closed. **Expected:** App opens/focuses correct view instead of only dismissing alert.
- [ ] **D4 Push permission cycle.** Enable then disable notifications on a test device. **Expected:** User receives only permitted alerts, and disable takes effect.
- [ ] **D5 Admin creates/edits band.** Use test band. **Expected:** Palette and member-count settings save and display; expected count does not add approval votes.
- [ ] **D6 Admin manages members.** Assign another band; deactivate/reactivate; reset a test account's password. **Expected:** Rights and login behaviour update correctly.
- [ ] **D7 Delete test account / band.** Follow confirmations using only synthetic data. **Expected:** No active account access; booking history preserved.

## E. Branding and help

- [ ] **E1 App name and logo.** Sign-in, header, browser tab, installed PWA. **Expected:** 88 Bunkspace with correct artwork, no clipped logo.
- [ ] **E2 How-to shortcut.** Tap the **?** in the header. **Expected:** Static /help.html loads, including member and admin instructions, with a working Back to app link.
- [ ] **E3 Help before signup.** Open How it works from login. **Expected:** Works without authentication.
- [ ] **E4 Long email on deactivated screen.** Use test account. **Expected:** Support text stays inside mobile card; tapping configured Gmail contact opens mail composer. Until a Gmail contact is configured, no incorrect email should be shown.
- [ ] **E5 Colour and font.** Verify band colours, LEMONMILK glyphs and long names. **Expected:** No illegible text, clipped headings or colour-only identification.
- [ ] **E6 Network and device checks.** Test slow/mobile network and offline. **Expected:** No phantom confirmation; error messages explain offline booking limitations.
- [ ] **E7 Pull-to-refresh alignment.** On Android, pull down to refresh while signed out and signed in. **Expected:** Temporary loading logo and text remain centred, no sideways movement or horizontal scroll.
- [ ] **E8 Branded icons.** Check the browser favicon, Android installed PWA icon, and Android notification in both collapsed and expanded views. **Expected:** The new logo's 88 motif is visible in the favicon/status bar (monochrome in status bar), the larger app icon shows the full supplied artwork, and no white square appears. If Android caches the previous icon, refresh or reinstall the PWA and retry.


## Sign-off log

| Scenario | Pass / Fail / Blocked | Tester | Date | Notes or evidence |
|---|---|---|---|---|
| A: Registration and login | | | | |
| B: Calendar | | | | |
| C: Booking and band confirmations | | | | |
| D: Admin and notifications | | | | |
| E: Branding and static guide | | | | |

**Release blocker:** All account permissions, booking conflict, recovery-email and phone-push critical scenarios must pass. Report any regression with device, account role, date and steps to reproduce.