'use strict';
const fs=require('./native-fs.cjs'),path=require('node:path'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const {inspect,hash}=require('./app-inspection.cjs');
const preset=require('../profiles/faceit.json');
const SKIP=new Set(['node_modules','.git','temp','cache','code cache','gpucache','crashpad','user data','packages','logs','local storage','indexeddb','service worker']);
function defaultRoots(){
  const env=process.env,roots=[];
  if(process.platform==='win32'){
    roots.push(env.LOCALAPPDATA,env.ProgramFiles,env['ProgramFiles(x86)']);
    const script="$keys=@('HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*','HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*','HKLM:\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*'); @($keys | ForEach-Object { Get-ItemProperty -Path $_ -ErrorAction SilentlyContinue } | ForEach-Object { if($_.InstallLocation){[Environment]::ExpandEnvironmentVariables($_.InstallLocation)}; if($_.DisplayIcon){[Environment]::ExpandEnvironmentVariables($_.DisplayIcon)} }) | ConvertTo-Json -Compress";
    try{const raw=execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{encoding:'utf8',windowsHide:true,timeout:15000}).trim();if(raw){const values=JSON.parse(raw);for(let value of Array.isArray(values)?values:[values]){if(typeof value!=='string')continue;value=value.trim();const quoted=value.match(/^"([^"]+)"/);value=quoted?quoted[1]:value.replace(/,\s*-?\d+$/,'');if(fs.existsSync(value))roots.push(fs.statSync(value).isFile()?path.dirname(value):value);}}}catch(error){return{roots:roots.filter(Boolean),warning:'Windows install records could not be fully read: '+error.message};}
  }else if(process.platform==='linux')roots.push('/opt','/usr/lib','/usr/share',env.HOME&&path.join(env.HOME,'.local','share'));
  else roots.push('/Applications',env.HOME&&path.join(env.HOME,'Applications'));
  return{roots:roots.filter(Boolean),warning:null};
}
function faceitIntegration(details){
  let version=Object.keys(preset.builds).find(v=>preset.builds[v]===details.sha256);
  const resources=path.dirname(details.archive),receipt=path.join(resources,'bridge-runtime','bridge-install.json');
  if(!version&&fs.existsSync(receipt))try{const state=JSON.parse(fs.readFileSync(receipt,'utf8'));if(state.marker==='electron-bridge-faceit-v1'&&state.patchedSha256===details.sha256)version=Object.keys(preset.builds).find(v=>preset.builds[v]===state.originalSha256);}catch{}
  if(!version||path.basename(path.dirname(resources))!==`app-${version}`)return null;
  return{kind:'faceit-preset',version,root:path.dirname(path.dirname(resources))};
}
async function candidate(archive,executable){
  const savedConfig=path.join(path.dirname(archive),'bridgekit-runtime','app-profile.json');
  if(!executable&&fs.existsSync(savedConfig))try{const saved=require('./patch-engine.cjs').loadProfile(savedConfig);if(saved.archive===fs.realpathSync(archive))executable=saved.executable;}catch{}
  let details;
  try{details=await inspect(archive,executable);}catch(error){details={archive,executable:null,name:path.basename(path.dirname(path.dirname(archive))),blockers:[error.message],warnings:[],candidate:false};}
  const id=crypto.createHash('sha256').update(path.resolve(details.archive||archive).toLowerCase()).digest('hex').slice(0,24);
  const integration=faceitIntegration(details)||{kind:'generic'};
  let installed=false,profile=null;
  if(integration.kind==='faceit-preset')installed=!!require('./faceit.cjs').status(integration.root,integration.version).installed;
  else{
    const config=path.join(path.dirname(archive),'bridgekit-runtime','app-profile.json');
    if(fs.existsSync(config))try{const engine=require('./patch-engine.cjs');profile=engine.loadProfile(config);if(profile.archive!==details.archive||profile.executable!==details.executable)throw Error('Installed profile paths do not match this app');installed=(await engine.status(profile)).installed;if(profile.executableSha256!==details.executableSha256)details.blockers.push('App executable changed; inspect/review the new build');}catch(error){details.blockers.push('Installed profile: '+error.message);profile=null;}
    if(details.patched&&!installed)details.blockers.push('Existing bootstrap found; use its original installer or saved profile');
  }
  return{id,...details,integration,installed,profile,status:details.blockers.length?'blocked':installed?'installed':'candidate'};
}
async function scanApps(options={},progress=()=>{}){
  const defaults=options.includeDefaults===false?{roots:[],warning:null}:defaultRoots(),roots=[...defaults.roots,...options.roots||[]],seen=new Map(),archives=new Set(),unpacked=new Set(),apps=[],issues=[],queue=[];
  const maxEntries=options.maxEntries||80000,maxDepth=options.maxDepth??5;let visited=0,limited=false,depthLimited=false;
  if(defaults.warning)issues.push(defaults.warning);
  async function fileExists(file){try{const stat=await fs.promises.lstat(file);return stat.isFile()&&!stat.isSymbolicLink();}catch{return false;}}
  async function probe(folder){
    let found=false;
    for(const file of [path.join(folder,'app.asar'),path.join(folder,'resources','app.asar'),path.join(folder,'Contents','Resources','app.asar')])if(await fileExists(file)){archives.add(file);found=true;}
    for(const dir of [path.join(folder,'resources','app'),...(path.basename(folder).toLowerCase()==='resources'?[path.join(folder,'app')]:[])])if(await fileExists(path.join(dir,'package.json'))){unpacked.add(dir);found=true;}
    return found;
  }
  for(const root of [...new Set(roots)]){if(!root||root.startsWith('\\\\'))continue;const selected=path.resolve(root);if(selected===path.parse(selected).root)continue;await probe(selected);queue.push({folder:selected,depth:0});}
  // Probe every registered installation before bounded breadth-first discovery.
  // One large game/SDK directory must not starve the rest of the app catalog.
  for(let index=0;index<queue.length&&!limited;index++){
    const {folder,depth}=queue[index];if(depth>maxDepth){depthLimited=true;continue;}
    let actual,stat;try{stat=await fs.promises.lstat(folder);if(stat.isSymbolicLink()||!stat.isDirectory())continue;actual=await fs.promises.realpath(folder);}catch(error){if(issues.length<50)issues.push(`Cannot scan ${folder}: ${error.code||error.message}`);continue;}
    if(seen.has(actual)&&seen.get(actual)<=depth)continue;seen.set(actual,depth);
    if(await probe(actual))continue;
    try{
      for await(const item of await fs.promises.opendir(actual)){
        if(++visited>maxEntries){limited=true;break;}if(visited%500===0)progress({phase:'finding',visited,found:archives.size});
        if(item.isSymbolicLink())continue;
        const full=path.join(actual,item.name);
        if(item.isFile()&&item.name.toLowerCase()==='app.asar')archives.add(full);
        else if(item.isDirectory()&&!SKIP.has(item.name.toLowerCase())){
          if(item.name==='app'&&path.basename(actual).toLowerCase()==='resources'&&fs.existsSync(path.join(full,'package.json')))unpacked.add(full);
          queue.push({folder:full,depth:depth+1});
        }
        if(limited)break;
      }
    }catch(error){if(issues.length<50)issues.push(`Cannot read ${actual}: ${error.code||error.message}`);}
  }
  for(const archive of archives){progress({phase:'checking',visited,found:archives.size,checked:apps.length});const app=await candidate(archive);apps.push(app);progress({phase:'app',app});}
  for(const folder of unpacked){const archive=path.join(path.dirname(folder),'app.asar');if(archives.has(archive))continue;let manifest={};try{manifest=JSON.parse(fs.readFileSync(path.join(folder,'package.json'),'utf8'));}catch{}const app={id:crypto.createHash('sha256').update(folder).digest('hex').slice(0,24),archive:folder,name:manifest.productName||manifest.name||path.basename(path.dirname(path.dirname(folder))),version:manifest.version||null,status:'blocked',installed:false,integration:{kind:'generic'},blockers:['Unpacked resources/app layout: use source integration; the archive patcher requires app.asar'],warnings:[]};apps.push(app);progress({phase:'app',app});}
  apps.sort((a,b)=>String(a.name).localeCompare(String(b.name))||a.archive.localeCompare(b.archive));
  return{apps,visited,roots:[...seen.keys()].filter(v=>roots.some(r=>path.resolve(r)===v)),issues,limited:limited||depthLimited,depthLimited,coverage:'Known install locations and install records; portable/custom folders may need Add folder. Detection does not prove runtime compatibility.'};
}
module.exports={scanApps,candidate,defaultRoots,faceitIntegration};
