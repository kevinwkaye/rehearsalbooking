import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
const migration=readFileSync(new URL('../supabase/migrations/202611130002_bbbwp04_clear_notifications.sql',import.meta.url),'utf8');
const help=readFileSync(new URL('../public/help.html',import.meta.url),'utf8');

test('Clear notifications appears alongside phone notification settings and requires confirmation',()=>{
 assert.match(app,/Enable phone alerts<\/button>/);
 assert.match(app,/Disable phone alerts<\/button>/);
 assert.match(app,/Clear notifications<\/button>/);
 assert.match(app,/setConfirmClear\(true\)/);
 assert.match(app,/Yes, clear/);
 assert.match(app,/Keep notifications/);
});
test('clearing notices does not touch outstanding practice approvals or push settings',()=>{
 assert.match(app,/clear_my_notifications/);
 assert.match(app,/requests\.map\(req=><ProposalVoteCard/);
 assert.match(migration,/DELETE FROM public\.notifications/);
 assert.doesNotMatch(migration,/DELETE FROM public\.(practice_requests|practice_confirmations|bookings|push_subscriptions)/);
 assert.match(help,/does not affect pending practice confirmations or turn off phone alerts/);
});
test('database clears only authenticated user notices up to an existing cutoff',()=>{
 assert.match(migration,/CREATE OR REPLACE FUNCTION public\.clear_my_notifications\(p_through_id uuid\)/);
 assert.match(migration,/IF \(SELECT auth\.uid\(\)\) IS NULL OR NOT public\.is_approved\(\)/);
 assert.match(migration,/WHERE id=p_through_id AND recipient_user_id=\(SELECT auth\.uid\(\)\)/);
 assert.match(migration,/WHERE recipient_user_id=\(SELECT auth\.uid\(\)\) AND created_at<=v_cutoff/);
 assert.match(migration,/REVOKE ALL ON FUNCTION public\.clear_my_notifications\(uuid\) FROM PUBLIC,anon,authenticated/);
 assert.match(migration,/GRANT EXECUTE ON FUNCTION public\.clear_my_notifications\(uuid\) TO authenticated/);
});
test('notification clearing leaves the bell and push preferences intact',()=>{
 assert.match(app,/showNotifications&&<NotificationPanel/);
 assert.match(app,/void enablePush\(userId\)/);
 assert.match(app,/void disablePush\(userId\)/);
});
