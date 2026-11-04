'use strict';
const {contextBridge,ipcRenderer}=require('electron');
const invoke=(operation,args={})=>ipcRenderer.invoke('bridgekit:patcher:v1',operation,args);
contextBridge.exposeInMainWorld('bridgekit',Object.freeze({
  list:()=>invoke('list'),scan:()=>invoke('scan'),cancel:()=>invoke('cancel'),details:id=>invoke('details',{id}),addFolder:()=>invoke('addFolder'),addFile:()=>invoke('addFile'),chooseExecutable:id=>invoke('chooseExecutable',{id}),operate:(id,operation,config)=>invoke('operate',{id,operation,config}),
  onProgress(callback){if(typeof callback!=='function')throw Error('Expected callback');const listener=(_event,update)=>callback(update);ipcRenderer.on('bridgekit:scan-progress',listener);return()=>ipcRenderer.removeListener('bridgekit:scan-progress',listener);}
}));
