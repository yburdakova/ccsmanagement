
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  initLocalDb: () => ipcRenderer.invoke('init-local-db'),

  getUsers: () => ipcRenderer.invoke('get-users'),
  loginWithCode: (code) => ipcRenderer.invoke('login-with-code', code),
  getAllProjects: () => ipcRenderer.invoke('get-all-projects'),
  getAllProjectUsers: () => ipcRenderer.invoke('get-all-project-users'),
  getAllProjectRoles: () => ipcRenderer.invoke('get-ref-project-roles'),

  getAllTasks: () => ipcRenderer.invoke('get-all-tasks'),
  getAllProjectTasks: () => ipcRenderer.invoke('get-all-project-tasks'),
  getAllProjectTaskRoles: () => ipcRenderer.invoke('get-all-project-task-roles'),
  getAvailableTasks: (userId, projectId) => ipcRenderer.invoke('get-available-tasks', { userId, projectId }),
  getProjectItems: (projectId, projectTypeId) => ipcRenderer.invoke('get-project-items', { projectId, projectTypeId }),

  startUnallocated: (userId, activityId) => ipcRenderer.invoke('start-unallocated', { userId, activityId }),
  startTaskActivity: (userId, projectId, taskId) =>
    ipcRenderer.invoke('start-task-activity', { userId, projectId, taskId }),
  completeActiveActivity: (payload) => ipcRenderer.invoke('complete-activity', payload),
  syncQueue: () => ipcRenderer.invoke('sync-queue'),
  logout: (payload) => ipcRenderer.invoke('logout', payload),

});
