# Administrator guide

## First-time setup

Follow DEPLOYMENT.md to create the sole administrator. Sign in via **Administrator login**, below the band's sign-in form.

## Create a band

Open **Admin → Create a band account**. Fill in:

- Band name (the value users choose from the drop-down)
- Number of members (informational only)
- Band colour
- Band password (at least 10 characters)

Press **Create band**. The new band will appear in the list immediately. Share only the band's name and password with its members using a trusted channel. Each band has **one shared login** usable on multiple devices. There are no invitations, self-registrations or confirmation votes.

## Change a password

Open **Admin**, find the band and select **Change password**. Enter a new password and save. Share it privately. The app does not send email and does not display or store the old password. Changing a password may not immediately log out existing sessions. Deactivate the band temporarily when urgent access revocation is needed.

## Other management

- **Edit band:** rename it, change member count or colour.
- **Deactivate:** remove the band from the public list and prevent booking updates. Existing reservations remain intact until you edit or cancel them.
- **Activate:** restore access.
- **Calendar:** click any booking to edit, move or cancel it.
- **Recent activity:** inspect the audit list for changes.

The password cannot be viewed after it is set. If forgotten, issue a new one rather than trying to recover the original.

## Support contact

bunkface_booking_boutique@proton.me is an ordinary contact inbox, not an automated sender. No SMTP setup is needed for the app.

## Removing bands and member accounts

Band cards now contain an **Associated accounts** list. You can approve/deactivate/reassign/reset/delete individual non-admin accounts there. Deleting a member permanently removes their login (historical bookings remain), and cannot delete the sole administrator account.

**Delete band** requires confirmation. Cancel all confirmed rehearsals for that band first. Members assigned to a deleted band become unassigned and pending approval so they can choose a different band. If the band has prior booking history, it is archived rather than deleting those records; otherwise it is removed. The admin is not deleted and can be reassigned to a different band later.

The administrator may be assigned to a band, and can book for that band from the calendar. The administrator booking selector defaults to their band but allows booking for other bands when required.

## Phone alerts

Open the bell icon to find **Enable phone alerts** and **Disable phone alerts**. Notifications will only arrive outside the app after the server push setup in [PUSH_NOTIFICATIONS.md](PUSH_NOTIFICATIONS.md) and browser/device permission have been completed. In-app notifications still appear without push.
