'use strict';
const path=require('node:path'),{pathToFileURL}=require('node:url');
const CHANNEL='bridgekit:patcher:v1';
function bindPatcherIPC({ipcMain,window,controller}){
  const entry=pathToFileURL(path.join(__dirname,'index.html')).href;
  ipcMain.handle(CHANNEL,async(event,operation,args={})=>{
    if(window.isDestroyed()||event.sender!==window.webContents||event.senderFrame!==window.webContents.mainFrame||event.senderFrame.url!==entry)throw Error('Unauthorized patcher request');
    if(operation==='list')return{apps:controller.list()};
    if(operation==='scan')return controller.scan([],true);
    if(operation==='cancel')return controller.cancel();
    if(operation==='details')return controller.details(args.id);
    if(operation==='addFolder')return controller.pick('folder');
    if(operation==='addFile')return controller.pick('file');
    if(operation==='chooseExecutable')return controller.chooseExecutable(args.id);
    if(operation==='restoreIntegrity')return controller.integrity(args.id,true);
    if(operation==='operate')return controller.operate(args.id,args.operation,args.config);
    throw Error('Unknown patcher operation');
  });
  return()=>ipcMain.removeHandler(CHANNEL);
}
module.exports={bindPatcherIPC,CHANNEL};
