const path = require('path');
const dotenv = require('dotenv');
const crypto = require('crypto');
const { app, screen, BrowserWindow, ipcMain, dialog } = require('electron'); 
const { Menu } = require('electron');

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
const { initializeLocalDb } = require('./api/db-local');
const dataApi = require('./api/data-provider');
const { connectDesktopWs, disconnectDesktopWs } = require('./ws/desktop-ws-client');

let mainWindow = null;

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
  if (!app.isPackaged) {
    win.webContents.openDevTools();
  }
  mainWindow = win;

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
      console.error('[main] Failed to initialize local DB:', err.message);
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
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('init-local-db', async () => {
  const { initializeLocalDb } = require('./api/db-local');
  try {
    await initializeLocalDb();
    return { success: true };
  } catch (err) {
    console.error('[main] init-local-db error:', err.message);
    return { success: false, error: err.message };
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
    console.error('DB Error:', error);
    return [];
  }
});

ipcMain.handle('get-all-projects', async () => {
  const { saveProjectsToLocal } = require('./api/db-local');

  try {
    const projects = await dataApi.getAllProjects();
    saveProjectsToLocal(projects);
    console.log('Fetched and saved projects locally:', projects.length);
    return projects;
  } catch (error) {
    console.error('Error fetching projects:', error);
    return [];
  }
});

ipcMain.handle('get-all-project-users', async () => {
  const { saveProjectUsersToLocal } = require('./api/db-local');

  try {
    const projectUsers = await dataApi.getAllProjectUsers();
    saveProjectUsersToLocal(projectUsers);
    console.log('Fetched and saved project_users locally:', projectUsers.length);
    return projectUsers;
  } catch (error) {
    console.error('Error fetching project_users:', error);
    return [];
  }
});

ipcMain.handle('get-ref-project-roles', async () => {
  const { saveRefProjectRolesToLocal } = require('./api/db-local');

  try {
    const roles = await dataApi.getAllProjectRoles();
    saveRefProjectRolesToLocal(roles);
    console.log('Fetched and saved project roles locally:', roles.length);
    return roles;
  } catch (error) {
    console.error('Error fetching project roles:', error);
    return [];
  }
});

ipcMain.handle('get-all-tasks', async () => {
  const { saveTasksToLocal } = require('./api/db-local');

  try {
    const tasks = await dataApi.getAllTasks();
    saveTasksToLocal(tasks);
    console.log('Fetched and saved tasks locally:', tasks.length);
    return tasks;
  } catch (error) {
    console.error('Error fetching tasks:', error);
    return [];
  }
});

ipcMain.handle('get-all-project-tasks', async () => {
  const { saveProjectTasksToLocal } = require('./api/db-local');

  try {
    const projectTasks = await dataApi.getAllProjectTasks();
    saveProjectTasksToLocal(projectTasks);
    console.log('Fetched and saved project_tasks locally:', projectTasks.length);
    return projectTasks;
  } catch (error) {
    console.error('Error fetching project_tasks:', error);
    return [];
  }
});

ipcMain.handle('get-all-project-task-roles', async () => {
  const { saveProjectTaskRolesToLocal } = require('./api/db-local');

  try {
    const projectTaskRoles = await dataApi.getAllProjectTaskRoles();
    saveProjectTaskRolesToLocal(projectTaskRoles);
    console.log('Fetched and saved project_task_roles locally:', projectTaskRoles.length);
    return projectTaskRoles;
  } catch (error) {
    console.error('Error fetching project_task_roles:', error);
    return [];
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
    console.error('Error fetching customers:', error);
    return [];
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
    console.error('Error fetching project task data:', error);
    return [];
  }
});

ipcMain.handle('save-task-data', async (event, payload) => {
  const { saveTaskDataValueLocal } = require('./api/db-local');
  try {
    return await saveTaskDataValueLocal(payload);
  } catch (error) {
    console.error('Error saving task data:', error);
    return { success: false, error: error.message };
  }
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
    console.error('Error fetching available tasks:', error);
    return [];
  }
});

