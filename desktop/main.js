const path = require('path');
const dotenv = require('dotenv');
const crypto = require('crypto');
const { app, screen, BrowserWindow, ipcMain, dialog } = require('electron'); 
const { Menu } = require('electron');
const { showUserMessage, reportException, installMainConsoleBridge } = require('./utils/desktop-error-handler');
installMainConsoleBridge();

const readPackagedEnvProfile = () => {
  try {
    const envFile = path.join(process.resourcesPath, 'app-env.json');
    const fs = require('fs');
    if (!fs.existsSync(envFile)) return null;
    const raw = fs.readFileSync(envFile, 'utf8');
    const parsed = JSON.parse(raw);
    const value = String(parsed?.APP_ENV ?? parsed?.appEnv ?? '').trim();
    return value || null;
  } catch (err) {
    console.warn('[env] Failed to read packaged app-env.json:', err.message);
    return null;
  }
};

// If packaged, load .env files from resources (they're shipped via electron-builder extraResources).
const envBase = app.isPackaged ? process.resourcesPath : __dirname;

if (!process.env.APP_ENV) {
  const fromPackaged = readPackagedEnvProfile();
  if (fromPackaged) process.env.APP_ENV = fromPackaged;
}

dotenv.config({ path: path.resolve(envBase, '.env') });

const profile = process.env.APP_ENV || 'local';

dotenv.config({
  path: path.resolve(envBase, `.env.${profile}`),
  override: true,
});

console.log(`[env] APP_ENV=${profile} DB_HOST=${process.env.DB_HOST}`);

const { isOnline } = require('./utils/network-status');
const { initializeLocalDb, syncQueue } = require('./api/db-local');
const dataApi = require('./api/data-provider');
const {
  connectDesktopWs,
  disconnectDesktopWs,
  isDesktopWsConnected,
  setDesktopWsMessageListener,
  setDesktopWsStatusListener
} = require('./ws/desktop-ws-client');

let mainWindow = null;
let lastWsConnected = false;
let reconnectSyncInProgress = false;

function getConnectionState() {
  if (profile === 'backend') {
    return { mode: 'ws', connected: isDesktopWsConnected() };
  }
  return { mode: 'network', connected: null };
}

function publishConnectionState() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send('backend-connection-status', getConnectionState());
}

async function syncAfterBackendReconnect() {
  if (reconnectSyncInProgress) return;
  reconnectSyncInProgress = true;
  try {
    if (typeof dataApi.clearBootstrapCache === 'function') {
      dataApi.clearBootstrapCache();
    }
    const queueResult = await syncQueue();
    console.log(`[main] Reconnect syncQueue: ${queueResult.synced || 0} record(s) synced`);
    await initializeLocalDb();
    console.log('[main] Reconnect initializeLocalDb completed');
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('backend-data-refreshed', { at: new Date().toISOString() });
    }
  } catch (err) {
    await reportException('Reconnect synchronization', err, { level: 'warning' });
  } finally {
    reconnectSyncInProgress = false;
  }
}

function createWindow(screenWidth) {
  let isQuitting = false;
  const win = new BrowserWindow({
    width: 400,
    height: 900,
    icon: path.join(__dirname, '/assets/LogoCC.png'),
    title: 'CCS User Desktop Module',
    x: screenWidth - 400,
    y: 10,
    alwaysOnTop: true,
    // resizable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },

  });

  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  Menu.setApplicationMenu(null);
  mainWindow = win;
  win.webContents.on('did-finish-load', () => {
    publishConnectionState();
  });

  win.on('close', (event) => {
    if (isQuitting) return;
    event.preventDefault();

    const choice = dialog.showMessageBoxSync(win, {
      type: 'warning',
      buttons: ['Cancel', 'Stop Work Time and Close the App'],
      defaultId: 0,
      cancelId: 0,
      title: 'Confirm Exit',
      message: 'Are you sure you want to close the App? Your work time will be stopped!',
    });

    if (choice === 1) {
      isQuitting = true;
      app.quit();
    }
  });
}

