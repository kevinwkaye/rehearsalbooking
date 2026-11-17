-- Fix booking amendments after BBBWP0.4.2 restricted cross-band broadcasts.
-- Amendments notify only approved members of the affected band.
-- Cancellation notifications remain handled by cancel_booking(uuid,text).

CREATE OR REPLACE FUNCTION public.update_booking(
  p_id uuid,
  p_date date,
  p_time time without time zone
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v public.bookings%ROWTYPE;
  v_band_name text;
  v_message text;
BEGIN
  IF NOT public.is_approved() THEN RAISE EXCEPTION 'PERMISSION DENIED'; END IF;

  SELECT * INTO v FROM public.bookings
  WHERE id = p_id AND status = 'confirmed'
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Booking not found'; END IF;

  IF NOT public.is_admin() AND NOT public.is_band_member(v.band_id) THEN
    RAISE EXCEPTION 'PERMISSION DENIED';
  END IF;
  IF p_date IS NULL OR p_date < (now() AT TIME ZONE 'Europe/London')::date THEN
    RAISE EXCEPTION 'Cannot move to a past date';
  END IF;
  IF p_time IS NULL OR extract(second FROM p_time) <> 0
     OR extract(minute FROM p_time) NOT IN (0,30) THEN
    RAISE EXCEPTION 'Invalid start time';
  END IF;

  -- A no-op edit should not generate notifications.
  IF v.practice_date = p_date AND v.start_time = p_time THEN RETURN; END IF;

  UPDATE public.bookings
    SET practice_date = p_date, start_time = p_time, updated_at = now()
    WHERE id = p_id;

  SELECT name INTO v_band_name FROM public.bands WHERE id = v.band_id;
  v_message := coalesce(v_band_name, 'Your band') || ' changed a rehearsal from ' ||
    to_char(v.practice_date, 'Dy DD Mon YYYY') || ' at ' ||
    to_char(v.start_time, 'HH24:MI') || ' to ' ||
    to_char(p_date, 'Dy DD Mon YYYY') || ' at ' ||
    to_char(p_time, 'HH24:MI') || '.';

  INSERT INTO public.notifications(recipient_user_id, title, body)
    SELECT DISTINCT m.user_id, 'Rehearsal updated', v_message
    FROM public.band_memberships m
    JOIN public.profiles p ON p.id = m.user_id
    WHERE m.band_id = v.band_id AND p.status = 'approved';

  INSERT INTO public.audit_events(actor_id, action, details)
    VALUES (auth.uid(), 'booking.moved',
      jsonb_build_object(
        'booking_id', p_id,
        'from', v.practice_date, 'to', p_date,
        'from_time', v.start_time, 'to_time', p_time
      ));
END
$function$;

REVOKE ALL ON FUNCTION public.update_booking(uuid,date,time without time zone)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.update_booking(uuid,date,time without time zone)
  TO authenticated;
