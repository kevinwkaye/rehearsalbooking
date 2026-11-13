-- BBBWP0.3.3: allow an approved user to clear their own notification history.
-- Only notifications already on screen when the user requests clearing are deleted.
-- Pending rehearsal confirmations, bookings and push subscriptions remain untouched.
CREATE OR REPLACE FUNCTION public.clear_my_notifications(p_through_id uuid)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE
 v_cutoff timestamptz;
 v_count integer;
BEGIN
 IF (SELECT auth.uid()) IS NULL OR NOT public.is_approved() THEN
   RAISE EXCEPTION 'PERMISSION DENIED';
 END IF;
 SELECT created_at INTO v_cutoff
 FROM public.notifications
 WHERE id=p_through_id AND recipient_user_id=(SELECT auth.uid());
 IF v_cutoff IS NULL THEN RETURN 0; END IF;
 DELETE FROM public.notifications
 WHERE recipient_user_id=(SELECT auth.uid()) AND created_at<=v_cutoff;
 GET DIAGNOSTICS v_count=ROW_COUNT;
 RETURN v_count;
END $function$;

REVOKE ALL ON FUNCTION public.clear_my_notifications(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.clear_my_notifications(uuid) TO authenticated;
