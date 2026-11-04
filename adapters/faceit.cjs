'use strict';
const {app,BrowserWindow}=require('electron');
function isFaceitPage(value){try{const url=new URL(value);return url.protocol==='https:'&&url.hostname==='www.faceit.com';}catch{return false;}}
function install(options={}){
  const manager=require('../runtime/plugin-manager.cjs').createPluginManager({adapterId:'faceit',isPageAllowed:isFaceitPage,...options});
  app.on('browser-window-created',(_event,window)=>manager.observe(window));
  app.whenReady().then(()=>BrowserWindow.getAllWindows().forEach(window=>manager.observe(window)));
  return manager;
}
module.exports={install,isFaceitPage};
