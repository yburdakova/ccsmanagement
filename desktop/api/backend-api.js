const DEFAULT_BASE_URL = 'http://localhost:4000/api';
const baseUrl = String(process.env.BACKEND_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '');

let bootstrapCache = null;
let accessToken = null;

async function request(path, options = {}) {
  const url = `${baseUrl}${path}`;
  const requestHeaders = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (accessToken && !requestHeaders.Authorization) {
    requestHeaders.Authorization = `Bearer ${accessToken}`;
  }

  const response = await fetch(url, {
    headers: requestHeaders,
    ...options,
  });

  if (!response.ok) {
    if (response.status === 401) {
      // Keep local auth state aligned with backend auth state.
      clearAccessToken();
      clearBootstrapCache();
    }
    const text = await response.text();
    throw new Error(`[backend-api] ${response.status} ${response.statusText}: ${text}`);
  }

  if (response.status === 204) return null;
  return await response.json();
}

async function getBootstrap() {
  if (!bootstrapCache) {
    bootstrapCache = await request('/desktop/bootstrap');
  }
  return bootstrapCache;
}

function clearBootstrapCache() {
  bootstrapCache = null;
}

function setAccessToken(token) {
  const normalized = String(token || '').trim();
  accessToken = normalized || null;
}

function clearAccessToken() {
  accessToken = null;
}

async function getAllUsers() {
  return (await getBootstrap()).users || [];
}

async function loginByAuthCode(code) {
  const user = await request('/desktop/login-authcode', {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
  if (user?.accessToken) {
    setAccessToken(user.accessToken);
    clearBootstrapCache();
  } else {
    clearAccessToken();
  }
  return user;
}

async function getAllProjects() {
  return (await getBootstrap()).projects || [];
}

async function getAllProjectUsers() {
  return (await getBootstrap()).projectUsers || [];
}

async function getAllProjectRoles() {
  return (await getBootstrap()).projectRoles || [];
}

async function getAllTasks() {
  return (await getBootstrap()).tasks || [];
}

async function getAllCustomers() {
  return (await getBootstrap()).customers || [];
}

async function getAllItemTypes() {
  return (await getBootstrap()).itemTypes || [];
}

async function getAllProjectTasks() {
  return (await getBootstrap()).projectTasks || [];
}

async function getAllProjectTaskRoles() {
  return (await getBootstrap()).projectTaskRoles || [];
}

async function getAllTaskDataDefinitions() {
  return (await getBootstrap()).taskDataDefinitions || [];
}

async function getAllProjectTaskData() {
  return (await getBootstrap()).projectTaskData || [];
}

async function getAllRefItemStatus() {
  return (await getBootstrap()).refItemStatus || [];
}

async function getAllCfsItems() {
  return (await getBootstrap()).cfsItems || [];
}

async function getAllImItems() {
  return (await getBootstrap()).imItems || [];
}

async function getProjectTaskDataByTask(projectId, taskId) {
  return await request(`/desktop/project-task-data?projectId=${projectId}&taskId=${taskId}`);
}

async function saveTaskDataValueGlobal({ projectId, taskId, dataDefId, valueType, value }) {
  return await request('/desktop/task-data', {
    method: 'POST',
    body: JSON.stringify({ projectId, taskId, dataDefId, valueType, value }),
  });
}

async function getAvailableTasksForUser(userId, projectId) {
  return await request(`/desktop/available-tasks?userId=${userId}&projectId=${projectId}`);
}

async function getItemsByProject(projectId) {
  return await request(`/desktop/project-items?projectId=${projectId}&projectTypeId=0`);
}

async function getCfsItemsByProject(projectId) {
  return await request(`/desktop/project-items?projectId=${projectId}&projectTypeId=1`);
}

async function getImItemsByProject(projectId) {
  return await request(`/desktop/project-items?projectId=${projectId}&projectTypeId=2`);
}

async function getItemTrackingTasksByProject(projectId) {
  return await request(`/desktop/item-tracking-tasks?projectId=${projectId}`);
}

async function getItemStatusRuleByTask(projectId, taskId, applyAfterFinish) {
  const filter = applyAfterFinish == null ? '' : `&applyAfterFinish=${applyAfterFinish}`;
  return await request(`/desktop/item-status-rule?projectId=${projectId}&taskId=${taskId}${filter}`);
}

async function updateItemStatusGlobal(itemId, statusId) {
  return await request('/desktop/item-status', {
    method: 'POST',
    body: JSON.stringify({ itemId, statusId }),
  });
}

async function getUnfinishedTasksByUser(userId) {
  return await request(`/desktop/unfinished-tasks?userId=${userId}`);
}

async function getAssignmentsByUser(userId) {
  return await request(`/desktop/assignments?userId=${userId}`);
}

async function markUnfinishedTaskFinished(recordId) {
  return await request('/desktop/unfinished-finished', {
    method: 'POST',
    body: JSON.stringify({ recordId }),
  });
}

async function markUnfinishedTaskFinishedByUuid(uuid) {
  return await request('/desktop/unfinished-finished', {
    method: 'POST',
    body: JSON.stringify({ uuid }),
  });
}

async function markAssignmentAccepted(assignmentId) {
  return await request('/desktop/assignment-accepted', {
    method: 'POST',
    body: JSON.stringify({ assignmentId }),
  });
}

async function startUnallocatedActivityGlobal(payload) {
  return await request('/desktop/activities/start-unallocated', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

async function startTaskActivityGlobal(payload) {
  return await request('/desktop/activities/start-task', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

async function completeActiveActivityGlobal(payload) {
  return await request('/desktop/activities/complete', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

module.exports = {
  clearBootstrapCache,
  setAccessToken,
  clearAccessToken,
  getAllUsers,
  loginByAuthCode,
  getAllProjects,
  getAllProjectUsers,
  getAllProjectRoles,
  getAllTasks,
  getAllCustomers,
  getAllItemTypes,
  getAllProjectTasks,
  getAllProjectTaskRoles,
  getAllTaskDataDefinitions,
  getAllProjectTaskData,
  getAllRefItemStatus,
  getAllCfsItems,
  getAllImItems,
  getProjectTaskDataByTask,
  saveTaskDataValueGlobal,
  getAvailableTasksForUser,
  getItemsByProject,
  getCfsItemsByProject,
  getImItemsByProject,
  getItemTrackingTasksByProject,
  getItemStatusRuleByTask,
  updateItemStatusGlobal,
  getUnfinishedTasksByUser,
  getAssignmentsByUser,
  markUnfinishedTaskFinished,
  markUnfinishedTaskFinishedByUuid,
  markAssignmentAccepted,
  startUnallocatedActivityGlobal,
  startTaskActivityGlobal,
  completeActiveActivityGlobal,
};

