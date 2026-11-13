-- BBBWP0.3.3: optional reasons and cancellations reach the affected band.
-- Existing RPC signatures are kept as wrappers for clients still on the old app.
-- The existing notification-trigger push pipeline requires no Edge Function changes.

CREATE OR REPLACE FUNCTION public.cancel_booking(p_id uuid, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE
  v public.bookings%ROWTYPE;
  v_name text;
  v_reason text;
  v_public_message text;
  v_member_message text;
BEGIN
  IF NOT public.is_approved() THEN RAISE EXCEPTION 'PERMISSION DENIED'; END IF;
  -- Validation belongs in the database as well as the browser.
  v_reason:=btrim(coalesce(p_reason,''));
  IF char_length(v_reason)>200 THEN RAISE EXCEPTION 'Reason must be 200 characters or fewer'; END IF;
  v_reason:=nullif(regexp_replace(v_reason,'[[:cntrl:]]+',' ','g'),'');

  SELECT * INTO v FROM public.bookings
    WHERE id=p_id AND status='confirmed' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Booking not found'; END IF;
  IF NOT public.is_admin() AND NOT public.is_band_member(v.band_id) THEN
    RAISE EXCEPTION 'PERMISSION DENIED';
  END IF;

  UPDATE public.bookings SET status='cancelled',updated_at=now() WHERE id=p_id;
  SELECT name INTO v_name FROM public.bands WHERE id=v.band_id;
  v_public_message:=coalesce(v_name,'Band')||' cancelled '||
    to_char(v.practice_date,'Dy DD Mon')||'. The room is available.';
  v_member_message:=v_public_message||
    CASE WHEN v_reason IS NULL THEN '' ELSE ' Reason: '||v_reason END;

  -- Preserve existing announcement to members of other bands.
  PERFORM public.broadcast_booking(v.band_id,'Rehearsal cancelled',v_public_message);

  -- Additionally notify every approved member of the affected band,
  -- including whoever cancelled. DISTINCT prevents duplicate recipients.
  INSERT INTO public.notifications(recipient_user_id,title,body)
  SELECT DISTINCT m.user_id,'Rehearsal cancelled',v_member_message
  FROM public.band_memberships m
  JOIN public.profiles p ON p.id=m.user_id
  WHERE m.band_id=v.band_id AND p.status='approved';

  INSERT INTO public.audit_events(actor_id,action,details)
  VALUES(auth.uid(),'booking.cancelled',
    jsonb_build_object('booking_id',p_id,'reason',v_reason));
END $function$;

-- Preserve old clients that supply only the booking ID.
CREATE OR REPLACE FUNCTION public.cancel_booking(p_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path TO ''
AS $function$
  SELECT public.cancel_booking(p_id,NULL::text);
$function$;

CREATE OR REPLACE FUNCTION public.respond_practice(p_request uuid, p_confirm boolean, p_reason text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE
  r public.practice_requests%ROWTYPE;
  v_count integer;
  v_remaining integer;
  v_reason text;
  v_decliner text;
  v_band_name text;
  v_message text;
BEGIN
  IF NOT public.is_approved() THEN RAISE EXCEPTION 'PERMISSION DENIED'; END IF;
  v_reason:=btrim(coalesce(p_reason,''));
  IF char_length(v_reason)>200 THEN RAISE EXCEPTION 'Reason must be 200 characters or fewer'; END IF;
  v_reason:=nullif(regexp_replace(v_reason,'[[:cntrl:]]+',' ','g'),'');

  SELECT * INTO r FROM public.practice_requests WHERE id=p_request FOR UPDATE;
  IF NOT FOUND OR r.status<>'pending' THEN
    RAISE EXCEPTION 'Request is no longer pending';
  END IF;
  IF NOT public.is_band_member(r.band_id) THEN
    RAISE EXCEPTION 'Cannot confirm another band';
  END IF;
  IF NOT EXISTS(
    SELECT 1 FROM public.practice_confirmations
    WHERE request_id=r.id AND user_id=auth.uid() AND decision='awaiting'
  ) THEN
    RAISE EXCEPTION 'Already responded or not enrolled';
  END IF;

  SELECT count(*) INTO v_count FROM public.band_memberships m
  JOIN public.profiles p ON p.id=m.user_id
  WHERE m.band_id=r.band_id AND p.status='approved';
  IF v_count<>r.expected_confirmations OR EXISTS(
    SELECT 1 FROM public.practice_confirmations c WHERE c.request_id=r.id
    AND NOT EXISTS(
      SELECT 1 FROM public.band_memberships m
      JOIN public.profiles p ON p.id=m.user_id
      WHERE m.band_id=r.band_id AND m.user_id=c.user_id AND p.status='approved'
    )
  ) THEN
    RAISE EXCEPTION 'Band membership changed. Request a new rehearsal';
  END IF;

  UPDATE public.practice_confirmations
  SET decision=CASE WHEN p_confirm THEN 'confirmed' ELSE 'declined' END,
      responded_at=now()
  WHERE request_id=r.id AND user_id=auth.uid();

  INSERT INTO public.audit_events(actor_id,action,details)
  VALUES(auth.uid(),
    CASE WHEN p_confirm THEN 'practice.confirmed' ELSE 'practice.declined' END,
    jsonb_build_object('request_id',r.id,'reason',CASE WHEN p_confirm THEN NULL ELSE v_reason END));

  IF NOT p_confirm THEN
    UPDATE public.practice_requests SET status='declined',resolved_at=now() WHERE id=r.id;
    SELECT contact_name INTO v_decliner FROM public.profiles WHERE id=auth.uid();
    SELECT name INTO v_band_name FROM public.bands WHERE id=r.band_id;
    v_message:=coalesce(v_decliner,'A band member')||
      ' declined '||coalesce(v_band_name,'the band')||' rehearsal on '||
      to_char(r.practice_date,'Dy DD Mon')||
      '. The request is cancelled and the room is not booked.'||
      CASE WHEN v_reason IS NULL THEN '' ELSE ' Reason: '||v_reason END;

    -- Alert every other currently approved member of the affected band.
    -- Exclude the decliner, whose action was already acknowledged on-screen.
    INSERT INTO public.notifications(recipient_user_id,title,body)
    SELECT DISTINCT m.user_id,'Rehearsal cancelled',v_message
    FROM public.band_memberships m
    JOIN public.profiles p ON p.id=m.user_id
    WHERE m.band_id=r.band_id AND p.status='approved' AND m.user_id<>auth.uid();
    RETURN 'declined';
  END IF;

  SELECT count(*) INTO v_remaining FROM public.practice_confirmations
  WHERE request_id=r.id AND decision<>'confirmed';
  IF v_remaining=0 THEN
    RETURN bunkface_private.finalize_practice_request(r.id);
  END IF;
  RETURN 'pending';
END $function$;

-- Preserve old clients using the previous two-argument voting RPC.
CREATE OR REPLACE FUNCTION public.respond_practice(p_request uuid,p_confirm boolean)
RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path TO ''
AS $function$
  SELECT public.respond_practice(p_request,p_confirm,NULL::text);
$function$;

-- For privileged functions: deny anonymous/public EXECUTE. Keep old signatures.
REVOKE ALL ON FUNCTION public.cancel_booking(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_booking(uuid,text) TO authenticated;
REVOKE ALL ON FUNCTION public.cancel_booking(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_booking(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.respond_practice(uuid,boolean,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.respond_practice(uuid,boolean,text) TO authenticated;
REVOKE ALL ON FUNCTION public.respond_practice(uuid,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.respond_practice(uuid,boolean) TO authenticated;
