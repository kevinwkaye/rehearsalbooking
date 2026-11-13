import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/styles.css',import.meta.url),'utf8');
const help=readFileSync(new URL('../public/help.html',import.meta.url),'utf8');

test('authenticated top navigation has a named question-mark help link',()=>{
 assert.match(app,/className="help-nav-link" href="\/help\.html" aria-label="How to use 88 Bunkspace"/);
 assert.match(app,/title="How to use 88 Bunkspace">\?<\/a>/);
});
test('login page exposes how-to page without authentication',()=>{
 assert.match(app,/className="auth-help-link" href="\/help\.html"/);
 assert.match(help,/href="\/"[^>]*>.*Back to the app/);
});
test('guide is static and covers registration, booking, approvals, admin and recovery',()=>{
 assert.match(help,/<!doctype html>/i);
 for(const id of ['getting-started','book','approvals','notifications','admin','problems']){
  assert.match(help,new RegExp('id="'+id+'"'));
  assert.match(help,new RegExp('href="#'+id+'"'));
 }
 assert.match(help,/at least 10 characters/i);
 assert.match(help,/everyone currently registered and approved/i);
 assert.match(help,/Forgot password\?/);
 assert.doesNotMatch(help,/SUPABASE_SERVICE_ROLE_KEY|sb_secret_|password=|\/rest\/v1\//i);
});
test('mobile help shortcut remains visible at 390px and keyboard accessible',()=>{
 assert.match(css,/\.site-header \.help-nav-link\{/);
 assert.match(css,/\.auth-help-link:focus-visible/);
 assert.match(css,/@media\(max-width:390px\)/);
});
