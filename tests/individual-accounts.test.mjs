import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
const migration=readFileSync(new URL('../supabase/migrations/202611110003_individual_members.sql',import.meta.url),'utf8');
const edge=readFileSync(new URL('../supabase/functions/admin-member-access/index.ts',import.meta.url),'utf8');
test('individual accounts use email/password signup and one-time band selection',()=>{
 assert.match(source,/db\.auth\.signUp/);
 assert.match(source,/contact_name:name\.trim\(\)/);
 assert.match(source,/choose_band_once/);
 assert.match(source,/list_available_bands/);
 assert.doesNotMatch(source,/bandLoginEmail/);
});
test('member cannot choose another band after assignment',()=>{
 assert.match(migration,/band_id is null and status='pending'/);
 assert.match(migration,/role='band' and band_id is null/);
 assert.match(migration,/admin_change_member_band/);
 assert.match(migration,/if not public\.is_admin\(\) then raise exception 'PERMISSION DENIED'/);
});
test('multiple individuals can join one band, even though bookings are exclusive by day',()=>{
 assert.match(migration,/drop constraint if exists profiles_band_id_key/);
 assert.match(migration,/public\.admin_create_band/);
 assert.match(migration,/public\.choose_band_once/);
 const initial=readFileSync(new URL('../supabase/migrations/202611110001_init.sql',import.meta.url),'utf8');
 assert.match(initial,/create unique index one_confirmed_booking_per_day/);
});
test('admin approval requires a chosen band and no signup metadata assigns role or band',()=>{
 assert.match(migration,/p_status<>'approved' or band_id is not null/);
 assert.doesNotMatch(migration,/new\.raw_user_meta_data->>'band_id'/);
 assert.match(migration,/values \(new\.id,null,lower\(new\.email\),v_name,'band','pending'\)/);
});
test('admin password resets are authenticated and require password change',()=>{
 assert.match(edge,/role','admin'/);
 assert.match(edge,/auth\.admin\.updateUserById/);
 assert.match(edge,/password_reset_at/);
 assert.match(migration,/u\.updated_at > p\.password_reset_at/);
});
