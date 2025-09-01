
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getUsers: () => ipcRenderer.invoke('get-users'),
  loginWithCode: (code) => ipcRenderer.invoke('login-with-code', code),
  getAllProjects: () => ipcRenderer.invoke('get-all-projects'),
  getAllProjectUsers: () => ipcRenderer.invoke('get-all-project-users'),
  getAllProjectRoles: () => ipcRenderer.invoke('get-ref-project-roles'),

  startUnallocated: (userId) => ipcRenderer.invoke('start-unallocated', userId),
  completeActiveActivity: (payload) => ipcRenderer.invoke('complete-activity', payload),
  syncQueue: () => ipcRenderer.invoke('sync-queue'),
});
