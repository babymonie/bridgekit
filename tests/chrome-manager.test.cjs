'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {fakeElectron}=require('./helpers/fake-electron.cjs');const {Registry}=require('../runtime/registry.cjs');const {createChromeAddons}=require('../runtime/chrome-addons.cjs');

test('legacy Electron session methods support load, settings and removal without session.extensions',async t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'bridge-legacy-chrome-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));const registry=new Registry({directory:path.join(root,'data')});
 registry.register(path.resolve(__dirname,'../plugins/wand-session-planner'),{grants:['storage'],enabled:true});
 const fake=fakeElectron(root),ses=fake.electron.session.defaultSession,modern=ses.extensions;
 ses.loadExtension=function(folder){assert.equal(this,ses);return modern.loadExtension(folder);};ses.removeExtension=function(id){assert.equal(this,ses);return modern.removeExtension(id);};delete ses.extensions;
 class Extensions{addTab(){}selectTab(){}}
 const host=createChromeAddons({registry,electron:fake.electron,extensionFactory:Extensions});host.ensure(ses);const entry=registry.get('wand-session-planner');await host.activate(entry,registry.package(entry.id));assert.equal(ses.loaded.size,1);
 const parent=new fake.electron.BrowserWindow({webPreferences:{session:ses}});host.observe(parent);await host.open(entry.id,parent);assert.match(fake.windows.at(-1).webContents.getURL(),/index.html$/);
 await host.deactivate(entry);assert.equal(ses.loaded.size,0);
});
test('generic Chrome host loads two unrelated packages, sizes settings, and unloads only the disabled plugin',async t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'bridge-chrome-manager-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));const registry=new Registry({directory:path.join(root,'data')});
 for(const id of ['extension-alpha','extension-beta']){const folder=path.join(root,id);fs.mkdirSync(folder);fs.writeFileSync(path.join(folder,'manifest.json'),JSON.stringify({manifest_version:3,name:id,version:'1',permissions:['storage'],options_ui:{page:'preferences.html'}}));fs.writeFileSync(path.join(folder,'preferences.html'),'<div class="layout">Settings</div>');fs.writeFileSync(path.join(folder,'layout.css'),'.layout{height:100%}');fs.writeFileSync(path.join(folder,'bridge-plugin.json'),JSON.stringify({id,settings:{css:'layout.css'}}));registry.register(folder,{grants:['storage'],enabled:true});}
 const fake=fakeElectron(root);class Extensions{constructor(options){this.options=options;this.tabs=[];}addTab(wc,win){this.tabs.push([wc,win]);}selectTab(){}}
 const host=createChromeAddons({registry,electron:fake.electron,extensionFactory:Extensions}),ses=fake.electron.session.defaultSession;host.ensure(ses);
 for(const entry of registry.list())await host.activate(entry,registry.package(entry.id));assert.equal(ses.loaded.size,2);
 const parent=new fake.electron.BrowserWindow({webPreferences:{session:ses}});host.observe(parent);await host.open('extension-beta',parent);const popup=fake.windows.at(-1);assert.match(popup.webContents.getURL(),/preferences\.html$/);assert.equal(popup.options.webPreferences.nodeIntegration,false);assert.ok(popup.webContents.css.some(css=>css.includes('.layout{height:100%}')));assert.ok(popup.webContents.css.some(css=>css.includes('body{min-height:100%')));
 registry.setEnabled('extension-beta',false);const result=await host.deactivate(registry.get('extension-beta'));assert.equal(result.reloadRequired,true);assert.equal(ses.loaded.size,1);assert.equal(popup.isDestroyed(),true);await assert.rejects(host.open('extension-beta',parent),/Enable/);await host.open('extension-alpha',parent);assert.equal(fake.windows.at(-1).isDestroyed(),false);
});
