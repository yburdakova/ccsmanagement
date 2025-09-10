document.addEventListener('DOMContentLoaded', async () => {

  const authInput = document.getElementById('authcode-input');
  authInput.focus();

  authInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      document.getElementById('start-button').click();
    }
  });

  window.network.startConnectionMonitoring();
  const allProjects = await window.electronAPI.getAllProjects();
  const allProjectUsers = await window.electronAPI.getAllProjectUsers();
  const projectRoles = await window.electronAPI.getAllProjectRoles();

  let currentUser = null;
  let currentSessionUuid = null;

  const projectSection = document.querySelector('.project-selector-section');
  projectSection.style.display = 'none';
  const taskSection = document.getElementById('task-selector-section');
  const taskSelect = document.getElementById('task-select');
  taskSection.style.display = 'none';

  document.getElementById('start-button').addEventListener('click', async () => {
      const code = document.getElementById('authcode-input').value.trim();
      const errorEl = document.getElementById('login-error');

      const user = await window.electronAPI.loginWithCode(code);

      if (user) {
        currentUser = user;

        errorEl.style.display = 'none';
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('main-screen').style.display = 'block';

        document.getElementById('welcome-text').textContent = `Welcome, ${user.first_name} ${user.last_name}`;
      } else {
        errorEl.style.display = 'block';
      }
  });
    
  document.getElementById('logout-button').addEventListener('click', async () => {
    if (currentUser) {
      await window.electronAPI.logout({ userId: currentUser.id });
    }

    currentUser = null;
    currentSessionUuid = null;

    // сброс кнопки
    const button = document.getElementById('clockin-button');
    button.textContent = 'CLOCK-IN';

    // скрываем секции
    projectSection.style.display = 'none';
    taskSection.style.display = 'none';

    // очищаем селекты
    document.getElementById('project-select').innerHTML = '<option value="">— Select Project —</option>';
    document.getElementById('project-role').textContent = '';
    taskSelect.innerHTML = '<option value="">— Select Task —</option>';

    // переключаем экраны
    document.getElementById('login-screen').style.display = 'block';
    document.getElementById('main-screen').style.display = 'none';

    // чистим поле ввода
    const authInput = document.getElementById('authcode-input');
    authInput.value = '';

    // небольшой трюк с фокусом
    authInput.blur();
    setTimeout(() => authInput.focus(), 50);

    console.log('[renderer] User logged out and UI reset');
  });

  document.getElementById('clockin-button').addEventListener('click', async () => {
      const button = document.getElementById('clockin-button');

      if (button.textContent === 'CLOCK-IN') {
        const result = await window.electronAPI.startUnallocated({ userId: currentUser.id });

        if (!result.success) {
          alert('Clock-in failed: ' + result.error);
          return;
        }

        currentSessionUuid = result.uuid;
        button.textContent = 'CLOCK-OUT';
        alert(`Clock-in successful! (uuid=${currentSessionUuid})`);

        const userProjects = allProjectUsers
          .filter(pu => pu.user_id === currentUser.id)
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

        const projectSelect = document.getElementById('project-select');
        projectSelect.innerHTML = '<option value="">— Select Project —</option>';
        userProjects.forEach(p => {
          const option = document.createElement('option');
          option.value = p.project_id;
          option.textContent = p.name;
          projectSelect.appendChild(option);
        });

       const roleText = document.getElementById('project-role');
projectSelect.addEventListener('change', async (e) => {
  const selected = userProjects.find(p => p.project_id == e.target.value);

  roleText.textContent = selected ? `Your role: ${selected.role}` : '';

  if (selected) {
    const tasks = await window.electronAPI.getAvailableTasks(currentUser.id, selected.project_id);

    taskSelect.innerHTML = '<option value="">— Select Task —</option>';
    tasks.forEach(t => {
      const option = document.createElement('option');
      option.value = t.id;
      option.textContent = t.description || t.name;
      taskSelect.appendChild(option);
    });

    taskSection.style.display = tasks.length > 0 ? 'block' : 'none';
  } else {
    taskSection.style.display = 'none';
  }
});


        projectSection.style.display = 'block';
      } else {
        // clock-out
        if (!currentSessionUuid) {
          alert('No active session UUID found!');
          return;
        }

        const result = await window.electronAPI.completeActiveActivity({
          uuid: currentSessionUuid,
          userId: currentUser.id,
          isTaskCompleted: false
        });

        if (!result.success) {
          alert('Clock-out failed: ' + result.error);
          return;
        }

        button.textContent = 'CLOCK-IN';
        alert(`Clock-out successful! (uuid=${currentSessionUuid})`);

        currentSessionUuid = null;

        projectSection.style.display = 'none';
      }
  });

});

