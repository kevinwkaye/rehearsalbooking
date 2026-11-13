-- BBBWP0.3.3 functional rollback.
-- Undo new notification recipient behaviour and ignore optional reasons,
-- while preserving both RPC signatures so app versions stay compatible.
-- NO table data / accounts / bookings / notifications are deleted.
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

CREATE OR REPLACE FUNCTION public.respond_practice(p_request uuid,p_confirm boolean)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.practice_requests%ROWTYPE; v_count integer; v_remaining integer;
BEGIN
 IF NOT public.is_approved() THEN RAISE EXCEPTION 'PERMISSION DENIED'; END IF;
 SELECT * INTO r FROM public.practice_requests WHERE id=p_request FOR UPDATE;
 IF NOT FOUND OR r.status<>'pending' THEN RAISE EXCEPTION 'Request is no longer pending'; END IF;
 IF NOT public.is_band_member(r.band_id) THEN RAISE EXCEPTION 'Cannot confirm another band'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.practice_confirmations WHERE request_id=r.id
     AND user_id=auth.uid() AND decision='awaiting') THEN RAISE EXCEPTION 'Already responded or not enrolled'; END IF;
 SELECT count(*) INTO v_count FROM public.band_memberships m JOIN public.profiles p ON p.id=m.user_id
 WHERE m.band_id=r.band_id AND p.status='approved';
 IF v_count<>r.expected_confirmations OR EXISTS (
   SELECT 1 FROM public.practice_confirmations c WHERE c.request_id=r.id
   AND NOT EXISTS(SELECT 1 FROM public.band_memberships m JOIN public.profiles p ON p.id=m.user_id
      WHERE m.band_id=r.band_id AND m.user_id=c.user_id AND p.status='approved')) THEN
   RAISE EXCEPTION 'Band membership changed. Request a new rehearsal'; END IF;
 UPDATE public.practice_confirmations SET decision=CASE WHEN p_confirm THEN 'confirmed' ELSE 'declined' END,responded_at=now()
 WHERE request_id=r.id AND user_id=auth.uid();
 INSERT INTO public.audit_events(actor_id,action,details)
 VALUES(auth.uid(),CASE WHEN p_confirm THEN 'practice.confirmed' ELSE 'practice.declined' END,jsonb_build_object('request_id',r.id));
 IF NOT p_confirm THEN
   UPDATE public.practice_requests SET status='declined',resolved_at=now() WHERE id=r.id;
   INSERT INTO public.notifications(recipient_user_id,title,body)
   SELECT c.user_id,'Rehearsal declined','A member declined '||to_char(r.practice_date,'Dy DD Mon')||'. The room is not booked.'
   FROM public.practice_confirmations c WHERE c.request_id=r.id AND c.user_id<>auth.uid();
   RETURN 'declined';
 END IF;
 SELECT count(*) INTO v_remaining FROM public.practice_confirmations WHERE request_id=r.id AND decision<>'confirmed';
 IF v_remaining=0 THEN RETURN bunkface_private.finalize_practice_request(r.id); END IF;
 RETURN 'pending';
END $$;

-- Old and new clients both remain callable after this functional rollback.
CREATE OR REPLACE FUNCTION public.cancel_booking(p_id uuid,p_reason text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path TO ''
AS $function$
 SELECT public.cancel_booking(p_id);
$function$;

CREATE OR REPLACE FUNCTION public.respond_practice(p_request uuid,p_confirm boolean,p_reason text)
RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path TO ''
AS $function$
 SELECT public.respond_practice(p_request,p_confirm);
$function$;

REVOKE ALL ON FUNCTION public.cancel_booking(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_booking(uuid,text) TO authenticated;
REVOKE ALL ON FUNCTION public.respond_practice(uuid,boolean,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.respond_practice(uuid,boolean,text) TO authenticated;
