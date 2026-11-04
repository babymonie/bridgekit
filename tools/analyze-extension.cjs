'use strict';
// Static dependency inventory only. Does not execute or install extension code.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
function analyze(directory) {
  const root = fs.realpathSync(directory);
  const manifestBytes = fs.readFileSync(path.join(root, 'manifest.json'));
  const manifest = JSON.parse(manifestBytes);
  const sources = [];
  function walk(dir) {
    for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
      if (item.isSymbolicLink()) continue;
      const file = path.join(dir, item.name);
      if (item.isDirectory()) walk(file);
      else if (item.name.endsWith('.js')) {
        const bytes = fs.readFileSync(file), text = bytes.toString('utf8');
        sources.push({ path: path.relative(root, file), bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex'), literalChromeReferences: [...new Set([...text.matchAll(/\b(?:chrome|browser)\.([a-zA-Z_$][\w$]*(?:\.[a-zA-Z_$][\w$]*){0,2})/g)].map(match => match[1]))].sort() });
      }
    }
  }
  walk(root);
  return { name: manifest.name, version: manifest.version, manifestVersion: manifest.manifest_version, permissions: manifest.permissions || [], hostPermissions: manifest.host_permissions || [], contentScripts: manifest.content_scripts || [], background: manifest.background, action: manifest.action, options: manifest.options_ui, webAccessibleResources: manifest.web_accessible_resources || [], sources, limitations: ['Literal text scan, not control-flow analysis. Bundled polyfill references may be unused; aliases and computed properties may be missed.', 'No runtime compatibility, account, API response, clipboard, or DOM behavior verified.', 'The Bridge v0.2 SDK does not load Chrome extensions.'] };
}
if (require.main === module) {
  try { console.log(JSON.stringify(analyze(process.argv[2]), null, 2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { analyze };
