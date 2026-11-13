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
test('guide is a short member-only quick start, not an admin manual',()=>{
 assert.match(help,/<!doctype html>/i);
 for(const id of ['getting-started','book','approvals','changes','notifications']){
  assert.match(help,new RegExp('id="'+id+'"'));

 }
 assert.match(help,/New here\? Create an account/);
 assert.match(help,/Request practice/);
 assert.match(help,/Confirm/);
 assert.match(help,/Decline/);
 assert.match(help,/Change of plans/);
 assert.match(help,/clear old messages/);
 assert.doesNotMatch(help,/id="admin"|Manage bands|delete an account|audit trail|create bands/i);
 assert.ok(help.length<8000,'Keep the quick guide concise');
 assert.match(help,/Forgot password\?/);
 assert.doesNotMatch(help,/SUPABASE_SERVICE_ROLE_KEY|sb_secret_|password=|\/rest\/v1\//i);
});
test('mobile help shortcut remains visible at 390px and keyboard accessible',()=>{
 assert.match(css,/\.site-header \.help-nav-link\{/);
 assert.match(css,/\.auth-help-link:focus-visible/);
 assert.match(css,/@media\(max-width:390px\)/);
});
