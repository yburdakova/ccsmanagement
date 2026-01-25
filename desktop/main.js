const { app, screen, BrowserWindow, ipcMain, dialog } = require('electron'); 
const { Menu } = require('electron');

const path = require('path');
const { isOnline } = require('./utils/network-status');
const { initializeLocalDb } = require('./api/db-local');

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
  win.webContents.openDevTools();

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
  await initializeLocalDb();

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
  const { getAllUsers } = require('./api/db');
  const { saveUsersToLocal } = require('./api/db-local');

  try {
    const users = await getAllUsers();
    saveUsersToLocal(users);
    console.log('Fetched and saved users locally:', users.length);
    return users;
  } catch (error) {
    console.error('DB Error:', error);
    return [];
  }
});

ipcMain.handle('get-all-projects', async () => {
  const { getAllProjects } = require('./api/db');
  const { saveProjectsToLocal } = require('./api/db-local');

  try {
    const projects = await getAllProjects();
    saveProjectsToLocal(projects);
    console.log('Fetched and saved projects locally:', projects.length);
    return projects;
  } catch (error) {
    console.error('Error fetching projects:', error);
    return [];
  }
});

ipcMain.handle('get-all-project-users', async () => {
  const { getAllProjectUsers } = require('./api/db');
  const { saveProjectUsersToLocal } = require('./api/db-local');

  try {
    const projectUsers = await getAllProjectUsers();
    saveProjectUsersToLocal(projectUsers);
    console.log('Fetched and saved project_users locally:', projectUsers.length);
    return projectUsers;
  } catch (error) {
    console.error('Error fetching project_users:', error);
    return [];
  }
});

ipcMain.handle('get-ref-project-roles', async () => {
  const { getAllProjectRoles } = require('./api/db');
  const { saveRefProjectRolesToLocal } = require('./api/db-local');

  try {
    const roles = await getAllProjectRoles();
    saveRefProjectRolesToLocal(roles);
    console.log('Fetched and saved project roles locally:', roles.length);
    return roles;
  } catch (error) {
    console.error('Error fetching project roles:', error);
    return [];
  }
});

ipcMain.handle('get-all-tasks', async () => {
  const { getAllTasks } = require('./api/db');
  const { saveTasksToLocal } = require('./api/db-local');

  try {
    const tasks = await getAllTasks();
    saveTasksToLocal(tasks);
    console.log('Fetched and saved tasks locally:', tasks.length);
    return tasks;
  } catch (error) {
    console.error('Error fetching tasks:', error);
    return [];
  }
});

ipcMain.handle('get-all-project-tasks', async () => {
  const { getAllProjectTasks } = require('./api/db');
  const { saveProjectTasksToLocal } = require('./api/db-local');

  try {
    const projectTasks = await getAllProjectTasks();
    saveProjectTasksToLocal(projectTasks);
    console.log('Fetched and saved project_tasks locally:', projectTasks.length);
    return projectTasks;
  } catch (error) {
    console.error('Error fetching project_tasks:', error);
    return [];
  }
});

ipcMain.handle('get-all-project-task-roles', async () => {
  const { getAllProjectTaskRoles } = require('./api/db');
  const { saveProjectTaskRolesToLocal } = require('./api/db-local');

  try {
    const projectTaskRoles = await getAllProjectTaskRoles();
    saveProjectTaskRolesToLocal(projectTaskRoles);
    console.log('Fetched and saved project_task_roles locally:', projectTaskRoles.length);
    return projectTaskRoles;
  } catch (error) {
    console.error('Error fetching project_task_roles:', error);
    return [];
  }
});

