'use strict';
const fs=require('./native-fs.cjs'),path=require('node:path');
const {hash,runningProcesses}=require('./app-inspection.cjs');
const MARKER='bridgekit-integrity-v1';
function paths(executable){return{backup:executable+'.bridgekit-fuse-original',receipt:executable+'.bridgekit-fuse.json',lock:executable+'.bridgekit-fuse.lock'};}
function regular(file){if(!fs.lstatSync(file).isFile()||fs.lstatSync(file).isSymbolicLink())throw Error('Expected a regular file: '+file);}
function state(executable){const p=paths(executable);if(!fs.existsSync(p.receipt))return null;regular(p.receipt);const r=JSON.parse(fs.readFileSync(p.receipt,'utf8'));if(r.marker!==MARKER||r.executable!==executable)throw Error('Integrity receipt does not match executable');regular(p.backup);if(hash(p.backup)!==r.originalSha256||hash(executable)!==r.modifiedSha256)throw Error('Executable or integrity backup changed; refusing overwrite');return r;}
async function change(app,restore=false,services={}){
 if(process.platform!=='win32'&&!services.fixture)throw Error('Integrity changes currently support Windows only');
 const executable=app.executable;if(!executable)throw Error('Choose the actual Electron executable');regular(executable);
 if(fs.realpathSync.native(executable)!==executable)throw Error('Choose the real executable path');
 const p=paths(executable),fd=fs.openSync(p.lock,'wx');
 try{
  const closed=()=>{if((services.runningProcesses||runningProcesses)(app).length)throw Error('Fully exit the app before changing integrity');};closed();
  if(hash(executable)!==app.executableSha256)throw Error('Executable changed since inspection; refresh the app');
  const {getCurrentFuseWire,flipFuses,FuseVersion,FuseV1Options,FuseState}=await import('@electron/fuses');
  const wire=await getCurrentFuseWire(executable);
  if(restore){
   const r=state(executable);if(!r)throw Error('No managed integrity backup');
   if(app.installed||app.patched||fs.existsSync(path.join(path.dirname(app.archive),'bridgekit-runtime')))throw Error('Restore the original app archive before restoring integrity');
   if(hash(app.archive)!==r.archiveSha256)throw Error('Archive changed; cannot safely re-enable original integrity');
   closed();fs.copyFileSync(p.backup,executable);if(hash(executable)!==r.originalSha256)throw Error('Executable restore verification failed');
   fs.unlinkSync(p.receipt);fs.unlinkSync(p.backup);return{restored:true};
  }
  if(app.installed||app.patched)throw Error('Integrity preparation requires an unpatched app');
  if(wire.version!=='1'||wire[FuseV1Options.EnableEmbeddedAsarIntegrityValidation]!==FuseState.ENABLE)throw Error('Expected an enabled, supported integrity fuse');
  if(fs.existsSync(p.backup)||fs.existsSync(p.receipt))throw Error('Integrity backup already exists; refusing overwrite');
  const original=fs.readFileSync(executable),originalSha256=hash(executable),archiveSha256=hash(app.archive);
  fs.copyFileSync(executable,p.backup,fs.constants.COPYFILE_EXCL);
  if(hash(p.backup)!==originalSha256)throw Error('Integrity backup verification failed');
  try{
   closed();if(hash(executable)!==originalSha256)throw Error('Executable changed during preparation');
   const count=await flipFuses(executable,{version:FuseVersion.V1,[FuseV1Options.EnableEmbeddedAsarIntegrityValidation]:false});
   const modified=fs.readFileSync(executable),after=await getCurrentFuseWire(executable);let differences=0;
   if(original.length!==modified.length||count!==1)throw Error('Unexpected executable layout');
   for(let i=0;i<original.length;i++)if(original[i]!==modified[i]){differences++;if(original[i]!==49||modified[i]!==48)throw Error('Unexpected executable change');}
   if(differences!==1||after[4]!==FuseState.DISABLE||Object.keys(wire).some(key=>key!=='4'&&wire[key]!==after[key]))throw Error('Unexpected fuse changes');
   fs.writeFileSync(p.receipt,JSON.stringify({marker:MARKER,executable,originalSha256,modifiedSha256:hash(executable),archiveSha256,createdAt:new Date().toISOString()},null,2),{flag:'wx'});
   return{disabled:true,backup:p.backup};
  }catch(error){fs.copyFileSync(p.backup,executable);if(fs.existsSync(p.receipt))fs.unlinkSync(p.receipt);fs.unlinkSync(p.backup);throw error;}
 }finally{fs.closeSync(fd);fs.unlinkSync(p.lock);}
}
module.exports={change,state,paths};
