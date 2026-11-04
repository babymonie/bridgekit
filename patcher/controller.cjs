'use strict';
const fs=require('../tools/native-fs.cjs'),path=require('node:path');
const {Worker}=require('node:worker_threads');
const scanner=require('../tools/app-scanner.cjs'),engine=require('../tools/patch-engine.cjs');
const {validateProfile}=require('../runtime/app-profile.cjs');
const {discover,runningProcesses}=require('../tools/app-inspection.cjs');
class PatcherController{
  constructor({directory,dialog,getWindow,notify=()=>{},engineApi=engine}){this.directory=directory;this.dialog=dialog;this.getWindow=getWindow;this.notify=notify;this.engine=engineApi;this.apps=new Map();this.extraRoots=new Set();this.worker=null;this.busy=false;}
  list(){return[...this.apps.values()].sort((a,b)=>String(a.name).localeCompare(String(b.name))||a.archive.localeCompare(b.archive));}
  async scan(roots,includeDefaults=true){
    if(this.worker||this.busy)throw Error('An operation is already running');
    if(includeDefaults)this.apps.clear();
    return new Promise((resolve,reject)=>{
      const worker=new Worker(path.join(__dirname,'scan-worker.cjs'),{workerData:{roots:[...roots,...this.extraRoots],includeDefaults}});this.worker=worker;let settled=false;
      const finish=(error,value)=>{if(settled)return;settled=true;this.worker=null;error?reject(error):resolve(value);};
      worker.on('message',message=>{if(message.type==='progress'){if(message.update.phase==='app')this.apps.set(message.update.app.id,message.update.app);this.notify(message.update);}else if(message.type==='done'){for(const app of message.result.apps)this.apps.set(app.id,app);finish(null,{...message.result,apps:this.list()});}else if(message.type==='error')finish(Error(message.message));});
      worker.on('error',error=>finish(error));worker.on('exit',code=>{if(!settled)finish(Error(code?'Scan stopped':'Scan ended without a result'));});
    });
  }
  async cancel(){const worker=this.worker;if(worker)await worker.terminate();return{apps:this.list()};}
  get(id){const app=this.apps.get(id);if(!app)throw Error('Select a detected or explicitly added app');return app;}
  async details(id){const previous=this.get(id);if(!previous.archive.endsWith('.asar'))return previous;const app=await scanner.candidate(previous.archive,previous.executable);this.apps.set(app.id,app);return app;}
  async pick(kind){
    const result=await this.dialog.showOpenDialog(this.getWindow(),{title:kind==='folder'?'Choose an app installation folder':kind==='exe'?'Choose this appâ€™s executable':'Choose an app executable or app.asar',properties:[kind==='folder'?'openDirectory':'openFile']});
    if(result.canceled||!result.filePaths?.length)return{canceled:true,apps:this.list()};
    const selected=result.filePaths[0],archives=discover(selected);if(!archives.length)throw Error('No app.asar found in this location; unpacked/source integrations are not archive patch targets');
    this.extraRoots.add(fs.statSync(selected).isDirectory()?selected:path.dirname(selected));
    for(const file of archives){const app=await scanner.candidate(file,kind==='file'&&!selected.endsWith('.asar')?selected:undefined);this.apps.set(app.id,app);}
    return{apps:this.list()};
  }
  async chooseExecutable(id){const app=this.get(id),result=await this.dialog.showOpenDialog(this.getWindow(),{title:'Choose the executable that launches this app',properties:['openFile']});if(result.canceled||!result.filePaths?.length)return{canceled:true,app};const updated=await scanner.candidate(app.archive,result.filePaths[0]);this.apps.set(updated.id,updated);return{app:updated};}
  profile(app,config){
    if(app.profile)return validateProfile({...app.profile,pageAccess:config?.pageAccess||app.profile.pageAccess,nativeExtensions:config?.nativeExtensions??app.profile.nativeExtensions});
    return validateProfile({schemaVersion:1,appId:config?.appId,name:String(app.name),archive:app.archive,executable:app.executable,sha256:app.sha256,executableSha256:app.executableSha256,pageAccess:config?.pageAccess,nativeExtensions:config?.nativeExtensions===true});
  }
  async integrity(id,restore=false){
    if(this.busy||this.worker)throw Error('Wait for the current scan/operation');this.busy=true;
    try{
      const previous=this.get(id),app=await scanner.candidate(previous.archive,previous.executable);
      if(app.integration.kind!=='generic')throw Error('Integrity changes are not available for app presets');
      const other=app.blockers.filter(reason=>!reason.startsWith('Embedded ASAR integrity is enabled.'));
      if(other.length)throw Error(other.join('\n'));
      if(restore&&!app.integrityBackup)throw Error('No verified integrity backup');
      if(!restore&&(!app.fuses?.embeddedAsarIntegrity||app.installed))throw Error('Integrity preparation is not available for this app');
      if(runningProcesses(app).length)throw Error('Fully exit the app before changing integrity');
      const title=restore?'Restore original executable':'Disable ASAR integrity';
      const answer=await this.dialog.showMessageBox(this.getWindow(),{type:'warning',title:title+' · BridgeKit',message:title+': '+app.name+'?',detail:restore?`Executable: ${app.executable}\nRestores the exact saved executable. The app archive must already be restored.`:`Executable: ${app.executable}\n\nThis disables archive tamper validation and invalidates the executable’s digital signature. Vendor checks may prevent startup, and app updates may undo this change. Compatibility is not guaranteed.\n\nBridgeKit will back up the executable and change only this fuse. The archive will remain unchanged. You must review the patch separately afterward.`,buttons:[title,'Cancel'],defaultId:1,cancelId:1});
      if(answer.response!==0)return{canceled:true,apps:this.list()};
      const result=await require('../tools/integrity-change.cjs').change(app,restore);
      const updated=await scanner.candidate(app.archive,app.executable);this.apps.set(updated.id,updated);return{result,app:updated,apps:this.list(),prepared:!restore};
    }finally{this.busy=false;}
  }
  async operate(id,operation,config){
    const selected=this.get(id);if(operation==='patch'&&selected.fuses?.embeddedAsarIntegrity&&selected.blockers.length===1&&selected.blockers[0].startsWith('Embedded ASAR integrity is enabled.'))return this.integrity(id);
    if(this.busy||this.worker)throw Error('Wait for the current scan/operation');if(!['patch','update','restore'].includes(operation))throw Error('Unknown patch operation');
    this.busy=true;
    try{
      const app=this.get(id);if(app.blockers.length)throw Error(app.blockers.join('\n'));
      let profile,review,preset;
      if(app.integration.kind==='faceit-preset'){
        const api=require('../tools/faceit.cjs');preset={api,root:app.integration.root,version:app.integration.version};const current=api.status(preset.root,preset.version);if(!current.supported)throw Error('FACEIT build changed; scan again');if(runningProcesses({archive:current.archive,executable:path.resolve(current.resources,'../FACEIT.exe')}).length)throw Error('Fully exit FACEIT before changing its runtime');review={canApply:true,changes:{archive:current.archive,backup:current.backup,runtime:current.directory,pageAccess:{origins:['https://www.faceit.com'],localPages:[]},nativeExtensions:true}};
      }else{profile=operation==='restore'?app.profile:this.profile(app,config);if(!profile)throw Error('Matching installed profile is required');review=await this.engine.plan(profile,operation);if(!review.canApply)throw Error(review.blockers.join('\n'));}
      const changes=review.changes;
      const detail=`Archive: ${changes.archive}\nExecutable: ${app.executable}\nBackup: ${changes.backup}\nRuntime: ${changes.runtime}\n\nAllowed app pages: ${JSON.stringify(changes.pageAccess)}\nNative Chrome compatibility: ${changes.nativeExtensions?'on (partial)':'off'}\n\nFully close the app first. Runtime compatibility is not guaranteed by detection. Original app files and settings are preserved by the reviewed workflow.`;
      const title=operation==='patch'?'Patch':operation==='restore'?'Restore original app':'Update BridgeKit';
      const answer=await this.dialog.showMessageBox(this.getWindow(),{type:'question',title:`${title} Â· BridgeKit`,message:`${title}: ${app.name}?`,detail,buttons:[title,'Cancel'],defaultId:1,cancelId:1});
      if(answer.response!==0)return{canceled:true,apps:this.list()};
      let result;
      if(preset)result=preset.api[{patch:'install',update:'update',restore:'uninstall'}[operation]](preset.root,preset.version);
      else{
        fs.mkdirSync(this.directory,{recursive:true});const saved=path.join(this.directory,profile.appId+'.json');
        if(fs.existsSync(saved)){const existing=this.engine.loadProfile(saved);if(existing.archive!==profile.archive)throw Error('This app ID belongs to another archive; choose a unique app ID');}
        if(fs.existsSync(saved)&&fs.lstatSync(saved).isSymbolicLink())throw Error('Unexpected profile link');
        fs.writeFileSync(saved,JSON.stringify(profile,null,2)+'\n');result=await this.engine.apply(profile,operation);
      }
      const updated=await scanner.candidate(app.archive,app.executable);this.apps.set(updated.id,updated);return{result,app:updated,apps:this.list()};
    }finally{this.busy=false;}
  }
}
module.exports={PatcherController};
