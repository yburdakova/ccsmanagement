const { app, BrowserWindow, ipcMain } = require('electron'); // ← добавлено ipcMain
const path = require('path');
const { getAllUsers } = require('./api/db'); // ← импорт функции

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

// 🔌 IPC handler
ipcMain.handle('get-users', async () => {
  try {
    const users = await getAllUsers();
    console.log('Fetched users:', users);
    return users;
  } catch (error) {
    console.error('DB Error:', error);
    return [];
  }
});
