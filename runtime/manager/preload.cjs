'use strict';
const {contextBridge,ipcRenderer}=require('electron');
const invoke=(operation,args={})=>ipcRenderer.invoke('electron-bridge:manager:v1',operation,args);
contextBridge.exposeInMainWorld('bridgeManager',Object.freeze({
  list:()=>invoke('list'),installFolder:()=>invoke('installFolder'),installZip:()=>invoke('installZip'),discover:()=>invoke('discover'),
  setEnabled:(id,enabled)=>invoke('setEnabled',{id,enabled}),open:id=>invoke('open',{id}),uninstall:id=>invoke('uninstall',{id}),reload:()=>invoke('reload'),
  onChanged:callback=>{if(typeof callback!=='function')throw Error('Expected callback');const listener=()=>callback();ipcRenderer.on('electron-bridge:manager-changed',listener);return()=>ipcRenderer.removeListener('electron-bridge:manager-changed',listener);}
}));
