'use strict';
const {app,BrowserWindow,ipcMain}=require('electron');
const fs=require('../tools/native-fs.cjs'),path=require('node:path'),os=require('node:os');
const {writeApp}=require('../tests/helpers/asar-fixture.cjs');
const {candidate}=require('../tools/app-scanner.cjs');
const {PatcherController}=require('../patcher/controller.cjs');
const {bindPatcherIPC}=require('../patcher/ipc.cjs');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'bridgekit-picker-check-')),output=process.env.BRIDGE_VERIFICATION_OUTPUT||path.resolve(__dirname,'..');
app.setPath('userData',path.join(root,'profile'));
const report={version:'0.5.0',runtime:process.versions.electron,checks:[],success:false};
function check(name,ok){report.checks.push({name,passed:!!ok});if(!ok)throw Error(name);}
async function waitFor(wc,expression){for(let i=0;i<150;i++){if(await wc.executeJavaScript(expression))return true;await new Promise(r=>setTimeout(r,30));}return false;}
let unbind,controller;
const timer=setTimeout(()=>{report.error='Timed out';finish(1);},45000);
async function finish(code){clearTimeout(timer);await controller?.cancel().catch(()=>{});unbind?.();for(const w of BrowserWindow.getAllWindows())w.destroy();fs.writeFileSync(path.join(output,'patcher-ui-verification.json'),JSON.stringify(report,null,2));app.exit(code);}
app.whenReady().then(async()=>{try{
  const fixture=writeApp(root,{id:'sample-notes'}),original=fs.readFileSync(fixture.file),blocked=writeApp(root,{id:'protected-chat',integrity:true});
  let dialogResponse=0,lastReview;
  const win=new BrowserWindow({width:1180,height:800,show:false,webPreferences:{preload:path.resolve(__dirname,'../patcher/preload.cjs'),sandbox:true,contextIsolation:true,nodeIntegration:false}});
  controller=new PatcherController({directory:path.join(root,'profiles'),dialog:{showMessageBox:async(_window,options)=>{lastReview=options;return{response:dialogResponse};}},getWindow:()=>win,notify:update=>win.webContents.send('bridgekit:scan-progress',update)});
  const scan=controller.scan.bind(controller);controller.scan=()=>scan([root],false);
  controller.apps.set('temporary',{id:'temporary',name:'Scanning fixture',archive:fixture.file,integration:{kind:'generic'},status:'candidate',blockers:[]});
  unbind=bindPatcherIPC({ipcMain,window:win,controller});await win.loadFile(path.resolve(__dirname,'../patcher/index.html'));
  check('Patcher renderer has only narrow APIs and no Node globals',await win.webContents.executeJavaScript("typeof require==='undefined'&&typeof process==='undefined'&&typeof bridgekit.scan==='function'&&typeof bridgekit.invoke==='undefined'"));
  await waitFor(win.webContents,"document.querySelectorAll('.app-row').length===1");
  controller.apps.clear();await win.webContents.executeJavaScript('bridgekit.scan()');
  check('Worker scans fixture apps from the actual desktop renderer',controller.list().length===2);
  const item=controller.list().find(a=>a.archive===fixture.file),locked=controller.list().find(a=>a.archive===blocked.file);
  check('Integrity-protected fixture is visibly blocked',locked.status==='blocked');
  if(process.platform==='win32'){
    const exeBefore=fs.readFileSync(blocked.executable),archiveBefore=fs.readFileSync(blocked.file);
    dialogResponse=1;const canceled=await win.webContents.executeJavaScript(`bridgekit.operate(${JSON.stringify(locked.id)},'patch',{})`);
    check('Canceling the native integrity warning leaves executable unchanged',canceled.canceled&&fs.readFileSync(blocked.executable).equals(exeBefore));
    dialogResponse=0;const prepared=await win.webContents.executeJavaScript(`bridgekit.operate(${JSON.stringify(locked.id)},'patch',{})`);
    check('Reviewed integrity preparation disables the fuse without patching the archive',prepared.prepared&&!controller.get(locked.id).fuses.embeddedAsarIntegrity&&fs.readFileSync(blocked.file).equals(archiveBefore)&&!controller.get(locked.id).installed);
    check('Integrity warning states signature loss and defaults to Cancel',lastReview.type==='warning'&&lastReview.defaultId===1&&lastReview.detail.includes('invalidates'));
    await win.webContents.executeJavaScript(`bridgekit.restoreIntegrity(${JSON.stringify(locked.id)})`);
    check('Desktop integrity restoration recovers the byte-identical original executable',fs.readFileSync(blocked.executable).equals(exeBefore)&&controller.get(locked.id).fuses.embeddedAsarIntegrity);
  }
  await win.webContents.executeJavaScript(`bridgekit.details(${JSON.stringify(item.id)})`);
  const config={appId:'picker-fixture',pageAccess:{origins:[],localPages:['renderer/index.html']},nativeExtensions:false};
  await win.webContents.executeJavaScript(`bridgekit.operate(${JSON.stringify(item.id)},'patch',${JSON.stringify(config)})`);
  check('Desktop controller patches a reviewed app through real IPC',controller.get(item.id).installed);
  check('Original backup is byte-identical',fs.readFileSync(fixture.file+'.bridgekit-original').equals(original));
  await win.webContents.executeJavaScript(`bridgekit.operate(${JSON.stringify(item.id)},'update',${JSON.stringify(config)})`);
  check('Desktop runtime update preserves installed state',controller.get(item.id).installed);
  await win.webContents.executeJavaScript(`bridgekit.operate(${JSON.stringify(item.id)},'restore',${JSON.stringify(config)})`);
  check('Desktop restore returns the exact original archive',fs.readFileSync(fixture.file).equals(original)&&!controller.get(item.id).installed);
  const outsider=new BrowserWindow({show:false,webPreferences:{preload:path.resolve(__dirname,'../patcher/preload.cjs'),sandbox:true,contextIsolation:true,nodeIntegration:false}});await outsider.loadURL('about:blank');
  check('An unrelated renderer cannot invoke patcher operations',await outsider.webContents.executeJavaScript("bridgekit.list().then(()=>false,error=>error.message.includes('Unauthorized'))"));
  await win.webContents.executeJavaScript('document.getElementById("scan").click()');
  await waitFor(win.webContents,"document.getElementById('notice').textContent.startsWith('Scan complete.')&&!document.getElementById('scan').disabled");
  await win.webContents.executeJavaScript("[...document.querySelectorAll('.app-row')].find(row=>row.textContent.includes('sample-notes')).click()");await waitFor(win.webContents,"!document.getElementById('selected').hidden");
  check('Picker renders a selectable app list and detail panel',await win.webContents.executeJavaScript("document.querySelectorAll('.app-row').length===2&&!document.getElementById('selected').hidden"));
  win.showInactive();
  await new Promise(resolve=>setTimeout(resolve,350));
  try{fs.writeFileSync(path.join(output,'patcher-preview.png'),(await win.webContents.capturePage()).toPNG());}catch(error){report.screenshotWarning=error.message;}
  report.success=true;
}catch(error){report.error=error.stack;console.error(error);}await finish(report.success?0:1);});