ipcMain.handle('get-available-tasks', async (event, { userId, projectId }) => {
  const { getAvailableTasksForUser } = require('./api/db-local');
  const { getAvailableTasksForUser: getAvailableTasksGlobal } = require('./api/db');
  const { isOnline } = require('./utils/network-status');

  try {
    const online = await isOnline();
    if (online) {
      const tasks = await getAvailableTasksGlobal(userId, projectId);
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
  const { getAllItemTypes } = require('./api/db');
  const { isOnline } = require('./utils/network-status');

  try {
    const online = await isOnline();
    if (!online) return [];
    return await getAllItemTypes();
  } catch (error) {
    console.error('Error fetching item types:', error);
    return [];
  }
});

ipcMain.handle('login-with-code', async (event, code) => {
  const { loginByAuthCode } = require('./api/db');
  const { loginByAuthCodeLocal } = require('./api/db-local');
  const { isOnline } = require('./utils/network-status');

  const online = await isOnline();

  try {
    if (online) {
      const user = await loginByAuthCode(code);
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
  const { startUnallocatedActivityGlobal: startServer } = require('./api/db');

  const safeActivityId = Number(activityId) || 4;
  const isConnected = await isOnline();

  try {
    const { uuid } = await startLocal(userId, safeActivityId);

    if (isConnected) {
      const res = await startServer({ uuid, user_id: userId, activity_id: safeActivityId });
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
  const { startTaskActivityGlobal: startServer } = require('./api/db');
  const isConnected = await isOnline();

  try {
    const { uuid } = await startLocal(userId, projectId, taskId, itemId);

    if (isConnected) {
      const res = await startServer({
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

ipcMain.handle('complete-activity', async (event, { uuid, userId, isTaskCompleted, note }) => {
  const { completeActiveActivityLocal: completeLocal } = require('./api/db-local');
  const { completeActiveActivityGlobal: completeServer } = require('./api/db');
  const isConnected = await isOnline();

  try {
    const localResult = await completeLocal({
      uuid,
      is_completed_project_task: isTaskCompleted,
      timestamp: new Date().toISOString(),
      note
    });

    if (!localResult.success) {
      throw new Error(localResult.error || 'Local completion failed');
    }

    if (isConnected) {
      const result = await completeServer({
        uuid: localResult.uuid,
        user_id: userId,
        is_completed_project_task: isTaskCompleted,
        timestamp: localResult.endTime.toISOString(),
        note
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
  const { getItemsByProject, getCfsItemsByProject, getImItemsByProject } = require('./api/db');
  try {
    const items = await getItemsByProject(projectId);
    if (items.length) {
      return items;
    }
    if (projectTypeId === 1) {
      return await getCfsItemsByProject(projectId);
    } else if (projectTypeId === 2) {
      return await getImItemsByProject(projectId);
    } else {
      return [];
    }
  } catch (error) {
    console.error('Error fetching project items:', error);
    return [];
  }
});

ipcMain.handle('get-item-tracking-tasks', async (event, { projectId }) => {
  const { getItemTrackingTasksByProject } = require('./api/db');
  const { isOnline } = require('./utils/network-status');

  try {
    const online = await isOnline();
    if (!online) return [];
    return await getItemTrackingTasksByProject(projectId);
  } catch (error) {
    console.error('Error fetching item tracking tasks:', error);
    return [];
  }
});

ipcMain.handle('get-item-status-rule', async (event, { projectId, taskId, applyAfterFinish }) => {
  const { getItemStatusRuleByTask } = require('./api/db');
  const { isOnline } = require('./utils/network-status');

  try {
    const online = await isOnline();
    if (!online) return null;
    return await getItemStatusRuleByTask(projectId, taskId, applyAfterFinish);
  } catch (error) {
    console.error('Error fetching item status rule:', error);
    return null;
  }
});

ipcMain.handle('update-item-status', async (event, { itemId, statusId }) => {
  const { updateItemStatusGlobal } = require('./api/db');
  const { isOnline } = require('./utils/network-status');

  try {
    const online = await isOnline();
    if (!online) {
      return { success: false, error: 'Offline mode' };
    }
    return await updateItemStatusGlobal(itemId, statusId);
  } catch (error) {
    console.error('Error updating item status:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-unfinished-tasks', async (event, { userId }) => {
  const { getUnfinishedTasksByUser } = require('./api/db');
  const { isOnline } = require('./utils/network-status');

  try {
    const online = await isOnline();
    if (!online) return [];
    return await getUnfinishedTasksByUser(userId);
  } catch (error) {
    console.error('Error fetching unfinished tasks:', error);
    return [];
  }
});

ipcMain.handle('get-assignments', async (event, { userId }) => {
  const { getAssignmentsByUser } = require('./api/db');
  const { isOnline } = require('./utils/network-status');

  try {
    const online = await isOnline();
    if (!online) return [];
    return await getAssignmentsByUser(userId);
  } catch (error) {
    console.error('Error fetching assignments:', error);
    return [];
  }
});

ipcMain.handle('mark-unfinished-finished', async (event, { recordId, uuid }) => {
  const { markUnfinishedTaskFinished, markUnfinishedTaskFinishedByUuid } = require('./api/db');
  const { isOnline } = require('./utils/network-status');

  try {
    const online = await isOnline();
    if (!online) return { success: false, error: 'Offline mode' };
    if (uuid) {
      return await markUnfinishedTaskFinishedByUuid(uuid);
    }
    return await markUnfinishedTaskFinished(recordId);
  } catch (error) {
    console.error('Error updating unfinished task:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('mark-assignment-accepted', async (event, { assignmentId }) => {
  const { markAssignmentAccepted } = require('./api/db');
  const { isOnline } = require('./utils/network-status');

  try {
    const online = await isOnline();
    if (!online) return { success: false, error: 'Offline mode' };
    return await markAssignmentAccepted(assignmentId);
  } catch (error) {
    console.error('Error updating assignment:', error);
    return { success: false, error: error.message };
  }
});

app.on('will-quit', async (event) => {
  event.preventDefault();

  try {
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

