import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const load=(path)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const app=load('src/App.tsx');
const sql=load('supabase/migrations/202611130001_bbbwp04_cancellation_and_decline_reasons.sql');
const css=load('src/styles.css');
const rollback=load('ops/BBBWP0.4_rollback.sql');
const help=load('public/help.html');

test('confirmed rehearsal cancellation asks for a reason and needs explicit confirmation',()=>{
 assert.match(app,/Reason for cancelling \(optional\)/);
 assert.match(app,/maxLength=\{200\} value=\{cancelReason\}/);
 assert.match(app,/\{cancelReason\.length\}\/200 characters/);
 assert.match(app,/Confirm|Yes, cancel/);
 assert.match(app,/p_id:booking\.id,p_reason:cancelReason\.trim\(\)\|\|null/);
});

test('declining an unconfirmed request asks for a reason, rather than declining instantly',()=>{
 assert.match(app,/Reason for declining \(optional\)/);
 assert.match(app,/maxLength=\{200\} value=\{declineReason\}/);
 assert.match(app,/\{declineReason\.length\}\/200 characters/);
 assert.match(app,/Confirm decline/);
 assert.match(app,/onClick=\{\(\)=>\{setDeclining\(true\)/);
 assert.match(app,/p_request:proposal\.id,p_confirm:confirm,p_reason:confirm\?null:declineReason\.trim\(\)\|\|null/);
});

test('server rejects reasons over 200 characters for both operations',()=>{
 assert.equal((sql.match(/char_length\(v_reason\)>200/g)||[]).length,2);
 assert.equal((sql.match(/Reason must be 200 characters or fewer/g)||[]).length,2);
 assert.match(sql,/nullif\(regexp_replace\(v_reason,'\[\[:cntrl:\]\]\+',' ','g'\),''\)/);
});

test('cancel booking alerts every approved affected-band member, including the canceller',()=>{
 assert.match(sql,/CREATE OR REPLACE FUNCTION public\.cancel_booking\(p_id uuid, p_reason text\)/);
 assert.match(sql,/SELECT DISTINCT m\.user_id,'Rehearsal cancelled',v_member_message/);
 assert.match(sql,/WHERE m\.band_id=v\.band_id AND p\.status='approved'/);
 assert.doesNotMatch(sql,/WHERE m\.band_id=v\.band_id AND p\.status='approved' AND m\.user_id<>auth\.uid\(\)/);
});

test('cancellation reason stays private to affected band',()=>{
 assert.match(sql,/v_public_message:=/);
 assert.match(sql,/v_member_message:=v_public_message/);
 assert.match(sql,/public\.broadcast_booking\(v\.band_id,'Rehearsal cancelled',v_public_message\)/);
 assert.match(sql,/SELECT DISTINCT m\.user_id,'Rehearsal cancelled',v_member_message/);
});

test('declining a pending request notifies other approved band members with reason',()=>{
 assert.match(sql,/CREATE OR REPLACE FUNCTION public\.respond_practice\(p_request uuid, p_confirm boolean, p_reason text\)/);
 assert.match(sql,/UPDATE public\.practice_requests SET status='declined',resolved_at=now\(\)/);
 assert.match(sql,/SELECT DISTINCT m\.user_id,'Rehearsal cancelled',v_message/);
 assert.match(sql,/WHERE m\.band_id=r\.band_id AND p\.status='approved' AND m\.user_id<>auth\.uid\(\)/);
 assert.match(sql,/CASE WHEN v_reason IS NULL THEN '' ELSE ' Reason: '\|\|v_reason END/);
});

test('existing app RPC signatures and server-side authorisation are preserved',()=>{
 assert.match(sql,/public\.cancel_booking\(p_id uuid\)\s+RETURNS void/);
 assert.match(sql,/public\.respond_practice\(p_request uuid,p_confirm boolean\)\s+RETURNS text/);
 assert.match(sql,/SELECT public\.cancel_booking\(p_id,NULL::text\)/);
 assert.match(sql,/SELECT public\.respond_practice\(p_request,p_confirm,NULL::text\)/);
 assert.match(sql,/IF NOT public\.is_approved\(\) THEN RAISE EXCEPTION 'PERMISSION DENIED'/);
 assert.match(sql,/IF NOT public\.is_admin\(\) AND NOT public\.is_band_member\(v\.band_id\)/);
 assert.match(sql,/IF NOT public\.is_band_member\(r\.band_id\)/);
 assert.match(sql,/GRANT EXECUTE ON FUNCTION public\.cancel_booking\(uuid,text\) TO authenticated/);
 assert.match(sql,/GRANT EXECUTE ON FUNCTION public\.respond_practice\(uuid,boolean,text\) TO authenticated/);
});

test('styles and guide support both optional reason forms at mobile widths',()=>{
 assert.match(css,/\.decline-reason-panel textarea/);
 assert.match(css,/\.cancellation-reason-label textarea/);
 assert.match(css,/\.reason-counter/);
 assert.match(help,/optional reason/i);
 assert.match(help,/optional reason/i);
});

test('rollback keeps bookings and restores both old behaviours',()=>{
 assert.match(rollback,/CREATE OR REPLACE FUNCTION public\.cancel_booking\(p_id uuid\)/);
 assert.match(rollback,/CREATE OR REPLACE FUNCTION public\.respond_practice\(p_request uuid,p_confirm boolean\)/);
 assert.match(rollback,/CREATE OR REPLACE FUNCTION public\.cancel_booking\(p_id uuid,p_reason text\)/);
 assert.match(rollback,/CREATE OR REPLACE FUNCTION public\.respond_practice\(p_request uuid,p_confirm boolean,p_reason text\)/);
 assert.doesNotMatch(rollback,/DROP TABLE|TRUNCATE|DELETE FROM public\.bookings/i);
});
