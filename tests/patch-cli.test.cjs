'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{spawnSync}=require('node:child_process');
const {writeApp}=require('./helpers/asar-fixture.cjs');
const cli=path.resolve(__dirname,'../tools/bridgekit.cjs');
function run(args){const result=spawnSync(process.execPath,[cli,...args],{encoding:'utf8',windowsHide:true});assert.equal(result.status,0,result.stderr);return result.stdout;}
test('generic CLI setup, review, patch, status and restore work for a new app without code edits',t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'bridgekit-cli-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));const app=writeApp(root),file=path.join(root,'profile.json'),original=fs.readFileSync(app.file);
  const setupOutput=run(['setup',app.file,'--exe',app.executable,'--id','cli-example','--local-page','renderer/index.html','--output',file]);assert.doesNotMatch(setupOutput,/Blocked: App is running/);assert.ok(fs.existsSync(file));assert.ok(fs.readFileSync(app.file).equals(original));
  assert.equal(JSON.parse(run(['plan',file,'--json'])).canApply,true);
  run(['patch',file,'--yes']);assert.equal(JSON.parse(run(['status',file,'--json'])).installed,true);
  run(['restore',file,'--yes']);assert.ok(fs.readFileSync(app.file).equals(original));
});
test('FACEIT remains available as a preset with its existing known builds',()=>{const preset=JSON.parse(run(['presets','--json']))[0];assert.equal(preset.id,'faceit');assert.deepEqual(preset.builds,['2.10.0','2.11.0']);});
