-- BBBWP0.4.2 emergency safeguard.
-- Run if unexpected room-wide alerts occur. It switches off optional
-- cross-band admin booking broadcasts without deleting accounts, bookings,
-- notifications, or saved preferences. Own-band notifications still work.
CREATE OR REPLACE FUNCTION public.broadcast_booking(p_band uuid,p_title text,p_body text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
BEGIN
 IF p_title NOT IN ('New rehearsal booking','Rehearsal cancelled') THEN
  RAISE EXCEPTION 'Unsupported booking broadcast type';
 END IF;
 -- Intentionally no cross-band notifications in this fallback.
END $function$;
REVOKE ALL ON FUNCTION public.broadcast_booking(uuid,text,text) FROM PUBLIC,anon,authenticated;
