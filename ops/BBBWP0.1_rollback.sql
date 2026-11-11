-- BBBWP0.1 functional rollback, preserves data and historical proposal records.
-- Roll the previous Cloudflare Pages deployment back only AFTER this succeeds.
BEGIN;
REVOKE EXECUTE ON FUNCTION public.request_practice(date,time without time zone) FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.respond_practice(uuid,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.create_booking(date,time without time zone,uuid) TO authenticated;
DROP TRIGGER IF EXISTS notify_push_after_insert ON public.notifications;

DO $$
BEGIN
 IF NOT has_function_privilege('authenticated','public.create_booking(date,time without time zone,uuid)','EXECUTE') THEN
   RAISE EXCEPTION 'Rollback failed: create_booking not restored';
 END IF;
 IF has_function_privilege('authenticated','public.request_practice(date,time without time zone)','EXECUTE') THEN
   RAISE EXCEPTION 'Rollback failed: request_practice is still callable';
 END IF;
END $$;
COMMIT;
