'use strict';
const fs = require('node:fs');
const path = require('node:path');
const WORLD = 1047;
const LIMIT = 65536;
const permissions = { 'page.info': 'page.read', 'page.query': 'page.read', 'page.setText': 'page.dom', 'page.insertHTML': 'page.dom', 'page.remove': 'page.dom', 'page.addStyle': 'page.styles', 'page.removeStyle': 'page.styles', 'page.runScript': 'page.scripts', 'page.cleanup': 'page.scripts' };
function text(value, limit, label) { if (typeof value !== 'string' || value.length > limit) throw Error(`Invalid ${label}`); return value; }
function resource(root, file, extension) {
  text(file, 160, 'resource path');
  if (path.isAbsolute(file) || file.includes('\\') || file.split('/').includes('..') || path.extname(file) !== extension) throw Error('Invalid plugin resource');
  const resolved = fs.realpathSync(path.join(root, file));
  const relative = path.relative(fs.realpathSync(root), resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw Error('Resource escapes plugin directory');
  if (fs.statSync(resolved).size > LIMIT) throw Error('Resource too large');
  return fs.readFileSync(resolved, 'utf8');
}
// This function is serialized into a dedicated isolated world, never the app's main world.
function domOperation(operation, payload, owner) {
  const selector = payload.selector;
  const nodes = selector ? [...document.querySelectorAll(selector)].slice(0, 100) : [];
  if (operation === 'page.query') return nodes.map(node => ({ tag: node.tagName.toLowerCase(), id: node.id, text: node.textContent.slice(0, 2000) }));
  if (operation === 'page.setText') { for (const node of nodes) node.textContent = payload.text; return nodes.length; }
  if (operation === 'page.remove') {
    let count = 0;
    for (const node of nodes) if (node.getAttribute('data-bridge-owner') === owner) { node.remove(); count++; }
    return count;
  }
  if (operation === 'page.insertHTML') {
    if (!nodes.length) return 0;
    if (!('setHTML' in Element.prototype)) throw Error('Safe HTML insertion requires a newer Chromium runtime');
    const wrapper = document.createElement('section');
    wrapper.setAttribute('data-bridge-owner', owner);
    // Deliberately no URL attributes, inline handlers, styles, forms, embeds or scripts.
    wrapper.setHTML(payload.html, { sanitizer: { elements: ['div', 'section', 'aside', 'span', 'p', 'strong', 'em', 'b', 'i', 'small', 'h1', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'br', 'button'], attributes: ['id', 'class', 'title', 'aria-label', 'role', 'type'] } });
    if (payload.position === 'prepend') nodes[0].prepend(wrapper); else nodes[0].append(wrapper);
    return 1;
  }
  throw Error('Unknown DOM operation');
}
class PageAPI {
  constructor({ manifest, root, isPageAllowed, settings, readPageInfo, worldId = WORLD }) {
    this.manifest = manifest; this.root = root; this.isPageAllowed = isPageAllowed; this.settings = settings;
    this.styles = new Map(); this.documents = new Map(); this.disposed = false;
    this.worldId = worldId;
    this.readPageInfo=readPageInfo;
  }
  target(parent) {
    if (this.disposed || !parent || parent.isDestroyed() || parent.webContents.isDestroyed()) throw Error('Page unavailable');
    const wc = parent.webContents, prefs = wc.getLastWebPreferences();
    if (!this.isPageAllowed(wc.getURL()) || prefs.nodeIntegration || !prefs.contextIsolation || prefs.offscreen) throw Error('Page access denied');
    return wc;
  }
  async evaluate(wc, code) {
    const frame = wc.mainFrame;
    const generation = this.documents.get(wc.id) || 0;
    const expectedURL = wc.getURL();
    const execution = wc.executeJavaScriptInIsolatedWorld(this.worldId, [{ code: `(async()=>{ if(location.href !== ${JSON.stringify(expectedURL)}) throw Error('Page changed before execution'); const value = await (${code}); const json = JSON.stringify(value === undefined ? null : value); if(json.length > ${LIMIT}) throw Error('Page result too large'); return json; })()` }]);
    let timer;
    const result = await Promise.race([execution, new Promise((_, reject) => { timer = setTimeout(() => reject(Error('Page script timed out')), 5000); })]).finally(() => clearTimeout(timer));
    if (this.disposed || wc.isDestroyed() || wc.mainFrame !== frame || generation !== (this.documents.get(wc.id) || 0) || !this.isPageAllowed(wc.getURL())) throw Error('Page changed during operation');
    return JSON.parse(result);
  }
  async dispatch(parent, operation, payload = {}) {
    if(this.stopping)throw Error('Plugin is stopping');
    if(this.disposed)throw Error('Page unavailable');
    const permission = permissions[operation];
    if (!permission || !this.manifest.permissions.includes(permission)) throw Error(`Permission denied: ${permission || operation}`);
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw Error('Invalid page request');
    if(operation==='page.info'&&this.readPageInfo){const info=this.readPageInfo(parent);if(info)return info;}
    const wc = this.target(parent);
    if (operation === 'page.info') return { url: wc.getURL(), title: wc.getTitle() };
    if (operation === 'page.cleanup') return this.cleanup(parent);
    if (['page.query', 'page.setText', 'page.insertHTML', 'page.remove'].includes(operation)) {
      text(payload.selector, 512, 'selector');
      if (!payload.selector.trim()) throw Error('Empty selector');
      if (operation === 'page.setText') text(payload.text, 8192, 'text');
      if (operation === 'page.insertHTML') { text(payload.html, LIMIT, 'HTML'); if (!['append', 'prepend', undefined].includes(payload.position)) throw Error('Invalid insertion position'); }
      return this.evaluate(wc, `(${domOperation.toString()})(${JSON.stringify(operation)},${JSON.stringify(payload)},${JSON.stringify(this.manifest.id)})`);
    }
    if (operation === 'page.addStyle') {
      const id = text(payload.id, 64, 'style ID');
      if (!/^[a-z][\w-]*$/.test(id)) throw Error('Invalid style ID');
      const css = payload.file ? resource(this.root, payload.file, '.css') : text(payload.css, LIMIT, 'CSS');
      // Do not allow CSS to make new remote requests through this convenience API.
      if (/url\s*\(|@import|\\|\/\*/i.test(css)) throw Error('Styles must not contain resource URLs, imports, escapes or comments');
      const key = `${wc.id}:${id}`, old = this.styles.get(key);
      if (old) await wc.removeInsertedCSS(old);
      const generation = this.documents.get(wc.id) || 0;
      const token = await wc.insertCSS(css);
      if (this.disposed || wc.isDestroyed() || generation !== (this.documents.get(wc.id) || 0) || !this.isPageAllowed(wc.getURL())) {
        if (!wc.isDestroyed()) await wc.removeInsertedCSS(token);
        throw Error('Page changed during style insertion');
      }
      this.styles.set(key, token);
      return id;
    }
    if (operation === 'page.removeStyle') {
      const key = `${wc.id}:${text(payload.id, 64, 'style ID')}`, token = this.styles.get(key);
      if (token) { await wc.removeInsertedCSS(token); this.styles.delete(key); }
      return Boolean(token);
    }
    if (operation === 'page.runScript') {
      const source = resource(this.root, payload.file, '.js');
      const args = JSON.stringify(payload.args ?? null);
      if (args.length > 8192) throw Error('Script arguments too large');
      const settings = JSON.stringify(this.settings());
      return this.evaluate(wc, `(async()=>{ 'use strict'; if(typeof require !== 'undefined' || typeof process !== 'undefined') throw Error('Unsafe script environment'); const state = globalThis.__bridgePageState ||= { cleanups:[], controller:new AbortController() }; const bridgePage = Object.freeze({ pluginId:${JSON.stringify(this.manifest.id)}, settings:Object.freeze(${settings}), signal:state.controller.signal, onCleanup(fn){ if(typeof fn !== 'function') throw Error('Expected cleanup function'); if(state.cleanups.length >= 100) throw Error('Cleanup limit exceeded'); state.cleanups.push(fn); } }); return await (async (args,bridgePage)=>{\n${source}\n})(${args},bridgePage); })()`);
    }
  }
  async cleanup(parent) {
    const wc = this.target(parent);
    await this.evaluate(wc, `(async()=>{const state=globalThis.__bridgePageState; if(state){state.controller.abort();for(const fn of state.cleanups.splice(0)){try{await fn();}catch{}}delete globalThis.__bridgePageState;}for(const node of document.querySelectorAll('[data-bridge-owner]'))if(node.getAttribute('data-bridge-owner')===${JSON.stringify(this.manifest.id)})node.remove();return true;})()`);
    for (const [key, token] of this.styles) if (key.startsWith(`${wc.id}:`)) { await wc.removeInsertedCSS(token); this.styles.delete(key); }
    return true;
  }
  navigation(wc) {
    this.documents.set(wc.id, (this.documents.get(wc.id) || 0) + 1);
    for (const key of this.styles.keys()) if (key.startsWith(`${wc.id}:`)) this.styles.delete(key);
  }
  async autoRun(parent) {
    for (const item of this.manifest.contentScripts || []) {
      this.target(parent);
      for (const file of item.css || []) await this.dispatch(parent, 'page.addStyle', { id: `auto-${file.replace(/[^a-z0-9-]/gi, '-')}`, file });
      for (const file of item.js || []) await this.dispatch(parent, 'page.runScript', { file });
    }
  }
}
module.exports = { PageAPI, resource, permissions };
