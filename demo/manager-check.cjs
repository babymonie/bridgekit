'use strict';
const {app,BrowserWindow,dialog}=require('electron');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const root=path.resolve(__dirname,'..'),temp=fs.mkdtempSync(path.join(os.tmpdir(),'bridge-manager-check-'));
const output=process.env.BRIDGE_VERIFICATION_OUTPUT||root;
app.setPath('userData',path.join(temp,'profile'));
const report={version:'0.4.1',runtime:process.versions,checks:[],success:false};
function check(name,value){report.checks.push({name,passed:!!value});if(!value)throw Error(name);}
const timeout=setTimeout(()=>{report.error='Timed out';finish(1);},40000);
let manager;
async function finish(code){clearTimeout(timeout);try{await manager?.dispose();}catch{}for(const win of BrowserWindow.getAllWindows())win.destroy();fs.writeFileSync(path.join(output,'manager-electron-verification.json'),JSON.stringify(report,null,2));app.exit(code);}
app.whenReady().then(async()=>{
 try{
  const source=path.join(temp,'independent-plugin');fs.mkdirSync(source);
  fs.writeFileSync(path.join(source,'manifest.json'),JSON.stringify({apiVersion:1,id:'independent-check',name:'Independent check',version:'1.0.0',entry:'index.html',permissions:['panel','storage.local','page.scripts'],contentScripts:[{runAt:'document_end',js:['client.js']}]}));
  fs.writeFileSync(path.join(source,'index.html'),'<!doctype html><title>Independent settings</title><p>Independent plugin</p>');
  fs.writeFileSync(path.join(source,'client.js'),"const node=document.createElement('aside');node.id='independent-marker';node.textContent='Enabled';document.body.append(node);bridgePage.onCleanup(()=>node.remove());return true;");
  const empty=path.join(temp,'bundles');fs.mkdirSync(empty);
  manager=require('../adapters/faceit.cjs').install({directory:path.join(temp,'registry'),bundledDirectory:empty});
  const parent=new BrowserWindow({show:false,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false}});
  await parent.webContents.session.protocol.handle('https',()=>new Response('<!doctype html><title>Offline FACEIT fixture</title><h1>Fixture</h1>',{headers:{'content-type':'text/html'}}));
  await parent.loadURL('https://www.faceit.com/bridge-manager-check');await manager.ready;
  const win=await manager.open();
  check('Actual FACEIT adapter creates independent empty manager',(await manager.dispatch('list')).plugins.length===0);
  check('Manager preload exposes no Node or raw IPC',await win.webContents.executeJavaScript("typeof require==='undefined'&&typeof process==='undefined'&&typeof bridgeManager.list==='function'&&typeof bridgeManager.invoke==='undefined'"));
  dialog.showOpenDialog=async()=>({canceled:false,filePaths:[source]});dialog.showMessageBox=async()=>({response:0});
  await win.webContents.executeJavaScript('bridgeManager.installFolder()');
  check('Real manager IPC installs an unrelated folder disabled',manager.controller.list()[0]?.enabled===false);
  await win.webContents.executeJavaScript("bridgeManager.setEnabled('independent-check',true)");
  await new Promise(resolve=>setTimeout(resolve,150));
  check('Enabling creates page content',await parent.webContents.executeJavaScript("!!document.getElementById('independent-marker')"));
  await win.webContents.executeJavaScript("bridgeManager.open('independent-check')");
  const panel=BrowserWindow.getAllWindows().find(w=>w!==win&&w!==parent);
  check('Plugin panel has no Node and own narrow bridge',await panel.webContents.executeJavaScript("typeof require==='undefined'&&typeof process==='undefined'&&typeof bridge.storage.set==='function'&&typeof bridgeManager==='undefined'"));
  await panel.webContents.executeJavaScript("bridge.storage.set('savedCheck','persisted')");
  await win.webContents.executeJavaScript("bridgeManager.setEnabled('independent-check',false)");
  check('Disabling removes page content',await parent.webContents.executeJavaScript("!document.getElementById('independent-marker')"));
  check('Disabling destroys settings panel',panel.isDestroyed());
  check('Disabled state persists on disk',new (require('../runtime/registry.cjs').Registry)({directory:path.join(temp,'registry')}).get('independent-check').enabled===false);
  check('Manager remains usable with every plugin disabled',(await win.webContents.executeJavaScript('bridgeManager.list()')).plugins[0].enabled===false);
  await win.webContents.executeJavaScript("bridgeManager.setEnabled('independent-check',true)");
  await win.webContents.executeJavaScript("bridgeManager.open('independent-check')");
  const reopened=BrowserWindow.getAllWindows().find(w=>w!==win&&w!==parent);
  check('Saved setting survives disable/re-enable',await reopened.webContents.executeJavaScript("bridge.storage.get('savedCheck').then(value=>value==='persisted')"));
  await win.webContents.executeJavaScript("bridgeManager.uninstall('independent-check')");
  check('Uninstall removes package and registry entry',manager.controller.list().length===0&&!fs.existsSync(path.join(temp,'registry/plugins/independent-check')));
  check('Uninstall preserves saved settings',fs.existsSync(path.join(temp,'registry/settings/independent-check.json')));
  check('Manager remains open after uninstall',!win.isDestroyed());
  await win.webContents.executeJavaScript("new Promise(resolve=>setTimeout(resolve,80))");
  fs.writeFileSync(path.join(output,'manager-preview.png'),(await win.webContents.capturePage()).toPNG());
  const nativeSource=path.join(root,'plugins/faceit-forecast');
  if(fs.existsSync(path.join(nativeSource,'manifest.json'))){
  manager.registry.register(nativeSource);
  await win.webContents.executeJavaScript('bridgeManager.discover()');
  await win.webContents.executeJavaScript("bridgeManager.setEnabled('faceit-forecast',true)");
  check('Manager loads a native MV3 package',parent.webContents.session.extensions.getAllExtensions().some(e=>e.id==='mpkkcddegpblmobincjkbpgfcbejjbcp'));
  await win.webContents.executeJavaScript("bridgeManager.open('faceit-forecast')");
  const nativeWindow=BrowserWindow.getAllWindows().find(w=>w!==win&&w!==parent);
  check('Native settings fill the viewport',await nativeWindow.webContents.executeJavaScript("document.querySelector('.container').getBoundingClientRect().height>=innerHeight-2"));
  check('Expanded settings content uses the remaining height',await nativeWindow.webContents.executeJavaScript("document.querySelector('.patch-notes-collapsible').getBoundingClientRect().bottom>=innerHeight-25"));
  await new Promise(resolve=>setTimeout(resolve,500));
  try{fs.writeFileSync(path.join(output,'forecast-manager-preview.png'),(await nativeWindow.webContents.capturePage()).toPNG());}catch(error){report.screenshotWarning=error.message;}
  await win.webContents.executeJavaScript("bridgeManager.setEnabled('faceit-forecast',false)");
  check('Manager disable unloads native extension',!parent.webContents.session.extensions.getAllExtensions().some(e=>e.id==='mpkkcddegpblmobincjkbpgfcbejjbcp'));
  check('Manager disable closes native settings',nativeWindow.isDestroyed());
  check('Native disabled state persists',new (require('../runtime/registry.cjs').Registry)({directory:path.join(temp,'registry')}).get('faceit-forecast').enabled===false);
  fs.writeFileSync(path.join(output,'manager-preview.png'),(await win.webContents.capturePage()).toPNG());
  }else report.skipped=['Native FORECAST fixture: supply your own package to exercise native checks'];
  report.success=true;
 }catch(error){report.error=error.stack;console.error(error);}
 await finish(report.success?0:1);
});
