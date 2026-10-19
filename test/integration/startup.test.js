const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

test('both entry points explain invalid encryption keys without printing their value', () => {
  for (const entry of ['onvif.js', 'src/app.js']) {
    const result = spawnSync(process.execPath, [path.resolve(__dirname, '../..', entry)], {
      env: { ...process.env, ARCHIVE_KEY: 'invalid-private-key' },
      encoding: 'utf8',
      timeout: 10000,
      windowsHide: true,
    });
    assert.equal(result.status, 1);
    const row = JSON.parse(result.stderr.trim());
    assert.equal(row.code, 'INVALID_ARCHIVE_KEY');
    assert.match(row.message, /64/);
    assert.match(row.message, /\.env/);
    assert.ok(!result.stderr.includes('invalid-private-key'));
  }
});

test('unexpected startup messages cannot leak credentials into the error report', () => {
  const { startupFailure } = require('../../src/startup-error');
  const result = startupFailure(new Error('http://admin:private-password@nvr/ failed'));
  assert.equal(result.event, 'startup_failed');
  assert.ok(!JSON.stringify(result).includes('private-password'));
  assert.match(startupFailure({ code: 'EADDRINUSE' }).message, /port/i);
});
