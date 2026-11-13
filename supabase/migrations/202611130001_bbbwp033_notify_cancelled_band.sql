-- BBBWP0.3.3: all approved members of the cancelled rehearsal's band
-- receive their own notification, even when one of them made the cancellation.
-- Preserve the existing broadcast to approved users who are NOT in that band.
-- The notifications INSERT trigger queues the existing in-app/push pipeline.
CREATE OR REPLACE FUNCTION public.cancel_booking(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v public.bookings%ROWTYPE;
  v_name text;
  v_message text;
BEGIN
  IF NOT public.is_approved() THEN RAISE EXCEPTION 'PERMISSION DENIED'; END IF;

  SELECT * INTO v
    FROM public.bookings
    WHERE id=p_id AND status='confirmed'
    FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Booking not found'; END IF;

  IF NOT public.is_admin() AND NOT public.is_band_member(v.band_id) THEN
    RAISE EXCEPTION 'PERMISSION DENIED';
  END IF;

  UPDATE public.bookings
    SET status='cancelled',updated_at=now()
    WHERE id=p_id;

  SELECT name INTO v_name FROM public.bands WHERE id=v.band_id;
  v_message := coalesce(v_name,'Band')||' cancelled '||
    to_char(v.practice_date,'Dy DD Mon')||'. The room is available.';

  -- Existing behaviour: notify approved members of OTHER bands that the room
  -- is available again. This excludes the affected band's members.
  PERFORM public.broadcast_booking(v.band_id,'Rehearsal cancelled',v_message);

  -- Additional behaviour: send one notice to EACH currently approved member
  -- of the affected band, including the member who cancelled the rehearsal.
  -- DISTINCT protects against duplicate membership rows.
  INSERT INTO public.notifications(recipient_user_id,title,body)
  SELECT DISTINCT m.user_id,'Rehearsal cancelled',v_message
    FROM public.band_memberships m
    JOIN public.profiles p ON p.id=m.user_id
    WHERE m.band_id=v.band_id AND p.status='approved';

  INSERT INTO public.audit_events(actor_id,action,details)
    VALUES(auth.uid(),'booking.cancelled',jsonb_build_object('booking_id',p_id));
END
$function$;
