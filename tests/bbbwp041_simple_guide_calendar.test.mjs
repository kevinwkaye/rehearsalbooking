import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const styles=readFileSync(new URL('../src/styles.css',import.meta.url),'utf8');
const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
const help=readFileSync(new URL('../public/help.html',import.meta.url),'utf8');

test('free future dates have a visibly different background and border from past disabled dates',()=>{
 const future=styles.match(/\.calendar-day:not\(\.booked\):not\(\.past\):not\(\.pending-practice\)\{([^}]*)\}/)?.[1];
 const past=styles.match(/\.calendar-day\.past:not\(\.booked\),\.calendar-day\.past:not\(\.booked\):hover\{([^}]*)\}/)?.[1];
 assert.ok(future,'future/available style present');
 assert.ok(past,'past/disabled style present');
 assert.match(future,/background:#37545E/);
 assert.match(future,/border-color:#6E98A5/);
 assert.match(past,/background:#1B2027/);
 assert.match(past,/border-color:#343B45/);
 assert.notEqual(future,past);
});
test('past calendar dates are still disabled, band bookings and pending states remain distinct',()=>{
 assert.match(app,/disabled=\{past&&!b\}/);
 assert.match(app,/\$\{b\?'booked':''\}/);
 assert.match(styles,/\.calendar-day\.booked\{background:var\(--band-colour\);opacity:1\}/);
 assert.match(styles,/\.calendar-day\.pending-practice:not\(\.booked\)/);
 assert.match(styles,/\.calendar-day\.today\{/);
});
test('public help is short and about members, not account administration',()=>{
 assert.doesNotMatch(help,/<section id="admin"|Manage bands|Recent activity|Band archived|expected member count/i);
 assert.match(help,/Join your band/);
 assert.match(help,/Book a practice/);
 assert.match(help,/Confirm or decline/);
 assert.match(help,/Change of plans\?/);
 assert.ok(help.length<8000);
});
