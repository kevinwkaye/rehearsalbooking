-- BBBWP0.3.3 functional rollback only.
-- Restores the cancellation notice recipients used before BBBWP0.3.3.
-- Does NOT touch any bookings, memberships, profiles or existing notifications.
CREATE OR REPLACE FUNCTION public.cancel_booking(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE v public.bookings%ROWTYPE; v_name text;
BEGIN
 IF NOT public.is_approved() THEN RAISE EXCEPTION 'PERMISSION DENIED'; END IF;
 SELECT * INTO v FROM public.bookings WHERE id=p_id AND status='confirmed' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Booking not found'; END IF;
 IF NOT public.is_admin() AND NOT public.is_band_member(v.band_id) THEN RAISE EXCEPTION 'PERMISSION DENIED'; END IF;
 UPDATE public.bookings SET status='cancelled',updated_at=now() WHERE id=p_id;
 SELECT name INTO v_name FROM public.bands WHERE id=v.band_id;
 PERFORM public.broadcast_booking(v.band_id,'Rehearsal cancelled',v_name||' cancelled '||to_char(v.practice_date,'Dy DD Mon')||'. The room is available.');
 INSERT INTO public.audit_events(actor_id,action,details) VALUES(auth.uid(),'booking.cancelled',jsonb_build_object('booking_id',p_id));
END $function$;
