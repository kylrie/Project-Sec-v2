const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  toggleDevTools: () => ipcRenderer.send('toggle-devtools'),
  toggleMiniMode: () => ipcRenderer.send('toggle-mini-mode'),
  onShortcut: (callback) => {
    ipcRenderer.on('hotkey-triggered', () => callback());
  },
  onWakeWordDetected: (callback) => {
    ipcRenderer.on('wake-word-detected', (_event, ...args) => callback(...args));
  }
});


