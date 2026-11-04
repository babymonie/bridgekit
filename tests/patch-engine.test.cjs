'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {archive,writeApp}=require('./helpers/asar-fixture.cjs');
const {member,patchGeneric,entryInfo}=require('../tools/archive.cjs');
const {inspect,discover,hash}=require('../tools/app-inspection.cjs');
const {validateProfile,isPageAllowed}=require('../runtime/app-profile.cjs');
const engine=require('../tools/patch-engine.cjs');
const closed={runningProcesses:()=>[]};
function temp(t){const root=fs.mkdtempSync(path.join(os.tmpdir(),'bridgekit-engine-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));return root;}
function profile(app,id='example-app'){return validateProfile({schemaVersion:1,appId:id,name:id,archive:app.file,executable:app.executable,sha256:hash(app.file),executableSha256:hash(app.executable),pageAccess:{origins:['https://app.example.test'],localPages:['renderer/index.html']}});}
test('general ASAR patch preserves original members with nested CommonJS and ESM entries',()=>{
  for(const [main,type]of [['out/main/start.cjs','commonjs'],['dist/start.js','module'],['app/main.mjs','commonjs']]){
    const files={'package.json':JSON.stringify({main,type}),[main]:'original bytes','other.bin':'unchanged'},original=archive(files),patched=patchGeneric(original);
    assert.equal(patched.main,main);assert.equal(patched.type,main.endsWith('.mjs')||type==='module'?'module':'commonjs');
    assert.equal(member(patched.bytes,main).toString(),'original bytes');assert.equal(member(patched.bytes,'other.bin').toString(),'unchanged');
    assert.equal(JSON.parse(member(patched.bytes,'package.json')).main,patched.entry);
    assert.match(member(patched.bytes,patched.entry).toString(),patched.type==='module'?/await import/:/require\(path.join\(__dirname/);
    assert.throws(()=>patchGeneric(patched.bytes),/existing bootstrap/);
  }
});
test('entry resolution respects implicit index, directory entries and nearest package type',()=>{
  assert.equal(entryInfo(archive({'package.json':'{}','index.js':''})).main,'index.js');
  assert.equal(entryInfo(archive({'package.json':'{"main":"dist"}','dist/index.js':''})).main,'dist/index.js');
  assert.equal(entryInfo(archive({'package.json':'{"main":"out/start.js","type":"module"}','out/package.json':'{"type":"commonjs"}','out/start.js':''})).type,'commonjs');
  for(const main of ['../outside.js','C:/outside.js','/outside.js'])assert.throws(()=>entryInfo(archive({'package.json':JSON.stringify({main})})),/inside the archive/);
});
test('profile policy scopes exact origins and selected local pages without broad file access',t=>{
  const app=writeApp(temp(t)),p=profile(app);const {pathToFileURL}=require('node:url');
  assert.ok(isPageAllowed(p,'https://app.example.test/settings'));assert.ok(!isPageAllowed(p,'https://app.example.test.evil.test/'));assert.ok(!isPageAllowed(p,'https://app.example.test:444/'));
  assert.ok(isPageAllowed(p,pathToFileURL(path.join(app.file,'renderer/index.html')).href+'#settings'));
  assert.ok(!isPageAllowed(p,pathToFileURL(path.join(path.dirname(app.file),'outside.html')).href));
  const custom={...p,pageAccess:{origins:['app://desktop'],localPages:[]}};validateProfile(custom);assert.ok(isPageAllowed(custom,'app://desktop/settings'));assert.ok(!isPageAllowed(custom,'app://desktop.evil/settings'));
  for(const access of [{origins:['https://*.example.test'],localPages:[]},{origins:['chrome-extension://anything'],localPages:[]},{origins:[],localPages:['../secret.html']},{origins:[],localPages:[]}])assert.throws(()=>validateProfile({...p,pageAccess:access}));
});
test('explicit app discovery finds multiple versions without touching archives',t=>{const root=temp(t),a=writeApp(root,{id:'app-1'}),b=writeApp(root,{id:'app-2'});assert.deepEqual(discover(root),[a.file,b.file]);assert.deepEqual(discover(a.executable),[a.file]);});
for(const moduleType of ['commonjs','module'])test(`generic ${moduleType} profile supports patch, runtime update and exact restore`,async t=>{
  const root=temp(t),app=writeApp(root,{id:'unrelated-'+moduleType,main:moduleType==='module'?'app/start.mjs':'dist/entry.cjs',type:moduleType}),p=profile(app,'unrelated-'+moduleType),original=fs.readFileSync(app.file),binary=fs.readFileSync(app.executable);
  const review=await engine.plan(p,'patch',closed);assert.ok(review.canApply,review.blockers.join('\n'));
  const result=await engine.apply(p,'patch',closed);assert.equal(result.installed,true);assert.equal((await engine.status(p)).installed,true);
  assert.ok(fs.readFileSync(result.backup).equals(original));assert.equal(member(fs.readFileSync(app.file),result.originalMain).toString(),app.files[result.originalMain]);
  const after=fs.readFileSync(app.file);await engine.apply(p,'update',closed);assert.ok(fs.readFileSync(app.file).equals(after));
  const restored=await engine.apply(p,'restore',closed);assert.equal(restored.installed,false);assert.ok(fs.readFileSync(app.file).equals(original));assert.ok(fs.readFileSync(app.executable).equals(binary));assert.ok(!fs.existsSync(result.runtime));
});
test('integrity-protected and unrecognized binaries are blocked without fuse changes',async t=>{
  const app=writeApp(temp(t),{integrity:true}),p=profile(app),before=fs.readFileSync(app.executable);const review=await engine.plan(p,'patch',closed);assert.ok(review.blockers.some(s=>s.includes('integrity is enabled')));await assert.rejects(engine.apply(p,'patch',closed),/integrity/);assert.ok(fs.readFileSync(app.executable).equals(before));
  fs.writeFileSync(app.executable,'Not Electron');const next={...p,executableSha256:hash(app.executable)};assert.ok((await engine.plan(next,'patch',closed)).blockers.some(s=>s.includes('fuse inspection unavailable')));
});
test('running processes and changed archives/executables cannot be patched',async t=>{
  const app=writeApp(temp(t)),p=profile(app);await assert.rejects(engine.apply(p,'patch',{runningProcesses:()=>[123]}),/running/);
  fs.appendFileSync(app.file,'changed');assert.ok((await engine.plan(p,'patch',closed)).blockers.some(s=>s.includes('reviewed profile hash')));assert.ok(!fs.existsSync(engine.paths(p).backup));
});
test('restore and update reject modified, missing or unowned runtime data and backup',async t=>{
  const app=writeApp(temp(t)),p=profile(app);await engine.apply(p,'patch',closed);const paths=engine.paths(p),patched=fs.readFileSync(app.file),backup=fs.readFileSync(paths.backup);
  const extra=path.join(paths.runtime,'unowned.txt');fs.writeFileSync(extra,'keep me');await assert.rejects(engine.apply(p,'restore',closed),/unowned/);assert.ok(fs.readFileSync(app.file).equals(patched));fs.unlinkSync(extra);
  fs.appendFileSync(paths.backup,'bad');await assert.rejects(engine.apply(p,'restore',closed),/backup changed/);fs.writeFileSync(paths.backup,backup);
  const owned=path.join(paths.runtime,'bootstrap.cjs'),source=fs.readFileSync(owned);fs.writeFileSync(owned,'modified');await assert.rejects(engine.apply(p,'update',closed),/Modified runtime/);fs.writeFileSync(owned,source);
  await engine.apply(p,'restore',closed);assert.ok(fs.readFileSync(app.file).equals(backup));
});
test('reviewed profile cannot silently track a changed app executable',async t=>{const app=writeApp(temp(t)),p=profile(app);fs.appendFileSync(app.executable,'changed');assert.ok((await engine.plan(p,'patch',closed)).blockers.some(s=>s.includes('executable changed')));});
test('patch operation lock prevents concurrent writes and is not deleted by a refused operation',async t=>{const app=writeApp(temp(t)),p=profile(app),lock=engine.paths(p).lock;fs.writeFileSync(lock,'other process');await assert.rejects(engine.apply(p,'patch',closed),/EEXIST/);assert.equal(fs.readFileSync(lock,'utf8'),'other process');assert.ok(!fs.existsSync(engine.paths(p).backup));});
