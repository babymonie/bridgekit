'use strict';
const {app,BrowserWindow}=require('electron'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'wand-plugins-check-')),output=process.env.BRIDGE_VERIFICATION_OUTPUT||path.resolve(__dirname,'..');
app.setPath('userData',path.join(temp,'profile'));
const unsafeParent=process.env.BRIDGE_TEST_UNSAFE_PARENT==='1';
let manager;const report={runtime:process.versions.electron,unsafeParent,checks:[],success:false};
function check(name,value){report.checks.push({name,passed:!!value});if(!value)throw Error(name);}
async function wait(w,expression){for(let i=0;i<100;i++){if(await w.webContents.executeJavaScript(expression))return;await new Promise(resolve=>setTimeout(resolve,40));}throw Error('Timed out: '+expression);}
async function finish(code){clearTimeout(timeout);await manager?.dispose();for(const win of BrowserWindow.getAllWindows())win.destroy();fs.writeFileSync(path.join(output,'wand-plugins-verification.json'),JSON.stringify(report,null,2));app.exit(code);}
const timeout=setTimeout(()=>{report.error='Timed out';finish(1);},40000);
app.whenReady().then(async()=>{try{
 const fixture=path.join(temp,'game.html');fs.writeFileSync(fixture,'<!doctype html><title>Offline game fixture</title><h1>Game</h1>');const bundles=path.join(temp,'empty');fs.mkdirSync(bundles);
 manager=require('../runtime/plugin-manager.cjs').createPluginManager({adapterId:'wand',directory:path.join(temp,'registry'),bundledDirectory:bundles,enableBundledDefaults:false,nativeExtensions:true,isPageAllowed:url=>url===require('node:url').pathToFileURL(fixture).href});await manager.ready;
 const parent=new BrowserWindow({show:false,webPreferences:unsafeParent?{sandbox:false,contextIsolation:false,nodeIntegration:true}:{sandbox:true,contextIsolation:true,nodeIntegration:false}});await parent.loadFile(fixture);manager.observe(parent);
 for(const id of ['wand-game-notebook','wand-session-planner']){const source=path.resolve(__dirname,'../plugins',id),info=require('../runtime/registry.cjs').inspectPackage(source);manager.registry.register(source,{grants:info.permissions,enabled:false});}
 await manager.dispatch('discover');check('Both independent Wand packages are discovered disabled',manager.controller.list().length===2&&manager.controller.list().every(p=>!p.enabled));
 const hostWindows=new Set(BrowserWindow.getAllWindows());
 await manager.dispatch('setEnabled',{id:'wand-game-notebook',enabled:true});await manager.dispatch('open',{id:'wand-game-notebook'});
 let panel=BrowserWindow.getAllWindows().find(w=>!hostWindows.has(w)&&!w.webContents.getURL().endsWith('/companion.html'));await wait(panel,"!document.getElementById('save').disabled");
 check('SDK panel is isolated from Node and raw Electron',await panel.webContents.executeJavaScript("typeof require==='undefined'&&typeof process==='undefined'&&typeof bridge.storage.set==='function'"));
 if(unsafeParent){
   await panel.webContents.executeJavaScript("document.getElementById('capture').click()");await wait(panel,"document.getElementById('status').textContent.includes('Page access denied')");
   check('SDK page reads stay denied for Node-enabled Wand-like windows',true);
   await panel.webContents.executeJavaScript("document.getElementById('game').value='Manual game'");
 }else{await panel.webContents.executeJavaScript("document.getElementById('capture').click()");await wait(panel,"document.getElementById('game').value==='Offline game fixture'");}
 await panel.webContents.executeJavaScript("document.getElementById('notes').value='Try the frost build';document.getElementById('editor').requestSubmit()");await wait(panel,"document.getElementById('status').textContent==='Saved on this device.'");
 check('SDK notebook captures an allowed page title and saves a note',await panel.webContents.executeJavaScript("document.getElementById('games').options.length===2"));
 await manager.dispatch('setEnabled',{id:'wand-game-notebook',enabled:false});check('Disabling SDK plugin destroys its settings panel',panel.isDestroyed());
 await manager.dispatch('setEnabled',{id:'wand-game-notebook',enabled:true});await manager.dispatch('open',{id:'wand-game-notebook'});panel=BrowserWindow.getAllWindows().find(w=>!hostWindows.has(w)&&!w.webContents.getURL().endsWith('/companion.html'));await wait(panel,"document.getElementById('notes').value==='Try the frost build'");check('SDK notes survive disabling and reopening',true);await manager.dispatch('setEnabled',{id:'wand-game-notebook',enabled:false});
 await manager.dispatch('setEnabled',{id:'wand-session-planner',enabled:true});await manager.dispatch('open',{id:'wand-session-planner'});panel=BrowserWindow.getAllWindows().find(w=>!hostWindows.has(w)&&!w.webContents.getURL().endsWith('/companion.html'));await wait(panel,"!document.getElementById('save').disabled");
 check('Native MV3 panel loads with storage but no Node',await panel.webContents.executeJavaScript("typeof chrome.storage.local.get==='function'&&typeof require==='undefined'&&typeof process==='undefined'"));
 await panel.webContents.executeJavaScript("document.getElementById('goals').value='Try a new build';document.getElementById('goals-form').requestSubmit()");await wait(panel,"document.querySelectorAll('#checklist input').length===1");
 await panel.webContents.executeJavaScript("document.querySelector('#checklist input').click()");await wait(panel,"document.getElementById('status').textContent==='Progress saved on this device.'");
 await panel.webContents.executeJavaScript("document.getElementById('start').click()");await wait(panel,"document.getElementById('status').textContent.startsWith('Timer started')");check('Chrome planner saves goals, checklist and timer using real native storage',true);
 await manager.dispatch('setEnabled',{id:'wand-session-planner',enabled:false});check('Disabling native plugin closes its settings panel',panel.isDestroyed());
 await manager.dispatch('setEnabled',{id:'wand-session-planner',enabled:true});await manager.dispatch('open',{id:'wand-session-planner'});panel=BrowserWindow.getAllWindows().find(w=>!hostWindows.has(w)&&!w.webContents.getURL().endsWith('/companion.html'));await wait(panel,"document.querySelector('#checklist input')?.checked===true");
 check('Native goals and timer survive disable/re-enable',await panel.webContents.executeJavaScript("document.getElementById('clock').textContent.includes(':')"));
 panel.showInactive();await new Promise(resolve=>setTimeout(resolve,200));fs.writeFileSync(path.join(output,'wand-session-planner-preview.png'),(await panel.webContents.capturePage()).toPNG());
 check('Settings use the full available viewport height',await panel.webContents.executeJavaScript('document.body.getBoundingClientRect().height>=innerHeight-2'));
 report.success=true;
 }catch(error){report.error=error.stack;console.error(error);}await finish(report.success?0:1);});
