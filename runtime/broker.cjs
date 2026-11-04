'use strict';
const fs = require('node:fs');
const path = require('node:path');
const dangerous = new Set(['__proto__', 'prototype', 'constructor']);
function keyCheck(key) {
  if (typeof key !== 'string' || !/^[a-zA-Z][\w.-]{0,63}$/.test(key) || dangerous.has(key)) throw Error('Invalid setting key');
}
function validateManifest(manifest) {
  if (manifest.apiVersion !== 1 || !/^[a-z][a-z0-9-]{1,47}$/.test(manifest.id)) throw Error('Invalid plugin identity or API version');
  if (!Array.isArray(manifest.permissions) || manifest.permissions.some(p => !['storage.local', 'panel', 'page.read', 'page.dom', 'page.styles', 'page.scripts', 'addons.manage'].includes(p))) throw Error('Unsupported permission');
  if (!manifest.permissions.includes('panel')) throw Error('Panel permission required');
  if (typeof manifest.entry!=='string'||!manifest.entry.endsWith('.html')||manifest.entry.includes('\\')||manifest.entry.includes(':')||path.isAbsolute(manifest.entry)||manifest.entry.split('/').some(part=>part==='..'||part==='')) throw Error('Invalid plugin entry path');
  if (manifest.contentScripts !== undefined) {
    if (!Array.isArray(manifest.contentScripts) || manifest.contentScripts.length > 10) throw Error('Invalid content scripts');
    for (const item of manifest.contentScripts) {
      if (!item || item.runAt !== 'document_end') throw Error('Only document_end content scripts supported');
      for (const kind of ['js', 'css']) if (item[kind] !== undefined && (!Array.isArray(item[kind]) || item[kind].length > 10 || item[kind].some(file => typeof file !== 'string'))) throw Error('Invalid content script files');
      if (item.js?.length && !manifest.permissions.includes('page.scripts')) throw Error('Content scripts require page.scripts');
      if (item.css?.length && !manifest.permissions.includes('page.styles')) throw Error('Content styles require page.styles');
    }
  }
  return manifest;
}
class Broker {
  constructor(directory, manifest) {
    this.manifest = validateManifest(manifest);
    this.file = path.join(directory, `${manifest.id}.json`);
    this.data = Object.create(null);
    try { this.data = Object.assign(Object.create(null), JSON.parse(fs.readFileSync(this.file, 'utf8'))); }
    catch (error) { if (error.code !== 'ENOENT') throw Error(`Cannot read plugin settings: ${error.message}`); }
  }
  dispatch(operation, args) {
    if (!this.manifest.permissions.includes('storage.local')) throw Error('Permission denied: storage.local');
    if (!Array.isArray(args)) throw Error('Invalid arguments');
    const [key, value] = args;
    keyCheck(key);
    if (operation === 'storage.get') return Object.hasOwn(this.data, key) ? this.data[key] : null;
    if (operation !== 'storage.set') throw Error('Unsupported operation');
    if (!['string', 'boolean', 'number'].includes(typeof value) && value !== null) throw Error('Only scalar settings supported');
    if (typeof value === 'number' && !Number.isFinite(value)) throw Error('Invalid number');
    if (typeof value === 'string' && value.length > 4096) throw Error('Setting too large');
    const next = Object.assign(Object.create(null), this.data, { [key]: value });
    const serialized = JSON.stringify(next, null, 2);
    if (Buffer.byteLength(serialized) > 32768) throw Error('Storage quota exceeded');
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(`${this.file}.tmp`, serialized, { mode: 0o600 });
    fs.renameSync(`${this.file}.tmp`, this.file);
    this.data = next;
    return true;
  }
}
module.exports = { Broker, validateManifest };
