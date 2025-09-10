
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getUsers: () => ipcRenderer.invoke('get-users'),
  loginWithCode: (code) => ipcRenderer.invoke('login-with-code', code),
  getAllProjects: () => ipcRenderer.invoke('get-all-projects'),
  getAllProjectUsers: () => ipcRenderer.invoke('get-all-project-users'),
  getAllProjectRoles: () => ipcRenderer.invoke('get-ref-project-roles'),

  getAllTasks: () => ipcRenderer.invoke('get-all-tasks'),
  getAllProjectTasks: () => ipcRenderer.invoke('get-all-project-tasks'),
  getAllProjectTaskRoles: () => ipcRenderer.invoke('get-all-project-task-roles'),
  getAvailableTasks: (userId, projectId) => ipcRenderer.invoke('get-available-tasks', { userId, projectId }),

  startUnallocated: (userId) => ipcRenderer.invoke('start-unallocated', userId),
  completeActiveActivity: (payload) => ipcRenderer.invoke('complete-activity', payload),
  syncQueue: () => ipcRenderer.invoke('sync-queue'),
  logout: (payload) => ipcRenderer.invoke('logout', payload),

});
