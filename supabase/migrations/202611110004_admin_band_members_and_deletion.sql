-- Administrator band affiliation, full-day booking correction and safe band deletion.
-- A band's existing rehearsal history is never discarded by deleting its entry.
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS role_band_check;
ALTER TABLE public.bands ADD COLUMN IF NOT EXISTS archived_at timestamptz;

CREATE OR REPLACE FUNCTION public.my_band_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT band_id FROM public.profiles
 WHERE id=(SELECT auth.uid()) AND status='approved';
$$;

CREATE OR REPLACE FUNCTION public.list_available_bands()
RETURNS TABLE(id uuid,name text,colour text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT b.id,b.name,b.colour FROM public.bands b
 WHERE b.archived_at IS NULL ORDER BY lower(b.name),b.id;
$$;

CREATE OR REPLACE FUNCTION public.choose_band_once(p_band_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF (SELECT auth.uid()) IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.bands WHERE id=p_band_id AND archived_at IS NULL)
 THEN RAISE EXCEPTION 'Unknown band'; END IF;
 UPDATE public.profiles SET band_id=p_band_id
 WHERE id=(SELECT auth.uid()) AND role='band' AND band_id IS NULL AND status='pending';
 IF NOT FOUND THEN RAISE EXCEPTION 'Band already selected. Ask the administrator to change it.'; END IF;
 INSERT INTO public.audit_events(actor_id,action,details)
 VALUES(auth.uid(),'member.band_selected',jsonb_build_object('band_id',p_band_id));
END $$;

CREATE OR REPLACE FUNCTION public.admin_change_member_band(p_user_id uuid,p_band_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT public.is_admin() THEN RAISE EXCEPTION 'PERMISSION DENIED'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.bands WHERE id=p_band_id AND archived_at IS NULL)
 THEN RAISE EXCEPTION 'Unknown band'; END IF;
 UPDATE public.profiles SET band_id=p_band_id WHERE id=p_user_id AND role IN ('band','admin');
 IF NOT FOUND THEN RAISE EXCEPTION 'Member not found'; END IF;
 INSERT INTO public.audit_events(actor_id,action,details)
 VALUES(auth.uid(),'member.band_changed',jsonb_build_object('user_id',p_user_id,'band_id',p_band_id));
END $$;

-- Fix: administrator may book on behalf of any active band, even if the
-- administrator is currently the only affiliated account for that band.
CREATE OR REPLACE FUNCTION public.create_booking(p_date date,p_time time without time zone,p_band uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_band uuid; v_id uuid; v_name text;
BEGIN
 IF NOT public.is_approved() THEN RAISE EXCEPTION 'PERMISSION DENIED'; END IF;
 IF p_date IS NULL OR p_date < (now() at time zone 'Europe/London')::date
 THEN RAISE EXCEPTION 'Cannot book a past date'; END IF;
 IF p_time IS NULL OR extract(second from p_time)<>0 OR extract(minute from p_time) NOT IN (0,30)
 THEN RAISE EXCEPTION 'Invalid start time'; END IF;
 IF public.is_admin() THEN v_band:=coalesce(p_band,public.my_band_id());
 ELSE v_band:=public.my_band_id(); END IF;
 SELECT name INTO v_name FROM public.bands WHERE id=v_band AND archived_at IS NULL;
 IF v_name IS NULL THEN RAISE EXCEPTION 'Please select an active band'; END IF;
 INSERT INTO public.bookings(band_id,practice_date,start_time,created_by)
 VALUES(v_band,p_date,p_time,auth.uid()) RETURNING id INTO v_id;
 PERFORM public.broadcast_booking(v_band,'New rehearsal booking',v_name||' booked '||to_char(p_date,'Dy DD Mon')||' at '||to_char(p_time,'HH24:MI')||'.');
 INSERT INTO public.audit_events(actor_id,action,details)
 VALUES(auth.uid(),'booking.created',jsonb_build_object('booking_id',v_id,'date',p_date,'band_id',v_band));
 RETURN v_id;
END $$;

-- Deleting a band must not silently erase confirmed bookings. Cancel those
-- first. Users become pending/unassigned, so they may reselect a band once.
CREATE OR REPLACE FUNCTION public.admin_delete_band(p_band_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_name text; v_result text;
BEGIN
 IF NOT public.is_admin() THEN RAISE EXCEPTION 'PERMISSION DENIED'; END IF;
 SELECT name INTO v_name FROM public.bands WHERE id=p_band_id AND archived_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Band not found'; END IF;
 IF EXISTS(SELECT 1 FROM public.bookings WHERE band_id=p_band_id AND status='confirmed')
 THEN RAISE EXCEPTION 'Cancel this band''s confirmed rehearsals before deleting the band'; END IF;
 UPDATE public.profiles
 SET band_id=NULL, status=CASE WHEN role='band' THEN 'pending' ELSE status END
 WHERE band_id=p_band_id;
 IF EXISTS(SELECT 1 FROM public.bookings WHERE band_id=p_band_id) THEN
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

REVOKE ALL ON FUNCTION public.admin_delete_band(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_band(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.choose_band_once(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.choose_band_once(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.list_available_bands() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.list_available_bands() TO authenticated;
REVOKE ALL ON FUNCTION public.admin_change_member_band(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_change_member_band(uuid,uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.create_booking(date,time without time zone,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.create_booking(date,time without time zone,uuid) TO authenticated;
