import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/styles.css',import.meta.url),'utf8');
const sql=readFileSync(new URL('../supabase/migrations/202611130004_bbbwp042_notification_preferences.sql',import.meta.url),'utf8');

test('regular members only receive their own band rehearsal alerts',()=>{
 assert.match(sql,/FROM public\.profiles p\s+JOIN public\.admin_notification_preferences pref ON pref\.user_id=p\.id/);
 assert.match(sql,/p\.role IN \('admin','superadmin'\) AND p\.status='approved'/);
 assert.match(sql,/AND NOT EXISTS\(\s*SELECT 1 FROM public\.band_memberships m\s+WHERE m\.user_id=p\.id AND m\.band_id=p_band/);
 assert.doesNotMatch(sql,/p\.status='approved'\s+AND NOT EXISTS\(SELECT 1 FROM public\.band_memberships/);
});

test('admin cross-band booking alerts require explicit opt in, and default is OFF',()=>{
 assert.match(sql,/all_band_booking_alerts boolean NOT NULL DEFAULT false/);
 assert.match(sql,/all_band_cancellation_alerts boolean NOT NULL DEFAULT false/);
 assert.match(sql,/p_title='New rehearsal booking' AND pref\.all_band_booking_alerts/);
 assert.match(sql,/p_title='Rehearsal cancelled' AND pref\.all_band_cancellation_alerts/);
 assert.match(sql,/REVOKE ALL ON FUNCTION public\.broadcast_booking\(uuid,text,text\) FROM PUBLIC,anon,authenticated/);
});

test('approval alerts remain on by default and are configurable for both admin roles',()=>{
 assert.match(sql,/registration_alerts boolean NOT NULL DEFAULT true/);
 assert.equal((sql.match(/COALESCE\(\(SELECT pref\.registration_alerts/g)||[]).length,2);
 assert.equal((sql.match(/p\.role IN \('admin','superadmin'\)/g)||[]).length>=3,true);
});

test('admin can see and change only their own preferences via RLS',()=>{
 assert.match(sql,/ENABLE ROW LEVEL SECURITY/);
 assert.match(sql,/FOR SELECT TO authenticated\s+USING \(user_id=\(SELECT auth\.uid\(\)\) AND public\.is_admin\(\)\)/);
 assert.match(sql,/FOR INSERT TO authenticated\s+WITH CHECK \(user_id=\(SELECT auth\.uid\(\)\) AND public\.is_admin\(\)\)/);
 assert.match(sql,/FOR UPDATE TO authenticated\s+USING \(user_id=\(SELECT auth\.uid\(\)\) AND public\.is_admin\(\)\)\s+WITH CHECK \(user_id=\(SELECT auth\.uid\(\)\) AND public\.is_admin\(\)\)/);
 assert.match(sql,/REVOKE ALL ON TABLE public\.admin_notification_preferences FROM PUBLIC,anon,authenticated/);
});

test('the bell panel exposes exactly three preferences for admins or owners',()=>{
 assert.match(app,/function NotificationPanel\(\{notices,userId,requests,votes,isAdmin/);
 assert.match(app,/isAdmin=\{admin\}/);
 assert.match(app,/\{isAdmin&&<section className="admin-alert-settings"/);
 assert.match(app,/New member registrations/);
 assert.match(app,/Bookings from all bands/);
 assert.match(app,/Cancellations from all bands/);
 assert.match(app,/Save notification choices/);
 assert.match(app,/DEFAULT_ADMIN_ALERT_PREFS:AdminAlertPrefs=\{registration_alerts:true,all_band_booking_alerts:false,all_band_cancellation_alerts:false\}/);
 assert.match(app,/\.from\('admin_notification_preferences'\)\.upsert/);
 assert.match(css,/\.admin-alert-toggle input\[type="checkbox"\]/);
});

test('booking confirmation, votes and phone alert subscription controls remain intact',()=>{
 assert.match(app,/<ProposalVoteCard/);
 assert.match(app,/Enable phone alerts/);
 assert.match(app,/Disable phone alerts/);
 assert.match(app,/Clear notifications/);
 assert.match(app,/Confirm decline/);
 assert.doesNotMatch(sql,/DELETE FROM public\.(bookings|practice_requests|notifications|push_subscriptions)/);
});
