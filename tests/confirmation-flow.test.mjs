import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
const migration=readFileSync(new URL('../supabase/migrations/202611110005_unanimous_band_confirmation.sql',import.meta.url),'utf8');
const push=readFileSync(new URL('../supabase/migrations/202611110006_push_delivery_webhook.sql',import.meta.url),'utf8');
const worker=readFileSync(new URL('../public/sw.js',import.meta.url),'utf8');

test('proposals capture all active band members and count proposer as confirmed',()=>{
 assert.match(migration,/INSERT INTO public\.practice_confirmations/);
 assert.match(migration,/WHEN p\.id=auth\.uid\(\) THEN 'confirmed'/);
 assert.match(migration,/VALUES\(v_band,p_date,p_time,auth\.uid\(\),v_active\)/);
 assert.doesNotMatch(migration,/v_active<>v_expected/);
 assert.match(migration,/IF v_active=1 THEN/);
 assert.match(migration,/IF v_active<1 THEN/);
});
test('pending proposals do not reserve the room before every vote',()=>{
 assert.match(migration,/CREATE TABLE public\.practice_requests/);
 assert.match(migration,/CREATE FUNCTION public\.respond_practice/);
 assert.match(migration,/v_remaining=0/);
 assert.match(migration,/INSERT INTO public\.bookings\(band_id,practice_date,start_time,created_by\)/);
 assert.match(migration,/ON CONFLICT DO NOTHING/);
 assert.doesNotMatch(migration,/CREATE TRIGGER booking_claimed_date/);
});
test('only band members can vote and admin does not receive an independent approval',()=>{
 assert.match(migration,/v_band<>r\.band_id/);
 assert.match(migration,/user_id=auth\.uid\(\)/);
 assert.match(migration,/REVOKE EXECUTE ON FUNCTION public\.create_booking/);
 assert.match(app,/request_practice/);
 assert.match(app,/respond_practice/);
 assert.doesNotMatch(app,/else await rpc\('create_booking'/);
});
test('declines and membership changes invalidate proposals',()=>{
 assert.match(migration,/status='declined'/);
 assert.match(migration,/CREATE TRIGGER invalidate_on_profile_change/);
 assert.match(migration,/CREATE TRIGGER invalidate_on_band_archive/);
 assert.doesNotMatch(migration,/AFTER UPDATE OF member_count,archived_at/);
});
test('band requests are visible with one-click confirm and decline',()=>{
 assert.match(app,/practice-confirmation/);
 assert.match(app,/Your vote: confirmed/);
 assert.match(app,/Practice confirmations/);
 assert.match(app,/>Confirm<\/button>/);
 assert.match(app,/>Decline<\/button>/);
});
test('push dispatch is connected to inserted notifications without committing secrets',()=>{
 assert.match(push,/notify_push_after_insert/);
 assert.match(push,/vault\.decrypted_secrets/);
 assert.match(push,/net\.http_post/);
 assert.match(push,/bunkface_push_config/);
 assert.doesNotMatch(push,/PUSH_DISPATCH_SECRET=[a-f0-9]{64}/);
 assert.match(worker,/\?notifications=1/);
});

test('registration gaps do not block practice and count changes do not invalidate it',()=>{
 assert.match(migration,/VALUES\(v_band,p_date,p_time,auth\.uid\(\),v_active\)/);
 assert.doesNotMatch(migration,/Band registration incomplete/);
 assert.match(migration,/AFTER UPDATE OF archived_at ON public\.bands/);
 assert.match(app,/Expected band members \(information only\)/);
});
test('single approved member sees immediate booking success',()=>{
 assert.match(migration,/IF v_active=1 THEN/);
 assert.match(app,/created\?\.status==='confirmed'\?'Practice booked\.'/);
});
