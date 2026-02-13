
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  initLocalDb: () => ipcRenderer.invoke('init-local-db'),

  getUsers: () => ipcRenderer.invoke('get-users'),
  loginWithCode: (code) => ipcRenderer.invoke('login-with-code', code),
  getAllProjects: () => ipcRenderer.invoke('get-all-projects'),
  getAllProjectUsers: () => ipcRenderer.invoke('get-all-project-users'),
  getAllProjectRoles: () => ipcRenderer.invoke('get-ref-project-roles'),

  getAllTasks: () => ipcRenderer.invoke('get-all-tasks'),
  getItemTypes: () => ipcRenderer.invoke('get-item-types'),
  getAllProjectTasks: () => ipcRenderer.invoke('get-all-project-tasks'),
  getAllProjectTaskRoles: () => ipcRenderer.invoke('get-all-project-task-roles'),
  getAllCustomers: () => ipcRenderer.invoke('get-all-customers'),
  getProjectTaskData: (projectId, taskId) =>
    ipcRenderer.invoke('get-project-task-data', { projectId, taskId }),
  saveTaskData: (payload) => ipcRenderer.invoke('save-task-data', payload),
  getAvailableTasks: (userId, projectId) => ipcRenderer.invoke('get-available-tasks', { userId, projectId }),
  getProjectItems: (projectId, projectTypeId) => ipcRenderer.invoke('get-project-items', { projectId, projectTypeId }),
  getItemTrackingTasks: (projectId) => ipcRenderer.invoke('get-item-tracking-tasks', { projectId }),
  getItemStatusRule: (projectId, taskId, applyAfterFinish) =>
    ipcRenderer.invoke('get-item-status-rule', { projectId, taskId, applyAfterFinish }),
  updateItemStatus: (itemId, statusId) => ipcRenderer.invoke('update-item-status', { itemId, statusId }),
  getUnfinishedTasks: (userId) => ipcRenderer.invoke('get-unfinished-tasks', { userId }),
  getAssignments: (userId) => ipcRenderer.invoke('get-assignments', { userId }),
  markAssignmentAccepted: (assignmentId) =>
    ipcRenderer.invoke('mark-assignment-accepted', { assignmentId }),
  markUnfinishedFinished: (recordId, uuid) =>
    ipcRenderer.invoke('mark-unfinished-finished', { recordId, uuid }),

  startUnallocated: (userId, activityId) => ipcRenderer.invoke('start-unallocated', { userId, activityId }),
  startTaskActivity: (userId, projectId, taskId, itemId) =>
    ipcRenderer.invoke('start-task-activity', { userId, projectId, taskId, itemId }),
  completeActiveActivity: (payload) => ipcRenderer.invoke('complete-activity', payload),
  syncQueue: () => ipcRenderer.invoke('sync-queue'),
  logout: (payload) => ipcRenderer.invoke('logout', payload),
  getBackendConnectionStatus: () => ipcRenderer.invoke('get-backend-connection-status'),
  onBackendConnectionStatus: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('backend-connection-status', listener);
    return () => ipcRenderer.removeListener('backend-connection-status', listener);
  },
  onBackendDataRefreshed: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('backend-data-refreshed', listener);
    return () => ipcRenderer.removeListener('backend-data-refreshed', listener);
  },

});
