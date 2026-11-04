'use strict';
const path=require('node:path'),fs=require('node:fs');
const {pathToFileURL}=require('node:url');
const {Registry}=require('./registry.cjs');
const {PluginController}=require('./plugin-controller.cjs');
const {preparePackage}=require('./package-import.cjs');
const CHANNEL='electron-bridge:manager:v1';
function createPluginManager(options){
  const electron=options.electron||require('electron');
  const {app,BrowserWindow,session,ipcMain,dialog,Tray,Menu}=electron;
  const directory=options.directory||path.join(app.getPath('appData'),'ElectronBridge',options.adapterId);
  const registry=new Registry({directory,appId:options.adapterId,enableBundledDefaults:options.enableBundledDefaults,bundledDirectory:options.bundledDirectory||path.resolve(__dirname,'../plugins')});
  const parents=new Map(),sdk=new Map(),reloadWindows=new Set(),observed=new WeakSet();
  const managerFile=path.resolve(__dirname,'manager/index.html'),managerURL=pathToFileURL(managerFile).href;
  let window=null,tray=null,quitting=false,lastParent=null,chrome,nativeCompatibilityError=null;
  const markReload=()=>{for(const parent of parents.values())reloadWindows.add(parent.id);};
  const runtime={
    async activate(entry,info){
      if(entry.kind==='chrome-extension'){await chrome.activate(entry,info);markReload();return{reloadRequired:parents.size>0};}
      if(sdk.has(entry.id))return;
      const factory=options.sdkFactory||require('./host.cjs').createHost;
      const host=factory({adapterId:options.adapterId,storageDirectory:path.join(directory,'settings'),pluginDirectory:info.directory,grantedPermissions:entry.grants,isPageAllowed:options.isPageAllowed,standalone:false,showOnAttach:false,worldId:entry.worldId,addons:{list:()=>controller.list(),open:(id,parent)=>controller.open(id,parent)}});
      sdk.set(entry.id,host);
      for(const parent of parents.values())host.attach(parent);
    },
    async deactivate(entry){
      if(entry.kind==='chrome-extension'){const result=await chrome.deactivate(entry);if(result.reloadRequired)markReload();return result;}
      const host=sdk.get(entry.id);if(host){sdk.delete(entry.id);await host.dispose();}
      const needsReload=!!host&&(entry.permissions.includes('page.scripts')||entry.permissions.includes('page.dom'));if(needsReload)markReload();return{reloadRequired:needsReload};
    },
    async open(entry,parent){if(!parent||parent.isDestroyed())throw Error('Open a supported app window first');if(entry.kind==='chrome-extension')return chrome.open(entry.id,parent);const host=sdk.get(entry.id);if(!host)throw Error('Plugin is not running');host.attach(parent);host.openPanel();return true;}
  };
  const controller=new PluginController({registry,runtime});
  const ready=app.whenReady().then(async()=>{
    try{
      chrome=options.nativeExtensions===false?require('./disabled-native.cjs').createDisabledNative():(options.chromeFactory||require('./chrome-addons.cjs').createChromeAddons)({registry,...(options.electron?{electron:options.electron}:{})});
      chrome.ensure(session.defaultSession);
    }catch(error){
      nativeCompatibilityError=error.message;chrome=require('./disabled-native.cjs').createDisabledNative(error.message);
      console.warn('[Bridge] Native Chrome unavailable; continuing with SDK plugins:',error.message);
    }
    const result=await controller.initialize();
    ensureTray();return result;
  });
  ready.catch(error=>console.error('[Bridge] Plugin manager:',error));
  function parentWindow(){const focused=BrowserWindow.getFocusedWindow();return parents.get(focused?.id)||parents.get(lastParent)||[...parents.values()].at(-1);}
  function payload(){return{plugins:controller.list(),discoveryErrors:registry.discoveryErrors,reloadRequired:reloadWindows.size>0,pluginDirectory:registry.packages,nativeCompatibilityError};}
  function changed(){if(window&&!window.isDestroyed())window.webContents.send('electron-bridge:manager-changed');}
  function ensureTray(){if(tray)return;tray=new Tray(path.join(__dirname,'bridge-icon.png'));tray.setToolTip('Bridge Â· Plugin manager (Ctrl+Shift+B)');tray.setContextMenu(Menu.buildFromTemplate([{label:'Open Bridge plugin manager',click:()=>open().catch(console.error)}]));tray.on('click',()=>open().catch(console.error));tray.on('double-click',()=>open().catch(console.error));}
  async function open(){
    await ready;
    if(window&&!window.isDestroyed()){if(window.isMinimized())window.restore();window.show();window.focus();return window;}
    const ses=session.fromPartition('bridge-plugin-manager');
    ses.setPermissionRequestHandler((_wc,_p,callback)=>callback(false));ses.setPermissionCheckHandler(()=>false);
    ses.webRequest.onBeforeRequest((details,callback)=>callback({cancel:!details.url.startsWith(pathToFileURL(path.dirname(managerFile)+path.sep).href)}));
    window=new BrowserWindow({width:880,height:760,minWidth:580,minHeight:480,show:false,title:'Bridge Â· Plugins',backgroundColor:'#141619',autoHideMenuBar:true,webPreferences:{session:ses,preload:path.join(__dirname,'manager/preload.cjs'),sandbox:true,contextIsolation:true,nodeIntegration:false,webviewTag:false,webSecurity:true}});
    window.webContents.setWindowOpenHandler(()=>({action:'deny'}));window.webContents.on('will-navigate',event=>event.preventDefault());
    window.on('close',event=>{if(!quitting){event.preventDefault();window.hide();}});
    window.on('closed',()=>{window=null;});await window.loadURL(managerURL);window.show();return window;
  }
  function authorize(event){if(!window||window.isDestroyed()||event.sender!==window.webContents||event.senderFrame!==window.webContents.mainFrame||event.senderFrame.url!==managerURL)throw Error('Unauthorized manager request');}
  async function approve(info,verb='Enable'){
    const detail=[`${info.name} Â· ${info.version}`,`Type: ${info.kind}`,`Requested access: ${info.permissions.length?info.permissions.join(', '):'None'}`,info.optionalPermissions?.length?`Optional access: ${info.optionalPermissions.join(', ')}`:'',info.permissions.includes('page.scripts')?'Client-side scripts can read and change app page data.':'','Installed plugins do not receive Node.js or raw Electron access.'].filter(Boolean).join('\n\n');
    const result=await dialog.showMessageBox(window,{type:'question',title:`${verb} plugin`,message:`${verb} ${info.name}?`,detail,buttons:[verb,'Cancel'],defaultId:1,cancelId:1});return result.response===0;
  }
  async function install(kind){
    const result=await dialog.showOpenDialog(window,{title:kind==='zip'?'Install plugin ZIP':'Install plugin folder',properties:[kind==='zip'?'openFile':'openDirectory'],...(kind==='zip'?{filters:[{name:'Plugin ZIP',extensions:['zip']}]}:{})});
    if(result.canceled||!result.filePaths.length)return{canceled:true,...payload()};
    const prepared=preparePackage(result.filePaths[0],directory);
    try{if(!await approve(prepared.info,'Install disabled'))return{canceled:true,...payload()};registry.register(prepared.directory,{grants:prepared.info.permissions,enabled:false});changed();return payload();}finally{prepared.cleanup();}
  }
  async function dispatch(operation,args={}){
    await ready;
    if(operation==='list')return payload();
    if(operation==='installFolder')return install('folder');
    if(operation==='installZip')return install('zip');
    if(operation==='discover'){await controller.discover();changed();return payload();}
    if(operation==='setEnabled'){
      if(typeof args.enabled!=='boolean')throw Error('Expected enabled state');
      const entry=registry.get(args.id);
      if(args.enabled&&entry.permissions.some(permission=>!entry.grants.includes(permission))){if(!await approve(entry))return{canceled:true,...payload()};registry.approve(entry.id,entry.permissions);}
      try{await controller.setEnabled(args.id,args.enabled);}finally{changed();}return payload();
    }
    if(operation==='open'){await controller.open(args.id,parentWindow());return payload();}
    if(operation==='uninstall'){
      const entry=registry.get(args.id);const result=await dialog.showMessageBox(window,{type:'question',title:'Uninstall plugin',message:`Uninstall ${entry.name}?`,detail:'The plugin will be disabled and its installed package removed. Saved plugin settings are kept.',buttons:['Uninstall','Cancel'],defaultId:1,cancelId:1});
      if(result.response!==0)return{canceled:true,...payload()};await controller.uninstall(entry.id);changed();return payload();
    }
    if(operation==='reload'){
      const parent=parentWindow();if(!parent)throw Error('No supported app window');
      const result=await dialog.showMessageBox(window,{type:'question',title:'Reload app page',message:'Reload the app page to apply plugin changes?',detail:'Finish any active work first. This removes changes left by scripts and applies newly enabled Chrome extensions.',buttons:['Reload','Cancel'],defaultId:1,cancelId:1});
      if(result.response===0){parent.webContents.once('did-finish-load',()=>{reloadWindows.delete(parent.id);if(!reloadWindows.size)for(const state of controller.status.values())state.reloadRequired=false;changed();});parent.webContents.reload();}else return{canceled:true,...payload()};return payload();
    }
    throw Error('Unknown manager operation');
  }
  ipcMain.handle(CHANNEL,(event,operation,args)=>{authorize(event);return dispatch(operation,args);});
  const beforeQuit=()=>{quitting=true;};app.on('before-quit',beforeQuit);
  function observe(parent){
    if(parent.isDestroyed()||observed.has(parent))return;observed.add(parent);
    const wc=parent.webContents,prefs=wc.getLastWebPreferences();if(prefs.offscreen)return;
    const input=(event,key)=>{if(key.type==='keyDown'&&!key.isAutoRepeat&&key.control&&key.shift&&!key.alt&&!key.meta&&key.key.toLowerCase()==='b'){event.preventDefault();if(parents.has(parent.id))lastParent=parent.id;open().catch(console.error);}};
    wc.on('before-input-event',input);parent.once('closed',()=>wc.removeListener('before-input-event',input));
    // App-owned loaders may have Node enabled. Reopening trusted manager UI grants
    // no extension access to those windows; only safe approved pages attach below.
    if(prefs.nodeIntegration||!prefs.contextIsolation)return;
    ready.then(()=>{if(!parent.isDestroyed())chrome.observe(parent);}).catch(()=>{});
    const attach=()=>{if(parent.isDestroyed()||!options.isPageAllowed(wc.getURL())||parents.has(parent.id))return;parents.set(parent.id,parent);lastParent=parent.id;ready.then(()=>{for(const host of sdk.values())host.attach(parent);changed();}).catch(()=>{});};
    wc.on('did-finish-load',attach);wc.on('did-navigate-in-page',attach);
    parent.on('focus',()=>{if(parents.has(parent.id))lastParent=parent.id;});
    parent.on('closed',()=>{parents.delete(parent.id);reloadWindows.delete(parent.id);wc.removeListener('before-input-event',input);wc.removeListener('did-finish-load',attach);wc.removeListener('did-navigate-in-page',attach);});attach();
  }
  async function dispose(){quitting=true;await ready.catch(()=>{});for(const entry of registry.list())await runtime.deactivate(entry).catch(()=>{});ipcMain.removeHandler(CHANNEL);app.removeListener('before-quit',beforeQuit);if(window&&!window.isDestroyed())window.destroy();if(tray){tray.destroy();tray=null;}}
  return{ready,open,observe,registry,controller,dispatch,payload,dispose};
}
module.exports={createPluginManager};
