import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
const styles=readFileSync(new URL('../src/styles.css',import.meta.url),'utf8');
test('BBBWP0.3 uses supplied logo asset for all shared Logo instances',()=>{
 assert.ok(app.includes('src="/88-bunkspace-logo.webp" alt="88 Bunkspace"'));
 assert.ok(!app.includes('className="logo-mark"'));
 assert.ok(statSync(new URL('../public/88-bunkspace-logo.webp',import.meta.url)).size>10000);
});
test('BBBWP0.3 logo respects compact mobile layout and original proportions',()=>{
 assert.ok(styles.includes('.site-header .logo-art img'));
 assert.ok(styles.includes('@media(max-width:390px){.site-header .logo-art img'));
 assert.ok(app.includes('width={624} height={310}'));
});
