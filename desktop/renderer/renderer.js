document.addEventListener('DOMContentLoaded', async () => {
  const authInput = document.getElementById('authcode-input');
  const clockinButton = document.getElementById('clockin-button');
  const logoutButton = document.getElementById('logout-button');
  const projectSelect = document.getElementById('project-select');
  const rememberButton = document.getElementById('remember-project');
  const forgetButton = document.getElementById('forget-project');
  const roleText = document.getElementById('project-role');
  const taskSection = document.getElementById('task-selector-section');
  const taskSelect = document.getElementById('task-select');
  const startTaskButton = document.getElementById('start-task-button');
  const finishTaskButton = document.getElementById('finish-task-button');
  const stopTaskButton = document.getElementById('stop-task-button');
  const taskOverlay = document.getElementById('task-overlay');
  const taskOverlayName = document.getElementById('task-overlay-name');
  const taskOverlayTimer = document.getElementById('task-overlay-timer');
  const activityOverlay = document.getElementById('activity-overlay');
  const activityOverlayName = document.getElementById('activity-overlay-name');
  const activityOverlayTimer = document.getElementById('activity-overlay-timer');
  const finishActivityButton = document.getElementById('finish-activity-button');
  const breakButton = document.getElementById('break-btn');
  const prodBreakButton = document.getElementById('prod-btn');
  const activitySection = document.querySelector('.activity-section');
  const productionSection = document.querySelector('.production-section');
  const projectSection = document.querySelector('.project-selector-section');
  const itemInput = document.getElementById('item-input');
  const timerEl = document.querySelector('.timer');
  const savedProjectKey = 'rememberedProject';

  authInput.focus();
  authInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('start-button').click();
  });

  window.network.startConnectionMonitoring();
  let allProjects = await window.electronAPI.getAllProjects();
  let allProjectUsers = await window.electronAPI.getAllProjectUsers();
  let projectRoles = await window.electronAPI.getAllProjectRoles();

  let currentUser = null;
  let currentSessionUuid = null;
  let currentTaskUuid = null;
  let userProjects = [];
  let userSelectedTask = false;
  let timerIntervalId = null;
  let timerStartMs = null;
  let taskTimerIntervalId = null;
  let taskTimerStartMs = null;
  let activityTimerIntervalId = null;
  let activityTimerStartMs = null;
  let activitySectionDisplay = '';
  let productionSectionDisplay = '';

  // hiding sections initially
  projectSection.style.display = 'none';
  taskSection.style.display = 'none';
  if (activitySection) activitySection.style.display = 'none';
  if (productionSection) productionSection.style.display = 'none';
  updateBookmarkButtons(!!getSavedProject());

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
      document.getElementById('main-screen').style.display = 'flex';
      document.getElementById('welcome-text').textContent =
        `${user.first_name} ${user.last_name}`;
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
    currentTaskUuid = null;
    stopTimer(true);
    stopTaskTimer(true);
    if (taskOverlay) taskOverlay.style.display = 'none';

    // reset UI
    clockinButton.textContent = 'CLOCK-IN';
    projectSection.style.display = 'none';
    taskSection.style.display = 'none';
    if (activitySection) activitySection.style.display = 'none';
    if (productionSection) productionSection.style.display = 'none';
    projectSelect.innerHTML = '<option value="">— Select Project —</option>';
    roleText.textContent = '';
    taskSelect.innerHTML = '<option value="">— Select Task —</option>';
    taskSelect.disabled = true;
    updateStartButton();
    const dataList = document.getElementById('items-list');
    if (dataList) dataList.innerHTML = '';
    if (itemInput) itemInput.value = '';

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

      await refreshProjectDataIfOnline({ updateOptions: false });

      clockinButton.textContent = 'CLOCK-OUT';
      alert(`Clock-in successful! (uuid=${currentSessionUuid})`);
      startTimer();
      if (activitySection) activitySection.style.display = '';
      if (productionSection) productionSection.style.display = '';

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

      const saved = getSavedProject();
      if (saved) {
        const matched = userProjects.find(
          (p) => Number(p.project_id) === Number(saved.projectId)
        );
        if (matched && Number(matched.role_id) === Number(saved.roleId)) {
          projectSelect.value = String(matched.project_id);
          updateBookmarkButtons(true);
          projectSelect.dispatchEvent(new Event('change'));
        } else {
          clearSavedProject();
          updateBookmarkButtons(false);
        }
      } else {
        updateBookmarkButtons(false);
      }
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
      currentTaskUuid = null;
      stopTimer(true);
      stopTaskTimer(true);
      if (taskOverlay) taskOverlay.style.display = 'none';
      if (activityOverlay) activityOverlay.style.display = 'none';
      stopActivityTimer(true);

      // reset UI after clock-out
      projectSection.style.display = 'none';
      taskSection.style.display = 'none';
      if (activitySection) activitySection.style.display = 'none';
      if (productionSection) productionSection.style.display = 'none';
      projectSelect.innerHTML = '<option value="">— Select Project —</option>';
      roleText.textContent = '';
      taskSelect.innerHTML = '<option value="">— Select Task —</option>';
      taskSelect.disabled = true;
    updateStartButton();
      const dataList = document.getElementById('items-list');
      if (dataList) dataList.innerHTML = '';
      if (itemInput) itemInput.value = '';
    }
  });

  rememberButton?.addEventListener('click', () => {
    const selectedId = projectSelect.value;
    if (!selectedId) return;
    const selected = userProjects.find(p => String(p.project_id) === String(selectedId));
    if (!selected) return;
    setSavedProject(selected);
    updateBookmarkButtons(true);
  });

  forgetButton?.addEventListener('click', () => {
    clearSavedProject();
    updateBookmarkButtons(false);
  });

  const handleBreakClick = async () => {
    if (!currentUser) return;

    if (currentTaskUuid) {
      const result = await window.electronAPI.completeActiveActivity({
        uuid: currentTaskUuid,
        userId: currentUser.id,
        isTaskCompleted: false
      });

      if (!result.success) {
        alert('Task stop failed: ' + result.error);
        return;
      }

      currentTaskUuid = null;
      if (taskOverlay) taskOverlay.style.display = 'none';
      stopTaskTimer(true);
      updateStartButton();

    }

    if (currentSessionUuid) {
      const result = await window.electronAPI.completeActiveActivity({
        uuid: currentSessionUuid,
        userId: currentUser.id,
        isTaskCompleted: false
      });

      if (!result.success) {
        alert('Failed to stop current activity: ' + result.error);
        return;
      }
      currentSessionUuid = null;
    }

    const breakResult = await window.electronAPI.startUnallocated(currentUser.id, 3);
    if (!breakResult.success) {
      alert('Failed to start break: ' + breakResult.error);
      return;
    }

    currentSessionUuid = breakResult.uuid;
    showActivityOverlay('Break');
  };

  breakButton?.addEventListener('click', handleBreakClick);
  prodBreakButton?.addEventListener('click', handleBreakClick);

  startTaskButton?.addEventListener('click', async () => {
    if (!taskOverlay || !taskOverlayName || !taskOverlayTimer) return;
    if (!currentUser) return;
    const selectedTask = taskSelect.options[taskSelect.selectedIndex]?.textContent?.trim() || '';
    if (!selectedTask || taskSelect.value === '' || !projectSelect.value) return;

    if (currentSessionUuid) {
      const unallocatedResult = await window.electronAPI.completeActiveActivity({
        uuid: currentSessionUuid,
        userId: currentUser.id,
        isTaskCompleted: false
      });

      if (!unallocatedResult.success) {
        alert('Failed to stop unallocated time: ' + unallocatedResult.error);
        return;
      }
      currentSessionUuid = null;
    }

    const result = await window.electronAPI.startTaskActivity(
      currentUser.id,
      Number(projectSelect.value),
      Number(taskSelect.value)
    );

    if (!result.success) {
      alert('Task start failed: ' + result.error);
      return;
    }

    currentTaskUuid = result.uuid;
    taskOverlayName.textContent = selectedTask;
    taskOverlay.style.display = 'flex';
    if (startTaskButton) startTaskButton.disabled = true;
    startTaskTimer();
  });

  const handleFinishTask = async () => {
    if (!currentUser || !currentTaskUuid) {
      if (taskOverlay) taskOverlay.style.display = 'none';
      stopTaskTimer(true);
      updateStartButton();
      return;
    }

    const result = await window.electronAPI.completeActiveActivity({
      uuid: currentTaskUuid,
      userId: currentUser.id,
      isTaskCompleted: true
    });

    if (!result.success) {
      alert('Task finish failed: ' + result.error);
      return;
    }

    currentTaskUuid = null;
    if (taskOverlay) taskOverlay.style.display = 'none';
    stopTaskTimer(true);
    updateStartButton();

    const unallocatedResult = await window.electronAPI.startUnallocated(currentUser.id);
    if (!unallocatedResult.success) {
      alert('Failed to start unallocated time: ' + unallocatedResult.error);
      return;
    }
    currentSessionUuid = unallocatedResult.uuid;
  };

  finishTaskButton?.addEventListener('click', handleFinishTask);
  stopTaskButton?.addEventListener('click', handleFinishTask);
  finishActivityButton?.addEventListener('click', async () => {
    if (currentUser && currentSessionUuid) {
      const result = await window.electronAPI.completeActiveActivity({
        uuid: currentSessionUuid,
        userId: currentUser.id,
        isTaskCompleted: false
      });

      if (!result.success) {
        alert('Failed to finish break: ' + result.error);
        return;
      }
      currentSessionUuid = null;
    }
    hideActivityOverlay();
  });

  taskSelect?.addEventListener('change', () => {
    userSelectedTask = taskSelect.selectedIndex > 0;
    updateStartButton();
  });

  // ==================
  // Project change
  // ==================
  projectSelect.addEventListener('change', async (e) => {
    const selected = userProjects.find(p => p.project_id == e.target.value);

    if (!selected) {
      resetProjectSelectionUi();
      return;
    }

    roleText.textContent = `Your role: ${selected.role_label}`;

    taskSection.style.display = 'block';
    await populateTasks(currentUser, selected);
    userSelectedTask = false;
    updateStartButton();

    if (selected.project_type_id === 1 || selected.project_type_id === 2) {
      await populateItems(selected);
    } else {
      const dataList = document.getElementById('items-list');
      if (dataList) dataList.innerHTML = '';
      if (itemInput) itemInput.value = '';
    }
  });

  projectSelect.addEventListener('focus', async () => {
    await refreshProjectDataIfOnline();
  });

  projectSelect.addEventListener('mousedown', async () => {
    await refreshProjectDataIfOnline();
  });

  // ==================
  // Helpers
  // ==================
  async function handleClockIn(userId) {
    const result = await window.electronAPI.startUnallocated(userId);
    if (!result.success) {
      alert('Clock-in failed: ' + result.error);
      return null;
    }
    return result.uuid;
  }

  function startTimer() {
    stopTimer();
    timerStartMs = Date.now();
    updateTimerDisplay();
    timerIntervalId = setInterval(updateTimerDisplay, 1000);
  }

  function stopTimer(reset) {
    if (timerIntervalId) {
      clearInterval(timerIntervalId);
      timerIntervalId = null;
    }
    timerStartMs = null;
    if (reset) timerEl.textContent = '00:00';
  }

  function updateTimerDisplay() {
    if (!timerStartMs) return;
    const elapsedMs = Date.now() - timerStartMs;
    const totalMinutes = Math.floor(elapsedMs / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    timerEl.textContent = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }

  function getSavedProject() {
    try {
      const raw = localStorage.getItem(savedProjectKey);
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      console.warn('[renderer] Failed to parse saved project:', err);
      return null;
    }
  }

  function setSavedProject(project) {
    const payload = { projectId: project.project_id, roleId: project.role_id };
    localStorage.setItem(savedProjectKey, JSON.stringify(payload));
  }

  function clearSavedProject() {
    localStorage.removeItem(savedProjectKey);
  }

  function updateBookmarkButtons(hasSaved) {
    if (!rememberButton || !forgetButton) return;
    rememberButton.style.display = hasSaved ? 'none' : 'inline-flex';
    forgetButton.style.display = hasSaved ? 'inline-flex' : 'none';
  }

  function updateStartButton() {
    if (!startTaskButton) return;
    const hasProject = !!projectSelect.value;
    const hasTask =
      userSelectedTask &&
      !taskSelect.disabled &&
      taskSelect.selectedIndex > 0 &&
      !!taskSelect.value;
    startTaskButton.disabled = !(hasProject && hasTask);
  }

  function resetProjectSelectionUi() {
    roleText.textContent = '';
    taskSection.style.display = 'none';
    taskSelect.innerHTML = '<option value="">Select Task</option>';
    taskSelect.disabled = true;
    updateStartButton();
    const dataList = document.getElementById('items-list');
    if (dataList) dataList.innerHTML = '';
    if (itemInput) itemInput.value = '';
  }

  async function refreshProjectDataIfOnline({ updateOptions = true } = {}) {
    if (!currentUser || !window.network?.isOnline?.()) return;

    try {
      const selectedProjectId = projectSelect.value;
      const [projects, projectUsers, roles] = await Promise.all([
        window.electronAPI.getAllProjects(),
        window.electronAPI.getAllProjectUsers(),
        window.electronAPI.getAllProjectRoles(),
      ]);

      allProjects = projects;
      allProjectUsers = projectUsers;
      projectRoles = roles;

      if (!updateOptions) return;

      userProjects = buildProjectList(allProjects, allProjectUsers, projectRoles, currentUser.id);
      projectSelect.innerHTML = '<option value="">Select Project</option>';
      userProjects.forEach(p => {
        const option = document.createElement('option');
        option.value = p.project_id;
        option.textContent = p.name;
        projectSelect.appendChild(option);
      });

      if (selectedProjectId) {
        projectSelect.value = selectedProjectId;
        if (projectSelect.value !== selectedProjectId) {
          projectSelect.value = '';
          resetProjectSelectionUi();
        }
      }
    } catch (err) {
      console.warn('[renderer] Failed to refresh projects:', err);
    }
  }

  function startTaskTimer() {
    stopTaskTimer();
    taskTimerStartMs = Date.now();
    updateTaskTimerDisplay();
    taskTimerIntervalId = setInterval(updateTaskTimerDisplay, 1000);
  }

  function stopTaskTimer(reset) {
    if (taskTimerIntervalId) {
      clearInterval(taskTimerIntervalId);
      taskTimerIntervalId = null;
    }
    taskTimerStartMs = null;
    if (reset && taskOverlayTimer) taskOverlayTimer.textContent = '00:00:00';
  }

  function updateTaskTimerDisplay() {
    if (!taskTimerStartMs || !taskOverlayTimer) return;
    const elapsedMs = Date.now() - taskTimerStartMs;
    const totalSeconds = Math.floor(elapsedMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    taskOverlayTimer.textContent = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  function showActivityOverlay(label) {
    if (!activityOverlay || !activityOverlayName || !activityOverlayTimer) return;
    activityOverlayName.textContent = label;
    activitySectionDisplay = activitySection?.style.display ?? '';
    productionSectionDisplay = productionSection?.style.display ?? '';
    if (activitySection) activitySection.style.display = 'none';
    if (productionSection) productionSection.style.display = 'none';
    activityOverlay.style.display = 'flex';
    startActivityTimer();
  }

  function hideActivityOverlay() {
    if (!activityOverlay) return;
    activityOverlay.style.display = 'none';
    if (activitySection) activitySection.style.display = activitySectionDisplay;
    if (productionSection) productionSection.style.display = productionSectionDisplay;
    stopActivityTimer(true);
  }

  function startActivityTimer() {
    stopActivityTimer();
    activityTimerStartMs = Date.now();
    updateActivityTimerDisplay();
    activityTimerIntervalId = setInterval(updateActivityTimerDisplay, 1000);
  }

  function stopActivityTimer(reset) {
    if (activityTimerIntervalId) {
      clearInterval(activityTimerIntervalId);
      activityTimerIntervalId = null;
    }
    activityTimerStartMs = null;
    if (reset && activityOverlayTimer) activityOverlayTimer.textContent = '00:00:00';
  }

  function updateActivityTimerDisplay() {
    if (!activityTimerStartMs || !activityOverlayTimer) return;
    const elapsedMs = Date.now() - activityTimerStartMs;
    const totalSeconds = Math.floor(elapsedMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    activityOverlayTimer.textContent = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
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
          role_id: pu.project_role_id,
          role_label: role?.label || role?.name || 'Unknown',
        };
      })
      .filter(p => !!p.project_id);
  }

  async function populateTasks(currentUser, project) {
    const tasks = await window.electronAPI.getAvailableTasks(currentUser.id, project.project_id);
    const uniqueTasks = [];
    const seen = new Set();
    tasks.forEach(t => {
      if (seen.has(t.id)) return;
      seen.add(t.id);
      uniqueTasks.push(t);
    });

    taskSelect.innerHTML = uniqueTasks.length
      ? '<option value="">Select Task</option>'
      : '<option value="">No tasks available</option>';
    taskSelect.disabled = uniqueTasks.length === 0;

    let defaultTaskId = null;
    uniqueTasks.forEach(t => {
      const option = document.createElement('option');
      option.value = t.id;
      option.textContent = t.description || t.name;
      taskSelect.appendChild(option);
      if (t.is_default === 1) defaultTaskId = t.id;
    });

    if (defaultTaskId) taskSelect.value = defaultTaskId;
  }

  async function populateItems(project) {
    if (!itemInput) return;
    const items = await window.electronAPI.getProjectItems(project.project_id, project.project_type_id);
    console.log('[renderer] Available items:', items);

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
      option.value = item.name; 
      dataList.appendChild(option);
    });
  }

});