ipcMain.handle('get-item-types', async () => {
  const { isOnline } = require('./utils/network-status');

  try {
    const online = await isOnline();
    if (!online) return [];
    return await dataApi.getAllItemTypes();
  } catch (error) {
    console.error('Error fetching item types:', error);
    return [];
  }
});

ipcMain.handle('login-with-code', async (event, code) => {
  const { loginByAuthCodeLocal } = require('./api/db-local');
  const { isOnline } = require('./utils/network-status');

  const online = await isOnline();

  try {
    if (online) {
      const user = await dataApi.loginByAuthCode(code);
      if (profile === 'backend' && user?.id) {
        connectDesktopWs(user.id);
      }
      return user || null;
    } else {
      const user = await loginByAuthCodeLocal(code);
      return user || null;
    }
  } catch (error) {
    console.error('Login failed:', error);
    return null;
  }
});


ipcMain.handle('start-unallocated', async (event, { userId, activityId }) => {
  const { startUnallocatedActivityLocal: startLocal } = require('./api/db-local');

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
      const res = await dataApi.startUnallocatedActivityGlobal({ uuid, user_id: userId, activity_id: safeActivityId });
      console.log('[main] start-unallocated: after server', res);
      if (!res.success) throw new Error(res.error);
    }

    return { success: true, uuid };
  } catch (error) {
    console.error('[main] start-unallocated error:', error.message);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('start-task-activity', async (event, { userId, projectId, taskId, itemId }) => {
  const { startTaskActivityLocal: startLocal } = require('./api/db-local');
  const isConnected = await isOnline();

  try {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
      mainWindow.webContents.focus();
    }
    const { uuid } = await startLocal(userId, projectId, taskId, itemId);

    if (isConnected) {
      const res = await dataApi.startTaskActivityGlobal({
        uuid,
        user_id: userId,
        project_id: projectId,
        task_id: taskId,
        item_id: itemId ?? null,
        timestamp: new Date().toISOString()
      });
      if (!res.success) throw new Error(res.error);
    }

    return { success: true, uuid };
  } catch (error) {
    console.error('[main] start-task-activity error:', error.message);
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
      const result = await dataApi.completeActiveActivityGlobal({
        uuid: localResult.uuid,
        user_id: userId,
        is_completed_project_task: isTaskCompleted,
        timestamp: localResult.endTime.toISOString(),
        note,
        taskData
      });

      if (!result.success) throw new Error(result.error);
    }

    return { success: true };
  } catch (error) {
    console.error('[main] complete-activity error:', error.message);
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
    console.error('[main] Logout auto-complete failed:', err.message);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('get-project-items', async (event, { projectId, projectTypeId }) => {
  try {
    const items = await dataApi.getItemsByProject(projectId);
    if (items.length) {
      return items;
    }
    if (projectTypeId === 1) {
      return await dataApi.getCfsItemsByProject(projectId);
    } else if (projectTypeId === 2) {
      return await dataApi.getImItemsByProject(projectId);
    } else {
      return [];
    }
  } catch (error) {
    console.error('Error fetching project items:', error);
    return [];
  }
});

ipcMain.handle('get-item-tracking-tasks', async (event, { projectId }) => {
  const { isOnline } = require('./utils/network-status');

  try {
    const online = await isOnline();
    if (!online) return [];
    return await dataApi.getItemTrackingTasksByProject(projectId);
  } catch (error) {
    console.error('Error fetching item tracking tasks:', error);
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
    console.error('Error fetching item status rule:', error);
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
    console.error('Error updating item status:', error);
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
    console.error('Error fetching unfinished tasks:', error);
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
    console.error('Error fetching assignments:', error);
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
    console.error('Error updating unfinished task:', error);
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
    console.error('Error updating assignment:', error);
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
    console.error('[main] Failed to auto-complete on quit:', err.message);
  } finally {
    // ⚡ небольшая задержка, чтобы дать SQLite очистить соединение
    setTimeout(() => {
      process.exit(0); // жёсткий выход без лишних коллизий
    }, 200);
  }
});

