'use strict';
const fs=require('./native-fs.cjs'),path=require('node:path'),crypto=require('node:crypto');
const {validateProfile}=require('../runtime/app-profile.cjs');
const {hash,inspect,runningProcesses}=require('./app-inspection.cjs');
const {patchGeneric}=require('./archive.cjs');
const ROOT=path.resolve(__dirname,'..'),MARKER='bridgekit-generic-v1';
function loadProfile(file){return validateProfile(JSON.parse(fs.readFileSync(file,'utf8')),path.dirname(path.resolve(file)));}
function paths(profile){const resources=fs.realpathSync(path.dirname(profile.archive));return{resources,runtime:path.join(resources,'bridgekit-runtime'),backup:profile.archive+'.bridgekit-original',lock:path.join(resources,'.bridgekit-operation.lock')};}
function inventory(root){const files={};function walk(folder){for(const item of fs.readdirSync(folder,{withFileTypes:true})){const full=path.join(folder,item.name);if(item.isSymbolicLink())throw Error('Unexpected link in runtime');if(item.isDirectory())walk(full);else if(item.isFile())files[path.relative(root,full).split(path.sep).join('/')]=hash(full);else throw Error('Unexpected runtime entry');}}walk(root);return files;}
function receipt(profile){const p=paths(profile);if(!fs.existsSync(p.runtime))return null;if(fs.lstatSync(p.runtime).isSymbolicLink()||fs.realpathSync(p.runtime)!==p.runtime)throw Error('Unexpected runtime path');const value=JSON.parse(fs.readFileSync(path.join(p.runtime,'bridgekit-install.json'),'utf8'));if(value.marker!==MARKER||value.appId!==profile.appId||value.originalSha256!==profile.sha256||!value.files||typeof value.files!=='object')throw Error('Runtime receipt does not match this profile');return value;}
function verifyOwned(profile,state){
  const p=paths(profile),files=inventory(p.runtime);delete files['bridgekit-install.json'];
  if(JSON.stringify(Object.keys(files).sort())!==JSON.stringify(Object.keys(state.files).sort()))throw Error('Missing or unowned runtime files; nothing changed');
  for(const [name,digest]of Object.entries(files))if(digest!==state.files[name])throw Error(`Modified runtime file: ${name}`);
}
function safeRemove(folder,resources){
  if(path.dirname(folder)!==resources||!/^\.bridgekit-(stage|previous|remove)-/.test(path.basename(folder)))throw Error('Refusing cleanup outside the operation workspace');
  if(!fs.existsSync(folder))return;
  if(fs.lstatSync(folder).isSymbolicLink()||fs.realpathSync(folder)!==folder)throw Error('Unexpected cleanup path');
  inventory(folder);fs.rmSync(folder,{recursive:true});
}
async function plan(input,operation='patch',services={}){
  const profile=validateProfile(input),p=paths(profile),details=await inspect(profile.archive,profile.executable),blockers=[...details.blockers];
  let state=null;try{state=receipt(profile);}catch(error){blockers.push(error.message);}
  if(fs.realpathSync(profile.archive)!==profile.archive||fs.realpathSync(profile.executable)!==profile.executable)blockers.push('Profile paths must identify the real archive/executable');
  if(details.executableSha256!==profile.executableSha256)blockers.push('App executable changed; inspect the new build');
  let running=[];try{running=(services.runningProcesses||runningProcesses)(profile);if(running.length)blockers.push('App is running; fully exit it before changing files');}catch(error){blockers.push(`Cannot establish that the app is closed: ${error.message}`);}
  if(operation==='patch'){
    if(state||details.patched||fs.existsSync(p.backup)||fs.existsSync(p.runtime))blockers.push('Existing patch/runtime/backup found; use its update or restore command');
    if(details.sha256!==profile.sha256)blockers.push('Archive differs from the reviewed profile hash');
  }else{
    if(!state)blockers.push('No matching BridgeKit installation');
    else try{
      if(details.sha256!==state.patchedSha256)throw Error('Patched archive changed');
      if(!fs.existsSync(p.backup)||fs.lstatSync(p.backup).isSymbolicLink()||hash(p.backup)!==profile.sha256)throw Error('Original backup changed or missing');
      verifyOwned(profile,state);
    }catch(error){blockers.push(error.message);}
  }
  return{operation,profile,details,state,paths:p,running,blockers,canApply:!blockers.length,changes:{archive:profile.archive,backup:p.backup,runtime:p.runtime,pageAccess:profile.pageAccess,nativeExtensions:profile.nativeExtensions},warnings:details.warnings};
}
function bootstrap(){return `'use strict';\nconst fs=require('original-fs'),path=require('node:path'),crypto=require('node:crypto');\nconst receipt=require('./bridgekit-install.json'),profile=require('./app-profile.json');\nconst archive=path.join(__dirname,'..',path.basename(profile.archive));\nconst digest=crypto.createHash('sha256').update(fs.readFileSync(archive)).digest('hex');\nif(digest!==receipt.patchedSha256)throw Error('App archive changed; BridgeKit disabled');\nmodule.exports=require('./adapters/generic.cjs').install({...profile,archive});\n`;}
function stage(profile,p,patchedSha256,previous,main,type){
  const folder=path.join(p.resources,`.bridgekit-stage-${crypto.randomUUID()}`);fs.mkdirSync(folder);
  try{
    for(const name of ['runtime','adapters','plugins','vendor'])fs.cpSync(path.join(ROOT,name),path.join(folder,name),{recursive:true,dereference:false});
    fs.writeFileSync(path.join(folder,'bootstrap.cjs'),bootstrap());
    fs.writeFileSync(path.join(folder,'app-profile.json'),JSON.stringify(profile,null,2));
    const files=inventory(folder);
    const state={marker:MARKER,appId:profile.appId,runtimeVersion:require('../package.json').version,originalSha256:profile.sha256,patchedSha256,originalMain:main,moduleType:type,installedAt:previous?.installedAt||new Date().toISOString(),updatedAt:new Date().toISOString(),files};
    fs.writeFileSync(path.join(folder,'bridgekit-install.json'),JSON.stringify(state,null,2));return folder;
  }catch(error){safeRemove(folder,p.resources);throw error;}
}
function locked(p,fn){const fd=fs.openSync(p.lock,'wx');try{fs.writeFileSync(fd,String(process.pid));return fn();}finally{fs.closeSync(fd);fs.unlinkSync(p.lock);}}
function recheck(review,services){if((services.runningProcesses||runningProcesses)(review.profile).length)throw Error('App started during the operation');if(hash(review.profile.archive)!==review.details.sha256||hash(review.profile.executable)!==review.profile.executableSha256)throw Error('App changed during the operation');}
function verifyBackup(profile,p){if(!fs.existsSync(p.backup)||fs.lstatSync(p.backup).isSymbolicLink()||hash(p.backup)!==profile.sha256)throw Error('Original backup changed or missing');}
async function apply(input,operation='patch',services={}){
  if(!['patch','update','restore'].includes(operation))throw Error('Unknown patch operation');
  const review=await plan(input,operation,services);if(!review.canApply)throw Error(review.blockers.join('\n'));
  const p=review.paths,profile=review.profile;
  return locked(p,()=>{
    recheck(review,services);
    if(operation==='restore'){
      verifyOwned(profile,review.state);
      verifyBackup(profile,p);
      const previous=path.join(p.resources,`.bridgekit-remove-${crypto.randomUUID()}`);
      fs.renameSync(p.runtime,previous);
      try{fs.renameSync(p.backup,profile.archive);}catch(error){fs.renameSync(previous,p.runtime);throw error;}
      safeRemove(previous,p.resources);return{installed:false,sha256:hash(profile.archive),settings:'Preserved'};
    }
    if(operation==='update'){
      const staging=stage(profile,p,review.state.patchedSha256,review.state,review.state.originalMain,review.state.moduleType),previous=path.join(p.resources,`.bridgekit-previous-${crypto.randomUUID()}`);
      try{recheck(review,services);verifyOwned(profile,review.state);verifyBackup(profile,p);fs.renameSync(p.runtime,previous);try{fs.renameSync(staging,p.runtime);}catch(error){fs.renameSync(previous,p.runtime);throw error;}safeRemove(previous,p.resources);}catch(error){safeRemove(staging,p.resources);throw error;}
      return{installed:true,runtimeVersion:require('../package.json').version,archiveUnchanged:true};
    }
    const patched=patchGeneric(fs.readFileSync(profile.archive)),patchedSha256=crypto.createHash('sha256').update(patched.bytes).digest('hex');
    const staging=stage(profile,p,patchedSha256,null,patched.main,patched.type),temporary=path.join(p.resources,`.bridgekit-archive-${crypto.randomUUID()}`);
    let backup=false,moved=false;
    try{
      fs.writeFileSync(temporary,patched.bytes,{flag:'wx'});
      recheck(review,services);
      fs.copyFileSync(profile.archive,p.backup,fs.constants.COPYFILE_EXCL);backup=true;
      if(hash(p.backup)!==profile.sha256)throw Error('Backup verification failed');
      fs.renameSync(staging,p.runtime);moved=true;
      recheck(review,services);fs.renameSync(temporary,profile.archive);
    }catch(error){
      if(fs.existsSync(temporary))fs.unlinkSync(temporary);safeRemove(staging,p.resources);
      if(moved){const abandoned=path.join(p.resources,`.bridgekit-remove-${crypto.randomUUID()}`);fs.renameSync(p.runtime,abandoned);safeRemove(abandoned,p.resources);}
      if(backup&&hash(profile.archive)===profile.sha256)fs.unlinkSync(p.backup);throw error;
    }
    return{installed:true,appId:profile.appId,originalMain:patched.main,moduleType:patched.type,patchedSha256,backup:p.backup,runtime:p.runtime};
  });
}
async function status(profile){const value=validateProfile(profile),p=paths(value);let state=null,error=null;try{state=receipt(value);}catch(e){error=e.message;}const digest=hash(value.archive);return{appId:value.appId,name:value.name,archive:value.archive,installed:!!state&&digest===state.patchedSha256,archiveSha256:digest,runtimeVersion:state?.runtimeVersion||null,backup:p.backup,error};}
module.exports={loadProfile,paths,plan,apply,status,inventory,MARKER};
