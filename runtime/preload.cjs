'use strict';
// Sandboxed Electron preload: deliberately expose no IPC object or generic invoke.
const { contextBridge, ipcRenderer } = require('electron');
const channel=process.argv.find(value=>value.startsWith('--bridge-plugin-channel='))?.slice('--bridge-plugin-channel='.length)||'electron-bridge:v1';
contextBridge.exposeInMainWorld('bridge', Object.freeze({
  version: 1,
  info: () => ipcRenderer.invoke(channel, 'host.info', []),
  addons: Object.freeze({
    list: () => ipcRenderer.invoke(channel, 'addons.list', {}),
    open: id => ipcRenderer.invoke(channel, 'addons.open', { id })
  }),
  storage: Object.freeze({
    get: key => ipcRenderer.invoke(channel, 'storage.get', [key]),
    set: (key, value) => ipcRenderer.invoke(channel, 'storage.set', [key, value])
  }),
  page: Object.freeze({
    info: () => ipcRenderer.invoke(channel, 'page.info', {}),
    query: selector => ipcRenderer.invoke(channel, 'page.query', { selector }),
    setText: (selector, text) => ipcRenderer.invoke(channel, 'page.setText', { selector, text }),
    insertHTML: (selector, html, position = 'append') => ipcRenderer.invoke(channel, 'page.insertHTML', { selector, html, position }),
    remove: selector => ipcRenderer.invoke(channel, 'page.remove', { selector }),
    addStyle: options => ipcRenderer.invoke(channel, 'page.addStyle', options),
    removeStyle: id => ipcRenderer.invoke(channel, 'page.removeStyle', { id }),
    runScript: (file, args = null) => ipcRenderer.invoke(channel, 'page.runScript', { file, args }),
    cleanup: () => ipcRenderer.invoke(channel, 'page.cleanup', {}),
    onNavigate: callback => {
      if (typeof callback !== 'function') throw Error('Expected navigation callback');
      const listener = (_event, detail) => callback(detail);
      ipcRenderer.on('electron-bridge:page-navigation', listener);
      return () => ipcRenderer.removeListener('electron-bridge:page-navigation', listener);
    }
  })
}));
