'use strict';
const { app, BrowserWindow, ipcMain, session, screen, Tray, Menu } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL, fileURLToPath } = require('node:url');
const { Broker, validateManifest } = require('./broker.cjs');
const { PageAPI } = require('./page-api.cjs');
const CHANNEL = 'electron-bridge:v1';
const CSP = "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";

const BUILTIN_GRANTS = ['panel', 'storage.local', 'page.read', 'page.dom', 'page.styles', 'page.scripts', 'addons.manage'];
function createHost({ adapterId, storageDirectory, pluginDirectory, grantedPermissions, isPageAllowed, readPageInfo, addons, standalone = true, showOnAttach = true, worldId }) {
  if(!pluginDirectory)throw Error('A registered plugin directory is required');
  const channel = standalone ? CHANNEL : `electron-bridge:plugin:${JSON.parse(fs.readFileSync(path.join(pluginDirectory,'manifest.json'),'utf8')).id}`;
  let closing = false;
  const manifest = validateManifest(JSON.parse(fs.readFileSync(path.join(pluginDirectory, 'manifest.json'), 'utf8')));
  const root = fs.realpathSync(pluginDirectory);
  const entry = fs.realpathSync(path.join(root, manifest.entry));
  const entryRelative=path.relative(root,entry);
  if (entryRelative==='..'||entryRelative.startsWith(`..${path.sep}`)||path.isAbsolute(entryRelative)) throw Error('Plugin entry escapes plugin directory');
  const entryURL = pathToFileURL(entry).href;
  const broker = new Broker(storageDirectory, manifest);
  const approved = grantedPermissions || ['panel', 'storage.local'];
  if (manifest.permissions.some(permission => !approved.includes(permission))) throw Error('Plugin requests a permission not granted by the host');
  const panels = new Map();
  const parents = new Map();
  const panelParents = new Map();
  const reopeners = new Map();
  let tray, quitting = false;
  const beforeQuit = () => { quitting = true; };
  app.on('before-quit', beforeQuit);
  function openPanel() {
    const focused = BrowserWindow.getFocusedWindow();
    const parent = focused && (panelParents.get(focused.webContents.id) || focused);
    const reopen = reopeners.get(parent?.id) || [...reopeners.values()].at(-1);
    if (reopen) reopen();
  }
  function ensureTray() {
    if (!standalone) return;
    if (tray) return;
    tray = new Tray(path.join(__dirname, 'bridge-icon.png'));
    tray.setToolTip('Electron Bridge · Open panel (Ctrl+Shift+B in FACEIT)');
    tray.setContextMenu(Menu.buildFromTemplate([{ label: 'Open Bridge', click: openPanel }, { label: 'In the app: Ctrl+Shift+B', enabled: false }]));
    tray.on('click', openPanel);
    tray.on('double-click', openPanel);
  }
  const page = new PageAPI({ manifest, root, worldId, readPageInfo, settings: () => ({ ...broker.data }), isPageAllowed: isPageAllowed || (value => { try { const url = new URL(value); return adapterId === 'faceit' ? url.origin === 'https://www.faceit.com' : value === pathToFileURL(path.join(__dirname, '../demo/index.html')).href; } catch { return false; } }) });
  const info = Object.freeze({ apiVersion: 1, sdkVersion: '0.4.0', adapter: adapterId, plugin: manifest.id, name: manifest.name, permissions: [...manifest.permissions], capabilities: ['page.read', 'page.dom', 'page.styles', 'page.scripts', 'contentScripts.document_end'], electron: process.versions.electron });
  // Separate, non-persistent session: no FACEIT cookies, local storage or permission grants.
  const isolatedSession = session.fromPartition(`bridge-${manifest.id}`);
  isolatedSession.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
  isolatedSession.setPermissionCheckHandler(() => false);
  const denyDownload=event=>event.preventDefault();
  isolatedSession.on('will-download', denyDownload);
  isolatedSession.webRequest.onBeforeRequest((details, callback) => {
    let allowed = false;
    try {
      const candidate = fs.realpathSync(fileURLToPath(details.url));
      const relative = path.relative(root, candidate);
      allowed = relative !== '' && !relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative);
    } catch {}
    callback({ cancel: !allowed });
  });
  isolatedSession.webRequest.onHeadersReceived((details, callback) => callback({ responseHeaders: { ...details.responseHeaders, 'Content-Security-Policy': [CSP] } }));
  function authorize(event) {
    if(closing)throw Error('Plugin is stopping');
    const panel = panels.get(event.sender.id);
    if (!panel || panel.isDestroyed() || event.senderFrame !== panel.webContents.mainFrame || event.senderFrame.url !== entryURL || event.sender.getURL() !== entryURL) throw Error('Unauthorized plugin sender');
    return panel;
  }
  ipcMain.handle(channel, (event, operation, args) => {
    authorize(event);
    if (operation === 'host.info') return info;
    if (operation === 'addons.list' || operation === 'addons.open') {
      if (!manifest.permissions.includes('addons.manage')) throw Error('Permission denied: addons.manage');
      const parent = panelParents.get(event.sender.id);
      if (!addons) { if(operation==='addons.list')return []; throw Error('No Chrome addon host in this adapter'); }
      return operation === 'addons.list' ? addons.list(parent) : addons.open(args?.id, parent);
    }
    if (typeof operation === 'string' && operation.startsWith('page.')) return page.dispatch(panelParents.get(event.sender.id), operation, args);
    return broker.dispatch(operation, args);
  });
  function attach(parent) {
    if (parents.has(parent.id)) return parents.get(parent.id);
    const panel = new BrowserWindow({
      parent, width: standalone ? 390 : 640, height: standalone ? 720 : 820, minWidth: 340, minHeight: 460, show: false,
      title: `Bridge · ${manifest.name}`, backgroundColor: '#141619', autoHideMenuBar: true,
      resizable: true, minimizable: false, maximizable: false, fullscreenable: false,
      webPreferences: { session: isolatedSession, preload: path.join(__dirname, 'preload.cjs'), additionalArguments:[`--bridge-plugin-channel=${channel}`], sandbox: true, contextIsolation: true, nodeIntegration: false, nodeIntegrationInWorker: false, webviewTag: false, webSecurity: true, devTools: false, safeDialogs: true }
    });
    panels.set(panel.webContents.id, panel);
    panelParents.set(panel.webContents.id, parent);
    parents.set(parent.id, panel);
    const contentsId = panel.webContents.id;
    let dismissed = !showOnAttach;
    const reopen = () => {
      if (parent.isDestroyed() || panel.isDestroyed()) return;
      dismissed = false;
      if (parent.isMinimized()) parent.restore();
      parent.show(); position(); panel.show(); panel.focus();
    };
    reopeners.set(parent.id, reopen);
    ensureTray();
    const shortcut = (event, input) => {
      if (input.type === 'keyDown' && !input.isAutoRepeat && input.control && input.shift && !input.alt && !input.meta && input.key.toLowerCase() === 'b') {
        event.preventDefault(); reopen();
      }
    };
    if(standalone){parent.webContents.on('before-input-event', shortcut);panel.webContents.on('before-input-event', shortcut);}
    // Closing the panel dismisses its UI; the plugin remains active in the app.
    panel.on('close', event => { if (!quitting && !parent.isDestroyed()) { event.preventDefault(); dismissed = true; panel.hide(); } });
    const notify = () => { if (panel.isDestroyed() || parent.isDestroyed()) return; panel.webContents.send('electron-bridge:page-navigation', { url: parent.webContents.getURL() }); };
    const inPage = (_event, _url, isMainFrame) => { if (isMainFrame !== false) notify(); };
    const navigated = (_event, _url, inPlace, isMainFrame) => { if (isMainFrame !== false && !inPlace) page.navigation(parent.webContents); };
    const loaded = () => { if(closing)return;notify(); page.autoRun(parent).catch(error => console.error('[Bridge] Content script:', error.message)); };
    parent.webContents.on('did-start-navigation', navigated);
    parent.webContents.on('did-finish-load', loaded);
    parent.webContents.on('did-navigate-in-page', inPage);
    // attach() is called after the app page's initial load by the FACEIT adapter.
    page.autoRun(parent).catch(error => console.error('[Bridge] Content script:', error.message));
    const position = () => {
      if (parent.isDestroyed() || panel.isDestroyed()) return;
      const p = parent.getBounds(), bounds = panel.getBounds();
      const work = screen.getDisplayMatching(p).workArea;
      panel.setPosition(Math.max(work.x, Math.min(p.x + p.width - bounds.width - 18, work.x + work.width - bounds.width)), Math.max(work.y, Math.min(p.y + 68, work.y + work.height - bounds.height)));
    };
    panel.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    panel.webContents.on('will-navigate', event => event.preventDefault());
    panel.webContents.on('will-redirect', event => event.preventDefault());
    panel.webContents.on('will-attach-webview', event => event.preventDefault());
    panel.once('ready-to-show', () => { position(); if (!dismissed && parent.isVisible() && !parent.isMinimized()) panel.showInactive(); });
    const hide = () => { if (!panel.isDestroyed()) panel.hide(); };
    const show = () => { if (!dismissed && !panel.isDestroyed()) { position(); panel.showInactive(); } };
    parent.on('move', position); parent.on('resize', position);
    parent.on('minimize', hide); parent.on('hide', hide); parent.on('restore', show); parent.on('show', show);
    panel.on('closed', () => {
      panels.delete(contentsId); parents.delete(parent.id);
      panelParents.delete(contentsId);
      reopeners.delete(parent.id);
      if (!reopeners.size && tray) { tray.destroy(); tray = null; }
      parent.webContents.removeListener('before-input-event', shortcut);
      parent.webContents.removeListener('did-start-navigation', navigated);
      parent.webContents.removeListener('did-finish-load', loaded);
      parent.webContents.removeListener('did-navigate-in-page', inPage);
      if (!parent.isDestroyed()) page.cleanup(parent).catch(() => {});
      parent.removeListener('move', position); parent.removeListener('resize', position);
      parent.removeListener('minimize', hide); parent.removeListener('hide', hide); parent.removeListener('restore', show); parent.removeListener('show', show);
    });
    panel.loadURL(entryURL).catch(error => console.error('[Bridge] Panel load failed:', error.message));
    return panel;
  }
  return { attach, openPanel, info, broker, panels, page, async dispose() { closing=true;page.stopping=true;ipcMain.removeHandler(channel); app.removeListener('before-quit', beforeQuit); isolatedSession.removeListener('will-download',denyDownload);if (tray) { tray.destroy(); tray = null; } await Promise.allSettled([...new Set(panelParents.values())].map(parent => page.cleanup(parent))); page.disposed = true; for (const panel of panels.values()) panel.destroy(); } };
}
module.exports = { createHost };
