-- The Bunkface Booking Boutique: first migration.
-- All booking mutations are SECURITY DEFINER RPCs with explicit caller checks.
create extension if not exists pgcrypto;

create table public.bands (
  id uuid primary key default gen_random_uuid(),
  name text not null check(length(btrim(name)) between 2 and 80),
  member_count integer not null check(member_count between 1 and 50),
  colour text not null default '#74B8A7' check(colour ~ '^#[0-9A-Fa-f]{6}$'),
  created_at timestamptz not null default now()
);
create unique index bands_name_unique on public.bands(lower(btrim(name)));

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  band_id uuid unique references public.bands(id) on delete set null,
  email text not null,
  contact_name text not null check(length(btrim(contact_name)) between 2 and 80),
  role text not null default 'band' check(role in ('band','admin')),
  status text not null default 'pending' check(status in ('pending','approved','rejected','deactivated')),
  created_at timestamptz not null default now(),
  constraint role_band_check check((role='admin' and band_id is null) or (role='band' and band_id is not null))
);
create unique index exactly_one_admin on public.profiles(role) where role='admin';
create unique index profiles_email_unique on public.profiles(lower(email));

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  band_id uuid not null references public.bands(id),
  practice_date date not null,
  start_time time without time zone not null,
  status text not null default 'confirmed' check(status in ('confirmed','cancelled')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Prevents all double-booking races, even simultaneous transactions.
create unique index one_confirmed_booking_per_day on public.bookings(practice_date) where status='confirmed';
create index bookings_by_date on public.bookings(practice_date);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text not null,
  read_at timestamptz,
  push_sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_recipient_date on public.notifications(recipient_user_id,created_at desc);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  subscription jsonb not null,
  created_at timestamptz not null default now()
);
create index push_subscriptions_user on public.push_subscriptions(user_id);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Registration comes through Supabase email/password signup. Never trust client-supplied role/status.
create function public.on_auth_created() returns trigger language plpgsql security definer set search_path='' as $$
declare v_band uuid; v_name text; v_contact text; v_count integer;
begin
  v_name:=btrim(coalesce(new.raw_user_meta_data->>'band_name',''));
  v_contact:=btrim(coalesce(new.raw_user_meta_data->>'contact_name',''));
  if length(v_name) not between 2 and 80 or length(v_contact) not between 2 and 80 then
    raise exception 'Invalid registration details';
  end if;
  if coalesce(new.raw_user_meta_data->>'member_count','') !~ '^[0-9]{1,2}$' then
    raise exception 'Invalid member count';
  end if;
  v_count:=(new.raw_user_meta_data->>'member_count')::integer;
  if v_count not between 1 and 50 then raise exception 'Invalid member count'; end if;
  insert into public.bands(name,member_count) values(v_name,v_count) returning id into v_band;
  insert into public.profiles(id,band_id,email,contact_name,role,status)
    values(new.id,v_band,lower(new.email),v_contact,'band','pending');
  return new;
end $$;
create trigger auth_user_registered after insert on auth.users for each row execute function public.on_auth_created();

create function public.is_admin() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles where id=(select auth.uid()) and role='admin' and status='approved');
$$;
create function public.is_approved() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles where id=(select auth.uid()) and status='approved');
$$;
create function public.my_band_id() returns uuid language sql stable security definer set search_path='' as $$
 select band_id from public.profiles where id=(select auth.uid()) and role='band' and status='approved';
$$;

alter table public.bands enable row level security;
alter table public.profiles enable row level security;
alter table public.bookings enable row level security;
alter table public.notifications enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.audit_events enable row level security;

create policy "approved users read bands" on public.bands for select to authenticated
  using (public.is_approved());
create policy "users see own profile, admin sees all" on public.profiles for select to authenticated
  using (id=(select auth.uid()) or public.is_admin());
create policy "approved users read confirmed bookings" on public.bookings for select to authenticated
  using (public.is_approved() and (status='confirmed' or public.is_admin() or band_id=public.my_band_id()));
create policy "own notifications" on public.notifications for select to authenticated
  using (recipient_user_id=(select auth.uid()) and public.is_approved());
