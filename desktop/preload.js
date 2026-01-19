// Preload script for security
// This runs in an isolated context before the web page loads

const { contextBridge } = require('electron');

// Expose limited APIs to the renderer process if needed
contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  isElectron: true
});
