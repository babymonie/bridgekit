'use strict';
const fs=require('./native-fs.cjs'),path=require('node:path'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const {entryInfo,parse}=require('./archive.cjs');
const MAX_ARCHIVE_SIZE=512*1024*1024;
function hash(file){const digest=crypto.createHash('sha256'),fd=fs.openSync(file,'r'),buffer=Buffer.alloc(1024*1024);try{let count;while((count=fs.readSync(fd,buffer,0,buffer.length,null)))digest.update(buffer.subarray(0,count));}finally{fs.closeSync(fd);}return digest.digest('hex');}
function discover(input){
  const selected=path.resolve(input),found=[];
  if(!fs.existsSync(selected))throw Error('App path does not exist');
  const stat=fs.lstatSync(selected);if(stat.isSymbolicLink())throw Error('Select the real app path, not a link');
  if(stat.isFile()&&selected.endsWith('.asar'))return[selected];
  const root=stat.isDirectory()?selected:path.dirname(selected);
  let visited=0;
  function scan(folder,depth){if(++visited>1500)throw Error('App search too broad; select its resources directory or app.asar');for(const item of fs.readdirSync(folder,{withFileTypes:true})){if(item.isSymbolicLink())continue;const full=path.join(folder,item.name);if(item.isFile()&&item.name==='app.asar')found.push(full);else if(item.isDirectory()&&depth<4&&!['node_modules','.git','Cache','User Data','locales','swiftshader'].includes(item.name))scan(full,depth+1);}}
  scan(root,0);return found.sort();
}
function executables(archive){const folder=path.dirname(path.dirname(archive));return fs.readdirSync(folder,{withFileTypes:true}).filter(item=>item.isFile()&&(process.platform==='win32'?/\.exe$/i.test(item.name)&&!/^unins|^update|^crashpad|^squirrel\.exe$/i.test(item.name):!item.name.includes('.')&&(fs.statSync(path.join(folder,item.name)).mode&0o111))).map(item=>path.join(folder,item.name));}
async function inspect(archive,executable){
  archive=fs.realpathSync.native(archive);
  const blockers=[],warnings=['Structural compatibility is not proof of app startup or plugin compatibility.'];
  if(!fs.statSync(archive).isFile()||fs.statSync(archive).size>MAX_ARCHIVE_SIZE)throw Error('Expected an ASAR file no larger than 512 MiB');
  const bytes=fs.readFileSync(archive);let entry=null,patched=false;const htmlPages=[];
  try{entry=entryInfo(bytes);const files=parse(bytes).header.files;patched=!!(files['bridge-bootstrap.cjs']||files['bridgekit-bootstrap.cjs']||files['bridgekit-bootstrap.mjs']);const collect=(items,prefix='')=>{for(const [name,file]of Object.entries(items)){if(htmlPages.length>=100)break;if(file.files)collect(file.files,prefix+name+'/');else if(name.endsWith('.html')&&!file.unpacked&&!file.link)htmlPages.push(prefix+name);}};collect(files);}catch(error){blockers.push(error.message);}
  const candidates=executables(archive);
  executable=executable?fs.realpathSync.native(executable):candidates.length===1?candidates[0]:null;
  let fuses=null;
  if(!executable)blockers.push('Choose the exact app executable with --exe');
  else try{
    const {getCurrentFuseWire,FuseState,FuseV1Options}=await import('@electron/fuses');
    const wire=await getCurrentFuseWire(executable);
    fuses={version:wire.version,embeddedAsarIntegrity:wire[FuseV1Options.EnableEmbeddedAsarIntegrityValidation]===FuseState.ENABLE};
    if(wire.version!=='1'||![FuseState.DISABLE,FuseState.ENABLE].includes(wire[FuseV1Options.EnableEmbeddedAsarIntegrityValidation]))blockers.push('ASAR integrity fuse state could not be established');
    if(fuses.embeddedAsarIntegrity)blockers.push('Embedded ASAR integrity is enabled. Review the integrity change before patching.');
  }catch(error){blockers.push(`Electron fuse inspection unavailable: ${error.message}`);}
  if(process.platform==='darwin'||archive.includes('.app'+path.sep))blockers.push('macOS bundle patching is inspection-only; signing/rollback support is not implemented');
  return{archive,executable,executableCandidates:candidates,sha256:hash(archive),executableSha256:executable?hash(executable):null,name:entry?.manifest.productName||entry?.manifest.name||path.basename(path.dirname(path.dirname(archive))),version:entry?.manifest.version||null,main:entry?.main,moduleType:entry?.type,patched,fuses,htmlPages,blockers,warnings,candidate:blockers.length===0};
}
function runningProcesses(profile){
  const archiveFolder=path.dirname(profile.archive),appFolder=path.basename(archiveFolder).toLowerCase()==='resources'?path.dirname(archiveFolder):archiveFolder;
  const appPrefix=appFolder+path.sep;
  if(process.platform==='win32'){
    const command="@(Get-CimInstance Win32_Process | Where-Object { $_.ProcessId -ne $env:BRIDGEKIT_OWNER_PID -and ($_.ExecutablePath -eq $env:BRIDGEKIT_APP_EXE -or ($_.ExecutablePath -and $_.ExecutablePath.StartsWith($env:BRIDGEKIT_APP_PREFIX,[StringComparison]::OrdinalIgnoreCase)) -or ($_.CommandLine -and $_.CommandLine.Contains($env:BRIDGEKIT_APP_ASAR))) } | Select-Object -ExpandProperty ProcessId) | ConvertTo-Json -Compress";
    const output=execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',command],{encoding:'utf8',windowsHide:true,env:{...process.env,BRIDGEKIT_OWNER_PID:String(process.pid),BRIDGEKIT_APP_EXE:profile.executable,BRIDGEKIT_APP_ASAR:profile.archive,BRIDGEKIT_APP_PREFIX:appPrefix}}).trim();
    if(!output)return[];const ids=JSON.parse(output);return Array.isArray(ids)?ids:[ids];
  }
  if(process.platform==='linux'){
    const ids=[];for(const item of fs.readdirSync('/proc'))if(/^\d+$/.test(item)&&Number(item)!==process.pid){try{const exe=fs.readlinkSync(`/proc/${item}/exe`),args=fs.readFileSync(`/proc/${item}/cmdline`,'utf8');if(exe===profile.executable||exe.startsWith(appPrefix)||args.split('\0').includes(profile.archive))ids.push(Number(item));}catch{}}
    return ids;
  }
  throw Error('Process checks support Windows and Linux only');
}
module.exports={hash,discover,executables,inspect,runningProcesses,MAX_ARCHIVE_SIZE};
