'use strict';
// This file is only launched by the user's explicit demo command.
if(process.argv.includes('--verify')){
  require('./main.cjs');
}else{
  const {app,BrowserWindow}=require('electron');
  const fs=require('node:fs'),path=require('node:path');
  const {pathToFileURL}=require('node:url');
  const {Registry}=require('../runtime/registry.cjs');
  const {createPluginManager}=require('../runtime/plugin-manager.cjs');
  app.setName('Bridge Manager Demo');
  app.setPath('userData',path.join(app.getPath('appData'),'ElectronBridge','manager-demo-profile'));
  app.whenReady().then(async()=>{
    const directory=path.join(app.getPath('appData'),'ElectronBridge','manager-demo');
    if(!fs.existsSync(path.join(directory,'registry.json'))){
      const registry=new Registry({directory,appId:'test-bench',enableBundledDefaults:false,bundledDirectory:path.resolve(__dirname,'../plugins')});registry.discover();for(const entry of registry.list())registry.setEnabled(entry.id,false);
    }
    const fixture=pathToFileURL(path.join(__dirname,'index.html')).href;
    const manager=createPluginManager({adapterId:'test-bench',directory,nativeExtensions:false,enableBundledDefaults:false,isPageAllowed:value=>value===fixture});
    app.on('browser-window-created',(_event,window)=>manager.observe(window));
    const parent=new BrowserWindow({width:1100,height:800,title:'Bridge · Local test bench',webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false}});
    await parent.loadURL(fixture);manager.observe(parent);await manager.ready;await manager.open();
  }).catch(error=>{console.error(error);app.exit(1);});
}
