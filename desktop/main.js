const { app, BrowserWindow, ipcMain } = require('electron'); // ← добавлено ipcMain
const path = require('path');

require('./api/db-local');

function createWindow() {
  const win = new BrowserWindow({
    width: 400,
    height: 800,
    webPreferences: {
    preload: path.join(__dirname, 'preload.js'),
    contextIsolation: true,
    nodeIntegration: false
    },

  });

  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
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


ipcMain.handle('login-with-code', async (event, code) => {
  const { loginByAuthCode } = require('./api/db');
  try {
    const user = await loginByAuthCode(code);
    return user || null;
  } catch (error) {
    console.error('Login failed:', error);
    return null;
  }
});

