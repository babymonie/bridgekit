'use strict';
// Patches only generated offline fixtures, never an installed user app.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),{spawn}=require('node:child_process');
const {archive}=require('../tests/helpers/asar-fixture.cjs');
const {hash}=require('./app-inspection.cjs');
const engine=require('./patch-engine.cjs');
const ROOT=path.resolve(__dirname,'..'),output=process.env.BRIDGE_VERIFICATION_OUTPUT||ROOT;
async function child(binary,asar){return new Promise((resolve,reject)=>{const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;delete env.NODE_OPTIONS;const run=spawn(binary,[asar],{env,windowsHide:true,stdio:'inherit'}),timer=setTimeout(()=>{run.kill();reject(Error('Fixture timed out'));},25000);run.on('error',error=>{clearTimeout(timer);reject(error);});run.on('exit',code=>{clearTimeout(timer);code?reject(Error(`Fixture exited ${code}`)):resolve();});});}
async function main(){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'bridgekit-real-patch-')),binary=require('electron'),result={version:require('../package.json').version,success:false,fixtures:[]};
  try{
    for(const type of ['commonjs','module']){
      const id=`patch-check-${type}-${crypto.randomBytes(4).toString('hex')}`,folder=path.join(root,type),resources=path.join(folder,'resources');fs.mkdirSync(resources,{recursive:true});
      const file=path.join(resources,'app.asar'),reportFile=path.join(folder,'report.json'),plugin=path.join(folder,'style-plugin');fs.mkdirSync(plugin);
      fs.writeFileSync(path.join(plugin,'manifest.json'),JSON.stringify({apiVersion:1,id:'fixture-style',name:'Fixture style',version:'1',entry:'index.html',permissions:['panel','page.styles'],contentScripts:[{runAt:'document_end',css:['app.css']}]}));
      fs.writeFileSync(path.join(plugin,'index.html'),'<!doctype html><title>Fixture settings</title>Settings');fs.writeFileSync(path.join(plugin,'app.css'),'#app-main{color:rgb(1,2,3)}');
      const code=`const fs=require('node:fs'),path=require('node:path');
const {app,BrowserWindow,session}=require('electron');
const report={type:${JSON.stringify(type)},checks:[],success:false};
const beforeReady=!app.isReady();
app.setPath('userData',${JSON.stringify(path.join(folder,'profile'))});
const manager=require(path.join(path.dirname(app.getAppPath()),'bridgekit-runtime/bootstrap.cjs'));
function check(name,value){report.checks.push({name,passed:!!value});if(!value)throw Error(name);}
async function until(wc,expression){for(let i=0;i<100;i++){if(await wc.executeJavaScript(expression))return true;await new Promise(r=>setTimeout(r,20));}return false;}
app.whenReady().then(async()=>{try{
check('Original entry ran before Electron ready',beforeReady);
await manager.ready;
const ses=session.fromPartition('ephemeral-app-page');
const parent=new BrowserWindow({show:false,webPreferences:{session:ses,sandbox:true,contextIsolation:true,nodeIntegration:false}});
await parent.loadFile(path.join(app.getAppPath(),'renderer/index.html'));
check('Original local app page loaded',await parent.webContents.executeJavaScript("document.getElementById('app-main').textContent==='Original application'"));
const window=await manager.open();
check('Generic manager initialized with an ephemeral app session',!window.isDestroyed()&&!ses.isPersistent());
check('App-specific plugins do not leak into another app',!manager.registry.list().some(p=>p.id==='faceit-ad-cleaner'));
manager.registry.register(${JSON.stringify(plugin)},{grants:['panel','page.styles']});
await window.webContents.executeJavaScript("bridgeManager.setEnabled('fixture-style',true)");
check('SDK style applies to the selected local page',await until(parent.webContents,"getComputedStyle(document.getElementById('app-main')).color==='rgb(1, 2, 3)'"));
await window.webContents.executeJavaScript("bridgeManager.open('fixture-style')");
const settings=BrowserWindow.getAllWindows().find(w=>w!==window&&w!==parent);
check('Plugin settings load through the generic adapter',await until(settings.webContents,"document.title==='Fixture settings'&&document.readyState==='complete'"));
check('Plugin settings retain Node isolation',await settings.webContents.executeJavaScript("typeof require==='undefined'&&typeof process==='undefined'"));
check('App renderer has no Node globals',await parent.webContents.executeJavaScript("typeof require==='undefined'&&typeof process==='undefined'"));
await window.webContents.executeJavaScript("bridgeManager.setEnabled('fixture-style',false)");
check('Disabling cleans up app styles',await parent.webContents.executeJavaScript("getComputedStyle(document.getElementById('app-main')).color!=='rgb(1, 2, 3)'"));
check('Manager survives disabling the plugin',!window.isDestroyed());
report.success=true;
}catch(error){report.error=error.stack;console.error(error);}
await manager.dispose();for(const win of BrowserWindow.getAllWindows())win.destroy();
const data=manager.registry.directory;
if(path.basename(data)===${JSON.stringify(id)}&&path.basename(path.dirname(data))==='apps')fs.rmSync(data,{recursive:true,force:true});
fs.writeFileSync(${JSON.stringify(reportFile)},JSON.stringify(report,null,2));app.exit(report.success?0:1);
});`;
      const main=type==='module'?'nested/start.mjs':'dist/main.cjs',source=type==='module'?`import {createRequire} from 'node:module';\nconst require=createRequire(import.meta.url);\n${code}`:code;
      const bytes=archive({'package.json':JSON.stringify({name:id,main,type,version:'1'}),[main]:source,'renderer/index.html':'<!doctype html><title>Generic app fixture</title><h1 id="app-main">Original application</h1>'});fs.writeFileSync(file,bytes);
      const profile={schemaVersion:1,appId:id,name:'Independent '+type+' fixture',archive:file,executable:binary,sha256:hash(file),executableSha256:hash(binary),pageAccess:{origins:[],localPages:['renderer/index.html']},nativeExtensions:false};
      await engine.apply(profile);await child(binary,file);
      const report=JSON.parse(fs.readFileSync(reportFile,'utf8'));if(!report.success)throw Error(report.error||'Fixture failed');result.fixtures.push(report);
      await engine.apply(profile,'update');await engine.apply(profile,'restore');
      if(!fs.readFileSync(file).equals(bytes))throw Error('Exact fixture rollback failed');report.checks.push({name:'Generic update and exact archive restore',passed:true});
    }
    result.success=true;
  }catch(error){result.error=error.stack;console.error(error);process.exitCode=1;}
  fs.writeFileSync(path.join(output,'patcher-verification.json'),JSON.stringify(result,null,2));
}
if(require.main===module)main();
module.exports={main};
