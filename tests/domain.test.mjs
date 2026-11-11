import test from 'node:test';import assert from 'node:assert/strict';
import {dateKey,monthCells,isValidDateKey,describeDate,times,todayInLondon} from '../src/domain.mjs';
test('Monday-start calendar handles November 2026 correctly',()=>{const cells=monthCells(2026,10);assert.equal(cells.length,36);assert.equal(cells.indexOf(1),6);assert.equal(cells.at(-1),30);});
test('calendar handles leap day',()=>{assert.equal(monthCells(2028,1).filter(Boolean).length,29);assert.equal(isValidDateKey('2028-02-29'),true);assert.equal(isValidDateKey('2027-02-29'),false);});
test('local dates are not timezone-shifted',()=>{assert.equal(dateKey(2026,2,29),'2026-03-29');assert.match(describeDate('2026-03-29'),/Sunday, 29 March 2026/);});
test('time selection has 30-minute increments',()=>{assert.equal(times().length,48);assert.equal(times()[38],'19:00');});
test('London today switches correctly at midnight in BST',()=>{assert.equal(todayInLondon(new Date('2026-07-02T22:30:00Z')),'2026-07-02');assert.equal(todayInLondon(new Date('2026-07-02T23:30:00Z')),'2026-07-03');});
