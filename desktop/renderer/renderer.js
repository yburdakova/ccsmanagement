document.addEventListener('DOMContentLoaded', async () => {

  
  window.network.startConnectionMonitoring();
  const allProjects = await window.electronAPI.getAllProjects();
  const allProjectUsers = await window.electronAPI.getAllProjectUsers();
  const projectRoles = await window.electronAPI.getAllProjectRoles();

   let currentUser = null;

  document.getElementById('start-button').addEventListener('click', async () => {
    const code = document.getElementById('authcode-input').value.trim();
    const errorEl = document.getElementById('login-error');

    const user = await window.electronAPI.loginWithCode(code);

    if (user) {
      currentUser = user;
      const userProjects = allProjectUsers
    .filter(pu => pu.user_id === user.id)
    .map(pu => {
      const project = allProjects.find(p => p.id === pu.project_id);
      const role = projectRoles.find(r => r.id === pu.project_role_id);
      return {
        project_id: project?.id,
        name: project?.name,
        role: role?.label || role?.name || 'Unknown'
      };
    })
    .filter(p => !!p.project_id);

    // <select>
    const projectSelect = document.getElementById('project-select');
    userProjects.forEach(p => {
      const option = document.createElement('option');
      option.value = p.project_id;
      option.textContent = p.name;
      projectSelect.appendChild(option);
    });

    // show role
    const roleText = document.getElementById('project-role');
    projectSelect.addEventListener('change', (e) => {
      const selected = userProjects.find(p => p.project_id == e.target.value);
      if (selected) {
        roleText.textContent = `Your role: ${selected.role}`;
      } else {
        roleText.textContent = '';
      }
    });

      errorEl.style.display = 'none';

      document.getElementById('login-screen').style.display = 'none';
      document.getElementById('main-screen').style.display = 'block';

      document.getElementById('welcome-text').textContent = `Welcome, ${user.first_name} ${user.last_name}`;
    } else {
      errorEl.style.display = 'block';
    }
  });

document.getElementById('clockin-button').addEventListener('click', async () => {
  const result = await window.electronAPI.startUnallocated(currentUser.id);

  if (!result.success) {
    alert('Clock-in failed: ' + result.error);
    return;
  }

  document.getElementById('clockin-button').textContent = 'CLOCK-OUT';
  alert('Clock-in successful!');
});
  

});

