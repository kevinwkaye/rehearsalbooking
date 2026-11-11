# Administrator guide: individual member accounts

The administrator creates **bands**, not shared band passwords. Each musician registers using their own name, email and password.

## Bands and membership
Create bands in Admin with a band name, colour and member count (informational). Members can then register and select one of these bands once. Their selection is locked; only the administrator can reassign them later.

Review pending members and verify that each person belongs to the selected band before approving. **Email ownership is not verified in this no-SMTP MVP.** You can approve, reject or deactivate members, and change the band assignment where necessary.

## Password resets
Use the Admin member password reset action to set a temporary password. Share it securely via Proton Mail. The member must choose a new password after logging in. No automatic recovery emails are sent.

## Bookings
Approved members can book a date immediately for their own band; the entire day is reserved. Other bands cannot take it. Members can edit and cancel their own band's bookings. The admin can correct all bookings. There is **no individual confirmation vote** for a booking.

## Initial setup
See [DEPLOYMENT.md](DEPLOYMENT.md) for migration order, administrator bootstrap and Cloudflare hosting. The app's help address is `bunkface_booking_boutique@proton.me`.
