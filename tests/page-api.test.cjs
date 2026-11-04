'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { PageAPI, resource } = require('../runtime/page-api.cjs');
const { validateManifest } = require('../runtime/broker.cjs');
const manifest = require('../plugins/hello-panel/manifest.json');
const root = path.resolve(__dirname, '../plugins/hello-panel');
test('page operations require individual permissions before touching an app window', async () => {
  const api = new PageAPI({ manifest: { ...manifest, permissions: ['panel'] }, root, isPageAllowed: () => true, settings: () => ({}) });
  for (const operation of ['page.info', 'page.query', 'page.setText', 'page.insertHTML', 'page.addStyle', 'page.runScript']) await assert.rejects(api.dispatch(null, operation, {}), /Permission denied/);
});
test('page code is restricted to bundled files, extension and size', t => {
  assert.ok(resource(root, 'page-widget.js', '.js').includes('document.createElement'));
  for (const file of ['../panel.js', 'C:/outside.js', 'nested/../../panel.js', 'panel.css']) assert.throws(() => resource(root, file, '.js'));
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'bridge-page-'));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  fs.writeFileSync(path.join(temp, 'large.js'), 'x'.repeat(65537));
  assert.throws(() => resource(temp, 'large.js', '.js'), /too large/);
});
test('content scripts cannot declare unsupported timing or missing permissions', () => {
  assert.throws(() => validateManifest({ ...manifest, contentScripts: [{ runAt: 'document_start', js: ['page-widget.js'] }] }), /document_end/);
  assert.throws(() => validateManifest({ ...manifest, permissions: ['panel'], contentScripts: manifest.contentScripts }), /require/);
});
test('reject non-approved pages and pages with Node integration', () => {
  const make = (url, prefs) => ({ isDestroyed: () => false, webContents: { isDestroyed: () => false, getURL: () => url, getLastWebPreferences: () => prefs } });
  const api = new PageAPI({ manifest, root, isPageAllowed: url => url === 'https://www.faceit.com/', settings: () => ({}) });
  assert.throws(() => api.target(make('https://elsewhere.test/', { contextIsolation: true })), /denied/);
  assert.throws(() => api.target(make('https://www.faceit.com/', { contextIsolation: true, nodeIntegration: true })), /denied/);
  assert.throws(() => api.target(make('https://www.faceit.com/', { contextIsolation: false })), /denied/);
});
test('SDK execution uses each plugin assigned isolated world',async()=>{
  const worlds=[];const wc={id:1,mainFrame:{},isDestroyed:()=>false,getURL:()=> 'https://www.faceit.com/',async executeJavaScriptInIsolatedWorld(world){worlds.push(world);return 'true';}};
  const first=new PageAPI({manifest,root,isPageAllowed:()=>true,settings:()=>({}),worldId:12001});const second=new PageAPI({manifest,root,isPageAllowed:()=>true,settings:()=>({}),worldId:12002});
  await first.evaluate(wc,'true');await second.evaluate(wc,'true');assert.deepEqual(worlds,[12001,12002]);
});
