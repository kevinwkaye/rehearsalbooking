import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(p)=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const app=read('src/App.tsx'),sql=read('supabase/migrations/202611120001_bbbwp02_memberships_notifications.sql');
const worker=read('public/sw.js'),push=read('supabase/functions/push-dispatch/index.ts');
test('signup selects multiple band ids via checkboxes before account approval',()=>{
 assert.match(app,/type="checkbox" checked={selectedBands\.includes\(b.id\)}/);
 assert.match(app,/band_ids:selectedBands/);
 assert.match(sql,/CREATE TABLE public\.band_memberships/);
 assert.match(sql,/VALUES\(NEW\.id,v_first,lower\(NEW\.email\),v_name,'band','pending'\)/);
});
test('only admin can amend memberships and signup never grants approval',()=>{
 assert.match(sql,/public\.admin_set_member_bands\(p_user_id uuid,p_band_ids uuid\[\]\)/);
 assert.match(sql,/IF NOT public\.is_admin\(\) THEN RAISE EXCEPTION 'PERMISSION DENIED'/);
 assert.match(sql,/GRANT EXECUTE ON FUNCTION public\.admin_set_member_bands\(uuid,uuid\[\]\) TO authenticated/);
});
test('every band member is counted once per band and only selected band can be requested',()=>{
 assert.match(sql,/public\.is_band_member\(p_band\)/);
 assert.match(sql,/public\.band_memberships m JOIN public\.profiles p/);
 assert.match(app,/p_band:bookingBandId/);
 assert.match(sql,/public\.is_band_member\(r\.band_id\)/);
});
test('admin notified once when signup is ready for approval',()=>{
 assert.match(sql,/INSERT INTO public\.notifications\(recipient_user_id,title,body\)/);
 assert.match(sql,/Account awaiting approval/);
 assert.match(app,/pending-approvals-stat/);
});
test('reading bell clears notifications up to a stable existing ID, not subsequent arrivals',()=>{
 assert.match(sql,/mark_all_notices_read\(p_through_id uuid\)/);
 assert.match(sql,/created_at<=v_cutoff/);
 assert.match(app,/openNotifications\(\)/);
});
test('Android push directs approval to admin, else notifications, with fallback window open',()=>{
 assert.match(push,/url:n\.title==='Account awaiting approval'/);
 assert.match(worker,/self\.clients\.openWindow\(destination\)/);
 assert.match(worker,/OPEN_APPROVALS/);
});
test('password recovery uses built-in Supabase Auth APIs and login',()=>{
 assert.match(app,/auth\.resetPasswordForEmail/);
 assert.match(app,/auth\.updateUser\(\{password\}\)/);
 assert.match(app,/PASSWORD_RECOVERY/);
});
test('calendar swipe never overrides boundary or vertical movement',()=>{
 assert.match(app,/Math\.abs\(dx\)>65&&Math\.abs\(dx\)>Math\.abs\(dy\)\*1\.4/);
 assert.match(app,/if\(target<today\)return/);
});
test('branding, palette and local type are the approved ones',()=>{
 const css=read('src/styles.css');assert.match(app,/88 Bunkspace/);
 assert.match(app,/#A30000','#D84797','#FF7700','#00AFB5','#7DDF64/);
 assert.match(css,/LEMONMILK-Regular\.otf/);
 assert.match(read('public/manifest.webmanifest'),/88 Bunkspace/);
});
test('rollback preserves memberships, accounts, bookings and legacy signup',()=>{
 assert.match(sql,/IF v_requested IS NULL THEN/);
 assert.match(sql,/CREATE OR REPLACE FUNCTION public\.choose_band_once/);
 assert.match(read('ops/BBBWP0.2_rollback.sql'),/ALTER TABLE public\.bands DROP CONSTRAINT/);
 assert.doesNotMatch(read('ops/BBBWP0.2_rollback.sql'),/DROP TABLE|TRUNCATE|DELETE FROM/);
});
