document.addEventListener('DOMContentLoaded', async () => {

  
  window.network.startConnectionMonitoring();
  const users = await window.electronAPI.getUsers();
  const projects = await window.electronAPI.getAllProjects();
  const projectUsers = await window.electronAPI.getAllProjectUsers();
  const projectRoles = await window.electronAPI.getAllProjectRoles();

  document.getElementById('start-button').addEventListener('click', async () => {
    const code = document.getElementById('authcode-input').value.trim();
    const errorEl = document.getElementById('login-error');

    const user = await window.electronAPI.loginWithCode(code);

    if (user) {
      errorEl.style.display = 'none';

      document.getElementById('login-screen').style.display = 'none';
      document.getElementById('main-screen').style.display = 'block';

      document.getElementById('welcome-text').textContent = `Welcome, ${user.first_name} ${user.last_name}`;
    } else {
      errorEl.style.display = 'block';
    }
  });

  document.getElementById('clockin-button').addEventListener('click', async () => {
    const online = await window.network.isOnline();

    if (!online) {
      alert('You are offline. We will store the data locally.');
      return;
    }

    alert('You are online. Data will be sent to server.');
  });
});
