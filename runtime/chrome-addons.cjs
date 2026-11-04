'use strict';
const path=require('node:path');
const {applySettingsLayout}=require('./settings-layout.cjs');
const {approvedPermissions,bindPermissions}=require('./chrome-permissions.cjs');
function webURL(value){const url=new URL(value);if(!['http:','https:'].includes(url.protocol))throw Error('Only HTTP(S) addon tabs are allowed');return url.href;}
function extensionAPI(ses){
  const api=typeof ses.extensions?.loadExtension==='function'&&typeof ses.extensions?.removeExtension==='function'?ses.extensions:ses;
  if(typeof api.loadExtension!=='function'||typeof api.removeExtension!=='function')throw Error('This Electron session does not support loading Chrome extensions; SDK plugins remain available');
  return api;
}
function createChromeAddons({registry,electron,extensionFactory}){
  const {BrowserWindow,dialog}=electron||require('electron');
  const ElectronChromeExtensions=extensionFactory||require('../vendor/electron-chrome-extensions').ElectronChromeExtensions;
  if(!registry)throw Error('Plugin registry required');
  const sessions=new Map(),active=new Map(),observed=new WeakSet(),managed=new Set(),popups=new Map();
  function webWindow(ses,details={}){
    const url=details.url?webURL(details.url):'about:blank';
    const win=new BrowserWindow({width:1000,height:760,show:details.active!==false,autoHideMenuBar:true,title:'Extension browser',webPreferences:{session:ses,sandbox:true,contextIsolation:true,nodeIntegration:false,webviewTag:false,webSecurity:true}});
    const id=win.webContents.id;managed.add(id);win.on('closed',()=>managed.delete(id));
    win.webContents.on('will-navigate',(event,target)=>{try{webURL(target);}catch{event.preventDefault();}});
    win.webContents.setWindowOpenHandler(details=>{try{webWindow(ses,details);}catch{}return{action:'deny'};});
    win.loadURL(url).catch(error=>{if(!win.isDestroyed())console.error('[Bridge] Extension tab:',error.message);});return win;
  }
  function ensure(ses){
    if(sessions.has(ses))return sessions.get(ses);
    if(!ses.isPersistent())throw Error('Chrome-compatible plugins need a persistent app session');
    const state={id:sessions.size+1,manager:null,extensions:extensionAPI(ses),loaded:new Map(),pending:new Map()};
    const manager=new ElectronChromeExtensions({session:ses,modulePath:path.resolve(__dirname,'../vendor/electron-chrome-extensions'),
      async createTab(details){const win=webWindow(ses,details);return[win.webContents,win];},
      selectTab(_wc,win){if(!win.isDestroyed()){if(win.isMinimized())win.restore();win.show();win.focus();}},
      removeTab(wc,win){if(!managed.has(wc.id)){queueMicrotask(()=>{if(!wc.isDestroyed()&&!win.isDestroyed())manager.addTab(wc,win);});return;}win.destroy();},
      async createWindow(details){return webWindow(ses,{url:Array.isArray(details.url)?details.url[0]:details.url,active:details.focused});},
      removeWindow(win){if(!win.isDestroyed()&&managed.has(win.webContents.id))win.destroy();},
      async requestPermissions(extension,requested){
        const loaded=[...state.loaded.values()].find(item=>item.extension.id===extension.id);
        if(!loaded||!registry.get(loaded.entry.id).enabled)return false;
        const entry=registry.get(loaded.entry.id),approved=approvedPermissions(entry);
        if((requested.origins||[]).every(p=>approved.origins.includes(p))&&(requested.permissions||[]).every(p=>approved.permissions.includes(p)))return true;
        if(requested.origins?.length||!requested.permissions?.length||requested.permissions.some(p=>p!=='clipboardWrite')||requested.permissions.some(p=>!entry.optionalPermissions.includes(p)))return false;
        const result=await dialog.showMessageBox({type:'question',title:'Bridge permission request',message:`Allow ${loaded.entry.name} to write to your clipboard?`,detail:'You can decline and keep the plugin enabled.',buttons:['Allow','Decline'],defaultId:1,cancelId:1});if(result.response===0){registry.approve(entry.id,[...new Set([...entry.grants,...requested.permissions])]);return true;}return false;
      }
    });state.manager=manager;bindPermissions(manager,registry,active);sessions.set(ses,state);
    for(const item of active.values())load(ses,state,item.entry,item.info).catch(error=>console.error('[Bridge] Plugin load:',error.message));
    return state;
  }
  function load(ses,state,entry,info){
    if(state.loaded.has(entry.id))return Promise.resolve(state.loaded.get(entry.id).extension);
    if(state.pending.has(entry.id))return state.pending.get(entry.id);
    const pending=Promise.resolve().then(()=>state.extensions.loadExtension(info.directory)).then(extension=>{
      if(entry.nativeIdentity&&extension.id!==entry.nativeIdentity){state.extensions.removeExtension(extension.id);throw Error('Extension identity differs from its manifest');}
      if(!active.has(entry.id)){state.extensions.removeExtension(extension.id);return null;}
      state.loaded.set(entry.id,{entry,info,extension});managerPermissions(state,extension);console.log(`[Bridge] Loaded ${entry.name} ${entry.version}`);return extension;
    }).finally(()=>state.pending.delete(entry.id));state.pending.set(entry.id,pending);return pending;
  }
  function managerPermissions(state,extension){state.manager.api?.permissions?.processExtension(extension);}
  async function activate(entry,info){active.set(entry.id,{entry,info});await Promise.all([...sessions].map(([ses,state])=>load(ses,state,entry,info)));}
  async function deactivate(entry){
    const hadActive=active.has(entry.id);
    active.delete(entry.id);
    for(const [key,item]of popups)if(item.id===entry.id){if(!item.window.isDestroyed())item.window.destroy();popups.delete(key);}
    for(const state of sessions.values()){await state.pending.get(entry.id)?.catch(()=>{});const item=state.loaded.get(entry.id);if(item){state.extensions.removeExtension(item.extension.id);state.loaded.delete(entry.id);}}
    return{reloadRequired:hadActive};
  }
  function observe(win){
    if(win.isDestroyed()||observed.has(win))return;
    const wc=win.webContents,prefs=wc.getLastWebPreferences();
    if(prefs.offscreen||prefs.nodeIntegration||!prefs.contextIsolation||!wc.session.isPersistent())return;
    observed.add(win);const state=ensure(wc.session);state.manager.addTab(wc,win);
    win.on('focus',()=>{if(!win.isDestroyed())state.manager.selectTab(wc);});
  }
  async function open(id,parent){
    const item=active.get(id);if(!item||!registry.get(id).enabled)throw Error('Enable this plugin before opening settings');
    if(!item.info.settingsEntry)throw Error('This plugin does not declare a settings or popup page');
    const ses=parent.webContents.session,state=ensure(ses),extension=await load(ses,state,item.entry,item.info);
    if(!extension)throw Error('Plugin was disabled');
    const key=`${state.id}:${id}`;
    const existing=popups.get(key)?.window;if(existing&&!existing.isDestroyed()){existing.show();existing.focus();return true;}
    const win=new BrowserWindow({width:640,height:820,minWidth:400,minHeight:450,parent,title:`${item.entry.name} · Settings`,autoHideMenuBar:true,backgroundColor:'#111315',webPreferences:{session:ses,sandbox:true,contextIsolation:true,nodeIntegration:false,webviewTag:false,webSecurity:true}});
    popups.set(key,{id,window:win});
    const prefix=`chrome-extension://${extension.id}/`;
    win.webContents.setWindowOpenHandler(details=>{try{webWindow(ses,details);}catch{}return{action:'deny'};});
    win.webContents.on('will-navigate',(event,url)=>{if(!url.startsWith(prefix)){event.preventDefault();try{webWindow(ses,{url});}catch{}}});
    win.webContents.on('did-finish-load',()=>applySettingsLayout(win.webContents,item.info).catch(error=>console.error('[Bridge] Settings layout:',error.message)));
    win.on('closed',()=>popups.delete(key));
    await win.loadURL(prefix+item.info.settingsEntry);await applySettingsLayout(win.webContents,item.info);return true;
  }
  return{ensure,observe,activate,deactivate,open,sessions};
}
module.exports={createChromeAddons,webURL};
