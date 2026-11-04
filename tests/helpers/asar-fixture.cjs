'use strict';
const fs=require('../../tools/native-fs.cjs'),path=require('node:path');
function archive(files){
  const header={files:{}},bodies=[];let offset=0;
  for(const [name,value]of Object.entries(files)){const parts=name.split('/'),body=Buffer.from(value);let parent=header;for(const part of parts.slice(0,-1))parent=parent.files[part]||=( {files:{}} );parent.files[parts.at(-1)]={size:body.length,offset:String(offset)};offset+=body.length;bodies.push(body);}
  const json=Buffer.from(JSON.stringify(header)),padding=(4-json.length%4)%4,pickle=Buffer.alloc(16+json.length+padding);
  pickle.writeUInt32LE(4,0);pickle.writeUInt32LE(8+json.length+padding,4);pickle.writeUInt32LE(4+json.length+padding,8);pickle.writeUInt32LE(json.length,12);json.copy(pickle,16);
  return Buffer.concat([pickle,...bodies]);
}
function fuseBinary(integrity=false){return Buffer.concat([Buffer.from('Fixture, not an executable\ndL7pKGdnNz796PbbjQWNKmHXBZaB9tsX'),Buffer.from([1,9,...Buffer.from(integrity?'100010000':'100000000')])]);}
function writeApp(root,{id='example-app',main='dist/start.cjs',type='commonjs',integrity=false}={}){
  const folder=path.join(root,id),resources=path.join(folder,'resources');fs.mkdirSync(resources,{recursive:true});
  const executable=path.join(folder,process.platform==='win32'?'Example.exe':'example-app'),file=path.join(resources,'app.asar');
  fs.writeFileSync(executable,fuseBinary(integrity),{mode:0o755});
  const files={'package.json':JSON.stringify({name:id,version:'1.0.0',main,type}),[main]:'globalThis.originalApplicationStarted=true;','renderer/index.html':'<!doctype html><title>Example app</title><h1>Original app content</h1>'};
  fs.writeFileSync(file,archive(files));return{file,executable,files};
}
module.exports={archive,fuseBinary,writeApp};