create policy "own subscriptions read" on public.push_subscriptions for select to authenticated using (user_id=(select auth.uid()) and public.is_approved());
create policy "own subscriptions insert" on public.push_subscriptions for insert to authenticated with check (user_id=(select auth.uid()) and public.is_approved());
create policy "own subscriptions update" on public.push_subscriptions for update to authenticated using (user_id=(select auth.uid()) and public.is_approved()) with check (user_id=(select auth.uid()) and public.is_approved());
create policy "own subscriptions delete" on public.push_subscriptions for delete to authenticated using (user_id=(select auth.uid()) and public.is_approved());
create policy "admin read audit" on public.audit_events for select to authenticated using (public.is_admin());

-- Prevent any frontend from directly mutating bookings, bands, profiles, notifications or audit.
revoke insert,update,delete on public.bands, public.profiles, public.bookings, public.notifications, public.audit_events from anon, authenticated;

create function public.broadcast_booking(p_band uuid,p_title text,p_body text)
returns void language plpgsql security definer set search_path='' as $$
begin
 insert into public.notifications(recipient_user_id,title,body)
 select id,p_title,p_body from public.profiles
 where status='approved' and (role='admin' or band_id<>p_band);
end $$;

create function public.create_booking(p_date date,p_time time without time zone,p_band uuid default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_band uuid; v_id uuid; v_name text;
begin
 if not public.is_approved() then raise exception 'PERMISSION DENIED'; end if;
 if p_date is null or p_date<(now() at time zone 'Europe/London')::date then raise exception 'Cannot book a past date'; end if;
 if p_time is null or extract(second from p_time)<>0 or extract(minute from p_time) not in (0,30) then raise exception 'Invalid start time'; end if;
 if public.is_admin() then v_band:=p_band; else v_band:=public.my_band_id(); end if;
 if v_band is null or not exists(select 1 from public.profiles where band_id=v_band and role='band' and status='approved') then
   raise exception 'PERMISSION DENIED';
 end if;
 select name into v_name from public.bands where id=v_band;
 insert into public.bookings(band_id,practice_date,start_time,created_by) values(v_band,p_date,p_time,auth.uid()) returning id into v_id;
 perform public.broadcast_booking(v_band,'New rehearsal booking',v_name||' booked '||to_char(p_date,'Dy DD Mon')||' at '||to_char(p_time,'HH24:MI')||'.');
 insert into public.audit_events(actor_id,action,details) values(auth.uid(),'booking.created',jsonb_build_object('booking_id',v_id,'date',p_date,'band_id',v_band));
 return v_id;
end $$;

create function public.update_booking(p_id uuid,p_date date,p_time time without time zone)
returns void language plpgsql security definer set search_path='' as $$
declare v public.bookings%rowtype; v_name text;
begin
 if not public.is_approved() then raise exception 'PERMISSION DENIED'; end if;
 select * into v from public.bookings where id=p_id and status='confirmed' for update;
 if not found then raise exception 'Booking not found'; end if;
 if not public.is_admin() and v.band_id is distinct from public.my_band_id() then raise exception 'PERMISSION DENIED'; end if;
 if p_date is null or p_date<(now() at time zone 'Europe/London')::date then raise exception 'Cannot move to a past date'; end if;
 if p_time is null or extract(second from p_time)<>0 or extract(minute from p_time) not in (0,30) then raise exception 'Invalid start time'; end if;
 update public.bookings set practice_date=p_date,start_time=p_time,updated_at=now() where id=p_id;
 select name into v_name from public.bands where id=v.band_id;
 perform public.broadcast_booking(v.band_id,'Rehearsal moved',v_name||' moved a rehearsal from '||to_char(v.practice_date,'Dy DD Mon')||' to '||to_char(p_date,'Dy DD Mon')||' at '||to_char(p_time,'HH24:MI')||'.');
 insert into public.audit_events(actor_id,action,details) values(auth.uid(),'booking.moved',jsonb_build_object('booking_id',p_id,'from_date',v.practice_date,'to_date',p_date));
end $$;

create function public.cancel_booking(p_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v public.bookings%rowtype; v_name text;
begin
 if not public.is_approved() then raise exception 'PERMISSION DENIED'; end if;
 select * into v from public.bookings where id=p_id and status='confirmed' for update;
 if not found then raise exception 'Booking not found'; end if;
 if not public.is_admin() and v.band_id is distinct from public.my_band_id() then raise exception 'PERMISSION DENIED'; end if;
 update public.bookings set status='cancelled',updated_at=now() where id=p_id;
 select name into v_name from public.bands where id=v.band_id;
 perform public.broadcast_booking(v.band_id,'Rehearsal cancelled',v_name||' cancelled '||to_char(v.practice_date,'Dy DD Mon')||'. The room is available.');
 insert into public.audit_events(actor_id,action,details) values(auth.uid(),'booking.cancelled',jsonb_build_object('booking_id',p_id,'date',v.practice_date));
end $$;

create function public.admin_set_status(p_user_id uuid,p_status text)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_admin() then raise exception 'PERMISSION DENIED'; end if;
 if p_status not in ('approved','rejected','deactivated') then raise exception 'Invalid status'; end if;
 if not exists(select 1 from public.profiles where id=p_user_id and role='band') then raise exception 'Band account not found'; end if;
 update public.profiles set status=p_status where id=p_user_id;
 insert into public.audit_events(actor_id,action,details) values(auth.uid(),'account.status',jsonb_build_object('user_id',p_user_id,'status',p_status));
end $$;

create function public.admin_update_band(p_band_id uuid,p_name text,p_count integer,p_colour text,p_contact text)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_admin() then raise exception 'PERMISSION DENIED'; end if;
 if length(btrim(coalesce(p_name,''))) not between 2 and 80 or p_count not between 1 and 50 or p_colour !~ '^#[0-9A-Fa-f]{6}$' or length(btrim(coalesce(p_contact,''))) not between 2 and 80 then
 raise exception 'Invalid band details'; end if;
 update public.bands set name=btrim(p_name),member_count=p_count,colour=p_colour where id=p_band_id;
 if not found then raise exception 'Band not found'; end if;
 update public.profiles set contact_name=btrim(p_contact) where band_id=p_band_id;
 insert into public.audit_events(actor_id,action,details) values(auth.uid(),'band.updated',jsonb_build_object('band_id',p_band_id,'name',p_name,'member_count',p_count,'colour',p_colour));
end $$;

create function public.mark_notice_read(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_approved() then raise exception 'PERMISSION DENIED'; end if;
 update public.notifications set read_at=now() where id=p_id and recipient_user_id=auth.uid();
end $$;

-- By default EXECUTE on PostgreSQL functions is granted to PUBLIC: lock this down.
revoke all on function public.on_auth_created() from public,anon,authenticated;
revoke all on function public.broadcast_booking(uuid,text,text) from public,anon,authenticated;
revoke all on function public.is_admin() from public,anon;
revoke all on function public.is_approved() from public,anon;
revoke all on function public.my_band_id() from public,anon;
revoke all on function public.create_booking(date,time without time zone,uuid) from public,anon;
revoke all on function public.update_booking(uuid,date,time without time zone) from public,anon;
revoke all on function public.cancel_booking(uuid) from public,anon;
revoke all on function public.admin_set_status(uuid,text) from public,anon;
revoke all on function public.admin_update_band(uuid,text,integer,text,text) from public,anon;
revoke all on function public.mark_notice_read(uuid) from public,anon;
grant execute on function public.is_admin(),public.is_approved(),public.my_band_id() to authenticated;
grant execute on function public.create_booking(date,time without time zone,uuid),public.update_booking(uuid,date,time without time zone),public.cancel_booking(uuid),public.admin_set_status(uuid,text),public.admin_update_band(uuid,text,integer,text,text),public.mark_notice_read(uuid) to authenticated;

-- Publish only relevant table changes to Supabase Realtime.
alter publication supabase_realtime add table public.bookings;
alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.profiles;
