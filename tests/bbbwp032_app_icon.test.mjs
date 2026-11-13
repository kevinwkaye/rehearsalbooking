import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const icon=readFileSync(new URL('../public/pwa-bunkspace-icon.svg',import.meta.url),'utf8');
const manifest=JSON.parse(readFileSync(new URL('../public/manifest.webmanifest',import.meta.url),'utf8'));
const sw=readFileSync(new URL('../public/sw.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');

test('installed icon has a charcoal background with larger full-size artwork',()=>{
 assert.match(icon,/<svg[^>]*viewBox="0 0 512 512"/);
 assert.match(icon,/<rect width="512" height="512" fill="#171A20"\/>/);
 assert.match(icon,/<image x="-17" y="-36" width="546" height="546" preserveAspectRatio="xMidYMid meet" href="data:image\/webp;base64,/);
 assert.doesNotMatch(icon,/<clipPath\b|<circle\b|mask="|clip-path="/);
});

test('PWA manifest points at logo, not the old 88-only glyph or masked tile',()=>{
 assert.equal(manifest.icons.length,1);
 assert.equal(manifest.icons[0].src,'/pwa-bunkspace-icon.svg');
 assert.equal(manifest.icons[0].purpose,'any');
 assert.equal(manifest.icons[0].type,'image/svg+xml');
 assert.match(html,/manifest\.webmanifest\?v=bbbwp041/);
});

test('updated SW precaches full PWA icon but preserves Android notification badge',()=>{
 assert.match(sw,/88-bunkspace-shell-v6/);
 assert.match(sw,/\/pwa-bunkspace-icon\.svg/);
 assert.match(sw,/badge:'\/notification-badge\.png'/);
});
