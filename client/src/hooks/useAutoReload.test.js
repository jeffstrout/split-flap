// Unit test for the reload decision behind useAutoReload (issue #94): the kiosk
// should reload only when the server's build commit actually changes, never on
// first sighting or a missing commit (server mid-restart).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { shouldReload } from './useAutoReload.js';

test('no reload before a baseline is recorded', () => {
  assert.equal(shouldReload(null, 'abc123'), false);
});

test('no reload when the commit is unchanged', () => {
  assert.equal(shouldReload('abc123', 'abc123'), false);
});

test('reload when the commit changes', () => {
  assert.equal(shouldReload('abc123', 'def456'), true);
});

test('no reload on a missing/empty current commit', () => {
  assert.equal(shouldReload('abc123', undefined), false);
  assert.equal(shouldReload('abc123', ''), false);
});
