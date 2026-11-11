# Phone push notifications: setup and verification

The Bunkface Booking Boutique already has an in-app notification table, a PWA service worker, subscription registration and a `push-dispatch` Supabase Edge Function in source control. **Push notifications are not operational until the following server configuration is complete.**

## How it will work

1. A signed-in, approved member installs the PWA (iPhone: **Add to Home Screen**) and taps **Enable phone alerts** in the bell panel.
2. The device stores an individual Web Push subscription in `public.push_subscriptions`.
3. A booking, cancellation or move inserts a notification into `public.notifications` for members of the *other bands* (and administrators).
4. A Supabase Database Webhook for `public.notifications` INSERT invokes the `push-dispatch` Edge Function with a shared secret header.
5. The Edge Function loads the notification and relevant subscriptions from the database, sends encrypted Web Push, and marks the notification delivered if no device delivery fails.

## Remaining setup

1. Generate a **VAPID keypair** using a supported Web Push tool, offline or in a trusted private environment. The **public key** is safe to publish; the **private key** must stay server-side.
2. Add `VITE_VAPID_PUBLIC_KEY=<public-key>` to Cloudflare Pages environment variables and rebuild.
3. Configure Edge Function secrets: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_CONTACT=mailto:bunkface_booking_boutique@proton.me`, and a random `PUSH_DISPATCH_SECRET`. Do not put private keys in Cloudflare's `VITE_` variables or in GitHub.
4. Deploy `push-dispatch` with **JWT verification disabled only for that function**, because a database webhook authenticates using `x-bunkface-secret` instead of a user JWT. The function rejects absent or incorrect secrets.
5. In Supabase **Database Webhooks**, configure an INSERT webhook on `public.notifications` to call `https://cpkywxtecixgmdsnfcun.supabase.co/functions/v1/push-dispatch`. Include the exact `x-bunkface-secret` header as the server secret. Restrict this secret to server-side configuration.
6. Test on an Android browser, then on an iPhone with the PWA added to the Home Screen. Enable alerts separately on each device.
7. Create a booking from a different band. Confirm an in-app notification is created, the webhook invokes the function, the push reaches the subscribed device and tapping it opens the app. Check Supabase Edge Function logs if it fails.

## Important limitations

- iPhone browser push generally requires the installed Home Screen web app. Permission must be granted after a user gesture.
- Users with notifications disabled or unsupported devices can still book and read in-app notices.
- A new booking should never be rolled back because Web Push delivery failed.
- If two members share one device, each account/device subscription must be managed independently.
- Avoid repeatedly prompting users who have denied notification permissions.
- For production, add failure monitoring and retry rules; no service can guarantee delivery to every device.
