'use strict';
const fs=require('node:fs');
const {entryPath}=require('./registry.cjs');
const BASE_SETTINGS_CSS='html{height:100%;width:100%;margin:0}body{min-height:100%;width:100%;margin:0;box-sizing:border-box}';
async function applySettingsLayout(webContents,info){
  await webContents.insertCSS(BASE_SETTINGS_CSS);
  if(info.settingsCss){const file=entryPath(info.directory,info.settingsCss);if(fs.statSync(file).size>65536)throw Error('Settings stylesheet too large');await webContents.insertCSS(fs.readFileSync(file,'utf8'));}
}
module.exports={applySettingsLayout,BASE_SETTINGS_CSS};
