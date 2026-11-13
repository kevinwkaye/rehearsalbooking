import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
const types=readFileSync(new URL('../src/types.ts',import.meta.url),'utf8');
const sql=readFileSync(new URL('../supabase/migrations/202611130003_owner_superadmin_role.sql',import.meta.url),'utf8');

test('owner account is distinct from regular admin and band roles',()=>{
 assert.match(types,/role:'admin'\|'superadmin'\|'band'/);
 assert.match(sql,/role IN \('band','admin','superadmin'\)/);
});
test('owner can use existing admin UI while all account access still requires approved authentication',()=>{
 assert.match(app,/profile\.role==='superadmin'/);
 assert.match(app,/user\.role==='superadmin'/);
 assert.match(app,/profile\?\.role==='superadmin'/);
 assert.match(sql,/id=\(SELECT auth\.uid\(\)\)/);
 assert.match(sql,/status='approved'/);
});
test('owner account must be created in Supabase Auth, no hidden entry point or credentials',()=>{
 assert.doesNotMatch(sql.split('\\n').filter(line=>!line.trimStart().startsWith('--')).join('\\n'),/INSERT INTO (?:auth\\.users|public\\.profiles)|kwkaye|CREATE POLICY|GRANT EXECUTE/i);
 assert.doesNotMatch(app,/kwkaye84@gmail\.com/);
});
