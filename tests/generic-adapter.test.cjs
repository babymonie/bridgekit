'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {fakeElectron}=require('./helpers/fake-electron.cjs');
const {Registry}=require('../runtime/registry.cjs');
const {install}=require('../adapters/generic.cjs');
test('generic adapter runs SDK-only with ephemeral sessions and app-specific state',async t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'generic-adapter-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const fake=fakeElectron(root);fake.electron.session.defaultSession.isPersistent=()=>false;
  const profile={schemaVersion:1,appId:'generic-example',name:'Generic Example',archive:path.join(root,'app.asar'),executable:path.join(root,'Example.exe'),sha256:'a'.repeat(64),executableSha256:'b'.repeat(64),pageAccess:{origins:['https://example.test'],localPages:[]},nativeExtensions:false};
  let nativeCalled=false;
  const manager=install(profile,{electron:fake.electron,bundledDirectory:path.join(root,'empty'),chromeFactory:()=>{nativeCalled=true;throw Error('Native host should not start');}});
  await manager.ready;t.after(()=>manager.dispose());assert.equal(nativeCalled,false);assert.equal(manager.registry.directory,path.join(root,'ElectronBridge','apps','generic-example'));
  const win=await manager.open();assert.ok(!win.isDestroyed());
});
test('app-targeted bundles are not discovered or imported into unrelated apps',t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'generic-targets-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const source=path.resolve(__dirname,'../plugins/faceit-ad-cleaner');
  const generic=new Registry({directory:path.join(root,'generic'),appId:'notes-app',bundledDirectory:path.dirname(source)});generic.discover();assert.ok(!generic.list().some(e=>e.id==='faceit-ad-cleaner'));assert.throws(()=>generic.register(source),/targets faceit/);
  const faceit=new Registry({directory:path.join(root,'faceit'),appId:'faceit'});assert.equal(faceit.register(source).id,'faceit-ad-cleaner');
});
test('generic profiles do not automatically enable bundled defaults',t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'generic-defaults-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));const bundle=path.join(root,'bundles','sample-plugin');fs.mkdirSync(bundle,{recursive:true});
  fs.writeFileSync(path.join(bundle,'manifest.json'),JSON.stringify({apiVersion:1,id:'sample-plugin',name:'Sample',version:'1',entry:'index.html',permissions:['panel']}));fs.writeFileSync(path.join(bundle,'index.html'),'Sample');fs.writeFileSync(path.join(bundle,'bridge-plugin.json'),JSON.stringify({defaultEnabled:true}));
  const registry=new Registry({directory:path.join(root,'data'),appId:'notes-app',enableBundledDefaults:false,bundledDirectory:path.join(root,'bundles')});registry.discover();assert.equal(registry.get('sample-plugin').enabled,false);assert.deepEqual(registry.get('sample-plugin').grants,[]);
});
