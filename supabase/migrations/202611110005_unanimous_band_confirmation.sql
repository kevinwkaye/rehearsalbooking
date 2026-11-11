-- The Bunkface Booking Boutique: proposals require every approved member of
-- the selected band, including an administrator who is also in that band.
-- Pending proposals never reserve a date. The existing partial unique index on
-- confirmed bookings remains the final authority for room availability.

CREATE TABLE public.practice_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  band_id uuid NOT NULL REFERENCES public.bands(id),
  practice_date date NOT NULL,
  start_time time without time zone NOT NULL,
  proposed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  expected_confirmations integer NOT NULL CHECK (expected_confirmations BETWEEN 1 AND 50),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','confirmed','declined','clashed','invalidated')),
  booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  CONSTRAINT request_time_half_hour CHECK (extract(second FROM start_time)=0 AND extract(minute FROM start_time) IN (0,30))
);
CREATE UNIQUE INDEX one_pending_request_per_band_day
  ON public.practice_requests(band_id,practice_date) WHERE status='pending';
CREATE INDEX requests_for_band_date ON public.practice_requests(band_id,practice_date DESC);

CREATE TABLE public.practice_confirmations (
  request_id uuid NOT NULL REFERENCES public.practice_requests(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  member_name text NOT NULL,
  decision text NOT NULL DEFAULT 'awaiting' CHECK(decision IN ('awaiting','confirmed','declined')),
  responded_at timestamptz,
  PRIMARY KEY(request_id,user_id)
);
CREATE INDEX confirmations_by_user ON public.practice_confirmations(user_id);

ALTER TABLE public.practice_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.practice_confirmations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own band or admin reads requests" ON public.practice_requests FOR SELECT TO authenticated
  USING (public.is_approved() AND (band_id=public.my_band_id() OR public.is_admin()));
CREATE POLICY "own band or admin reads confirmations" ON public.practice_confirmations FOR SELECT TO authenticated
  USING (public.is_approved() AND EXISTS (
    SELECT 1 FROM public.practice_requests r WHERE r.id=request_id
      AND (r.band_id=public.my_band_id() OR public.is_admin())
  ));
REVOKE INSERT,UPDATE,DELETE ON public.practice_requests,public.practice_confirmations FROM anon,authenticated;

-- Only trusted booking RPCs can finalize a request. This schema is not exposed
-- in the Supabase Data API.
CREATE SCHEMA IF NOT EXISTS bunkface_private;
REVOKE ALL ON SCHEMA bunkface_private FROM PUBLIC;

-- A locked request is required before calling this function.
CREATE FUNCTION bunkface_private.finalize_practice_request(p_request uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.practice_requests%ROWTYPE;
        v_booking uuid; v_band_name text;
BEGIN
  SELECT * INTO r FROM public.practice_requests WHERE id=p_request FOR UPDATE;
  IF NOT FOUND OR r.status<>'pending' THEN RAISE EXCEPTION 'Request is no longer pending'; END IF;
  IF EXISTS(SELECT 1 FROM public.practice_confirmations WHERE request_id=r.id AND decision<>'confirmed')
     OR (SELECT count(*) FROM public.practice_confirmations WHERE request_id=r.id)<>r.expected_confirmations
  THEN RAISE EXCEPTION 'Not all band members have confirmed'; END IF;

  IF r.practice_date<(now() AT TIME ZONE 'Europe/London')::date THEN
    UPDATE public.practice_requests SET status='invalidated',resolved_at=now() WHERE id=r.id;
    RETURN 'invalidated';
  END IF;

  INSERT INTO public.bookings(band_id,practice_date,start_time,created_by)
  VALUES(r.band_id,r.practice_date,r.start_time,r.proposed_by)
  ON CONFLICT DO NOTHING RETURNING id INTO v_booking;

  IF v_booking IS NULL THEN
    UPDATE public.practice_requests SET status='clashed',resolved_at=now() WHERE id=r.id;
    INSERT INTO public.notifications(recipient_user_id,title,body)
      SELECT c.user_id,'Practice date unavailable','Another band booked '||to_char(r.practice_date,'Dy DD Mon')||' first. Please choose another date.'
      FROM public.practice_confirmations c WHERE c.request_id=r.id;
    RETURN 'clashed';
  END IF;

  UPDATE public.practice_requests SET status='confirmed',booking_id=v_booking,resolved_at=now() WHERE id=r.id;
  SELECT name INTO v_band_name FROM public.bands WHERE id=r.band_id;
  INSERT INTO public.notifications(recipient_user_id,title,body)
    SELECT c.user_id,'Practice confirmed',v_band_name||' are booked for '||to_char(r.practice_date,'Dy DD Mon')||' at '||to_char(r.start_time,'HH24:MI')||'.'
    FROM public.practice_confirmations c WHERE c.request_id=r.id;
  PERFORM public.broadcast_booking(r.band_id,'New rehearsal booking',v_band_name||' booked '||to_char(r.practice_date,'Dy DD Mon')||' at '||to_char(r.start_time,'HH24:MI')||'.');
  INSERT INTO public.audit_events(actor_id,action,details)
    VALUES(auth.uid(),'booking.confirmed_by_band',jsonb_build_object('request_id',r.id,'booking_id',v_booking,'band_id',r.band_id,'date',r.practice_date));
  RETURN 'confirmed';
END $$;
REVOKE ALL ON FUNCTION bunkface_private.finalize_practice_request(uuid) FROM PUBLIC,anon,authenticated;

-- A member proposes with a single action; the proposer is automatically yes.
-- The expected number is a minimum registration requirement, not a voting
-- shortcut. If the number of approved members differs from the admin's band
-- count, ask the admin to finish approvals or correct the expected count.
CREATE FUNCTION public.request_practice(p_date date,p_time time without time zone)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_band uuid; v_band_name text; v_name text; v_expected integer;
        v_active integer; v_request uuid; v_outcome text;
BEGIN
  IF NOT public.is_approved() THEN RAISE EXCEPTION 'PERMISSION DENIED'; END IF;
  v_band:=public.my_band_id();
  IF v_band IS NULL THEN RAISE EXCEPTION 'Choose your own band before requesting a practice'; END IF;
  IF p_date IS NULL OR p_date<(now() AT TIME ZONE 'Europe/London')::date THEN
    RAISE EXCEPTION 'Please choose today or a future date'; END IF;
  IF p_time IS NULL OR extract(second FROM p_time)<>0 OR extract(minute FROM p_time) NOT IN (0,30)
  THEN RAISE EXCEPTION 'Choose a time in 30-minute increments'; END IF;

  SELECT b.name,b.member_count INTO v_band_name,v_expected
    FROM public.bands b WHERE b.id=v_band AND b.archived_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Your band is not active'; END IF;
  SELECT count(*) INTO v_active FROM public.profiles
    WHERE band_id=v_band AND status='approved' AND role IN ('band','admin');
  IF v_active<>v_expected THEN
    RAISE EXCEPTION 'Band registration incomplete: % of % approved members. Ask the administrator to check the member count.',v_active,v_expected;
  END IF;
  IF EXISTS(SELECT 1 FROM public.bookings WHERE practice_date=p_date AND status='confirmed') THEN
    RAISE EXCEPTION 'Sorry, this date is already booked'; END IF;
  IF EXISTS(SELECT 1 FROM public.practice_requests WHERE band_id=v_band AND practice_date=p_date AND status='pending') THEN
    RAISE EXCEPTION 'Your band already has a pending request for this date'; END IF;

  INSERT INTO public.practice_requests(band_id,practice_date,start_time,proposed_by,expected_confirmations)
    VALUES(v_band,p_date,p_time,auth.uid(),v_expected) RETURNING id INTO v_request;
  INSERT INTO public.practice_confirmations(request_id,user_id,member_name,decision,responded_at)
    SELECT v_request,p.id,p.contact_name,
      CASE WHEN p.id=auth.uid() THEN 'confirmed' ELSE 'awaiting' END,
      CASE WHEN p.id=auth.uid() THEN now() ELSE NULL END
    FROM public.profiles p WHERE p.band_id=v_band AND p.status='approved' AND p.role IN ('band','admin');
  SELECT contact_name INTO v_name FROM public.profiles WHERE id=auth.uid();
  INSERT INTO public.notifications(recipient_user_id,title,body)
    SELECT c.user_id,'Confirm a rehearsal',v_name||' has requested '||to_char(p_date,'Dy DD Mon')||' at '||to_char(p_time,'HH24:MI')||'. Open the app to confirm or decline.'
    FROM public.practice_confirmations c WHERE c.request_id=v_request AND c.decision='awaiting';
  INSERT INTO public.audit_events(actor_id,action,details)
    VALUES(auth.uid(),'practice.requested',jsonb_build_object('request_id',v_request,'band_id',v_band,'date',p_date));
  IF v_expected=1 THEN
    v_outcome:=bunkface_private.finalize_practice_request(v_request);
  END IF;
  RETURN v_request;
END $$;

CREATE FUNCTION public.respond_practice(p_request uuid,p_confirm boolean)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.practice_requests%ROWTYPE; v_band uuid;
        v_count integer; v_remaining integer; v_result text;
BEGIN
  IF NOT public.is_approved() THEN RAISE EXCEPTION 'PERMISSION DENIED'; END IF;
  v_band:=public.my_band_id();
  SELECT * INTO r FROM public.practice_requests WHERE id=p_request FOR UPDATE;
  IF NOT FOUND OR r.status<>'pending' THEN RAISE EXCEPTION 'This request is no longer awaiting confirmation'; END IF;
  IF v_band IS NULL OR v_band<>r.band_id THEN RAISE EXCEPTION 'You cannot confirm a different band'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.practice_confirmations
      WHERE request_id=r.id AND user_id=auth.uid() AND decision='awaiting')
    THEN RAISE EXCEPTION 'You have already responded, or are not on this band'; END IF;
  -- A membership update invalidates requests via trigger. Check again under lock.
  SELECT count(*) INTO v_count FROM public.profiles WHERE band_id=r.band_id
    AND status='approved' AND role IN ('band','admin');
  IF v_count<>r.expected_confirmations OR
     EXISTS (SELECT 1 FROM public.practice_confirmations c WHERE c.request_id=r.id AND NOT EXISTS(
       SELECT 1 FROM public.profiles p WHERE p.id=c.user_id AND p.band_id=r.band_id AND p.status='approved' AND p.role IN ('band','admin')
     )) THEN
    RAISE EXCEPTION 'Band membership has changed. Ask someone to request a new rehearsal';
  END IF;
  UPDATE public.practice_confirmations SET decision=CASE WHEN p_confirm THEN 'confirmed' ELSE 'declined' END,responded_at=now()
  WHERE request_id=r.id AND user_id=auth.uid();
  INSERT INTO public.audit_events(actor_id,action,details)
    VALUES(auth.uid(),CASE WHEN p_confirm THEN 'practice.confirmed' ELSE 'practice.declined' END,
      jsonb_build_object('request_id',r.id));
  IF NOT p_confirm THEN
    UPDATE public.practice_requests SET status='declined',resolved_at=now() WHERE id=r.id;
    INSERT INTO public.notifications(recipient_user_id,title,body)
      SELECT c.user_id,'Rehearsal declined','A band member declined '||to_char(r.practice_date,'Dy DD Mon')||'. The room has not been booked.'
      FROM public.practice_confirmations c WHERE c.request_id=r.id AND c.user_id<>auth.uid();
    RETURN 'declined';
  END IF;
  SELECT count(*) INTO v_remaining FROM public.practice_confirmations
    WHERE request_id=r.id AND decision<>'confirmed';
  IF v_remaining=0 THEN RETURN bunkface_private.finalize_practice_request(r.id); END IF;
  RETURN 'pending';
END $$;

-- Competing requests are resolved by the unique confirmed-date index when the
-- final member votes. Do not lock competitors' proposal rows from an INSERT
-- trigger: that can deadlock two bands voting at exactly the same time.

-- When band affiliation or approval changes, do not silently change the vote
-- roster of a pending practice. Instead invalidate it and request again.
CREATE FUNCTION bunkface_private.membership_changed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_old_band uuid; v_new_band uuid;
BEGIN
  IF TG_OP='DELETE' THEN
    IF OLD.status='approved' THEN v_old_band:=OLD.band_id; END IF;
  ELSIF TG_OP='INSERT' THEN
    IF NEW.status='approved' THEN v_new_band:=NEW.band_id; END IF;
  ELSIF OLD.band_id IS DISTINCT FROM NEW.band_id OR OLD.status IS DISTINCT FROM NEW.status OR OLD.role IS DISTINCT FROM NEW.role THEN
    IF OLD.status='approved' THEN v_old_band:=OLD.band_id; END IF;
    IF NEW.status='approved' THEN v_new_band:=NEW.band_id; END IF;
  END IF;
  IF v_old_band IS NOT NULL OR v_new_band IS NOT NULL THEN
    WITH invalid AS (
      UPDATE public.practice_requests SET status='invalidated',resolved_at=now()
      WHERE status='pending' AND band_id IN (v_old_band,v_new_band)
      RETURNING id,band_id,practice_date
    )
    INSERT INTO public.notifications(recipient_user_id,title,body)
    SELECT c.user_id,'Rehearsal request needs restarting','Your band membership changed. Please request a new practice date.'
    FROM invalid i JOIN public.practice_confirmations c ON c.request_id=i.id;
  END IF;
  RETURN COALESCE(NEW,OLD);
END $$;
CREATE TRIGGER invalidate_on_profile_change AFTER INSERT OR UPDATE OF band_id,status,role OR DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION bunkface_private.membership_changed();

CREATE FUNCTION bunkface_private.expected_member_count_changed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF OLD.member_count IS DISTINCT FROM NEW.member_count OR OLD.archived_at IS DISTINCT FROM NEW.archived_at THEN
    WITH invalid AS (
      UPDATE public.practice_requests SET status='invalidated',resolved_at=now()
      WHERE status='pending' AND band_id=NEW.id RETURNING id
    )
    INSERT INTO public.notifications(recipient_user_id,title,body)
    SELECT c.user_id,'Rehearsal request needs restarting','The band roster has changed. Please request a new practice date.'
    FROM invalid i JOIN public.practice_confirmations c ON c.request_id=i.id;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER invalidate_on_band_count_change AFTER UPDATE OF member_count,archived_at ON public.bands
  FOR EACH ROW EXECUTE FUNCTION bunkface_private.expected_member_count_changed();

-- A single-member band auto-confirms. Admin affiliation is a normal membership
-- vote, never a privileged approval requirement for another band.
-- Stop the old instant-confirm RPC for all signed-in users.
REVOKE EXECUTE ON FUNCTION public.create_booking(date,time without time zone,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.request_practice(date,time without time zone),public.respond_practice(uuid,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.request_practice(date,time without time zone),public.respond_practice(uuid,boolean) TO authenticated;

ALTER PUBLICATION supabase_realtime ADD TABLE public.practice_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.practice_confirmations;
