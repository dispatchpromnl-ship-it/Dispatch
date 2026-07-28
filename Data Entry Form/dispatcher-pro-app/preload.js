const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  submitToSheets: (formData) => ipcRenderer.invoke('submit-to-sheets', formData),
});
