'use strict';
const {EventEmitter}=require('node:events');const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
function fakeElectron(directory){
  let sequence=0;const windows=[],sessions=new Map(),handlers=new Map();
  class Session extends EventEmitter{
    constructor(partition){super();this.partition=partition;this.loaded=new Map();this.removed=[];this.extensions={loadExtension:async folder=>{const manifest=JSON.parse(fs.readFileSync(path.join(folder,'manifest.json'),'utf8'));const digest=crypto.createHash('sha256').update(manifest.key?Buffer.from(manifest.key,'base64'):Buffer.from(folder)).digest('hex').slice(0,32);const id=[...digest].map(c=>String.fromCharCode(97+parseInt(c,16))).join('');const extension={id,name:manifest.name,version:manifest.version};this.loaded.set(id,extension);return extension;},removeExtension:id=>{this.removed.push(id);this.loaded.delete(id);}};this.webRequest={onBeforeRequest:handler=>{this.beforeRequest=handler;},onHeadersReceived:handler=>{this.headers=handler;}};}
    isPersistent(){return this.partition.startsWith('persist:');}setPermissionRequestHandler(){}setPermissionCheckHandler(){}
  }
  const session={fromPartition(name){if(!sessions.has(name))sessions.set(name,new Session(name));return sessions.get(name);}};session.defaultSession=session.fromPartition('persist:default');
  class Contents extends EventEmitter{
    constructor(prefs){super();this.id=++sequence;this.prefs={sandbox:true,contextIsolation:true,nodeIntegration:false,...prefs};this.session=prefs.session||session.defaultSession;this.mainFrame={url:''};this.destroyed=false;this.sent=[];this.css=[];}
    getURL(){return this.mainFrame.url;}getTitle(){return this.title||'App';}getLastWebPreferences(){return this.prefs;}isDestroyed(){return this.destroyed;}
    send(...args){this.sent.push(args);}setWindowOpenHandler(handler){this.openHandler=handler;}
    async insertCSS(css){this.css.push(css);return`css-${this.css.length}`;}async removeInsertedCSS(){}
    reload(){queueMicrotask(()=>this.emit('did-finish-load'));}async executeJavaScriptInIsolatedWorld(world,scripts){this.world=world;this.scripts=scripts;return 'true';}
  }
  class Window extends EventEmitter{
    constructor(options={}){super();this.id=++sequence;this.options=options;this.webContents=new Contents(options.webPreferences||{});this.visible=options.show!==false;this.destroyed=false;this.bounds={x:0,y:0,width:options.width||800,height:options.height||600};windows.push(this);}
    static getFocusedWindow(){return Window.focused;}static getAllWindows(){return windows.filter(w=>!w.destroyed);}
    async loadURL(url){this.webContents.mainFrame.url=url;this.webContents.emit('did-finish-load');this.emit('ready-to-show');}async loadFile(file){return this.loadURL(require('node:url').pathToFileURL(file).href);}
    isDestroyed(){return this.destroyed;}isVisible(){return this.visible;}isMinimized(){return false;}restore(){}show(){this.visible=true;this.emit('show');}showInactive(){this.show();}hide(){this.visible=false;this.emit('hide');}focus(){Window.focused=this;this.emit('focus');}getBounds(){return this.bounds;}setPosition(x,y){this.bounds.x=x;this.bounds.y=y;}
    close(){const event={preventDefault(){this.prevented=true;}};this.emit('close',event);if(!event.prevented)this.destroy();}
    destroy(){if(this.destroyed)return;this.destroyed=true;this.webContents.destroyed=true;this.emit('closed');}
  }
  class Tray extends EventEmitter{constructor(){super();this.destroyed=false;}setToolTip(value){this.tooltip=value;}setContextMenu(value){this.menu=value;}destroy(){this.destroyed=true;}}
  const app=new EventEmitter();app.whenReady=()=>Promise.resolve();app.getPath=()=>directory;
  const dialog={response:0,openPaths:[],async showMessageBox(){return{response:this.response};},async showOpenDialog(){return{canceled:!this.openPaths.length,filePaths:this.openPaths};}};
  const electron={app,BrowserWindow:Window,session,dialog,Tray,Menu:{buildFromTemplate:items=>({items})},ipcMain:{handle(name,handler){if(handlers.has(name))throw Error('Duplicate IPC handler');handlers.set(name,handler);},removeHandler(name){handlers.delete(name);}},screen:{getDisplayMatching:()=>({workArea:{x:0,y:0,width:1600,height:1000}})}};
  return{electron,windows,sessions,handlers};
}
module.exports={fakeElectron};
