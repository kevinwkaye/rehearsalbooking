import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/styles.css',import.meta.url),'utf8');

test('deactivated/rejected account support contact is a mailto link',()=>{
 assert.match(app,/className="support-email" href=\{\`mailto:\$\{SUPPORT\}\`\}/);
 assert.match(app,/Contact <a className="support-email"/);
});
test('support contact can be supplied by Cloudflare build variables',()=>{
 assert.match(app,/import\.meta\.env\.VITE_SUPPORT_EMAIL/);
});
test('auth card and support email wrap rather than overflow 390px viewport',()=>{
 assert.match(css,/\.auth-card \.auth-lead\{[^}]*overflow-wrap:anywhere/);
 assert.match(css,/\.auth-card \.support-email\{[^}]*overflow-wrap:anywhere/);
 assert.match(css,/\.auth-card\{min-width:0;max-width:100%;\}/);
});
test('pending account copy and auth controls remain present',()=>{
 assert.match(app,/Waiting for approval/);
 assert.match(app,/Check again/);
 assert.match(app,/Log out/);
});

test('do not display previous Proton support mailbox as Gmail fallback',()=>{
 assert.doesNotMatch(app,/bunkface_booking_boutique@proton\.me/);
 assert.match(app,/Contact the room administrator if you think this is a mistake/);
});
