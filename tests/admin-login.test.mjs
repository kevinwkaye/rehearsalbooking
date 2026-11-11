import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
const migration=readFileSync(new URL('../supabase/migrations/202611110002_admin_managed_band_login.sql',import.meta.url),'utf8');
const edge=readFileSync(new URL('../supabase/functions/admin-band-account/index.ts',import.meta.url),'utf8');
test('band login has a selector but no public registration path',()=>{
 assert.match(source,/list_login_bands/);
 assert.match(source,/Choose your band/);
 assert.doesNotMatch(source,/auth\.signUp/);
 assert.doesNotMatch(source,/Register a band/);
});
test('admin-only account provisioning uses Auth Admin and does not store plain passwords',()=>{
 assert.match(edge,/role','admin'/);
 assert.match(edge,/auth\.admin\.createUser/);
 assert.match(edge,/auth\.admin\.updateUserById/);
 assert.doesNotMatch(edge,/from\('bands'\)\.insert\([^\n]*password/);
});
test('migration limits anonymous discovery to names and colours',()=>{
 assert.match(migration,/returns table\(id uuid,name text,colour text\)/);
 assert.match(migration,/grant execute on function public\.list_login_bands\(\) to anon,authenticated/);
 assert.match(migration,/Public account registration is disabled/);
});
