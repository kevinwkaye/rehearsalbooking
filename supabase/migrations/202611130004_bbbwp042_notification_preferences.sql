-- BBBWP0.4.2: Admin-controlled notification types and band-only booking alerts.
-- All booking confirmation, decline, and affected-band cancellation messages remain
-- scoped to existing member lists. Only admins can opt into room-wide updates.
-- No existing bookings, accounts, notification rows or subscriptions are changed.

CREATE TABLE IF NOT EXISTS public.admin_notification_preferences (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  registration_alerts boolean NOT NULL DEFAULT true,
  all_band_booking_alerts boolean NOT NULL DEFAULT false,
  all_band_cancellation_alerts boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_notification_preferences ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.admin_notification_preferences FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON TABLE public.admin_notification_preferences TO authenticated;

CREATE POLICY "admin views own notification preferences"
 ON public.admin_notification_preferences FOR SELECT TO authenticated
 USING (user_id=(SELECT auth.uid()) AND public.is_admin());

CREATE POLICY "admin inserts own notification preferences"
 ON public.admin_notification_preferences FOR INSERT TO authenticated
 WITH CHECK (user_id=(SELECT auth.uid()) AND public.is_admin());

CREATE POLICY "admin updates own notification preferences"
 ON public.admin_notification_preferences FOR UPDATE TO authenticated
 USING (user_id=(SELECT auth.uid()) AND public.is_admin())
 WITH CHECK (user_id=(SELECT auth.uid()) AND public.is_admin());

-- This legacy broadcast used to send room-wide booking alerts to EVERY OTHER
-- band and the admins. It now sends alerts only to administrators who have
-- explicitly opted in to the particular type (default is OFF).
CREATE OR REPLACE FUNCTION public.broadcast_booking(p_band uuid,p_title text,p_body text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
BEGIN
  IF p_title NOT IN ('New rehearsal booking','Rehearsal cancelled') THEN
    RAISE EXCEPTION 'Unsupported booking broadcast type';
  END IF;

  INSERT INTO public.notifications(recipient_user_id,title,body)
  SELECT p.id,p_title,p_body
  FROM public.profiles p
  JOIN public.admin_notification_preferences pref ON pref.user_id=p.id
  WHERE p.role IN ('admin','superadmin') AND p.status='approved'
    AND ( (p_title='New rehearsal booking' AND pref.all_band_booking_alerts)
       OR (p_title='Rehearsal cancelled' AND pref.all_band_cancellation_alerts))
    AND NOT EXISTS(
      SELECT 1 FROM public.band_memberships m
      WHERE m.user_id=p.id AND m.band_id=p_band
    );
END $function$;

-- The broadcast API is internal to trusted booking RPCs, never a client action.
REVOKE ALL ON FUNCTION public.broadcast_booking(uuid,text,text) FROM PUBLIC,anon,authenticated;

-- Include both admin types in signup alerts, and respect each person's choice.
CREATE OR REPLACE FUNCTION public.on_auth_created()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
 FROM public.profiles p WHERE p.role IN ('admin','superadmin') AND p.status='approved'
 AND COALESCE((SELECT pref.registration_alerts FROM public.admin_notification_preferences pref WHERE pref.user_id=p.id),true);
 INSERT INTO public.audit_events(actor_id,action,details)
 VALUES(NEW.id,'account.registered',jsonb_build_object('user_id',NEW.id,'band_ids',v_requested));
 RETURN NEW;
END $function$

CREATE OR REPLACE FUNCTION public.choose_band_once(p_band_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
 WHERE p.role IN ('admin','superadmin') AND p.status='approved'
 AND COALESCE((SELECT pref.registration_alerts FROM public.admin_notification_preferences pref WHERE pref.user_id=p.id),true);
 INSERT INTO public.audit_events(actor_id,action,details)
 VALUES(auth.uid(),'member.band_selected',jsonb_build_object('band_id',p_band_id));
END $function$
