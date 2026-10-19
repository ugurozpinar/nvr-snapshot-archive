const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadConfig } = require('../../src/config');

const env = { ARCHIVE_KEY: '01'.repeat(32) };

test('configuration rejects invalid ports before opening application resources', () => {
  for (const port of ['abc', '-1', '65536', '3.5', 'Infinity', ' ', '0x50']) {
    assert.throws(() => loadConfig({ ...env, PORT: port }), { code: 'INVALID_PORT' });
  }
  assert.equal(loadConfig(env).port, 3080);
  assert.equal(loadConfig({ ...env, PORT: '65535' }).port, 65535);
  // Port zero is useful for isolated tests and embedded instances.
  assert.equal(loadConfig({ ...env, PORT: '0' }).port, 0);
});
