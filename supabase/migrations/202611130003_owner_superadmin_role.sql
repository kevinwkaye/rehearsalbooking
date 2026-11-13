-- Protected owner access for 88 Bunkspace.
-- The owner authenticates normally through Supabase Auth; no hidden bypass.
-- Do NOT hard-code any owner's email or password in source control.
-- This migration creates the ROLE, not a user or secret credentials.
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('band','admin','superadmin'));

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
  SELECT EXISTS(
    SELECT 1 FROM public.profiles
    WHERE id=(SELECT auth.uid())
      AND role IN ('admin','superadmin')
      AND status='approved'
  );
$function$;

-- Preserve existing privilege model: all current admin RPCs depend on
-- public.is_admin(). They therefore work for a superadmin as well.
-- Regular admins cannot edit an owner's status in admin_set_status because
-- it permits changes only for accounts with role='band'.
-- Regular admins cannot delete owner accounts through the existing
-- admin-member-access function (it only allows deleting band members).
-- No auth.users writes or new public account-creation API are introduced.
