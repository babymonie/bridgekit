'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { install, uninstall, update, target, status } = require('../tools/faceit.cjs');
const { parse, member } = require('../tools/archive.cjs');
const selected = target();
const source = fs.existsSync(selected.backup) ? selected.backup : selected.archive;
test('archive patch preserves original members; rollback restores exact original', { skip: !fs.existsSync(source) }, t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bridge-installer-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const location = target(root, selected.version);
  fs.mkdirSync(location.resources, { recursive: true });
  fs.copyFileSync(source, location.archive);
  const original = fs.readFileSync(location.archive);
  const originalHash = crypto.createHash('sha256').update(original).digest('hex');
  assert.equal(install(root, selected.version).installed, true);
  const patched = fs.readFileSync(location.archive);
  assert.equal(JSON.parse(member(patched, 'package.json')).main, 'bridge-bootstrap.cjs');
  const a = parse(original), b = parse(patched);
  function compare(files, prefix = '') {
    for (const [name, record] of Object.entries(files)) {
      const relative = prefix + name;
      if (record.files) { compare(record.files, relative + '/'); continue; }
      if (relative === 'package.json' || record.unpacked || record.link) continue;
      const begin = Number(record.offset);
      assert.ok(original.subarray(a.dataOffset + begin, a.dataOffset + begin + record.size).equals(patched.subarray(b.dataOffset + begin, b.dataOffset + begin + record.size)), relative);
    }
  }
  compare(a.header.files);
  assert.equal(update(root, selected.version).state.runtimeVersion, require('../package.json').version);
  assert.ok(fs.readFileSync(location.archive).equals(patched), 'runtime update must not rewrite the archive');
  assert.throws(() => install(root, selected.version), /Unsupported archive/);
  const unknown = path.join(location.directory, 'unknown.txt');
  fs.writeFileSync(unknown, 'user addition');
  assert.throws(() => uninstall(root, selected.version), /unowned/);
  assert.equal(status(root, selected.version).installed, true);
  fs.unlinkSync(unknown);
  assert.equal(uninstall(root, selected.version).archiveSha256, originalHash);
  assert.ok(fs.readFileSync(location.archive).equals(original));
});
test('unknown builds are rejected without creating backups or runtime', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bridge-unsupported-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const location = target(root); fs.mkdirSync(location.resources, { recursive: true }); fs.writeFileSync(location.archive, 'unknown');
  assert.throws(() => install(root), /Unsupported archive/);
  assert.equal(fs.existsSync(location.backup), false);
  assert.equal(fs.existsSync(location.directory), false);
});
