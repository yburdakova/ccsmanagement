document.addEventListener('DOMContentLoaded', async () => {
  const authInput = document.getElementById('authcode-input');
  const clockinButton = document.getElementById('clockin-button');
  const logoutButton = document.getElementById('logout-button');
  const projectSelect = document.getElementById('project-select');
  const roleText = document.getElementById('project-role');
  const taskSection = document.getElementById('task-selector-section');
  const taskSelect = document.getElementById('task-select');
  const projectSection = document.querySelector('.project-selector-section');
  const itemInput = document.getElementById('item-input');

  authInput.focus();
  authInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('start-button').click();
  });

  window.network.startConnectionMonitoring();
  const allProjects = await window.electronAPI.getAllProjects();
  const allProjectUsers = await window.electronAPI.getAllProjectUsers();
  const projectRoles = await window.electronAPI.getAllProjectRoles();

  let currentUser = null;
  let currentSessionUuid = null;
  let userProjects = [];

  // hiding sections initially
  projectSection.style.display = 'none';
  taskSection.style.display = 'none';

  // ==================
  // Login
  // ==================
  document.getElementById('start-button').addEventListener('click', async () => {
    const code = authInput.value.trim();
    const errorEl = document.getElementById('login-error');

    const user = await window.electronAPI.loginWithCode(code);

    if (user) {
      currentUser = user;
      errorEl.style.display = 'none';
      document.getElementById('login-screen').style.display = 'none';
      document.getElementById('main-screen').style.display = 'block';
      document.getElementById('welcome-text').textContent =
        `Welcome, ${user.first_name} ${user.last_name}`;
    } else {
      errorEl.style.display = 'block';
    }
  });

  // ==================
  // Logout
  // ==================
  logoutButton.addEventListener('click', async () => {
    if (currentUser) {
      await window.electronAPI.logout({ userId: currentUser.id });
    }

    currentUser = null;
    currentSessionUuid = null;

    // reset UI
    clockinButton.textContent = 'CLOCK-IN';
    projectSection.style.display = 'none';
    taskSection.style.display = 'none';
    projectSelect.innerHTML = '<option value="">— Select Project —</option>';
    roleText.textContent = '';
    taskSelect.innerHTML = '<option value="">— Select Task —</option>';
    const dataList = document.getElementById('items-list');
    if (dataList) dataList.innerHTML = '';
    itemInput.value = '';

    document.getElementById('login-screen').style.display = 'block';
    document.getElementById('main-screen').style.display = 'none';
    authInput.value = '';
    authInput.blur();
    setTimeout(() => authInput.focus(), 50);

    console.log('[renderer] User logged out and UI reset');
  });

  // ==================
  // CLOCK-IN / CLOCK-OUT
  // ==================
  clockinButton.addEventListener('click', async () => {
    if (clockinButton.textContent === 'CLOCK-IN') {
      currentSessionUuid = await handleClockIn(currentUser.id);
      if (!currentSessionUuid) return;

      clockinButton.textContent = 'CLOCK-OUT';
      alert(`Clock-in successful! (uuid=${currentSessionUuid})`);

      // projects for user
      userProjects = buildProjectList(allProjects, allProjectUsers, projectRoles, currentUser.id);
      projectSelect.innerHTML = '<option value="">— Select Project —</option>';
      userProjects.forEach(p => {
        const option = document.createElement('option');
        option.value = p.project_id;
        option.textContent = p.name;
        projectSelect.appendChild(option);
      });

      projectSection.style.display = 'block';
    } else {
      // CLOCK-OUT
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

      clockinButton.textContent = 'CLOCK-IN';
      alert(`Clock-out successful! (uuid=${currentSessionUuid})`);
      currentSessionUuid = null;

      // reset UI after clock-out
      projectSection.style.display = 'none';
      taskSection.style.display = 'none';
      projectSelect.innerHTML = '<option value="">— Select Project —</option>';
      roleText.textContent = '';
      taskSelect.innerHTML = '<option value="">— Select Task —</option>';
      const dataList = document.getElementById('items-list');
      if (dataList) dataList.innerHTML = '';
      itemInput.value = '';
    }
  });

  // ==================
  // Project change
  // ==================
  projectSelect.addEventListener('change', async (e) => {
    const selected = userProjects.find(p => p.project_id == e.target.value);

    if (!selected) {
      roleText.textContent = '';
      taskSection.style.display = 'none';
      const dataList = document.getElementById('items-list');
      if (dataList) dataList.innerHTML = '';
      itemInput.value = '';
      return;
    }

    roleText.textContent = `Your role: ${selected.role}`;

    await populateTasks(currentUser, selected);

    if (selected.project_type_id === 1 || selected.project_type_id === 2) {
      await populateItems(selected);
    } else {
      const dataList = document.getElementById('items-list');
      if (dataList) dataList.innerHTML = '';
      itemInput.value = '';
    }
  });

  // ==================
  // Helpers
  // ==================
  async function handleClockIn(userId) {
    const result = await window.electronAPI.startUnallocated({ userId });
    if (!result.success) {
      alert('Clock-in failed: ' + result.error);
      return null;
    }
    return result.uuid;
  }

  function buildProjectList(allProjects, allProjectUsers, projectRoles, currentUserId) {
    return allProjectUsers
      .filter(pu => pu.user_id === currentUserId)
      .map(pu => {
        const project = allProjects.find(p => p.id === pu.project_id);
        const role = projectRoles.find(r => r.id === pu.project_role_id);
        return {
          project_id: project?.id,
          name: project?.name,
          project_type_id: project?.type_id,
          role: role?.label || role?.name || 'Unknown'
        };
      })
      .filter(p => !!p.project_id);
  }

  async function populateTasks(currentUser, project) {
    const tasks = await window.electronAPI.getAvailableTasks(currentUser.id, project.project_id);
    taskSelect.innerHTML = '<option value="">— Select Task —</option>';

    let defaultTaskId = null;
    tasks.forEach(t => {
      const option = document.createElement('option');
      option.value = t.id;
      option.textContent = t.description || t.name;
      taskSelect.appendChild(option);
      if (t.is_default === 1) defaultTaskId = t.id;
    });

    if (defaultTaskId) taskSelect.value = defaultTaskId;
    taskSection.style.display = tasks.length > 0 ? 'block' : 'none';
  }

  async function populateItems(project) {
    const items = await window.electronAPI.getProjectItems(project.project_id, project.project_type_id);
    console.log('[renderer] Available items:', items); // 👈 посмотри в консоль DevTools

    let dataList = document.getElementById('items-list');
    if (!dataList) {
      dataList = document.createElement('datalist');
      dataList.id = 'items-list';
      document.body.appendChild(dataList);
      itemInput.setAttribute('list', 'items-list');
    }

    dataList.innerHTML = '';
    items.forEach(item => {
      const option = document.createElement('option');
      option.value = item.name;   // 👈 здесь теперь будет label
      dataList.appendChild(option);
    });
  }

});
