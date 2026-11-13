import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const sw=readFileSync(new URL('../public/sw.js',import.meta.url),'utf8');
const manifest=JSON.parse(readFileSync(new URL('../public/manifest.webmanifest',import.meta.url),'utf8'));
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/styles.css',import.meta.url),'utf8');
const favicon=readFileSync(new URL('../public/icon.svg',import.meta.url),'utf8');
const pwa=readFileSync(new URL('../public'+manifest.icons[0].src,import.meta.url),'utf8');
const badge=readFileSync(new URL('../public/notification-badge.png',import.meta.url));

test('favicon and home-screen icon embed the client logo rather than old calendar art',()=>{
 assert.match(favicon,/<image[^>]+href="data:image\/webp;base64,/);
 assert.match(pwa,/<image[^>]+href="data:image\/webp;base64,/);
 assert.match(html,/icon\.svg\?v=bbbwp031/);
 assert.equal(manifest.icons[0].src,'/pwa-bunkspace-icon.svg');
});
test('Android notification badge is an actual transparent PNG with 88 glyph, not an SVG',()=>{
 assert.equal(badge.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
 assert.equal(badge.readUInt32BE(16),96);
 assert.equal(badge.readUInt32BE(20),96);
 assert.match(sw,/badge:'\/notification-badge\.png'/);
 assert.match(sw,/icon:'\/88-bunkspace-logo\.webp'/);
 assert.match(sw,/88-bunkspace-shell-v\d+/);
});
test('all required notification assets are pre-cached at service-worker installation',()=>{
 for(const path of ['/notification-badge.png','/manifest.webmanifest','/88-bunkspace-logo.webp','/help.html']){
  assert.ok(sw.includes(path),'Missing '+path);
 }
});
test('pull to refresh loading state and auth logo are centred at mobile widths',()=>{
 assert.match(css,/\.config-screen\{[^}]+align-items:center;justify-content:center;text-align:center/);
 assert.match(css,/\.config-screen \.logo-art\{[^}]+justify-content:center/);
 assert.match(css,/\.auth-card \.logo-art\{[^}]+justify-content:center/);
 assert.match(css,/@media\(max-width:740px\)/);
});
