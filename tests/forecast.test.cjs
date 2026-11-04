'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../plugins/faceit-forecast');
const available=fs.existsSync(path.join(root,'manifest.json'));
const optional={skip:available?false:'Optional user-supplied FORECAST package is not included'};
const manifest=available?JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8')):{};
const receipt=available?JSON.parse(fs.readFileSync(path.join(root,'bridge-plugin.json'),'utf8')):{};
test('FORECAST original application code and assets are preserved',optional,()=>{
 for(const [file,digest] of Object.entries(receipt.sourceFiles)){
  if(file==='manifest.json')continue;
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex'),digest,file);
 }
});
test('FORECAST identity and execution worlds are preserved',optional,()=>{
 const digest=crypto.createHash('sha256').update(Buffer.from(manifest.key,'base64')).digest('hex').slice(0,32);
 const id=[...digest].map(c=>String.fromCharCode(97+parseInt(c,16))).join('');
 assert.equal(id,receipt.extensionId);
 assert.equal(manifest.content_scripts[0].world,'MAIN');
 assert.equal(manifest.content_scripts[0].run_at,'document_start');
 assert.equal(manifest.content_scripts[1].js[0],'bridge-compat.js');
 assert.ok(manifest.content_scripts[1].js.includes('forecast.js'));
 assert.equal(manifest.background.service_worker,'src/background/worker.js');
});
test('All converted manifest entry points exist',optional,()=>{
 const files=[manifest.action.default_popup,manifest.background.service_worker,...manifest.content_scripts.flatMap(s=>s.js)];
 for(const file of files)assert.ok(fs.statSync(path.join(root,file)).isFile(),file);
});
