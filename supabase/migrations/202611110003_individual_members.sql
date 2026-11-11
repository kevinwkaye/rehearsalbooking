-- V3: individuals sign up with their own email and password, then choose a band once.
-- Apply AFTER 001 and 002. Only the administrator can create a band or reassign a member.
-- Supabase Auth: enable email/password sign-up and, with no SMTP, turn off email confirmation.

-- More than one individual can belong to the same band; a new member has no band yet.
alter table public.profiles drop constraint if exists profiles_band_id_key;
alter table public.profiles drop constraint if exists role_band_check;
alter table public.profiles add constraint role_band_check
  check ((role='admin' and band_id is null) or role='band');
alter table public.profiles add column if not exists must_change_password boolean not null default false;
alter table public.profiles add column if not exists password_reset_at timestamptz;
create index if not exists profiles_band_members on public.profiles (band_id) where role='band';

-- Replacing the V2 sign-up blocker. Auth metadata never determines band or privilege.
create or replace function public.on_auth_created()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_name text;
begin
  -- The administrator is provisioned separately using a service-role-only bootstrap script.
  if coalesce(new.raw_app_meta_data->>'admin_bootstrap','false')='true' then return new; end if;
  if coalesce(new.raw_app_meta_data->>'band_managed','false')='true' then
    raise exception 'Legacy shared band login creation is disabled';
  end if;
  v_name := btrim(coalesce(new.raw_user_meta_data->>'contact_name',''));
  if length(v_name) not between 2 and 80 or new.email is null then
    raise exception 'Please enter your name and email';
  end if;
  insert into public.profiles (id,band_id,email,contact_name,role,status)
  values (new.id,null,lower(new.email),v_name,'band','pending');
  return new;
end $$;

-- The list exposes only administrator-created band names, colours and IDs.
-- Members do not need approval to choose a band, but must be approved before booking.
drop function if exists public.list_login_bands();
create or replace function public.list_available_bands()
returns table(id uuid,name text,colour text)
language sql stable security definer set search_path='' as $$
  select id,name,colour from public.bands order by lower(name),id;
$$;
revoke all on function public.list_available_bands() from public,anon,authenticated;
grant execute on function public.list_available_bands() to authenticated;

create or replace function public.choose_band_once(p_band_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  if (select auth.uid()) is null then raise exception 'Sign in required'; end if;
  if not exists(select 1 from public.bands where id=p_band_id) then raise exception 'Unknown band'; end if;
  update public.profiles set band_id=p_band_id
  where id=(select auth.uid()) and role='band' and band_id is null and status='pending';
  if not found then raise exception 'Band already selected. Ask the administrator to change it.'; end if;
  insert into public.audit_events(actor_id,action,details)
  values(auth.uid(),'member.band_selected',jsonb_build_object('band_id',p_band_id));
end $$;
revoke all on function public.choose_band_once(uuid) from public,anon,authenticated;
grant execute on function public.choose_band_once(uuid) to authenticated;

create or replace function public.admin_create_band(p_name text,p_count integer,p_colour text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
  if not public.is_admin() then raise exception 'PERMISSION DENIED'; end if;
  if length(btrim(coalesce(p_name,''))) not between 2 and 80
    or p_count not between 1 and 50 or p_colour !~ '^#[0-9A-Fa-f]{6}$' then
    raise exception 'Invalid band details'; end if;
  insert into public.bands(name,member_count,colour)
  values(btrim(p_name),p_count,p_colour) returning id into v_id;
  insert into public.audit_events(actor_id,action,details)
  values(auth.uid(),'band.created',jsonb_build_object('band_id',v_id,'name',p_name));
  return v_id;
end $$;
revoke all on function public.admin_create_band(text,integer,text) from public,anon,authenticated;
grant execute on function public.admin_create_band(text,integer,text) to authenticated;

-- Only the admin may change an existing membership. No member update permissions exist.
create or replace function public.admin_change_member_band(p_user_id uuid,p_band_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  if not public.is_admin() then raise exception 'PERMISSION DENIED'; end if;
  if not exists(select 1 from public.bands where id=p_band_id) then raise exception 'Unknown band'; end if;
  update public.profiles set band_id=p_band_id where id=p_user_id and role='band';
  if not found then raise exception 'Member not found'; end if;
  insert into public.audit_events(actor_id,action,details)
  values(auth.uid(),'member.band_changed',jsonb_build_object('user_id',p_user_id,'band_id',p_band_id));
end $$;
revoke all on function public.admin_change_member_band(uuid,uuid) from public,anon,authenticated;
grant execute on function public.admin_change_member_band(uuid,uuid) to authenticated;

-- Reject administrator approval before the member has chosen a band.
create or replace function public.admin_set_status(p_user_id uuid,p_status text)
returns void language plpgsql security definer set search_path='' as $$
begin
  if not public.is_admin() then raise exception 'PERMISSION DENIED'; end if;
  if p_status not in ('approved','rejected','deactivated') then raise exception 'Invalid status'; end if;
  if not exists(select 1 from public.profiles
     where id=p_user_id and role='band' and (p_status<>'approved' or band_id is not null)) then
    raise exception 'Member not found or band not selected'; end if;
  update public.profiles set status=p_status where id=p_user_id;
  insert into public.audit_events(actor_id,action,details)
  values(auth.uid(),'account.status',jsonb_build_object('user_id',p_user_id,'status',p_status));
end $$;

-- Edit the band only, not the contact names of all its members.
-- Keep the old signature for compatibility with the earlier frontend.
create or replace function public.admin_update_band(p_band_id uuid,p_name text,p_count integer,p_colour text,p_contact text)
returns void language plpgsql security definer set search_path='' as $$
begin
  if not public.is_admin() then raise exception 'PERMISSION DENIED'; end if;
  if length(btrim(coalesce(p_name,''))) not between 2 and 80
    or p_count not between 1 and 50 or p_colour !~ '^#[0-9A-Fa-f]{6}$' then
    raise exception 'Invalid band details'; end if;
  update public.bands set name=btrim(p_name),member_count=p_count,colour=p_colour where id=p_band_id;
  if not found then raise exception 'Band not found'; end if;
  insert into public.audit_events(actor_id,action,details)
  values(auth.uid(),'band.updated',jsonb_build_object('band_id',p_band_id,'name',p_name,'member_count',p_count,'colour',p_colour));
end $$;

-- Admin temporary resets force a personal password change at the next sign-in.
create or replace function public.complete_password_change()
returns void language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  -- A member cannot clear the reset flag until Auth has accepted a newer password update.
  if not exists (
    select 1 from public.profiles p join auth.users u on u.id=p.id
    where p.id=auth.uid() and p.role='band' and p.must_change_password
      and p.password_reset_at is not null and u.updated_at > p.password_reset_at
  ) then raise exception 'Change your password before continuing'; end if;
  update public.profiles set must_change_password=false,password_reset_at=null where id=auth.uid() and role='band';
end $$;
revoke all on function public.complete_password_change() from public,anon,authenticated;
grant execute on function public.complete_password_change() to authenticated;

-- Any legacy synthetic shared logins are explicitly deactivated when upgrading.
update public.profiles set status='deactivated'
where role='band' and email like 'band-%@accounts.example.com';
