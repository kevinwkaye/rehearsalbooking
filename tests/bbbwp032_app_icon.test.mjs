import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const icon=readFileSync(new URL('../public/pwa-full-logo.svg',import.meta.url),'utf8');
const manifest=JSON.parse(readFileSync(new URL('../public/manifest.webmanifest',import.meta.url),'utf8'));
const sw=readFileSync(new URL('../public/sw.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');

test('app uses the full supplied artwork without a background tile or crop',()=>{
 assert.match(icon,/<svg[^>]*viewBox="0 0 512 512"/);
 assert.match(icon,/<image x="0" y="0" width="512" height="512" preserveAspectRatio="xMidYMid meet" href="data:image\/webp;base64,/);
 assert.doesNotMatch(icon,/<rect\b|<clipPath\b|<circle\b|mask="|clip-path="/);
});

test('PWA manifest points at logo, not the old 88-only glyph or masked tile',()=>{
 assert.equal(manifest.icons.length,1);
 assert.equal(manifest.icons[0].src,'/pwa-full-logo.svg');
 assert.equal(manifest.icons[0].purpose,'any');
 assert.equal(manifest.icons[0].type,'image/svg+xml');
 assert.match(html,/manifest\.webmanifest\?v=bbbwp032/);
});

test('updated SW precaches full PWA icon but preserves Android notification badge',()=>{
 assert.match(sw,/88-bunkspace-shell-v5/);
 assert.match(sw,/\/pwa-full-logo\.svg/);
 assert.match(sw,/badge:'\/notification-badge\.png'/);
});
