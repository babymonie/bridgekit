'use strict';
const fs=require('node:fs'),path=require('node:path');
const {contentResourcePath}=require('./chrome-paths.cjs');
function normalizePackage(directory){
  const file=path.join(directory,'manifest.json'),manifest=JSON.parse(fs.readFileSync(file,'utf8'));
  if(manifest.manifest_version!==3)return;
  for(const script of manifest.content_scripts||[])for(const field of ['js','css'])if(script[field])script[field]=script[field].map(contentResourcePath);
  const scripts=(manifest.content_scripts||[]).filter(item=>item.world!=='MAIN'&&item.js?.length);
  if(!scripts.length){fs.writeFileSync(file,JSON.stringify(manifest,null,2));return;}
  const relative='bridge-compat-resources/content.js',target=path.join(directory,relative),code=fs.readFileSync(path.join(__dirname,'chrome-content-compat.js'));
  if(fs.existsSync(target)&&!fs.readFileSync(target).equals(code))throw Error('Package conflicts with the reserved Bridge compatibility resource');
  fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,code);
  for(const script of scripts)if(!script.js.includes(relative))script.js.unshift(relative);
  fs.writeFileSync(file,JSON.stringify(manifest,null,2));
}
module.exports={normalizePackage};
