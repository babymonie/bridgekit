'use strict';
const {app,BrowserWindow,session}=require('electron');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {Registry,inspectPackage}=require('../runtime/registry.cjs');
const {preparePackage}=require('../runtime/package-import.cjs');
const {createChromeAddons}=require('../runtime/chrome-addons.cjs');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'bridge-compat-check-')),output=process.env.BRIDGE_VERIFICATION_OUTPUT||path.resolve(__dirname,'..');
app.setPath('userData',path.join(temp,'profile'));
const report={version:'0.4.1',runtime:process.versions,checks:[],success:false};
function check(name,value){report.checks.push({name,passed:!!value});if(!value)throw Error(name);}
const timer=setTimeout(()=>{report.error='Timed out';finish(1);},35000);
async function finish(code){clearTimeout(timer);for(const win of BrowserWindow.getAllWindows())win.destroy();fs.writeFileSync(path.join(output,'compatibility-verification.json'),JSON.stringify(report,null,2));app.exit(code);}
app.whenReady().then(async()=>{
 try{
  const r=new Registry({directory:path.join(temp,'data')});
  const raw=process.env.BRIDGE_TEST_IMPORT;
  if(raw){const prepared=preparePackage(raw,temp);try{const entry=r.register(prepared.directory);const info=r.package(entry.id);check('Supplied Chrome folder imports without rejecting root-relative paths',!entry.enabled);check('Copied content-script paths are relative',info.manifest.content_scripts.every(s=>[...s.js||[],...s.css||[]].every(f=>!f.startsWith('/'))));check('Original manifest is unchanged',inspectPackage(raw).manifest.content_scripts.some(s=>s.js?.some(f=>f.startsWith('/'))));report.imported={name:entry.name,requiredPermissions:entry.permissions};}finally{prepared.cleanup();}}
  const source=process.env.BRIDGE_TEST_REPEEK;
  if(!source)throw Error('Provide the user-selected Repeek extension package');
  const info=inspectPackage(source),entry=r.register(source,{enabled:true,grants:info.permissions});
  const ses=session.defaultSession;
  await ses.protocol.handle('https',()=>new Response('<!doctype html><title>Offline fixture</title><h1>Fixture</h1>',{headers:{'content-type':'text/html'}}));
  await ses.protocol.handle('http',()=>new Response('',{status:503}));
  const addons=createChromeAddons({registry:r});const state=addons.ensure(ses);await addons.activate(entry,r.package(entry.id));
  const ext=state.loaded.get(entry.id).extension;
  const popup=new BrowserWindow({show:false,webPreferences:{session:ses,sandbox:true,contextIsolation:true,nodeIntegration:false}});
  await popup.loadURL(`chrome-extension://${ext.id}/${info.settingsEntry}`);
  const origins=info.permissions.filter(p=>p.includes('://'));
  check('Repeek getAll reports both approved FACEIT sites',await popup.webContents.executeJavaScript(`chrome.permissions.getAll().then(p=>${JSON.stringify(origins)}.every(origin=>p.origins.includes(origin)))`));
  check('Repeek contains recognizes approved host grants',await popup.webContents.executeJavaScript(`chrome.permissions.contains({origins:${JSON.stringify(origins)}})`));
  check('Repeek request recognizes already approved host grants',await popup.webContents.executeJavaScript(`chrome.permissions.request({origins:${JSON.stringify(origins)}})`));
  check('Undeclared origins remain denied',!(await popup.webContents.executeJavaScript("chrome.permissions.request({origins:['https://unapproved.invalid/*']}).catch(()=>false)")));
  await new Promise(resolve=>setTimeout(resolve,500));
  check('Repeek settings no longer show the missing permissions screen',await popup.webContents.executeJavaScript("!document.body.innerText.includes('Additional permissions required')&&!document.title.startsWith('Permissions required')"));
  check('Repeek settings keep Node disabled',await popup.webContents.executeJavaScript("typeof require==='undefined'&&typeof process==='undefined'"));
  const settingsSnapshot=await popup.webContents.executeJavaScript("({title:document.title,text:document.body.innerText.slice(0,1200)})");report.settings=settingsSnapshot;
  check('Repeek settings actually rendered content',settingsSnapshot.text.trim().length>30);
  report.success=true;
 }catch(error){report.error=error.stack;console.error(error);}
 await finish(report.success?0:1);
});
