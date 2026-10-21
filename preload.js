const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  minimizeWindow: () => ipcRenderer.send('minimize-window'),
  closeWindow: () => ipcRenderer.send('close-window'),
  setAlwaysOnTop: (enabled) => ipcRenderer.send('toggle-always-on-top', enabled),
  setClickThrough: (enabled) => ipcRenderer.send('toggle-click-through', enabled),
  onClickThroughChanged: (callback) => ipcRenderer.on('click-through-changed', (_, val) => callback(val)),
  setContentProtection: (enabled) => ipcRenderer.send('toggle-protection', enabled),
  onProtectionStatus: (callback) => ipcRenderer.on('protection-status', (_, val) => callback(val)),
  getDesktopSources: () => ipcRenderer.invoke('get-desktop-sources')
});
