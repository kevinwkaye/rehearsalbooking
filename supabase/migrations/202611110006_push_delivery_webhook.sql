-- Enqueue encrypted Web Push delivery automatically after a notification is
-- created, via pg_net -> the private push-dispatch Edge Function.
-- No secret values are stored in source control. Store the shared dispatch
-- secret and VAPID private/public keys separately in Supabase Vault.
-- The dispatcher reads them via a service-role-only RPC. Nothing needs to be
-- pasted into Edge Function secrets or the Cloudflare frontend.
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION bunkface_private.queue_push_delivery()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_secret text;
BEGIN
  SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets
  WHERE name='bunkface_push_dispatch_secret' ORDER BY created_at DESC LIMIT 1;
  IF v_secret IS NULL OR length(v_secret)<32 THEN
    -- Push may not be configured yet; preserve in-app notifications.
    RETURN NEW;
  END IF;
  PERFORM net.http_post(
    url:='https://cpkywxtecixgmdsnfcun.supabase.co/functions/v1/push-dispatch',
    body:=jsonb_build_object('type','INSERT','schema','public','table','notifications','record',jsonb_build_object('id',NEW.id)),
    headers:=jsonb_build_object('Content-Type','application/json','x-bunkface-secret',v_secret),
    timeout_milliseconds:=8000
  );
  RETURN NEW;
END $$;

CREATE TRIGGER notify_push_after_insert AFTER INSERT ON public.notifications
 FOR EACH ROW EXECUTE FUNCTION bunkface_private.queue_push_delivery();


-- Sensitive config is only readable by Supabase's server-side service_role.
-- This RPC is never granted to anon or authenticated browsers.
CREATE OR REPLACE FUNCTION public.bunkface_push_config()
RETURNS TABLE(public_key text,private_key text,dispatch_secret text,contact text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT
    (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='bunkface_vapid_public_key' ORDER BY created_at DESC LIMIT 1),
    (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='bunkface_vapid_private_key' ORDER BY created_at DESC LIMIT 1),
    (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='bunkface_push_dispatch_secret' ORDER BY created_at DESC LIMIT 1),
    'mailto:bunkface_booking_boutique@proton.me'::text;
$$;
REVOKE ALL ON FUNCTION public.bunkface_push_config() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bunkface_push_config() TO service_role;
