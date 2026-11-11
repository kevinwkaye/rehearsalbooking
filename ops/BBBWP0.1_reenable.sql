-- BBBWP0.1 re-enable after a functional rollback, assuming 005/006 exist.
-- Deploy the matching BBBWP0.1 frontend and push-dispatch function alongside it.
BEGIN;
REVOKE EXECUTE ON FUNCTION public.create_booking(date,time without time zone,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.request_practice(date,time without time zone), public.respond_practice(uuid,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.request_practice(date,time without time zone), public.respond_practice(uuid,boolean) TO authenticated;
DO $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='notify_push_after_insert' AND tgrelid='public.notifications'::regclass AND NOT tgisinternal) THEN
   CREATE TRIGGER notify_push_after_insert AFTER INSERT ON public.notifications FOR EACH ROW EXECUTE FUNCTION bunkface_private.queue_push_delivery();
 END IF;
END $$;
DO $$
BEGIN
 IF has_function_privilege('authenticated','public.create_booking(date,time without time zone,uuid)','EXECUTE') THEN
   RAISE EXCEPTION 'Re-enable failed: direct booking still accessible';
 END IF;
 IF NOT has_function_privilege('authenticated','public.request_practice(date,time without time zone)','EXECUTE') THEN
   RAISE EXCEPTION 'Re-enable failed: practice requests inaccessible';
 END IF;
END $$;
COMMIT;
