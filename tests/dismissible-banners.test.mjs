import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/styles.css',import.meta.url),'utf8');

test('success and error banners separate wrapping text from close buttons',()=>{
 for(const kind of ['error','success']){
  assert.match(app,new RegExp('className="notice '+kind+' dismissible"[^>]*><span className="notice-content">'));
 }
 assert.match(app,/aria-label="Dismiss"/);
});

test('dismissible banners keep the close icon in a fixed top-right position',()=>{
 assert.match(css,/\.notice\.dismissible\{display:flex;align-items:flex-start;gap:12px\}/);
 assert.match(css,/\.notice\.dismissible \.notice-content\{flex:1;min-width:0;overflow-wrap:anywhere\}/);
 assert.match(css,/\.notice\.dismissible \.mini-close\{[^}]*flex:0 0 28px;[^}]*float:none/);
});
