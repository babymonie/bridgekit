'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { validateManifest } = require('./broker.cjs');
const {normalizePackage}=require('./normalize-package.cjs');
const {contentResourcePath}=require('./chrome-paths.cjs');
const MAX_BYTES = 64 * 1024 * 1024, MAX_FILES = 10000;
const validId = id => typeof id === 'string' && /^[a-z][a-z0-9-]{1,63}$/.test(id);
function inside(root, target) { const rel = path.relative(root, target); return rel !== '..' && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel); }
function entryPath(root, relative) {
  if (typeof relative !== 'string' || !relative || relative.length > 240 || relative.includes('\\') || relative.includes(':') || relative.split('/').some(part => part === '..' || part === '') || path.isAbsolute(relative)) throw Error('Invalid package entry path');
  const full = fs.realpathSync(path.join(root, relative));
  if (!inside(fs.realpathSync(root), full) || !fs.statSync(full).isFile()) throw Error('Entry escapes the package');
  return full;
}
function readJSON(file) { if(fs.statSync(file).size>1024*1024)throw Error('Manifest too large');return JSON.parse(fs.readFileSync(file, 'utf8')); }
function tree(root) {
  const files = []; let bytes = 0;
  function walk(dir) { for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    if (item.name === '_metadata' || item.name.startsWith('.bridge-')) continue;
    const full = path.join(dir, item.name);
    if (item.isSymbolicLink()) throw Error('Plugin packages cannot contain symbolic links');
    if (item.isDirectory()) walk(full);
    else if (item.isFile()) { const size = fs.statSync(full).size; bytes += size; files.push(path.relative(root, full)); if(bytes>MAX_BYTES||files.length>MAX_FILES)throw Error('Plugin package exceeds size or file limit'); }
    else throw Error('Unsupported package file');
  } }
  if (fs.lstatSync(root).isSymbolicLink()) throw Error('Plugin package root cannot be a link');
  walk(root); return files.sort();
}
function inspectPackage(directory) {
  const root = fs.realpathSync(directory), files = tree(root);
  const manifest = readJSON(path.join(root, 'manifest.json'));
  const sidecar = fs.existsSync(path.join(root,'bridge-plugin.json')) ? readJSON(path.join(root,'bridge-plugin.json')) : {};
  let kind, id, permissions, optionalPermissions = [], settingsEntry, nativeIdentity = null;
  if (manifest.apiVersion === 1) {
    validateManifest(manifest); kind = 'sdk'; id = manifest.id; permissions = [...manifest.permissions]; settingsEntry = manifest.entry;
    entryPath(root, manifest.entry);
    for(const item of manifest.contentScripts || []) for(const file of [...item.js||[],...item.css||[]])entryPath(root,file);
  } else {
    if (manifest.manifest_version !== 3) throw Error('Supported packages are Bridge SDK v1 or Chrome Manifest V3');
    if (!manifest.name || !manifest.version) throw Error('Plugin name and version are required');
    kind = 'chrome-extension';
    const identity = manifest.key ? crypto.createHash('sha256').update(Buffer.from(manifest.key,'base64')).digest('hex').slice(0,32).replace(/[0-9a-f]/g,c=>String.fromCharCode(97+parseInt(c,16))) : crypto.createHash('sha256').update(String(manifest.name)+'\n'+String(manifest.author||'')).digest('hex').slice(0,24);
    nativeIdentity = manifest.key ? identity : null;
    id = validId(sidecar.id) ? sidecar.id : `chrome-${identity}`;
    permissions = [...new Set([...manifest.permissions||[],...manifest.host_permissions||[],...(manifest.content_scripts||[]).flatMap(script=>script.matches||[])])];
    if(permissions.some(p=>['nativeMessaging','debugger'].includes(p)))throw Error('This package requires a native/debugging capability that Bridge does not grant');
    optionalPermissions = [...manifest.optional_permissions||[],...manifest.optional_host_permissions||[]];
    if (permissions.some(p=>typeof p!=='string') || optionalPermissions.some(p=>typeof p!=='string')) throw Error('Invalid permissions');
    for(const item of manifest.content_scripts||[])for(const file of [...item.js||[],...item.css||[]])entryPath(root,contentResourcePath(file));
    if(manifest.background?.service_worker)entryPath(root,manifest.background.service_worker);
    settingsEntry = manifest.options_ui?.page || manifest.options_page || manifest.action?.default_popup || null;
    if(settingsEntry)entryPath(root,settingsEntry);
  }
  if (!validId(id)) throw Error('Invalid plugin ID');
  if(typeof manifest.name!=='string'||manifest.name.length>160||typeof manifest.version!=='string'||manifest.version.length>64)throw Error('Invalid plugin name or version');
  let settingsCss = null;
  if(sidecar.settings?.css){entryPath(root,sidecar.settings.css);settingsCss=sidecar.settings.css;}
  const hash = crypto.createHash('sha256');
  for(const file of files){hash.update(file.replaceAll(path.sep,'/'));hash.update(fs.readFileSync(path.join(root,file)));}
  return { id, name: manifest.name, version: manifest.version, kind, nativeIdentity, permissions, optionalPermissions, settingsEntry, settingsCss, manifest, directory: root, fingerprint: hash.digest('hex'), files, defaultEnabled: sidecar.defaultEnabled===true };
}
class Registry {
  constructor({ directory, bundledDirectory }) {
    this.directory = path.resolve(directory); this.packages = path.join(this.directory,'plugins'); this.file = path.join(this.directory,'registry.json'); this.bundledDirectory = bundledDirectory;
    fs.mkdirSync(this.packages,{recursive:true}); this.discoveryErrors=[];
    try{this.state=readJSON(this.file);if(this.state.schema!==1||!this.state.plugins||!Array.isArray(this.state.removedBundles))throw Error('Invalid registry');}
    catch(error){if(error.code!=='ENOENT')throw Error(`Cannot read plugin registry: ${error.message}`);this.state={schema:1,plugins:{},removedBundles:[]};}
  }
  save(){fs.writeFileSync(this.file+'.tmp',JSON.stringify(this.state,null,2),{mode:0o600});fs.renameSync(this.file+'.tmp',this.file);}
  get(id){if(!validId(id)||!Object.hasOwn(this.state.plugins,id))throw Error('Plugin not found');return this.state.plugins[id];}
  list(){return Object.values(this.state.plugins).map(entry=>({...entry,permissions:[...entry.permissions],grants:[...entry.grants]}));}
  package(id){const entry=this.get(id),directory=path.join(this.packages,id);if(!inside(fs.realpathSync(this.packages),fs.realpathSync(directory)))throw Error('Plugin path escapes registry');const info=inspectPackage(directory);if(info.id!==id||info.fingerprint!==entry.fingerprint)throw Error('Package files changed; reinstall to review the updated package');return info;}
  register(source,{grants=[],enabled=false,bundled=false}={}) {
    const inspected=inspectPackage(source);
    if(Object.hasOwn(this.state.plugins,inspected.id))throw Error('A plugin with this ID is already installed');
    if(inspected.nativeIdentity&&this.list().some(entry=>entry.nativeIdentity===inspected.nativeIdentity))throw Error('This Chrome extension identity is already installed');
    if(inspected.permissions.some(p=>!grants.includes(p))&&enabled)throw Error('Permissions must be approved before enabling');
    if(grants.some(p=>![...inspected.permissions,...inspected.optionalPermissions].includes(p)))throw Error('Grant not declared by this package');
    const destination=path.join(this.packages,inspected.id);
    const same=path.resolve(source)===path.resolve(destination);
    const staging=path.join(this.packages,`.bridge-stage-${crypto.randomUUID()}`);
    const previous=path.join(this.packages,`.bridge-adopt-${crypto.randomUUID()}`);
    if(fs.existsSync(destination)&&!same)throw Error('An unregistered package already occupies this ID');
    if(same&&fs.lstatSync(destination).isSymbolicLink())throw Error('Package root cannot be a symbolic link');
    fs.mkdirSync(staging);let info;
    try{
      for(const file of inspected.files){const target=path.join(staging,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.join(inspected.directory,file),target);}
      if(inspectPackage(staging).fingerprint!==inspected.fingerprint)throw Error('Package changed during installation');
      normalizePackage(staging);info=inspectPackage(staging);
      if(same)fs.renameSync(destination,previous);
      try{fs.renameSync(staging,destination);}catch(error){if(same)fs.renameSync(previous,destination);throw error;}
    }catch(error){if(fs.existsSync(staging))fs.rmSync(staging,{recursive:true});throw error;}
    const entry={id:info.id,name:info.name,version:info.version,kind:info.kind,nativeIdentity:info.nativeIdentity,permissions:info.permissions,optionalPermissions:info.optionalPermissions,grants:[...grants],enabled:!!enabled,settingsEntry:info.settingsEntry,settingsCss:info.settingsCss,fingerprint:info.fingerprint,bundled,installedAt:new Date().toISOString(),worldId:10000+crypto.randomInt(400000000)};
    while(Object.values(this.state.plugins).some(other=>other.worldId===entry.worldId))entry.worldId=10000+crypto.randomInt(400000000);
    this.state.plugins[entry.id]=entry;
    try{this.save();}catch(error){delete this.state.plugins[entry.id];fs.rmSync(destination,{recursive:true});if(same)fs.renameSync(previous,destination);throw error;}
    if(same)fs.rmSync(previous,{recursive:true});
    return entry;
  }
  discover(){
    this.discoveryErrors=[];
    const scan=(root,bundled)=>{if(!root||!fs.existsSync(root))return;for(const item of fs.readdirSync(root,{withFileTypes:true})){
      if(!item.isDirectory()||item.name.startsWith('.'))continue;
      const folder=path.join(root,item.name);if(!fs.existsSync(path.join(folder,'manifest.json')))continue;
      try{const info=inspectPackage(folder);if(Object.hasOwn(this.state.plugins,info.id)||(bundled&&this.state.removedBundles.includes(info.id)))continue;this.register(folder,{bundled,enabled:bundled&&info.defaultEnabled,grants:bundled&&info.defaultEnabled?info.permissions:[]});}
      catch(error){this.discoveryErrors.push({folder:item.name,error:error.message});}
    }};
    scan(this.packages,false);scan(this.bundledDirectory,true);
    for(const entry of this.list())try{const current=this.package(entry.id);if(current.fingerprint!==entry.fingerprint)throw Error('Package files changed; reinstall to review the updated package');}catch(error){this.discoveryErrors.push({id:entry.id,error:error.message});}
    return this.list();
  }
  approve(id,grants){const entry=this.get(id);if(entry.permissions.some(p=>!grants.includes(p))||grants.some(p=>![...entry.permissions,...entry.optionalPermissions].includes(p)))throw Error('Required permissions not approved or grant not declared');const old=entry.grants;entry.grants=[...grants];try{this.save();}catch(error){entry.grants=old;throw error;}}
  setEnabled(id,enabled){const entry=this.get(id);if(enabled){this.package(id);if(entry.permissions.some(p=>!entry.grants.includes(p)))throw Error('Permissions must be approved');}const old=entry.enabled;entry.enabled=!!enabled;try{this.save();}catch(error){entry.enabled=old;throw error;}return entry;}
  uninstall(id){
    const entry=this.get(id);if(entry.enabled)throw Error('Disable the plugin before uninstalling');
    const folder=path.join(this.packages,id);if(fs.existsSync(folder)){const actual=fs.realpathSync(folder);if(actual!==path.join(fs.realpathSync(this.packages),id))throw Error('Unexpected uninstall path');tree(actual);}
    const trash=path.join(this.packages,`.bridge-remove-${crypto.randomUUID()}`);const exists=fs.existsSync(folder);if(exists)fs.renameSync(folder,trash);
    const oldRemoved=[...this.state.removedBundles];delete this.state.plugins[id];if(!this.state.removedBundles.includes(id))this.state.removedBundles.push(id);
    try{this.save();}catch(error){this.state.plugins[id]=entry;this.state.removedBundles=oldRemoved;if(exists)fs.renameSync(trash,folder);throw error;}
    if(exists)fs.rmSync(trash,{recursive:true});return true;
  }
}
module.exports={Registry,inspectPackage,entryPath,inside,tree,MAX_BYTES,MAX_FILES};
