'use strict';
const { app, BrowserWindow } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { createHost } = require('../runtime/host.cjs');
const verify = process.argv.includes('--verify');
const root = process.env.BRIDGE_VERIFICATION_OUTPUT || path.resolve(__dirname, '..');
const adapterTest = process.argv.includes('--faceit-adapter');
// Separate profile and app identity: never share FACEIT's single-instance lock or cookies.
app.setName('Electron Bridge Demo');
app.setPath('userData', path.join(app.getPath('appData'), 'ElectronBridge', 'demo-profile'));
app.whenReady().then(async () => {
  const storageDirectory = path.join(app.getPath('appData'), 'ElectronBridge', verify ? 'verification' : 'demo', 'settings');
  const pluginDirectory=path.resolve(__dirname,'../plugins/hello-panel');
  const grantedPermissions=JSON.parse(fs.readFileSync(path.join(pluginDirectory,'manifest.json'),'utf8')).permissions;
  const makeHost=adapterId=>createHost({adapterId,storageDirectory,pluginDirectory,grantedPermissions,isPageAllowed:value=>adapterTest?value.startsWith('https://www.faceit.com/'):value===require('node:url').pathToFileURL(path.join(__dirname,'index.html')).href});
  const parent = new BrowserWindow({ width: 1100, height: 760, title: 'Bridge · Adapter test bench', backgroundColor: '#101215', autoHideMenuBar: true, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } });
  let host, panel;
  if (adapterTest) {
    // Only this diagnostic process's session is intercepted. No external request is sent.
    await parent.webContents.session.protocol.handle('https', () => new Response(fs.readFileSync(path.join(__dirname, 'index.html')), { headers: { 'content-type': 'text/html' } }));
    await parent.loadURL('https://www.faceit.com/bridge-offline-test');
    host = makeHost('faceit');
    panel = host.attach(parent);
  } else {
    await parent.loadFile(path.join(__dirname, 'index.html'));
    host = makeHost('test-bench');
    panel = host.attach(parent);
  }
  if (!verify) return;
  const report = { runtime: process.versions, adapterTest, fixture: adapterTest ? 'SDK host on an offline FACEIT-origin fixture; not the production manager adapter' : 'Local development app', checks: [], success: false };
  const check = (name, passed, actual) => { report.checks.push({ name, passed: Boolean(passed), actual }); if (!passed) throw Error(`Failed: ${name}`); };
  const waitReady = async win => {
    for (let i = 0; i < 100; i++) {
      if (await win.webContents.executeJavaScript(`Boolean(document.querySelector('#greeting') && !document.querySelector('#greeting').disabled && !document.querySelector('#enhance-page').disabled)`).catch(() => false)) return;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw Error('Panel did not initialize');
  };
  const run = expression => panel.webContents.executeJavaScript(expression);
  const watchdog = setTimeout(() => { fs.writeFileSync(path.join(root, 'verification-timeout.txt'), 'Runtime verification timed out'); app.exit(1); }, 30000);
  try {
    await waitReady(panel);
    check('Expected adapter identified', (await run(`window.bridge.info()`)).adapter === (adapterTest ? 'faceit' : 'test-bench'));
    const prefs = panel.webContents.getLastWebPreferences();
    check('Sandbox enabled', prefs.sandbox === true, prefs.sandbox);
    check('Context isolation enabled', prefs.contextIsolation === true, prefs.contextIsolation);
    check('Node integration disabled', prefs.nodeIntegration === false, prefs.nodeIntegration);
    check('No Node or Electron globals in plugin', await run(`typeof require === 'undefined' && typeof process === 'undefined' && typeof window.ipcRenderer === 'undefined'`));
    check('Host exposes only scoped APIs', await run(`JSON.stringify(Object.keys(window.bridge).sort()) === JSON.stringify(['addons','info','page','storage','version'])`));
    check('Plugin has a separate session', panel.webContents.session !== parent.webContents.session);
    check('Unrelated application renderer has no API', await parent.webContents.executeJavaScript(`typeof window.bridge === 'undefined'`));
    check('Invalid storage key rejected', await run(`window.bridge.storage.set('__proto__', 'bad').then(() => false, () => true)`));
    check('Object values rejected', await run(`window.bridge.storage.set('badValue', {a:1}).then(() => false, () => true)`));
    check('Network denied by policy', await run(`fetch('https://example.com').then(() => false, () => true)`));
    check('Local files outside plugin denied', await run(`fetch('file:///C:/Windows/win.ini').then(() => false, () => true)`));
    check('Page API reads the attached app only', (await run(`window.bridge.page.query('h1')`))[0].text.includes('One runtime'));
    check('Page text can be changed', await run(`window.bridge.page.setText('small', 'BRIDGE PAGE API TEST')`) === 1);
    check('App DOM reflects text change', await parent.webContents.executeJavaScript(`document.querySelector('small').textContent === 'BRIDGE PAGE API TEST'`));
    await run(`window.bridge.page.insertHTML('body', '<p id="bridge-html-test" onclick="window.bad=1">Inserted HTML</p><script>window.bad=1</script><iframe src="https://example.com"></iframe>')`);
    check('HTML is inserted without scripts, frames or inline handlers', await parent.webContents.executeJavaScript(`Boolean(document.querySelector('#bridge-html-test')) && !document.querySelector('#bridge-html-test').hasAttribute('onclick') && !document.querySelector('[data-bridge-owner] script, [data-bridge-owner] iframe') && !window.bad`));
    await run(`window.bridge.page.addStyle({id:'test-style',css:'#bridge-html-test{color:rgb(251,184,106)}'})`);
    check('Page CSS is applied', await parent.webContents.executeJavaScript(`getComputedStyle(document.querySelector('#bridge-html-test')).color === 'rgb(251, 184, 106)'`));
    check('Page CSS can be removed', await run(`window.bridge.page.removeStyle('test-style')`));
    check('Script path traversal is rejected', await run(`window.bridge.page.runScript('../panel.js').then(()=>false,()=>true)`));
    check('Oversized script arguments are rejected', await run(`window.bridge.page.runScript('page-widget.js',{payload:'x'.repeat(9000)}).then(()=>false,()=>true)`));
    check('Malformed selectors are rejected', await run(`window.bridge.page.query('[').then(()=>false,()=>true)`));
    check('CSS remote resource requests are rejected', await run(`window.bridge.page.addStyle({id:'remote',css:'body{background:url(https://example.com/x)}'}).then(()=>false,()=>true)`));
    check('Removing app-owned elements is refused', await run(`window.bridge.page.remove('h1')`) === 0);
    const script = await run(`window.bridge.page.runScript('page-widget.js',{enabled:true})`);
    check('Bundled client-side code executes without Node or Electron', script.enabled && !script.nodeAvailable && !script.electronAvailable);
    check('Client-side state is isolated from app JavaScript', await parent.webContents.executeJavaScript(`typeof window.__bridgePageState === 'undefined'`));
    await parent.webContents.executeJavaScript(`document.querySelector('#electron-bridge-demo-widget button').click()`);
    check('Client-side event handlers work in the app DOM', await parent.webContents.executeJavaScript(`document.querySelector('#electron-bridge-demo-widget button').textContent === 'Client-side clicks: 1'`));
    await run(`window.bridge.page.cleanup()`);
    check('Cleanup removes plugin DOM and keeps app DOM', await parent.webContents.executeJavaScript(`!document.querySelector('[data-bridge-owner]') && Boolean(document.querySelector('h1'))`));
    // Exercise the new checkbox and automatic content scripts on a real document reload.
    await run(`document.querySelector('#enhance-page').checked=false; document.querySelector('#enhance-page').click()`);
    await waitReady(panel);
    check('Page widget toggle persists and modifies app HTML', host.broker.dispatch('storage.get', ['enhancePage']) === true && await parent.webContents.executeJavaScript(`Boolean(document.querySelector('#electron-bridge-demo-widget'))`));
    await run(`window.navigationEvents=[];window.stopNavigation=window.bridge.page.onNavigate(event=>window.navigationEvents.push(event));true`);
    await new Promise(resolve => { parent.webContents.once('did-finish-load', resolve); parent.webContents.reload(); });
    for(let i=0;i<50 && !(await parent.webContents.executeJavaScript(`Boolean(document.querySelector('#electron-bridge-demo-widget'))`));i++) await new Promise(resolve=>setTimeout(resolve,50));
    check('Content scripts reapply after app page reload', await parent.webContents.executeJavaScript(`Boolean(document.querySelector('#electron-bridge-demo-widget'))`));
    check('Panel receives page navigation notifications', await run(`window.navigationEvents.length > 0`));
    if (adapterTest) {
      const count = await run(`window.navigationEvents.length`);
      await parent.webContents.executeJavaScript(`history.pushState({},'', '/bridge-offline-test?spa=1')`);
      for(let i=0;i<30 && await run(`window.navigationEvents.length`)===count;i++) await new Promise(resolve=>setTimeout(resolve,30));
      check('SPA navigation emits an event and keeps widget state', await run(`window.navigationEvents.length > ${count}`) && await parent.webContents.executeJavaScript(`Boolean(document.querySelector('#electron-bridge-demo-widget'))`));
    }
    await run(`window.stopNavigation();true`);
    if (adapterTest) {
      await parent.loadURL('https://not-faceit.invalid/');
      check('Page API denies navigation outside approved origin', await run(`window.bridge.page.info().then(()=>false,()=>true)`));
      await parent.loadURL('https://www.faceit.com/bridge-offline-test');
    }
    // Exercise the actual checkbox listener, not just a direct storage write.
    const before = await run(`document.querySelector('#greeting').checked`);
    await run(`document.querySelector('#greeting').click()`);
    await waitReady(panel);
    const after = await run(`document.querySelector('#greeting').checked`);
    check('Checkbox writes setting through broker', after === !before && host.broker.dispatch('storage.get', ['showGreeting']) === after);
    const originalStorage = path.dirname(host.broker.file);
    await host.dispose();
    host = makeHost(adapterTest ? 'faceit' : 'test-bench');
    panel = host.attach(parent);
    await waitReady(panel);
    check('Setting survives host and renderer recreation', await run(`document.querySelector('#greeting').checked`) === after);
    panel.close();
    check('Closing Bridge hides the panel without destroying the plugin', !panel.isDestroyed() && !panel.isVisible());
    host.openPanel();
    check('Tray open action reopens the same panel', panel.isVisible() && !panel.isDestroyed());
    panel.close();
    parent.focus();
    parent.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'B', modifiers: ['control', 'shift'] });
    parent.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'B', modifiers: ['control', 'shift'] });
    for (let i=0;i<30 && !panel.isVisible();i++) await new Promise(resolve=>setTimeout(resolve,30));
    check('Ctrl+Shift+B reopens a dismissed panel', panel.isVisible());
    check('Reopening preserves the saved setting', await run(`document.querySelector('#greeting').checked`) === after);
    // Return to the visually useful greeting state for the screenshot.
    if (!after) { await run(`document.querySelector('#greeting').click()`); await waitReady(panel); }
    await run(`new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))`);
    const image = await panel.webContents.capturePage();
    fs.writeFileSync(path.join(root, 'panel-preview.png'), image.toPNG());
    report.success = true;
  } catch (error) { report.error = error.stack; }
  finally {
    clearTimeout(watchdog);
    fs.writeFileSync(path.join(root, 'verification.json'), JSON.stringify(report, null, 2));
    app.exit(report.success ? 0 : 1);
  }
}).catch(error => { console.error(error); app.exit(1); });
app.on('window-all-closed', () => app.quit());
