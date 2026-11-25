import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const load=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const app=load('src/App.tsx');
const css=load('src/styles.css');
const sql=load('supabase/migrations/202611250001_bbbwp05_optional_instant_booking.sql');

test('the optional checkbox is off by default and only appears on a new bookable practice',()=>{
 assert.match(app,/bookWithoutConfirmation,setBookWithoutConfirmation\]=useState\(false\)/);
 assert.match(app,/!booking&&canCreate&&<div className="instant-booking-option">/);
 assert.match(app,/Book without band confirmation/);
 assert.match(app,/checked=\{bookWithoutConfirmation\}/);
 assert.match(css,/\.instant-booking-check input\[type='checkbox'\]/);
});

test('instant path skips request/vote and standard path stays unchanged',()=>{
 assert.match(app,/else if\(bookWithoutConfirmation\)\{await rpc\('book_practice_instant'/);
 assert.match(app,/else \{const requestId=await rpc<string>\('request_practice'/);
 assert.match(app,/bookWithoutConfirmation\?'Confirm booking':'Request practice'/);
});

test('server confirms membership, validates availability, and prevents a double booking',()=>{
 assert.match(sql,/NOT public\.is_approved\(\) OR NOT public\.is_band_member\(p_band\)/);
 assert.match(sql,/archived_at IS NULL/);
 assert.match(sql,/p_date < \(now\(\) AT TIME ZONE 'Europe\/London'\)::date/);
 assert.match(sql,/ON CONFLICT DO NOTHING/);
 assert.match(sql,/IF v_booking_id IS NULL THEN/);
 assert.match(sql,/auth\.uid\(\)/);
});

test('instant booking alerts approved band members without requiring confirmation',()=>{
 assert.match(sql,/SELECT DISTINCT m\.user_id,'Practice booked'/);
 assert.match(sql,/WHERE m\.band_id=p_band AND p\.status='approved'/);
 assert.doesNotMatch(sql,/INSERT INTO public\.practice_requests/);
 assert.doesNotMatch(sql,/INSERT INTO public\.practice_confirmations/);
 assert.match(sql,/broadcast_booking\(p_band,'New rehearsal booking'/);
 assert.match(sql,/GRANT EXECUTE ON FUNCTION public\.book_practice_instant\(date,time without time zone,uuid\)/);
});
