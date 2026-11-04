'use strict';
const fs = require('./native-fs.cjs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { patch, member } = require('./archive.cjs');
const ROOT = path.resolve(__dirname, '..');
const BUILDS = require('../profiles/faceit.json').builds;
const marker = 'electron-bridge-faceit-v1';
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function target(root = path.join(process.env.LOCALAPPDATA || '', 'FACEIT'), version) {
  version ||= Object.keys(BUILDS).reverse().find(v => fs.existsSync(path.join(root, `app-${v}`, 'resources', 'app.asar'))) || '2.10.0';
  if (!Object.hasOwn(BUILDS, version)) throw Error('Unsupported app version');
  const resources = path.join(path.resolve(root), `app-${version}`, 'resources');
  return { version, expected: BUILDS[version], resources, archive: path.join(resources, 'app.asar'), backup: path.join(resources, 'app.asar.bridge-original'), directory: path.join(resources, 'bridge-runtime') };
}
function requireClosed(t) {
  if (process.platform !== 'win32') return;
  const found = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', "@(Get-Process FACEIT -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq $env:BRIDGE_INSTALL_EXE }).Count"], { encoding: 'utf8', windowsHide: true, env: { ...process.env, BRIDGE_INSTALL_EXE: path.resolve(t.resources, '../FACEIT.exe') } }).trim();
  if (found !== '0') throw Error('Fully exit FACEIT, including its tray process, before changing the archive. Nothing changed.');
}
function status(root, version) {
  const t = target(root, version);
  let state = null;
  try { state = JSON.parse(fs.readFileSync(path.join(t.directory, 'bridge-install.json'), 'utf8')); } catch {}
  const digest = fs.existsSync(t.archive) ? hash(t.archive) : null;
  return { ...t, supported: digest === t.expected || (state?.originalSha256 === t.expected && digest === state?.patchedSha256), installed: state?.marker === marker && digest === state.patchedSha256, archiveSha256: digest, state };
}
function bootstrapSource() { return `'use strict';\nconst path = require('node:path');\nif (process.argv.includes('--bridge-compat-verify')) {\n require('./demo/compat-check.cjs');\n} else if (process.argv.includes('--bridge-manager-verify')) {\n require('./demo/manager-check.cjs');\n} else if (process.argv.includes('--bridge-forecast-verify')) {\n require('./demo/forecast-check.cjs');\n} else if (process.argv.includes('--bridge-verify')) {\n process.argv.push('--verify', '--faceit-adapter');\n require('./demo/main.cjs');\n} else {\n try { const fs = require('original-fs'); const crypto = require('node:crypto'); const receipt = require('./bridge-install.json'); const digest = crypto.createHash('sha256').update(fs.readFileSync(path.join(process.resourcesPath, 'app.asar'))).digest('hex'); if (digest === receipt.patchedSha256) require('./adapters/faceit.cjs').install(); else console.error('[Bridge] App changed; host disabled'); } catch (error) { console.error('[Bridge] Adapter disabled:', error); }\n require(path.join(process.resourcesPath, 'app.asar', 'main.js'));\n}\n`; }
function install(root, version) {
  const t = target(root, version); requireClosed(t);
  if (hash(t.archive) !== t.expected) throw Error('Unsupported archive. Adapter requires an explicitly verified FACEIT build.');
  if (fs.existsSync(t.directory) || fs.existsSync(t.backup)) throw Error('Existing runtime or backup found; refusing to overwrite it.');
  const original = fs.readFileSync(t.archive), patched = patch(original);
  if (!member(original, 'main.js').equals(member(patched, 'main.js'))) throw Error('Original application entry changed unexpectedly');
  const staging = path.join(t.resources, `bridge-stage-${crypto.randomUUID()}`);
  const temporary = path.join(t.resources, `bridge-archive-${crypto.randomUUID()}`);
  fs.mkdirSync(staging);
  let runtimeInstalled = false, backupCreated = false;
  try {
    for (const name of ['runtime', 'adapters', 'plugins', 'demo', 'vendor']) fs.cpSync(path.join(ROOT, name), path.join(staging, name), { recursive: true });
    fs.writeFileSync(path.join(staging, 'bootstrap.cjs'), bootstrapSource());
    const files = {};
    function walk(dir) { for (const entry of fs.readdirSync(dir, { withFileTypes: true })) { const file = path.join(dir, entry.name); if (entry.isDirectory()) walk(file); else files[path.relative(staging, file)] = hash(file); } }
    walk(staging);
    fs.writeFileSync(path.join(staging, 'bridge-install.json'), JSON.stringify({ marker, version: t.version, originalSha256: t.expected, patchedSha256: crypto.createHash('sha256').update(patched).digest('hex'), installedAt: new Date().toISOString(), files }, null, 2));
    fs.writeFileSync(temporary, patched, { flag: 'wx' });
    fs.copyFileSync(t.archive, t.backup, fs.constants.COPYFILE_EXCL); backupCreated = true;
    if (hash(t.backup) !== t.expected) throw Error('Backup verification failed');
    fs.renameSync(staging, t.directory); runtimeInstalled = true;
    requireClosed(t);
    if (hash(t.archive) !== t.expected) throw Error('App changed during installation; refusing replacement');
    fs.renameSync(temporary, t.archive);
  } catch (error) {
    if (fs.existsSync(staging)) fs.rmSync(staging, { recursive: true });
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
    if (runtimeInstalled) fs.rmSync(t.directory, { recursive: true });
    if (backupCreated && hash(t.archive) === t.expected) fs.unlinkSync(t.backup);
    throw error;
  }
  return status(root, version);
}
function uninstall(root, version) {
  const t = target(root, version), s = status(root, version); requireClosed(t);
  if (!s.installed || s.state?.marker !== marker || hash(t.backup) !== t.expected) throw Error('Installation or original backup changed. Refusing automatic restoration.');
  const actual = [];
  function walk(dir) { for (const entry of fs.readdirSync(dir, { withFileTypes: true })) { const file = path.join(dir, entry.name); if (entry.isSymbolicLink()) throw Error('Unexpected link; refusing removal'); if (entry.isDirectory()) walk(file); else actual.push(path.relative(t.directory, file)); } }
  walk(t.directory);
  for (const file of actual) if (file !== 'bridge-install.json' && (!Object.hasOwn(s.state.files, file) || hash(path.join(t.directory, file)) !== s.state.files[file])) throw Error(`Changed or unowned runtime file: ${file}. Nothing removed.`);
  const resolved = fs.realpathSync(t.directory);
  if (resolved !== path.join(fs.realpathSync(t.resources), 'bridge-runtime')) throw Error('Unexpected target path');
  fs.renameSync(t.backup, t.archive); fs.rmSync(resolved, { recursive: true });
  return { installed: false, archiveSha256: hash(t.archive), settings: 'Preserved' };
}
function update(root, version) {
  const t = target(root, version), s = status(root, version); requireClosed(t);
  if (!s.installed || s.state.originalSha256 !== t.expected || hash(t.backup) !== t.expected) throw Error('Verified Bridge installation required for update');
  const resolved = fs.realpathSync(t.directory);
  if (resolved !== path.join(fs.realpathSync(t.resources), 'bridge-runtime')) throw Error('Unexpected target path');
  const owned = [];
  function inventory(dir) { for (const entry of fs.readdirSync(dir, { withFileTypes: true })) { const file = path.join(dir, entry.name); if (entry.isSymbolicLink()) throw Error('Unexpected link'); if (entry.isDirectory()) inventory(file); else owned.push(path.relative(t.directory, file)); } }
  inventory(t.directory);
  for (const file of owned) if (file !== 'bridge-install.json' && (!Object.hasOwn(s.state.files, file) || hash(path.join(t.directory, file)) !== s.state.files[file])) throw Error(`Modified or unowned runtime file: ${file}`);
  for (const file of Object.keys(s.state.files)) if (!owned.includes(file)) throw Error(`Missing runtime file: ${file}`);
  const staging = path.join(t.resources, `bridge-stage-${crypto.randomUUID()}`);
  const previous = path.join(t.resources, `bridge-previous-${crypto.randomUUID()}`);
  fs.mkdirSync(staging);
  let moved = false;
  try {
    for (const name of ['runtime', 'adapters', 'plugins', 'demo', 'vendor']) fs.cpSync(path.join(ROOT, name), path.join(staging, name), { recursive: true });
    fs.writeFileSync(path.join(staging, 'bootstrap.cjs'), bootstrapSource());
    const files = {};
    function walk(dir) { for (const entry of fs.readdirSync(dir, { withFileTypes: true })) { const file = path.join(dir, entry.name); if (entry.isDirectory()) walk(file); else files[path.relative(staging, file)] = hash(file); } }
    walk(staging);
    fs.writeFileSync(path.join(staging, 'bridge-install.json'), JSON.stringify({ ...s.state, runtimeVersion: require('../package.json').version, updatedAt: new Date().toISOString(), files }, null, 2));
    requireClosed(t);
    if (hash(t.archive) !== s.state.patchedSha256) throw Error('App changed during update');
    fs.renameSync(t.directory, previous); moved = true;
    try { fs.renameSync(staging, t.directory); } catch (error) { fs.renameSync(previous, t.directory); moved = false; throw error; }
    // The previous directory was just verified and renamed within resources.
    if (fs.realpathSync(previous) !== path.join(fs.realpathSync(t.resources), path.basename(previous))) throw Error('Unexpected previous runtime path');
    fs.rmSync(previous, { recursive: true });
  } catch (error) {
    if (fs.existsSync(staging)) fs.rmSync(staging, { recursive: true });
    if (moved && !fs.existsSync(t.directory)) fs.renameSync(previous, t.directory);
    throw error;
  }
  return status(root, version);
}
if (require.main === module) {
  try {
    const operation = { status, install, uninstall, update }[process.argv[2] || 'status'];
    if (!operation) throw Error('Usage: node tools/faceit.cjs status|install|uninstall [FACEIT root]');
    console.log(JSON.stringify(operation(process.argv[3], process.argv[4]), null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { install, status, uninstall, update, target };
