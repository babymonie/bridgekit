'use strict';
const path = require('node:path');
const {validateProfile,isPageAllowed} = require('../runtime/app-profile.cjs');
function install(input, options = {}) {
  const profile = validateProfile(input);
  const {app,BrowserWindow} = options.electron || require('electron');
  const manager = require('../runtime/plugin-manager.cjs').createPluginManager({
    adapterId:profile.appId,
    directory:path.join(app.getPath('appData'),'ElectronBridge','apps',profile.appId),
    nativeExtensions:profile.nativeExtensions,
    enableBundledDefaults:false,
    ...options,
    isPageAllowed:value => isPageAllowed(profile,value)
  });
  app.on('browser-window-created',(_event,win)=>manager.observe(win));
  app.whenReady().then(()=>BrowserWindow.getAllWindows().forEach(win=>manager.observe(win)));
  return manager;
}
module.exports = {install};
