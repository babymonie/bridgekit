'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {inspectPackage,MAX_BYTES,MAX_FILES}=require('./registry.cjs');
function preparePackage(source,stagingRoot){
  if(fs.statSync(source).isDirectory()){
    const original=inspectPackage(source),directory=path.join(stagingRoot,`.bridge-import-${crypto.randomUUID()}`);fs.mkdirSync(directory,{recursive:true});const cleanup=()=>{if(fs.existsSync(directory))fs.rmSync(directory,{recursive:true});};
    try{for(const relative of original.files){const file=path.join(directory,relative);fs.mkdirSync(path.dirname(file),{recursive:true});fs.copyFileSync(path.join(original.directory,relative),file);}const info=inspectPackage(directory);if(info.fingerprint!==original.fingerprint)throw Error('Plugin changed while preparing installation');return{info,directory,cleanup};}catch(error){cleanup();throw error;}
  }
  if(path.extname(source).toLowerCase()!=='.zip')throw Error('Select an extracted plugin folder or ZIP package');
  if(fs.statSync(source).size>MAX_BYTES)throw Error('ZIP package is too large');
  const AdmZip=require('../vendor/adm-zip');
  const entries=new AdmZip(source).getEntries();let total=0;
  if(entries.length>MAX_FILES)throw Error('ZIP has too many files');
  for(const entry of entries){
    const name=entry.entryName;
    if(name.includes('\\')||name.includes(':')||name.includes('\0')||name.startsWith('/')||name.split('/').includes('..'))throw Error('ZIP contains an unsafe path');
    if(((entry.header.attr>>>16)&0o170000)===0o120000)throw Error('ZIP symbolic links are not supported');
    if(entry.header.flags&1)throw Error('Encrypted ZIPs are not supported');
    total+=entry.header.size;if(total>MAX_BYTES)throw Error('ZIP expands beyond the package limit');
  }
  const roots=entries.filter(e=>!e.isDirectory&&/(^|\/)manifest\.json$/.test(e.entryName)).map(e=>e.entryName.slice(0,-'manifest.json'.length));
  roots.sort((a,b)=>a.split('/').length-b.split('/').length);
  if(!roots.length||roots.filter(root=>root.split('/').length===roots[0].split('/').length).length!==1)throw Error('ZIP must contain one plugin manifest at its root or in a single enclosing folder');
  const prefix=roots[0],directory=path.join(stagingRoot,`.bridge-import-${crypto.randomUUID()}`);
  fs.mkdirSync(directory,{recursive:true});
  const cleanup=()=>{if(fs.existsSync(directory))fs.rmSync(directory,{recursive:true});};
  try{
    for(const entry of entries){if(entry.isDirectory||!entry.entryName.startsWith(prefix))continue;const relative=entry.entryName.slice(prefix.length);if(relative.split('/').includes('_metadata'))continue;if(!relative||relative.split('/').some(p=>p===''||p==='.'))throw Error('ZIP contains an invalid path');const file=path.join(directory,relative);fs.mkdirSync(path.dirname(file),{recursive:true});const bytes=entry.getData();if(bytes.length!==entry.header.size)throw Error('ZIP size mismatch');fs.writeFileSync(file,bytes,{flag:'wx'});}
    return{info:inspectPackage(directory),directory,cleanup};
  }catch(error){cleanup();throw error;}
}
module.exports={preparePackage};
