-- BBBWP0.5: allow an approved member to book directly for one of their bands.
-- The default request_practice/voting path remains untouched.
CREATE OR REPLACE FUNCTION public.book_practice_instant(
  p_date date,
  p_time time without time zone,
  p_band uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_band_name text;
  v_booking_id uuid;
  v_member_name text;
BEGIN
  IF NOT public.is_approved() OR NOT public.is_band_member(p_band) THEN
    RAISE EXCEPTION 'You are not an approved member of this band';
  END IF;
  IF p_date IS NULL OR p_date < (now() AT TIME ZONE 'Europe/London')::date THEN
    RAISE EXCEPTION 'Choose today or a future date';
  END IF;
  IF p_time IS NULL OR extract(second FROM p_time) <> 0
     OR extract(minute FROM p_time) NOT IN (0,30) THEN
    RAISE EXCEPTION 'Choose a time in 30-minute increments';
  END IF;

  SELECT name INTO v_band_name
  FROM public.bands
  WHERE id=p_band AND archived_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Band no longer active'; END IF;

  -- Same partial unique index as unanimous-confirmation bookings.
  INSERT INTO public.bookings(band_id,practice_date,start_time,created_by)
    VALUES(p_band,p_date,p_time,auth.uid())
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_booking_id;
  IF v_booking_id IS NULL THEN
    RAISE EXCEPTION 'Sorry, this date is already booked';
  END IF;

  SELECT contact_name INTO v_member_name FROM public.profiles WHERE id=auth.uid();

  -- Send in-app notifications; existing notification trigger handles push.
  -- Never send confirm/decline requests for an instant booking.
  INSERT INTO public.notifications(recipient_user_id,title,body)
  SELECT DISTINCT m.user_id,'Practice booked',
    coalesce(v_member_name,'A band member')||' booked '||v_band_name||' for '||
    to_char(p_date,'Dy DD Mon YYYY')||' at '||to_char(p_time,'HH24:MI')||
    '. No confirmation needed.'
  FROM public.band_memberships m
  JOIN public.profiles p ON p.id=m.user_id
  WHERE m.band_id=p_band AND p.status='approved';

  -- Retain optional admin room-wide booking notices, off by default.
  PERFORM public.broadcast_booking(p_band,'New rehearsal booking',
    v_band_name||' booked '||to_char(p_date,'Dy DD Mon')||
    ' at '||to_char(p_time,'HH24:MI')||'.');

  INSERT INTO public.audit_events(actor_id,action,details)
    VALUES(auth.uid(),'booking.confirmed_without_band_vote',
      jsonb_build_object('booking_id',v_booking_id,'band_id',p_band,
                         'date',p_date,'time',p_time));
  RETURN v_booking_id;
END
$function$;
REVOKE ALL ON FUNCTION public.book_practice_instant(date,time without time zone,uuid)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.book_practice_instant(date,time without time zone,uuid)
  TO authenticated;
