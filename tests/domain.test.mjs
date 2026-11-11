import test from 'node:test';import assert from 'node:assert/strict';
import {dateKey,monthCells,isValidDateKey,describeDate,times,todayInLondon} from '../src/domain.mjs';
test('Monday-start calendar handles November 2026 correctly',()=>{const cells=monthCells(2026,10);assert.equal(cells.length,36);assert.equal(cells.indexOf(1),6);assert.equal(cells.at(-1),30);});
test('calendar handles leap day',()=>{assert.equal(monthCells(2028,1).filter(Boolean).length,29);assert.equal(isValidDateKey('2028-02-29'),true);assert.equal(isValidDateKey('2027-02-29'),false);});
test('local dates are not timezone-shifted',()=>{assert.equal(dateKey(2026,2,29),'2026-03-29');assert.match(describeDate('2026-03-29'),/Sunday, 29 March 2026/);});
test('time selection has 30-minute increments',()=>{assert.equal(times().length,48);assert.equal(times()[38],'19:00');});
test('London today switches correctly at midnight in BST',()=>{assert.equal(todayInLondon(new Date('2026-07-02T22:30:00Z')),'2026-07-02');assert.equal(todayInLondon(new Date('2026-07-02T23:30:00Z')),'2026-07-03');});

import {readFileSync} from 'node:fs';
const source = readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
const stylesheet = readFileSync(new URL('../src/styles.css',import.meta.url),'utf8');
const migration = readFileSync(new URL('../supabase/migrations/202611110004_admin_band_members_and_deletion.sql',import.meta.url),'utf8');
const edge = readFileSync(new URL('../supabase/functions/admin-member-access/index.ts',import.meta.url),'utf8');

test('calendar cannot navigate earlier than London current month',()=>{
 assert.match(source,/if\(target<today\)return/);
 assert.match(source,/disabled=\{viewingCurrentMonth\}/);
});
test('calendar eliminates introduction and full-day booking explanations',()=>{
 assert.doesNotMatch(source,/className="top-intro"/);
 assert.doesNotMatch(source,/className="bottom-cards"/);
 assert.doesNotMatch(source,/This reserves the entire day/);
 assert.match(stylesheet,/height:100dvh/);
 assert.match(stylesheet,/grid-auto-rows:minmax\(0,1fr\)/);
});
test('admin can change their own band and create bookings for unstaffed bands',()=>{
 assert.match(migration,/ALTER TABLE public\.profiles DROP CONSTRAINT IF EXISTS role_band_check/);
 assert.match(migration,/admin_change_member_band/);
 assert.match(migration,/CREATE OR REPLACE FUNCTION public\.create_booking/);
 assert.match(migration,/archived_at IS NULL/);
});
test('admin member deletion is server authorised and prevents admin self-deletion',()=>{
 assert.match(edge,/role','admin/);
 assert.match(edge,/data\?\.action==='delete_member'/);
 assert.match(edge,/id===user\.id/);
 assert.match(edge,/admin\.auth\.admin\.deleteUser/);
});
test('band deletion requires an admin and preserves prior booking history',()=>{
 assert.match(migration,/CREATE OR REPLACE FUNCTION public\.admin_delete_band/);
 assert.match(migration,/IF NOT public\.is_admin\(\)/);
 assert.match(migration,/status='confirmed'/);
 assert.match(migration,/archived_at=now\(\)/);
});
