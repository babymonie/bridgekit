'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Broker, validateManifest } = require('../runtime/broker.cjs');
const manifest = require('../plugins/hello-panel/manifest.json');
function temporary(t) { const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bridge-test-')); t.after(() => fs.rmSync(dir, { recursive: true, force: true })); return dir; }
test('settings persist across independent broker instances', t => {
  const dir = temporary(t); const first = new Broker(dir, manifest);
  assert.equal(first.dispatch('storage.get', ['showGreeting']), null);
  first.dispatch('storage.set', ['showGreeting', false]);
  assert.equal(new Broker(dir, manifest).dispatch('storage.get', ['showGreeting']), false);
});
test('permissions are enforced in the privileged broker', t => {
  const broker = new Broker(temporary(t), { ...manifest, permissions: ['panel'], contentScripts: [] });
  assert.throws(() => broker.dispatch('storage.set', ['showGreeting', true]), /Permission denied/);
});
test('reject traversal, prototype keys, unsupported calls and oversize values', t => {
  const broker = new Broker(temporary(t), manifest);
  for (const key of ['../escape', '__proto__', 'constructor', 'prototype', '']) assert.throws(() => broker.dispatch('storage.set', [key, true]));
  assert.throws(() => broker.dispatch('process.exec', ['showGreeting']), /Unsupported operation/);
  assert.throws(() => broker.dispatch('storage.set', ['setting', 'x'.repeat(4097)]), /too large/);
  assert.throws(() => broker.dispatch('storage.set', ['setting', {}]), /scalar/);
  assert.throws(() => broker.dispatch('storage.set', ['setting', Infinity]), /Invalid number/);
});
test('plugin identities cannot escape their storage directory', () => {
  assert.throws(() => validateManifest({ ...manifest, id: '../elsewhere' }));
  assert.throws(() => validateManifest({ ...manifest, permissions: ['panel', 'node'] }));
});
test('quota failure preserves the previous persisted value', t => {
  const dir = temporary(t); const broker = new Broker(dir, manifest);
  broker.dispatch('storage.set', ['first', false]);
  for (let i = 0; i < 8; i++) broker.dispatch('storage.set', [`value${i}`, 'x'.repeat(4000)]);
  assert.throws(() => broker.dispatch('storage.set', ['overflow', 'x'.repeat(4096)]), /quota/);
  assert.equal(new Broker(dir, manifest).dispatch('storage.get', ['first']), false);
  assert.equal(broker.dispatch('storage.get', ['overflow']), null);
});
