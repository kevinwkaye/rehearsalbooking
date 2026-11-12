-- Functional rollback: apply BEFORE restoring the previous Cloudflare Pages build.
-- Keeps account records, additional memberships, bookings, and notifications intact.
BEGIN;
-- BBBWP0.1's frontend knows each user's primary band; BBBWP0.2 has maintained
-- the old two-argument request_practice and choose_band_once functions.
DO $$ BEGIN
 IF NOT has_function_privilege('authenticated','public.request_practice(date,time without time zone)','EXECUTE')
 THEN RAISE EXCEPTION 'Rollback incompatible: old request_practice missing'; END IF;
 IF NOT has_function_privilege('authenticated','public.choose_band_once(uuid)','EXECUTE')
 THEN RAISE EXCEPTION 'Rollback incompatible: legacy band selection missing'; END IF;
END $$;
-- BBBWP0.1 allowed colours beyond BBBWP0.2's palette.
ALTER TABLE public.bands DROP CONSTRAINT IF EXISTS bbbwp02_band_colour_allowed;
-- The old UI only sees profiles.band_id, but all secondary memberships remain
-- saved in public.band_memberships for future re-enabling.
COMMIT;
