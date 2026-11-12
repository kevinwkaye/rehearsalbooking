# BBBWP0.3 | 88 Bunkspace logo replacement

Scope: Visual asset replacement only. Booking, approval, authentication, calendar and notification behaviour is unchanged.

- Replaces the shared Logo component with the supplied 88BS Logo.png artwork on sign-in, registration, password recovery, account pending, configuration and main header.
- Adds public/88-bunkspace-logo.webp. Original artwork is not redesigned or recoloured. Transparent margin is cropped and raster is optimised for web delivery.
- Responsive width for desktop and mobile; intrinsic image ratio preserved.
- No database migration or new configuration is necessary.

Verification: Run npm test and npm run build in CI. Check the header at 390px and the sign-in screen, and both Cloudflare Pages URLs.

Rollback: Revert this commit or restore the previous Pages deployment. No data changes were made.