app.whenReady().then(async () => {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  createWindow(width);
  if (app.isPackaged) {
    const { initializeLocalDb } = require('./api/db-local');
    initializeLocalDb().catch((err) => {
      reportException('Startup local DB initialization', err, { level: 'error' }).catch(() => {});
      try {
        dialog.showMessageBoxSync({
          type: 'error',
          title: 'Local DB init failed',
          message: 'Failed to initialize local database.',
          detail: String(err?.message || err),
        });
      } catch {}
    });
  }

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

  if (profile === 'backend') {
    setDesktopWsMessageListener((event) => {
      if (event?.type !== 'db-changed') return;
      console.log('[main] WS db-changed event received, refreshing local cache');
      syncAfterBackendReconnect().catch((err) => {
        reportException('WS db-changed refresh', err, { level: 'warning' });
      });
    });

    setDesktopWsStatusListener(({ connected }) => {
      publishConnectionState();
      const nextConnected = Boolean(connected);
      if (nextConnected && !lastWsConnected) {
        syncAfterBackendReconnect().catch((err) => {
          reportException('Reconnect sync scheduling', err, { level: 'warning' });
        });
      }
      lastWsConnected = nextConnected;
    });
  }
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('init-local-db', async () => {
  const { initializeLocalDb } = require('./api/db-local');
  try {
    if (typeof dataApi.clearBootstrapCache === 'function') {
      dataApi.clearBootstrapCache();
    }
    await initializeLocalDb();
    return { success: true };
  } catch (err) {
    await reportException('Local DB initialization', err, { level: 'error' });
    return { success: false, error: err.message };
  }
});

ipcMain.handle('show-user-message', async (_event, payload) => {
  try {
    return await showUserMessage(payload || {});
  } catch (err) {
    console.error('[main] show-user-message failed:', err.message);
    return { shown: false, error: err.message };
  }
});

ipcMain.handle('get-users', async () => {
  const { saveUsersToLocal } = require('./api/db-local');

  try {
    const users = await dataApi.getAllUsers();
    saveUsersToLocal(users);
    console.log('Fetched and saved users locally:', users.length);
    return users;
  } catch (error) {
    await reportException('Fetching users', error, { level: 'warning' });
    return [];
  }
});

ipcMain.handle('get-all-projects', async () => {
  const { saveProjectsToLocal, getAllProjectsLocal } = require('./api/db-local');

  try {
    const projects = await dataApi.getAllProjects();
    saveProjectsToLocal(projects);
    console.log('Fetched and saved projects locally:', projects.length);
    return projects;
  } catch (error) {
    await reportException('Fetching projects', error, { level: 'warning' });
    return await getAllProjectsLocal();
  }
});

ipcMain.handle('get-all-project-users', async () => {
  const { saveProjectUsersToLocal, getAllProjectUsersLocal } = require('./api/db-local');

  try {
    const projectUsers = await dataApi.getAllProjectUsers();
    saveProjectUsersToLocal(projectUsers);
    console.log('Fetched and saved project_users locally:', projectUsers.length);
    return projectUsers;
  } catch (error) {
    await reportException('Fetching project users', error, { level: 'warning' });
    return await getAllProjectUsersLocal();
  }
});

ipcMain.handle('get-ref-project-roles', async () => {
  const { saveRefProjectRolesToLocal, getAllProjectRolesLocal } = require('./api/db-local');

  try {
    const roles = await dataApi.getAllProjectRoles();
    saveRefProjectRolesToLocal(roles);
    console.log('Fetched and saved project roles locally:', roles.length);
    return roles;
  } catch (error) {
    await reportException('Fetching project roles', error, { level: 'warning' });
    return await getAllProjectRolesLocal();
  }
});

ipcMain.handle('get-all-tasks', async () => {
  const { saveTasksToLocal, getAllTasksLocal } = require('./api/db-local');

  try {
    const tasks = await dataApi.getAllTasks();
    saveTasksToLocal(tasks);
    console.log('Fetched and saved tasks locally:', tasks.length);
    return tasks;
  } catch (error) {
    await reportException('Fetching tasks', error, { level: 'warning' });
    return await getAllTasksLocal();
  }
});

ipcMain.handle('get-all-project-tasks', async () => {
  const { saveProjectTasksToLocal, getAllProjectTasksLocal } = require('./api/db-local');

  try {
    const projectTasks = await dataApi.getAllProjectTasks();
    saveProjectTasksToLocal(projectTasks);
    console.log('Fetched and saved project_tasks locally:', projectTasks.length);
    return projectTasks;
  } catch (error) {
    await reportException('Fetching project tasks', error, { level: 'warning' });
    return await getAllProjectTasksLocal();
  }
});

ipcMain.handle('get-all-project-task-roles', async () => {
  const { saveProjectTaskRolesToLocal, getAllProjectTaskRolesLocal } = require('./api/db-local');

  try {
    const projectTaskRoles = await dataApi.getAllProjectTaskRoles();
    saveProjectTaskRolesToLocal(projectTaskRoles);
    console.log('Fetched and saved project_task_roles locally:', projectTaskRoles.length);
    return projectTaskRoles;
  } catch (error) {
    await reportException('Fetching project task roles', error, { level: 'warning' });
    return await getAllProjectTaskRolesLocal();
  }
});

ipcMain.handle('get-all-customers', async () => {
  const { getAllCustomersLocal, saveCustomersToLocal } = require('./api/db-local');
  const { isOnline } = require('./utils/network-status');

  try {
    const online = await isOnline();
    if (online) {
      const customers = await dataApi.getAllCustomers();
      saveCustomersToLocal(customers);
      return customers;
    }
    return await getAllCustomersLocal();
  } catch (error) {
    await reportException('Fetching customers', error, { level: 'warning' });
    return await getAllCustomersLocal();
  }
});

ipcMain.handle('get-project-task-data', async (event, { projectId, taskId }) => {
  const { getProjectTaskDataByTask: getLocalProjectTaskDataByTask, replaceProjectTaskDataForTask } = require('./api/db-local');
  const { isOnline } = require('./utils/network-status');
  try {
    const online = await isOnline();
    if (online) {
      const rows = await dataApi.getProjectTaskDataByTask(projectId, taskId);
      await replaceProjectTaskDataForTask(projectId, taskId, rows);
      return rows;
    }
    return await getLocalProjectTaskDataByTask(projectId, taskId);
  } catch (error) {
    await reportException('Fetching project task data', error, { level: 'warning' });
    return await getLocalProjectTaskDataByTask(projectId, taskId);
  }
});

ipcMain.handle('save-task-data', async (event, payload) => {
  const { saveTaskDataValueLocal } = require('./api/db-local');
  try {
    return await saveTaskDataValueLocal(payload);
  } catch (error) {
    await reportException('Saving task data', error, { level: 'warning' });
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-backend-connection-status', async () => {
  return getConnectionState();
});

ipcMain.handle('get-available-tasks', async (event, { userId, projectId }) => {
  const { getAvailableTasksForUser } = require('./api/db-local');
  const { isOnline } = require('./utils/network-status');

  try {
    const online = await isOnline();
    if (online) {
      const tasks = await dataApi.getAvailableTasksForUser(userId, projectId);
      console.log(`[main] Fetched global tasks for user=${userId}, project=${projectId}:`, tasks.length);
      return tasks;
    }

    const tasks = await getAvailableTasksForUser(userId, projectId);
    console.log(`[main] Fetched local tasks for user=${userId}, project=${projectId}:`, tasks.length);
    return tasks;
  } catch (error) {
    await reportException('Fetching available tasks', error, { level: 'warning' });
    return await getAvailableTasksForUser(userId, projectId);
  }
});

ipcMain.handle('get-item-types', async () => {
  const { saveItemTypesToLocal, getAllItemTypesLocal } = require('./api/db-local');
  const { isOnline } = require('./utils/network-status');

  try {
    const online = await isOnline();
    if (online) {
      const itemTypes = await dataApi.getAllItemTypes();
      saveItemTypesToLocal(itemTypes);
      return itemTypes;
    }
    return await getAllItemTypesLocal();
  } catch (error) {
    await reportException('Fetching item types', error, { level: 'warning' });
    return await getAllItemTypesLocal();
  }
});

ipcMain.handle('login-with-code', async (event, code) => {
  const { loginByAuthCodeLocal, cacheSuccessfulLoginLocal } = require('./api/db-local');
  const { isOnline } = require('./utils/network-status');
  const offlinePolicyError =
    'Offline login unavailable. This user must login online at least once on this device, and last online login must be within 7 days.';

  const online = await isOnline();

  try {
    if (online) {
      try {
        const user = await dataApi.loginByAuthCode(code);
        if (!user?.id) {
          return { error: 'Invalid code.' };
        }
        await cacheSuccessfulLoginLocal(user, code);
        if (profile === 'backend' && user?.id) connectDesktopWs(user.id);
        return user;
      } catch (remoteErr) {
        // Backend may be unreachable even when generic connectivity check says online.
        // Fall back to local cached login instead of hard-failing.
        await reportException('Remote login fallback', remoteErr, { level: 'warning' });
        const localUser = await loginByAuthCodeLocal(code);
        if (!localUser?.id) {
          return { error: offlinePolicyError };
        }
        if (profile === 'backend' && localUser?.id) connectDesktopWs(localUser.id);
        return localUser;
      }
    } else {
      const user = await loginByAuthCodeLocal(code);
      if (!user?.id) {
        return { error: offlinePolicyError };
      }
      if (profile === 'backend' && user?.id) connectDesktopWs(user.id);
      return user;
    }
  } catch (error) {
    await reportException('Login', error, { level: 'error' });
    return { error: 'Login failed. Please try again.' };
  }
});


ipcMain.handle('start-unallocated', async (event, { userId, activityId }) => {
  const { startUnallocatedActivityLocal: startLocal, enqueueSyncPayload } = require('./api/db-local');

  const safeActivityId = Number(activityId) || 4;
  const isConnected = await isOnline();

  try {
    console.log('[main] start-unallocated: before local');
    var startTime = Date.now();
    //const { uuid } = await startLocal(userId, safeActivityId);
    
    const uuid = crypto.randomUUID();
    await startLocal(userId, safeActivityId, uuid);
    console.log('[main] start-unallocated: after local', Date.now() - startTime);

    if (isConnected) {
      console.log('[main] start-unallocated: before server');
      try {
        const res = await dataApi.startUnallocatedActivityGlobal({ uuid, user_id: userId, activity_id: safeActivityId });
        console.log('[main] start-unallocated: after server', res);
        if (!res.success) {
          await reportException('Start unallocated (remote)', new Error(String(res.error || 'Unknown remote error')), { level: 'warning' });
          await enqueueSyncPayload({
            type: 'start',
            uuid,
            user_id: userId,
            activity_id: safeActivityId,
            timestamp: new Date().toISOString()
          });
        }
      } catch (remoteErr) {
        await reportException('Start unallocated (remote fallback)', remoteErr, { level: 'warning' });
        await enqueueSyncPayload({
          type: 'start',
          uuid,
          user_id: userId,
          activity_id: safeActivityId,
          timestamp: new Date().toISOString()
        });
      }
    }

    return { success: true, uuid };
  } catch (error) {
    await reportException('Start unallocated', error, { level: 'error' });
    return { success: false, error: error.message };
  }
});

ipcMain.handle('start-task-activity', async (event, { userId, projectId, taskId, itemId }) => {
  const { startTaskActivityLocal: startLocal, enqueueSyncPayload } = require('./api/db-local');
  const isConnected = await isOnline();

  try {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
      mainWindow.webContents.focus();
    }
    const { uuid } = await startLocal(userId, projectId, taskId, itemId);

    if (isConnected) {
      try {
        const res = await dataApi.startTaskActivityGlobal({
          uuid,
          user_id: userId,
          project_id: projectId,
          task_id: taskId,
          item_id: itemId ?? null,
          timestamp: new Date().toISOString()
        });
        if (!res.success) {
          await reportException('Start task activity (remote)', new Error(String(res.error || 'Unknown remote error')), { level: 'warning' });
          await enqueueSyncPayload({
            type: 'start-task',
            uuid,
            user_id: userId,
            project_id: projectId,
            task_id: taskId,
            item_id: itemId ?? null,
            timestamp: new Date().toISOString()
          });
        }
      } catch (remoteErr) {
        await reportException('Start task activity (remote fallback)', remoteErr, { level: 'warning' });
        await enqueueSyncPayload({
          type: 'start-task',
          uuid,
          user_id: userId,
          project_id: projectId,
          task_id: taskId,
          item_id: itemId ?? null,
          timestamp: new Date().toISOString()
        });
      }
    }

    return { success: true, uuid };
  } catch (error) {
    await reportException('Start task activity', error, { level: 'error' });
    return { success: false, error: error.message };
  }
});

ipcMain.handle('sync-queue', async () => {
  const { syncQueue } = require('./api/db-local');
  try {
    const result = await syncQueue();
    return result;
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('complete-activity', async (event, { uuid, userId, isTaskCompleted, note, taskData }) => {
  const { completeActiveActivityLocal: completeLocal } = require('./api/db-local');
  const isConnected = await isOnline();

  try {
    const localResult = await completeLocal({
      uuid,
      is_completed_project_task: isTaskCompleted,
      timestamp: new Date().toISOString(),
      note,
      taskData
    });

    if (!localResult.success) {
      throw new Error(localResult.error || 'Local completion failed');
    }

    if (isConnected) {
      try {
        const result = await dataApi.completeActiveActivityGlobal({
          uuid: localResult.uuid,
          user_id: userId,
          is_completed_project_task: isTaskCompleted,
          timestamp: localResult.endTime.toISOString(),
          note,
          taskData
        });

        if (!result.success) {
          await reportException('Complete activity (remote)', new Error(String(result.error || 'Unknown remote error')), { level: 'warning' });
        }
      } catch (remoteErr) {
        await reportException('Complete activity (remote fallback)', remoteErr, { level: 'warning' });
      }
    }

    return { success: true };
  } catch (error) {
    await reportException('Complete activity', error, { level: 'error' });
    return { success: false, error: error.message };
  }
});

ipcMain.handle('logout', async (event) => {
  const { completeActiveActivityLocal: completeLocal, syncQueue } = require('./api/db-local');

  try {
    if (profile === 'backend') {
      disconnectDesktopWs();
    }
    const result = await completeLocal({
      uuid: null,
      is_completed_project_task: false,
      timestamp: new Date().toISOString()
    });

    if (result.success) {
      console.log(`[main] Auto-complete on logout for uuid=${result.uuid}`);
      const syncResult = await syncQueue();
      console.log(`[main] Sync on logout finished: ${syncResult.synced} record(s) synced`);
    } else {
      console.log('[main] No active task to complete on logout');
    }

    return { success: true };
  } catch (err) {
    await reportException('Logout auto-complete', err, { level: 'warning' });
    return { success: false, error: err.message };
  }
});

ipcMain.handle('get-project-items', async (event, { projectId, projectTypeId }) => {
  const { getProjectItemsLocal, saveCfsItemsToLocal, saveImItemsToLocal } = require('./api/db-local');
  try {
    const items = await dataApi.getItemsByProject(projectId);
    if (items.length) {
      if (Number(projectTypeId) === 1) saveCfsItemsToLocal(items.map((row) => ({ id: row.id, project_id: projectId, label: row.name, task_status_id: null })));
      if (Number(projectTypeId) === 2) saveImItemsToLocal(items.map((row) => ({ id: row.id, project_id: projectId, label: row.name, task_status_id: null })));
      return items;
    }
    if (projectTypeId === 1) {
      const cfsItems = await dataApi.getCfsItemsByProject(projectId);
      saveCfsItemsToLocal(cfsItems.map((row) => ({ id: row.id, project_id: projectId, label: row.name, task_status_id: row.task_status_id ?? null })));
      return cfsItems;
    } else if (projectTypeId === 2) {
      const imItems = await dataApi.getImItemsByProject(projectId);
      saveImItemsToLocal(imItems.map((row) => ({ id: row.id, project_id: projectId, label: row.name, task_status_id: row.task_status_id ?? null })));
      return imItems;
    } else {
      return await getProjectItemsLocal(projectId, projectTypeId);
    }
  } catch (error) {
    await reportException('Fetching project items', error, { level: 'warning' });
    return await getProjectItemsLocal(projectId, projectTypeId);
  }
});

ipcMain.handle('get-item-tracking-tasks', async (event, { projectId }) => {
  const { isOnline } = require('./utils/network-status');

  try {
    const online = await isOnline();
    if (!online) return [];
    return await dataApi.getItemTrackingTasksByProject(projectId);
  } catch (error) {
    await reportException('Fetching item tracking tasks', error, { level: 'warning' });
    return [];
  }
});

ipcMain.handle('get-item-status-rule', async (event, { projectId, taskId, applyAfterFinish }) => {
  const { isOnline } = require('./utils/network-status');

  try {
    const online = await isOnline();
    if (!online) return null;
    return await dataApi.getItemStatusRuleByTask(projectId, taskId, applyAfterFinish);
  } catch (error) {
    await reportException('Fetching item status rule', error, { level: 'warning' });
    return null;
  }
});

ipcMain.handle('update-item-status', async (event, { itemId, statusId }) => {
  const { isOnline } = require('./utils/network-status');

  try {
    const online = await isOnline();
    if (!online) {
      return { success: false, error: 'Offline mode' };
    }
    return await dataApi.updateItemStatusGlobal(itemId, statusId);
  } catch (error) {
    await reportException('Updating item status', error, { level: 'warning' });
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-unfinished-tasks', async (event, { userId }) => {
  const { isOnline } = require('./utils/network-status');

  try {
    const online = await isOnline();
    if (!online) return [];
    return await dataApi.getUnfinishedTasksByUser(userId);
  } catch (error) {
    await reportException('Fetching unfinished tasks', error, { level: 'warning' });
    return [];
  }
});

ipcMain.handle('get-assignments', async (event, { userId }) => {
  const { isOnline } = require('./utils/network-status');

  try {
    const online = await isOnline();
    if (!online) return [];
    return await dataApi.getAssignmentsByUser(userId);
  } catch (error) {
    await reportException('Fetching assignments', error, { level: 'warning' });
    return [];
  }
});

ipcMain.handle('mark-unfinished-finished', async (event, { recordId, uuid }) => {
  const { isOnline } = require('./utils/network-status');

  try {
    const online = await isOnline();
    if (!online) return { success: false, error: 'Offline mode' };
    if (uuid) {
      return await dataApi.markUnfinishedTaskFinishedByUuid(uuid);
    }
    return await dataApi.markUnfinishedTaskFinished(recordId);
  } catch (error) {
    await reportException('Updating unfinished task', error, { level: 'warning' });
    return { success: false, error: error.message };
  }
});

ipcMain.handle('mark-assignment-accepted', async (event, { assignmentId }) => {
  const { isOnline } = require('./utils/network-status');

  try {
    const online = await isOnline();
    if (!online) return { success: false, error: 'Offline mode' };
    return await dataApi.markAssignmentAccepted(assignmentId);
  } catch (error) {
    await reportException('Updating assignment', error, { level: 'warning' });
    return { success: false, error: error.message };
  }
});

app.on('will-quit', async (event) => {
  event.preventDefault();

  try {
    if (profile === 'backend') {
      disconnectDesktopWs();
    }
    const { completeActiveActivityLocal: completeLocal, syncQueue } = require('./api/db-local');

    const result = await completeLocal({
      uuid: null,
      is_completed_project_task: false,
      timestamp: new Date().toISOString()
    });

    if (result.success) {
      console.log(`[main] Queued auto-complete for uuid=${result.uuid}`);
      const syncResult = await syncQueue();
      console.log(`[main] Sync on quit finished: ${syncResult.synced} record(s) synced`);
    }
  } catch (err) {
    await reportException('Auto-complete on quit', err, { level: 'warning' });
  } finally {
    // ⚡ небольшая задержка, чтобы дать SQLite очистить соединение
    setTimeout(() => {
      process.exit(0); // жёсткий выход без лишних коллизий
    }, 200);
  }
});

process.on('uncaughtException', (error) => {
  reportException('Uncaught Exception', error, { level: 'error' }).catch(() => {});
});

process.on('unhandledRejection', (reason) => {
  reportException('Unhandled Rejection', reason, { level: 'error' }).catch(() => {});
});

