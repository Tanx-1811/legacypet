// What the desktop app adds to its pages. Kept tiny on purpose: everything else goes through
// the app's local API, the same one `legacypet app` serves in a browser.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('legacypetDesktop', {
  platform: process.platform,
  showMain: (hash) => ipcRenderer.send('legacypet:show-main', typeof hash === 'string' ? hash : ''),
});
