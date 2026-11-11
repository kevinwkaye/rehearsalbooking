import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const rollback = readFileSync(new URL('../ops/BBBWP0.1_rollback.sql', import.meta.url), 'utf8');
const reenable = readFileSync(new URL('../ops/BBBWP0.1_reenable.sql', import.meta.url), 'utf8');
const policy = readFileSync(new URL('../BBBWP0.1_RELEASE_POLICY.md', import.meta.url), 'utf8');

test('BBBWP0.1 rollback restores the old booking API', () => {
 assert.match(rollback, /GRANT EXECUTE ON FUNCTION public\.create_booking/);
 assert.match(rollback, /REVOKE EXECUTE ON FUNCTION public\.request_practice/);
 assert.match(rollback, /DROP TRIGGER IF EXISTS notify_push_after_insert/);
});

test('BBBWP0.1 re-enable restores the member confirmation API', () => {
 assert.match(reenable, /REVOKE EXECUTE ON FUNCTION public\.create_booking/);
 assert.match(reenable, /GRANT EXECUTE ON FUNCTION public\.request_practice/);
 assert.match(reenable, /CREATE TRIGGER notify_push_after_insert/);
});

test('Emergency rollback does not erase bookings, users or votes', () => {
 assert.doesNotMatch(rollback, /(?:DROP TABLE|DELETE FROM|TRUNCATE)\s+public\./i);
 assert.match(policy, /Preserve confirmed bookings/);
});
