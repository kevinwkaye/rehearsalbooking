-- BBBWP0.2: defence in depth for the band-membership API.
-- Supabase default grants may provide anon a table-level SELECT even though
-- the membership RLS policy returns no rows to unauthenticated users.
-- Remove that grant; authenticated SELECT remains subject to RLS.
REVOKE SELECT ON TABLE public.band_memberships FROM anon, PUBLIC;
GRANT SELECT ON TABLE public.band_memberships TO authenticated;
