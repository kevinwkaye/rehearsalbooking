-- V2: only the administrator may create bands and choose their passwords.
-- Existing deployments: apply after 202611110001_init.sql.
-- Disable public sign-up in Supabase Auth settings as defence in depth.

-- Only service-role generated Auth users with trusted app_metadata may be provisioned.
-- Ordinary Auth signUp() cannot set raw_app_meta_data, so it is rejected.
create or replace function public.on_auth_created()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if coalesce(new.raw_app_meta_data->>'band_managed','false') = 'true'
    or coalesce(new.raw_app_meta_data->>'admin_bootstrap','false') = 'true' then
    return new;
  end if;
  raise exception 'Public account registration is disabled';
end $$;

-- Band names are intentionally public for the drop-down menu.
-- No emails, passwords, user identifiers or membership details are exposed.
create function public.list_login_bands()
returns table(id uuid,name text,colour text)
language sql stable security definer set search_path='' as $$
  select b.id,b.name,b.colour
  from public.bands b
  join public.profiles p on p.band_id=b.id
  where p.role='band' and p.status='approved'
  order by lower(b.name),b.id;
$$;
revoke all on function public.list_login_bands() from public,anon,authenticated;
grant execute on function public.list_login_bands() to anon,authenticated;

-- Passwords are created and reset ONLY via an administrator-only Edge Function.
-- Internal Auth login aliases are derived from stable band UUIDs:
-- band-{band_id}@accounts.example.com
-- The UI never collects or displays a band's internal email alias.
