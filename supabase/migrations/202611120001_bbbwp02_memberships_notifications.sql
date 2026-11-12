-- BBBWP0.2: multi-band accounts, approval alerts, notification read behaviour.
-- Additive schema with existing primary-band pointer retained for functional rollback.
CREATE TABLE public.band_memberships (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  band_id uuid NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id,band_id)
);
CREATE INDEX band_memberships_by_band ON public.band_memberships(band_id,user_id);
INSERT INTO public.band_memberships(user_id,band_id)
 SELECT id,band_id FROM public.profiles WHERE band_id IS NOT NULL ON CONFLICT DO NOTHING;
ALTER TABLE public.band_memberships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members see own memberships, admin sees all" ON public.band_memberships
 FOR SELECT TO authenticated USING (user_id=(SELECT auth.uid()) OR public.is_admin());
REVOKE INSERT,UPDATE,DELETE ON public.band_memberships FROM anon,authenticated;
GRANT SELECT ON public.band_memberships TO authenticated;

CREATE OR REPLACE FUNCTION public.is_band_member(p_band_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT p_band_id IS NOT NULL AND EXISTS(
  SELECT 1 FROM public.band_memberships m
  JOIN public.profiles p ON p.id=m.user_id
  JOIN public.bands b ON b.id=m.band_id
  WHERE m.user_id=(SELECT auth.uid()) AND m.band_id=p_band_id
    AND p.status='approved' AND b.archived_at IS NULL
 );
$$;
REVOKE ALL ON FUNCTION public.is_band_member(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.is_band_member(uuid) TO authenticated;

-- Signup needs band names before authentication, never member details.
CREATE FUNCTION public.list_signup_bands()
RETURNS TABLE(id uuid,name text,colour text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT id,name,colour FROM public.bands WHERE archived_at IS NULL ORDER BY lower(name),id;
$$;
REVOKE ALL ON FUNCTION public.list_signup_bands() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.list_signup_bands() TO anon,authenticated;

-- Any user-supplied band IDs are just a PENDING request. No caller can set role or approval.
-- Supabase Auth trigger makes membership selection atomic with account creation.
CREATE OR REPLACE FUNCTION public.on_auth_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_name text; v_requested jsonb; v_count integer; v_valid integer; v_first uuid;
BEGIN
 IF coalesce(NEW.raw_app_meta_data->>'admin_bootstrap','false')='true' THEN RETURN NEW; END IF;
 IF coalesce(NEW.raw_app_meta_data->>'band_managed','false')='true' THEN
   RAISE EXCEPTION 'Legacy shared band login creation is disabled';
 END IF;
 v_name:=btrim(coalesce(NEW.raw_user_meta_data->>'contact_name',''));
 IF length(v_name) NOT BETWEEN 2 AND 80 OR NEW.email IS NULL THEN
   RAISE EXCEPTION 'Please enter your name and email'; END IF;
 v_requested:=NEW.raw_user_meta_data->'band_ids';
 -- Compatibility with previous single-band signup during a functional rollback.
 IF v_requested IS NULL THEN
   INSERT INTO public.profiles(id,band_id,email,contact_name,role,status)
   VALUES(NEW.id,NULL,lower(NEW.email),v_name,'band','pending');
   RETURN NEW;
 END IF;
 IF jsonb_typeof(v_requested)<>'array'
   OR jsonb_array_length(v_requested) NOT BETWEEN 1 AND 20 THEN
   RAISE EXCEPTION 'Choose at least one band'; END IF;
 -- Check each ID without granting access to any additional data.
 IF EXISTS(SELECT 1 FROM jsonb_array_elements_text(v_requested) AS x(value)
           WHERE value !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
 THEN RAISE EXCEPTION 'Invalid band selection'; END IF;
 SELECT count(*),count(DISTINCT value::uuid) INTO v_count,v_valid
 FROM jsonb_array_elements_text(v_requested) AS x(value);
 IF v_valid<>v_count THEN RAISE EXCEPTION 'Duplicate band selection'; END IF;
 IF (SELECT count(*) FROM public.bands WHERE id IN
    (SELECT value::uuid FROM jsonb_array_elements_text(v_requested) AS x(value))
    AND archived_at IS NULL)<>v_count THEN RAISE EXCEPTION 'Unknown or inactive band'; END IF;
 SELECT value::uuid INTO v_first FROM jsonb_array_elements_text(v_requested) AS x(value) LIMIT 1;
 INSERT INTO public.profiles(id,band_id,email,contact_name,role,status)
 VALUES(NEW.id,v_first,lower(NEW.email),v_name,'band','pending');
 INSERT INTO public.band_memberships(user_id,band_id)
 SELECT NEW.id,value::uuid FROM jsonb_array_elements_text(v_requested) AS x(value);
 INSERT INTO public.notifications(recipient_user_id,title,body)
 SELECT id,'Account awaiting approval',v_name||' signed up for '||(
    SELECT string_agg(b.name,', ' ORDER BY b.name)
    FROM public.bands b JOIN public.band_memberships bm ON bm.band_id=b.id WHERE bm.user_id=NEW.id
 )||'. Review their registration in Admin.'
 FROM public.profiles WHERE role='admin' AND status='approved';
 INSERT INTO public.audit_events(actor_id,action,details)
 VALUES(NEW.id,'account.registered',jsonb_build_object('user_id',NEW.id,'band_ids',v_requested));
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.on_auth_created() FROM PUBLIC,anon,authenticated;

-- Previous frontend chooses a band after signup. Keep this route rollback-safe.
CREATE OR REPLACE FUNCTION public.choose_band_once(p_band_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_name text;
BEGIN
 IF (SELECT auth.uid()) IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.bands WHERE id=p_band_id AND archived_at IS NULL)
 THEN RAISE EXCEPTION 'Unknown band'; END IF;
 UPDATE public.profiles SET band_id=p_band_id
 WHERE id=auth.uid() AND role='band' AND band_id IS NULL AND status='pending';
 IF NOT FOUND THEN RAISE EXCEPTION 'Band already selected'; END IF;
 INSERT INTO public.band_memberships(user_id,band_id) VALUES(auth.uid(),p_band_id)
 ON CONFLICT DO NOTHING;
 SELECT contact_name INTO v_name FROM public.profiles WHERE id=auth.uid();
 INSERT INTO public.notifications(recipient_user_id,title,body)
 SELECT p.id,'Account awaiting approval',v_name||' registered for '||b.name||'. Review in Admin.'
 FROM public.profiles p JOIN public.bands b ON b.id=p_band_id
 WHERE p.role='admin' AND p.status='approved';
 INSERT INTO public.audit_events(actor_id,action,details)
 VALUES(auth.uid(),'member.band_selected',jsonb_build_object('band_id',p_band_id));
END $$;
REVOKE ALL ON FUNCTION public.choose_band_once(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.choose_band_once(uuid) TO authenticated;

-- Admin assigns complete membership list. Single approval remains at profile level.
CREATE FUNCTION public.admin_set_member_bands(p_user_id uuid,p_band_ids uuid[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_role text; v_current uuid; v_new_primary uuid;
BEGIN
 IF NOT public.is_admin() THEN RAISE EXCEPTION 'PERMISSION DENIED'; END IF;
 SELECT role,band_id INTO v_role,v_current FROM public.profiles WHERE id=p_user_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Account not found'; END IF;
 IF p_band_ids IS NULL OR cardinality(p_band_ids)<1 OR cardinality(p_band_ids)>20 THEN
   RAISE EXCEPTION 'Select at least one band'; END IF;
 IF cardinality(ARRAY(SELECT DISTINCT unnest(p_band_ids)))<>cardinality(p_band_ids) THEN
   RAISE EXCEPTION 'Duplicate band selection'; END IF;
 IF EXISTS(SELECT 1 FROM unnest(p_band_ids) i WHERE i IS NULL
      OR NOT EXISTS(SELECT 1 FROM public.bands b WHERE b.id=i AND b.archived_at IS NULL)) THEN
   RAISE EXCEPTION 'Unknown band'; END IF;
 DELETE FROM public.band_memberships WHERE user_id=p_user_id AND band_id<>ALL(p_band_ids);
 INSERT INTO public.band_memberships(user_id,band_id)
 SELECT p_user_id,unnest(p_band_ids) ON CONFLICT DO NOTHING;
 v_new_primary:=CASE WHEN v_current=ANY(p_band_ids) THEN v_current ELSE p_band_ids[1] END;
 UPDATE public.profiles SET band_id=v_new_primary WHERE id=p_user_id;
 INSERT INTO public.audit_events(actor_id,action,details)
 VALUES(auth.uid(),'member.bands_changed',jsonb_build_object('user_id',p_user_id,'band_ids',to_jsonb(p_band_ids)));
END $$;
REVOKE ALL ON FUNCTION public.admin_set_member_bands(uuid,uuid[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_member_bands(uuid,uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_status(p_user_id uuid,p_status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT public.is_admin() THEN RAISE EXCEPTION 'PERMISSION DENIED'; END IF;
 IF p_status NOT IN ('approved','rejected','deactivated') THEN RAISE EXCEPTION 'Invalid status'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_user_id AND role='band') THEN
   RAISE EXCEPTION 'Account not found or administrator account'; END IF;
 IF p_status='approved' AND NOT EXISTS(SELECT 1 FROM public.band_memberships m
  JOIN public.bands b ON b.id=m.band_id WHERE m.user_id=p_user_id AND b.archived_at IS NULL) THEN
   RAISE EXCEPTION 'Choose at least one active band'; END IF;
 UPDATE public.profiles SET status=p_status WHERE id=p_user_id;
 INSERT INTO public.audit_events(actor_id,action,details)
 VALUES(auth.uid(),'account.status',jsonb_build_object('user_id',p_user_id,'status',p_status));
END $$;

-- Preserve old single-band API for rollback, but make it membership-safe.
CREATE OR REPLACE FUNCTION public.admin_change_member_band(p_user_id uuid,p_band_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT public.is_admin() THEN RAISE EXCEPTION 'PERMISSION DENIED'; END IF;
 PERFORM public.admin_set_member_bands(p_user_id,ARRAY[p_band_id]);
END $$;

CREATE OR REPLACE FUNCTION public.mark_all_notices_read(p_through_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_cutoff timestamptz; v_count integer;
BEGIN
 IF (SELECT auth.uid()) IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
 SELECT created_at INTO v_cutoff FROM public.notifications WHERE id=p_through_id AND recipient_user_id=auth.uid();
 IF v_cutoff IS NULL THEN RETURN 0; END IF;
 UPDATE public.notifications SET read_at=now() WHERE recipient_user_id=auth.uid()
  AND read_at IS NULL AND created_at<=v_cutoff;
 GET DIAGNOSTICS v_count=ROW_COUNT;
 RETURN v_count;
END $$;
REVOKE ALL ON FUNCTION public.mark_all_notices_read(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mark_all_notices_read(uuid) TO authenticated;

-- Existing RLS must include all the member's bands (not only profiles.band_id).
DROP POLICY "own band or admin reads requests" ON public.practice_requests;
CREATE POLICY "own band or admin reads requests" ON public.practice_requests
 FOR SELECT TO authenticated USING(public.is_approved() AND (public.is_band_member(band_id) OR public.is_admin()));
DROP POLICY "own band or admin reads confirmations" ON public.practice_confirmations;
CREATE POLICY "own band or admin reads confirmations" ON public.practice_confirmations
 FOR SELECT TO authenticated USING(public.is_approved() AND EXISTS(
   SELECT 1 FROM public.practice_requests r WHERE r.id=request_id
   AND (public.is_band_member(r.band_id) OR public.is_admin())
 ));

-- Enrolment changes (and status changes) invalidate only affected pending proposals.
CREATE FUNCTION bunkface_private.invalidate_band_requests(p_band_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF p_band_id IS NULL THEN RETURN; END IF;
 WITH invalid AS (
  UPDATE public.practice_requests SET status='invalidated',resolved_at=now()
  WHERE band_id=p_band_id AND status='pending' RETURNING id
 )
 INSERT INTO public.notifications(recipient_user_id,title,body)
 SELECT c.user_id,'Rehearsal request needs restarting','Band membership changed. Request a new practice date.'
 FROM invalid i JOIN public.practice_confirmations c ON c.request_id=i.id;
END $$;
REVOKE ALL ON FUNCTION bunkface_private.invalidate_band_requests(uuid) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION bunkface_private.band_memberships_changed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF TG_OP='DELETE' THEN
   -- The profile may already have been cascade-deleted.
   PERFORM bunkface_private.invalidate_band_requests(OLD.band_id);
 ELSE
   -- Pending signups do not count towards unanimous approval until approved.
   IF EXISTS(SELECT 1 FROM public.profiles WHERE id=NEW.user_id AND status='approved') THEN
     PERFORM bunkface_private.invalidate_band_requests(NEW.band_id);
   END IF;
 END IF;
 RETURN COALESCE(NEW,OLD);
END $$;
CREATE TRIGGER invalidate_on_membership_change
 AFTER INSERT OR DELETE ON public.band_memberships
 FOR EACH ROW EXECUTE FUNCTION bunkface_private.band_memberships_changed();

-- Replace legacy profile trigger. Primary-band pointer changes are not
-- membership changes; approval/deactivation must invalidate all enrolled bands.
DROP TRIGGER IF EXISTS invalidate_on_profile_change ON public.profiles;
CREATE OR REPLACE FUNCTION bunkface_private.membership_changed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_band uuid;
BEGIN
 IF TG_OP='UPDATE' AND OLD.status IS NOT DISTINCT FROM NEW.status
  AND OLD.role IS NOT DISTINCT FROM NEW.role THEN RETURN NEW; END IF;
 FOR v_band IN SELECT band_id FROM public.band_memberships
   WHERE user_id=COALESCE(NEW.id,OLD.id)
 LOOP PERFORM bunkface_private.invalidate_band_requests(v_band); END LOOP;
 RETURN COALESCE(NEW,OLD);
END $$;
CREATE TRIGGER invalidate_on_profile_change
 AFTER UPDATE OF status,role OR DELETE ON public.profiles
 FOR EACH ROW EXECUTE FUNCTION bunkface_private.membership_changed();

-- Update roster to include every approved user assigned to the selected band.
CREATE OR REPLACE FUNCTION public.request_practice(p_date date,p_time time without time zone,p_band uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_name text; v_proposer text; v_active integer; v_request uuid; v_result text;
BEGIN
 IF NOT public.is_band_member(p_band) THEN RAISE EXCEPTION 'You are not assigned to this band'; END IF;
 IF p_date IS NULL OR p_date<(now() AT TIME ZONE 'Europe/London')::date THEN
   RAISE EXCEPTION 'Choose today or a future date'; END IF;
 IF p_time IS NULL OR extract(second FROM p_time)<>0 OR extract(minute FROM p_time) NOT IN (0,30) THEN
   RAISE EXCEPTION 'Choose a time in 30-minute increments'; END IF;
 SELECT name INTO v_name FROM public.bands WHERE id=p_band AND archived_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Band no longer active'; END IF;
 SELECT count(*) INTO v_active FROM public.band_memberships m JOIN public.profiles p ON p.id=m.user_id
 WHERE m.band_id=p_band AND p.status='approved';
 IF v_active<1 THEN RAISE EXCEPTION 'No approved members'; END IF;
 IF EXISTS(SELECT 1 FROM public.bookings WHERE practice_date=p_date AND status='confirmed') THEN
   RAISE EXCEPTION 'Sorry, this date is already booked'; END IF;
 IF EXISTS(SELECT 1 FROM public.practice_requests WHERE band_id=p_band AND practice_date=p_date AND status='pending') THEN
   RAISE EXCEPTION 'Your band already has a pending request for this date'; END IF;
 INSERT INTO public.practice_requests(band_id,practice_date,start_time,proposed_by,expected_confirmations)
 VALUES(p_band,p_date,p_time,auth.uid(),v_active) RETURNING id INTO v_request;
 INSERT INTO public.practice_confirmations(request_id,user_id,member_name,decision,responded_at)
 SELECT v_request,p.id,p.contact_name,CASE WHEN p.id=auth.uid() THEN 'confirmed' ELSE 'awaiting' END,
   CASE WHEN p.id=auth.uid() THEN now() ELSE NULL END
 FROM public.band_memberships m JOIN public.profiles p ON p.id=m.user_id
 WHERE m.band_id=p_band AND p.status='approved';
 SELECT contact_name INTO v_proposer FROM public.profiles WHERE id=auth.uid();
 INSERT INTO public.notifications(recipient_user_id,title,body)
 SELECT c.user_id,'Confirm a rehearsal',v_proposer||' has requested '||v_name||' on '||to_char(p_date,'Dy DD Mon')||' at '||to_char(p_time,'HH24:MI')||'. Open 88 Bunkspace to confirm or decline.'
 FROM public.practice_confirmations c WHERE c.request_id=v_request AND c.decision='awaiting';
 INSERT INTO public.audit_events(actor_id,action,details)
 VALUES(auth.uid(),'practice.requested',jsonb_build_object('request_id',v_request,'band_id',p_band,'date',p_date));
 IF v_active=1 THEN v_result:=bunkface_private.finalize_practice_request(v_request); END IF;
 RETURN v_request;
END $$;
REVOKE ALL ON FUNCTION public.request_practice(date,time without time zone,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.request_practice(date,time without time zone,uuid) TO authenticated;

-- Compatibility wrapper for older clients during the deployment/rollback window.
CREATE OR REPLACE FUNCTION public.request_practice(p_date date,p_time time without time zone)
RETURNS uuid LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 SELECT public.request_practice(p_date,p_time,public.my_band_id());
$$;
REVOKE ALL ON FUNCTION public.request_practice(date,time without time zone) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.request_practice(date,time without time zone) TO authenticated;

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
REVOKE ALL ON FUNCTION public.respond_practice(uuid,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.respond_practice(uuid,boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_booking(p_id uuid,p_date date,p_time time without time zone)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v public.bookings%ROWTYPE; v_name text;
BEGIN
 IF NOT public.is_approved() THEN RAISE EXCEPTION 'PERMISSION DENIED'; END IF;
 SELECT * INTO v FROM public.bookings WHERE id=p_id AND status='confirmed' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Booking not found'; END IF;
 IF NOT public.is_admin() AND NOT public.is_band_member(v.band_id) THEN RAISE EXCEPTION 'PERMISSION DENIED'; END IF;
 IF p_date IS NULL OR p_date<(now() AT TIME ZONE 'Europe/London')::date THEN RAISE EXCEPTION 'Cannot move to a past date'; END IF;
 IF p_time IS NULL OR extract(second FROM p_time)<>0 OR extract(minute FROM p_time) NOT IN (0,30) THEN RAISE EXCEPTION 'Invalid start time'; END IF;
 UPDATE public.bookings SET practice_date=p_date,start_time=p_time,updated_at=now() WHERE id=p_id;
 SELECT name INTO v_name FROM public.bands WHERE id=v.band_id;
 PERFORM public.broadcast_booking(v.band_id,'Rehearsal moved',v_name||' moved a rehearsal from '||to_char(v.practice_date,'Dy DD Mon')||' to '||to_char(p_date,'Dy DD Mon')||' at '||to_char(p_time,'HH24:MI')||'.');
 INSERT INTO public.audit_events(actor_id,action,details) VALUES(auth.uid(),'booking.moved',jsonb_build_object('booking_id',p_id,'from',v.practice_date,'to',p_date));
END $$;

CREATE OR REPLACE FUNCTION public.cancel_booking(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
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
END $$;

-- Preserve the rule that a band sees its own pending requests, never other bands'.
-- Bookings are visible globally only when confirmed.
DROP POLICY IF EXISTS "approved users read confirmed bookings" ON public.bookings;
CREATE POLICY "approved users read confirmed bookings" ON public.bookings
 FOR SELECT TO authenticated USING(public.is_approved() AND (status='confirmed' OR public.is_admin() OR public.is_band_member(band_id)));

-- Broadcast booking changes to other bands, with no duplicate notifications for multi-band accounts.
CREATE OR REPLACE FUNCTION public.broadcast_booking(p_band uuid,p_title text,p_body text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 INSERT INTO public.notifications(recipient_user_id,title,body)
 SELECT p.id,p_title,p_body FROM public.profiles p WHERE p.status='approved'
 AND NOT EXISTS(SELECT 1 FROM public.band_memberships m WHERE m.user_id=p.id AND m.band_id=p_band);
END $$;
REVOKE ALL ON FUNCTION public.broadcast_booking(uuid,text,text) FROM PUBLIC,anon,authenticated;

-- Drop single band only while preserving other memberships and accounts.
CREATE OR REPLACE FUNCTION public.admin_delete_band(p_band_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_name text; v_result text;
BEGIN
 IF NOT public.is_admin() THEN RAISE EXCEPTION 'PERMISSION DENIED'; END IF;
 SELECT name INTO v_name FROM public.bands WHERE id=p_band_id AND archived_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Band not found'; END IF;
 IF EXISTS(SELECT 1 FROM public.bookings WHERE band_id=p_band_id AND status='confirmed') THEN
   RAISE EXCEPTION 'Cancel confirmed rehearsals before deleting this band'; END IF;
 DELETE FROM public.band_memberships WHERE band_id=p_band_id;
 UPDATE public.profiles p SET band_id=(SELECT m.band_id FROM public.band_memberships m
  WHERE m.user_id=p.id ORDER BY m.created_at,m.band_id LIMIT 1)
 WHERE p.band_id=p_band_id;
 UPDATE public.profiles p SET status='pending' WHERE p.role='band' AND p.status='approved'
  AND NOT EXISTS(SELECT 1 FROM public.band_memberships m WHERE m.user_id=p.id);
 IF EXISTS(SELECT 1 FROM public.bookings WHERE band_id=p_band_id) OR EXISTS(SELECT 1 FROM public.practice_requests WHERE band_id=p_band_id) THEN
  UPDATE public.bands SET archived_at=now() WHERE id=p_band_id;
  v_result:='archived';
 ELSE
  DELETE FROM public.bands WHERE id=p_band_id;
  v_result:='deleted';
 END IF;
 INSERT INTO public.audit_events(actor_id,action,details)
 VALUES(auth.uid(),'band.'||v_result,jsonb_build_object('band_id',p_band_id,'name',v_name));
 RETURN v_result;
END $$;

-- Client supplied flat colours; admin may freely reassign within this palette.
-- Existing bands retain identity, but are assigned a deterministic initial palette.
WITH ordered AS (SELECT id,ROW_NUMBER() OVER(ORDER BY created_at,id) AS n FROM public.bands)
UPDATE public.bands b SET colour=palette.hex
FROM ordered o CROSS JOIN LATERAL (
 SELECT (ARRAY['#A30000','#D84797','#FF7700','#00AFB5','#7DDF64'])[((o.n-1)%5)+1] AS hex
) palette WHERE b.id=o.id;
ALTER TABLE public.bands ADD CONSTRAINT bbbwp02_band_colour_allowed
CHECK (upper(colour)=ANY(ARRAY['#A30000','#D84797','#FF7700','#00AFB5','#7DDF64']));

ALTER PUBLICATION supabase_realtime ADD TABLE public.band_memberships;
