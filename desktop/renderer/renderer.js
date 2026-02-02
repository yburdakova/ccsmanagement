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
  const itemSection = document.getElementById('item-selector-section');
  const itemSelect = document.getElementById('item-select');
  const taskDataSection = document.getElementById('task-data-section');
  const taskDataList = document.getElementById('task-data-list');
  const taskOverlay = document.getElementById('task-overlay');
  if (taskOverlay) {
    taskOverlay.setAttribute('tabindex', '0');
    taskOverlay.addEventListener('mousedown', () => {
      window.focus();
      taskOverlay.focus();
    });
  }
  const taskOverlayName = document.getElementById('task-overlay-name');
  const taskOverlayItem = document.getElementById('task-overlay-item');
  const taskOverlayTimer = document.getElementById('task-overlay-timer');
  const taskOverlayNote = document.getElementById('task-overlay-note');
  const taskOverlayData = document.getElementById('task-overlay-data');
  const taskOverlayDataList = document.getElementById('task-overlay-data-list');
  const activityOverlay = document.getElementById('activity-overlay');
  const activityOverlayName = document.getElementById('activity-overlay-name');
  const activityOverlayTimer = document.getElementById('activity-overlay-timer');
  const activityOverlayNote = document.getElementById('activity-overlay-note');
  const finishActivityButton = document.getElementById('finish-activity-button');
  const breakButton = document.getElementById('prod-btn');
  const lunchButton = document.getElementById('lunch-btn');
  const meetingButton = document.getElementById('adm-btn');
  const adminButton = document.getElementById('break-btn');
  const activitySection = document.querySelector('.activity-section');
  const productionSection = document.querySelector('.production-section');
  const projectSection = document.querySelector('.project-selector-section');
  const notesSection = document.getElementById('notes-section');
  const unfinishedButton = document.getElementById('unfinished-btn');
  const unfinishedCount = document.getElementById('unfinished-count');
  const unfinishedList = document.getElementById('unfinished-list');
  const assignmentsButton = document.getElementById('assignments-btn');
  const assignmentsList = document.getElementById('assignments-list');
  const assignmentsCount = document.getElementById('assignments-count');
  const timerEl = document.querySelector('.timer');
  const savedProjectKey = 'rememberedProject';
  const workTimerStateKey = 'workTimerState';
  const itemInputLabel = document.getElementById('item-input-label');

  authInput.focus();
  authInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('start-button').click();
  });

  window.network.startConnectionMonitoring();
  window.addEventListener('beforeunload', () => {
    persistWorkTimerState();
  });
  let allProjects = await window.electronAPI.getAllProjects();
  let allProjectUsers = await window.electronAPI.getAllProjectUsers();
  let projectRoles = await window.electronAPI.getAllProjectRoles();
  let allItemTypes = await window.electronAPI.getItemTypes();
  let allCustomers = await window.electronAPI.getAllCustomers();

  let currentUser = null;
  let currentSessionUuid = null;
  let currentTaskUuid = null;
  let currentTaskItemId = null;
  let currentTaskStatusRule = null;
  let finishStatusRule = null;
  let currentTaskDataRows = [];
  let userProjects = [];
  let userSelectedTask = false;
  let timerIntervalId = null;
  let timerStartMs = null;
  let workTimerPausedElapsedMs = null;
  let taskTimerIntervalId = null;
  let taskTimerStartMs = null;
  let activityTimerIntervalId = null;
  let activityTimerStartMs = null;
  let activitySectionDisplay = '';
  let productionSectionDisplay = '';
  let currentProject = null;
  let itemTrackingTaskIds = new Set();
  let itemsLoadedProjectId = null;
  let projectItems = [];
  let itemTypesById = new Map(
    (allItemTypes || []).map((type) => [Number(type.id), String(type.name || '').trim()])
  );
  let pendingUnfinishedTask = null;
  let pendingTaskSelection = null;
  let pendingAssignment = null;
  let pendingAssignmentSelection = null;
  let assignmentsTotal = 0;

  // hiding sections initially
  projectSection.style.display = 'none';
  taskSection.style.display = 'none';
  if (taskDataSection) taskDataSection.style.display = 'none';
  if (activitySection) activitySection.style.display = 'none';
  if (productionSection) productionSection.style.display = 'none';
  if (notesSection) notesSection.style.display = 'none';
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
    currentTaskItemId = null;
    currentTaskStatusRule = null;
    currentTaskDataRows = [];
    pendingAssignment = null;
    pendingAssignmentSelection = null;
    stopTimer(true);
    stopTaskTimer(true);
    if (taskOverlay) taskOverlay.style.display = 'none';

    // reset UI
    clockinButton.textContent = 'CLOCK-IN';
    projectSection.style.display = 'none';
    taskSection.style.display = 'none';
    if (activitySection) activitySection.style.display = 'none';
    if (productionSection) productionSection.style.display = 'none';
    if (notesSection) notesSection.style.display = 'none';
    if (unfinishedCount) unfinishedCount.textContent = '0';
    if (unfinishedList) unfinishedList.style.display = 'none';
    if (unfinishedList) unfinishedList.innerHTML = '';
    if (assignmentsCount) assignmentsCount.textContent = '0';
    if (assignmentsList) assignmentsList.style.display = 'none';
    if (assignmentsList) assignmentsList.innerHTML = '';
    assignmentsTotal = 0;
    projectSelect.innerHTML = '<option value="">— Select Project —</option>';
    roleText.textContent = '';
    taskSelect.innerHTML = '<option value="">— Select Task —</option>';
    taskSelect.disabled = true;
    updateStartButton();
    if (itemSection) itemSection.style.display = 'none';
    if (itemSelect) itemSelect.innerHTML = '<option value="">Select item</option>';
    if (itemInputLabel) itemInputLabel.textContent = 'Item';
    if (taskDataSection) taskDataSection.style.display = 'none';
    if (taskDataList) taskDataList.innerHTML = '';
    projectItems = [];
    itemTrackingTaskIds = new Set();
    itemsLoadedProjectId = null;
    currentProject = null;

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

      window.electronAPI.initLocalDb();

      await refreshProjectDataIfOnline({ updateOptions: false });
      

      clockinButton.textContent = 'CLOCK-OUT';
      alert(`Clock-in successful! (uuid=${currentSessionUuid})`);
      resumeOrStartWorkTimer();
      if (activitySection) activitySection.style.display = '';
      if (productionSection) productionSection.style.display = '';
      if (notesSection) notesSection.style.display = '';
      await refreshUnfinishedTasksCount();

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
      const activeUuid = currentTaskUuid || currentSessionUuid;
      if (!activeUuid) {
        alert('No active session UUID found!');
        return;
      }

      const result = await window.electronAPI.completeActiveActivity({
        uuid: activeUuid,
        userId: currentUser.id,
        isTaskCompleted: false
      });

      if (!result.success) {
        alert('Clock-out failed: ' + result.error);
        return;
      }

      clockinButton.textContent = 'CLOCK-IN';
      alert(`Clock-out successful! (uuid=${activeUuid})`);
      persistWorkTimerState();
      currentSessionUuid = null;
      currentTaskUuid = null;
      currentTaskItemId = null;
      currentTaskStatusRule = null;
      currentTaskDataRows = [];
    currentTaskDataRows = [];
      pendingAssignment = null;
      pendingAssignmentSelection = null;
      stopTimer(true);
      stopTaskTimer(true);
      workTimerPausedElapsedMs = null;
      if (timerEl) timerEl.style.color = '';
      if (taskOverlay) taskOverlay.style.display = 'none';
      if (activityOverlay) activityOverlay.style.display = 'none';
      stopActivityTimer(true);

      // reset UI after clock-out
      projectSection.style.display = 'none';
      taskSection.style.display = 'none';
      if (activitySection) activitySection.style.display = 'none';
      if (productionSection) productionSection.style.display = 'none';
      if (notesSection) notesSection.style.display = 'none';
      if (unfinishedCount) unfinishedCount.textContent = '0';
      if (unfinishedList) unfinishedList.style.display = 'none';
      if (unfinishedList) unfinishedList.innerHTML = '';
      if (assignmentsCount) assignmentsCount.textContent = '0';
      if (assignmentsList) assignmentsList.style.display = 'none';
      if (assignmentsList) assignmentsList.innerHTML = '';
      assignmentsTotal = 0;
      projectSelect.innerHTML = '<option value="">— Select Project —</option>';
      roleText.textContent = '';
      taskSelect.innerHTML = '<option value="">— Select Task —</option>';
      taskSelect.disabled = true;
    updateStartButton();
      if (itemSection) itemSection.style.display = 'none';
      if (itemSelect) itemSelect.innerHTML = '<option value="">Select item</option>';
      if (itemInputLabel) itemInputLabel.textContent = 'Item';
      if (taskDataSection) taskDataSection.style.display = 'none';
      if (taskDataList) taskDataList.innerHTML = '';
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

  const handleActivityClick = async (activityId, label) => {
    if (!currentUser) return;

    if (currentTaskUuid) {
      pendingUnfinishedTask = { id: currentTaskUuid, isUuid: true };
      pendingTaskSelection = {
        projectId: String(projectSelect.value),
        taskId: String(taskSelect.value),
        itemId: String(itemSelect?.value || ''),
      };
      if (startTaskButton) startTaskButton.textContent = 'CONTINUE';
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

    const activityResult = await window.electronAPI.startUnallocated(currentUser.id, activityId);
    if (!activityResult.success) {
      alert(`Failed to start ${label.toLowerCase()}: ` + activityResult.error);
      return;
    }

    currentSessionUuid = activityResult.uuid;
    if (activityId === 1) {
      pauseWorkTimerForLunch();
    }
    showActivityOverlay(label);
    await refreshUnfinishedTasksCount();
    if (unfinishedList && unfinishedList.style.display !== 'none') {
      const tasks = await loadUnfinishedTasks();
      renderUnfinishedTasks(tasks);
    }
    await refreshAssignmentsListIfOpen();
  };

  const handleBreakClick = () => handleActivityClick(3, 'Break');
  const handleLunchClick = () => handleActivityClick(1, 'Lunch');
  const handleMeetingClick = () => handleActivityClick(5, 'Meeting');
  const handleAdministrationClick = () => handleActivityClick(8, 'Administration');

  breakButton?.addEventListener('click', handleBreakClick);
  lunchButton?.addEventListener('click', handleLunchClick);
  meetingButton?.addEventListener('click', handleMeetingClick);
  adminButton?.addEventListener('click', handleAdministrationClick);

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

    const selectedItemId = itemSelect?.value ? Number(itemSelect.value) : null;

    if (pendingUnfinishedTask && pendingTaskSelection) {
      const sameSelection =
        String(pendingTaskSelection.projectId) === String(projectSelect.value) &&
        String(pendingTaskSelection.taskId) === String(taskSelect.value) &&
        String(pendingTaskSelection.itemId || '') === String(itemSelect?.value || '');
      if (!sameSelection) {
        pendingUnfinishedTask = null;
        pendingTaskSelection = null;
        if (startTaskButton) startTaskButton.textContent = 'START';
      }
    }

    if (pendingAssignment && pendingAssignmentSelection) {
      const sameSelection =
        String(pendingAssignmentSelection.projectId) === String(projectSelect.value) &&
        String(pendingAssignmentSelection.taskId) === String(taskSelect.value) &&
        String(pendingAssignmentSelection.itemId || '') === String(itemSelect?.value || '');
      if (!sameSelection) {
        pendingAssignment = null;
        pendingAssignmentSelection = null;
      }
    }

    if (pendingUnfinishedTask) {
      if (pendingUnfinishedTask.isUuid) {
        await window.electronAPI.markUnfinishedFinished(null, pendingUnfinishedTask.id);
      } else {
        const markResult = await window.electronAPI.markUnfinishedFinished(
          pendingUnfinishedTask.id
        );
        if (!markResult?.success) {
          console.warn('[renderer] Failed to mark unfinished task finished:', markResult?.error);
        }
      }
      pendingUnfinishedTask = null;
      pendingTaskSelection = null;
      if (startTaskButton) startTaskButton.textContent = 'START';
      await refreshUnfinishedTasksCount();
      if (unfinishedList && unfinishedList.style.display !== 'none') {
        const tasks = await loadUnfinishedTasks();
        renderUnfinishedTasks(tasks);
      }
      await refreshAssignmentsListIfOpen();
    }
    const result = await window.electronAPI.startTaskActivity(
      currentUser.id,
      Number(projectSelect.value),
      Number(taskSelect.value),
      selectedItemId
    );

    if (!result.success) {
      alert('Task start failed: ' + result.error);
      return;
    }

    if (pendingAssignment && pendingAssignmentSelection) {
      const sameSelection =
        String(pendingAssignmentSelection.projectId) === String(projectSelect.value) &&
        String(pendingAssignmentSelection.taskId) === String(taskSelect.value) &&
        String(pendingAssignmentSelection.itemId || '') === String(itemSelect?.value || '');
      if (sameSelection) {
        const acceptResult = await window.electronAPI.markAssignmentAccepted(
          pendingAssignment.id
        );
        if (!acceptResult?.success) {
          console.warn('[renderer] Failed to accept assignment:', acceptResult?.error);
        }
        pendingAssignment = null;
        pendingAssignmentSelection = null;
        await refreshUnfinishedTasksCount();
        await refreshAssignmentsListIfOpen();
      }
    }

    currentTaskUuid = result.uuid;
    currentTaskItemId = selectedItemId;
    const projectId = Number(projectSelect.value);
    const taskId = Number(taskSelect.value);
    currentTaskStatusRule = await window.electronAPI.getItemStatusRule(
      projectId,
      taskId,
      0
    );
    finishStatusRule = await window.electronAPI.getItemStatusRule(
      projectId,
      taskId,
      1
    );
    if (
      currentTaskItemId &&
      currentTaskStatusRule &&
      currentTaskStatusRule.statusId
    ) {
      const statusResult = await window.electronAPI.updateItemStatus(
        currentTaskItemId,
        currentTaskStatusRule.statusId
      );
      if (!statusResult?.success) {
        console.warn('[renderer] Failed to update item status on start:', statusResult?.error);
      } else {
        await refreshItemOptions(currentTaskItemId);
      }
    }
    taskOverlayName.textContent = selectedTask;
    await loadTaskDataOverlay(projectId, taskId);
    if (taskOverlayItem) {
      if (currentTaskItemId && projectItems.length) {
        const item = projectItems.find((entry) => Number(entry.id) === Number(currentTaskItemId));
        const label = item?.name ? String(item.name).trim() : '';
        taskOverlayItem.textContent = label ? `Item: ${label}` : '';
        taskOverlayItem.style.display = label ? 'block' : 'none';
      } else {
        taskOverlayItem.textContent = '';
        taskOverlayItem.style.display = 'none';
      }
    }
    clearNoteInput(taskOverlayNote);
    taskOverlay.style.display = 'flex';
    if (startTaskButton) startTaskButton.disabled = true;
    startTaskTimer();
    if (taskOverlay) taskOverlay.focus();
    if (taskOverlayNote) {
      taskOverlayNote.disabled = false;
      taskOverlayNote.readOnly = false;
      setTimeout(() => taskOverlayNote.focus(), 50);
    }
    setTimeout(() => focusTaskDataInput(), 0);
  });

  const saveTaskDataValues = async () => {
    if (!currentUser || !currentProject) return;
    if (!taskOverlayDataList) return;

    const inputs = taskOverlayDataList.querySelectorAll('input, textarea, select');
    for (const input of inputs) {
      const dataDefId = Number(input.getAttribute('data-def-id'));
      const valueType = input.getAttribute('data-value-type') || '';
      if (!dataDefId || !valueType) continue;

      const value = input.value;
      const payload = {
        projectId: currentProject.project_id,
        taskId: Number(taskSelect.value),
        dataDefId,
        valueType,
        value
      };
      console.log('[task-data] save payload', payload);
      const result = await window.electronAPI.saveTaskData(payload);
      if (!result?.success) {
        console.warn('[renderer] Failed to save task data:', result?.error);
      }
    }
  };

  const handleFinishTask = async (applyStatus) => {
    if (!currentUser || !currentTaskUuid) {
      if (taskOverlay) taskOverlay.style.display = 'none';
      clearNoteInput(taskOverlayNote);
    if (taskOverlayData) taskOverlayData.style.display = 'none';
    if (taskOverlayDataList) taskOverlayDataList.innerHTML = '';
    currentTaskDataRows = [];
      stopTaskTimer(true);
      updateStartButton();
      return;
    }

    const note = getNoteValue(taskOverlayNote);
    if (applyStatus) {
      await saveTaskDataValues();
    }
    const result = await window.electronAPI.completeActiveActivity({
      uuid: currentTaskUuid,
      userId: currentUser.id,
      isTaskCompleted: applyStatus,
      note
    });

    if (!result.success) {
      alert('Task finish failed: ' + result.error);
      return;
    }

    const itemIdToRefresh = currentTaskItemId;

    if (
      applyStatus &&
      currentTaskItemId &&
      finishStatusRule &&
      finishStatusRule.statusId
    ) {
      const statusResult = await window.electronAPI.updateItemStatus(
        currentTaskItemId,
        finishStatusRule.statusId
      );
      if (!statusResult?.success) {
        console.warn('[renderer] Failed to update item status on finish:', statusResult?.error);
      } else {
        await refreshItemOptions(currentTaskItemId);
      }
    }

    if (!applyStatus) {
      await refreshItemOptions(currentTaskItemId);
    }

    currentTaskUuid = null;
    currentTaskItemId = null;
    currentTaskStatusRule = null;
    currentTaskDataRows = [];
    finishStatusRule = null;
    clearNoteInput(taskOverlayNote);
    if (taskOverlayData) taskOverlayData.style.display = 'none';
    if (taskOverlayDataList) taskOverlayDataList.innerHTML = '';
    currentTaskDataRows = [];
    if (taskOverlayItem) {
      taskOverlayItem.textContent = '';
      taskOverlayItem.style.display = 'none';
    }
    if (taskOverlay) taskOverlay.style.display = 'none';
    stopTaskTimer(true);
    updateStartButton();

    const unallocatedResult = await window.electronAPI.startUnallocated(currentUser.id);
    if (!unallocatedResult.success) {
      alert('Failed to start unallocated time: ' + unallocatedResult.error);
      return;
    }
    currentSessionUuid = unallocatedResult.uuid;
    await refreshItemOptions(itemIdToRefresh);
    if (itemSelect) itemSelect.value = '';
    await refreshUnfinishedTasksCount();
    if (unfinishedList && unfinishedList.style.display !== 'none') {
      const tasks = await loadUnfinishedTasks();
      renderUnfinishedTasks(tasks);
    }
    await refreshAssignmentsListIfOpen();
  };

  finishTaskButton?.addEventListener('click', () => handleFinishTask(true));
  stopTaskButton?.addEventListener('click', () => handleFinishTask(false));


  finishActivityButton?.addEventListener('click', async () => {
    if (currentUser && currentSessionUuid) {
      const note = getNoteValue(activityOverlayNote);
      const result = await window.electronAPI.completeActiveActivity({
        uuid: currentSessionUuid,
        userId: currentUser.id,
        isTaskCompleted: false,
        note
      });

      if (!result.success) {
        alert('Failed to finish break: ' + result.error);
        return;
      }
      currentSessionUuid = null;
    }
    if (activityOverlayName?.textContent === 'Lunch') {
      resumeWorkTimerAfterLunch();
    }
    hideActivityOverlay();
    await startUnallocatedForCurrentUser();
    await refreshUnfinishedTasksCount();
    if (unfinishedList && unfinishedList.style.display !== 'none') {
      const tasks = await loadUnfinishedTasks();
      renderUnfinishedTasks(tasks);
    }
    await refreshAssignmentsListIfOpen();
  });

  taskSelect?.addEventListener('change', async () => {
    userSelectedTask = taskSelect.selectedIndex > 0;
    updateStartButton();
    await updateItemSelection();
    if (pendingUnfinishedTask && pendingTaskSelection) {
      const sameSelection =
        String(pendingTaskSelection.projectId) === String(projectSelect.value) &&
        String(pendingTaskSelection.taskId) === String(taskSelect.value) &&
        String(pendingTaskSelection.itemId || '') === String(itemSelect?.value || '');
      if (!sameSelection) {
        pendingUnfinishedTask = null;
        pendingTaskSelection = null;
        if (startTaskButton) startTaskButton.textContent = 'START';
      }
    }
    if (pendingAssignment && pendingAssignmentSelection) {
      const sameSelection =
        String(pendingAssignmentSelection.projectId) === String(projectSelect.value) &&
        String(pendingAssignmentSelection.taskId) === String(taskSelect.value) &&
        String(pendingAssignmentSelection.itemId || '') === String(itemSelect?.value || '');
      if (!sameSelection) {
        pendingAssignment = null;
        pendingAssignmentSelection = null;
      }
    }
  });

  itemSelect?.addEventListener('change', () => {
    if (pendingUnfinishedTask && pendingTaskSelection) {
      const sameSelection =
        String(pendingTaskSelection.projectId) === String(projectSelect.value) &&
        String(pendingTaskSelection.taskId) === String(taskSelect.value) &&
        String(pendingTaskSelection.itemId || '') === String(itemSelect?.value || '');
      if (!sameSelection) {
        pendingUnfinishedTask = null;
        pendingTaskSelection = null;
        if (startTaskButton) startTaskButton.textContent = 'START';
      }
    }
    if (pendingAssignment && pendingAssignmentSelection) {
      const sameSelection =
        String(pendingAssignmentSelection.projectId) === String(projectSelect.value) &&
        String(pendingAssignmentSelection.taskId) === String(taskSelect.value) &&
        String(pendingAssignmentSelection.itemId || '') === String(itemSelect?.value || '');
      if (!sameSelection) {
        pendingAssignment = null;
        pendingAssignmentSelection = null;
      }
    }
  });

  // ==================
  // Project change
  // ==================
  const applyProjectSelection = async (selectedId) => {
    const selected = userProjects.find((p) => String(p.project_id) === String(selectedId));

    if (!selected) {
      resetProjectSelectionUi();
      return;
    }

    roleText.textContent = `Your role: ${selected.role_label}`;
    currentProject = selected;

    taskSection.style.display = 'block';
    await populateTasks(currentUser, selected);
    userSelectedTask = false;
    updateStartButton();
    if (taskDataSection) taskDataSection.style.display = 'none';
    if (taskDataList) taskDataList.innerHTML = '';
    if (taskSelect?.value) {
      await updateTaskDataSelection();
    }

    const trackingTasks = await window.electronAPI.getItemTrackingTasks(selected.project_id);
    itemTrackingTaskIds = new Set(trackingTasks.map((id) => Number(id)));
    if (itemSection) itemSection.style.display = 'none';
    if (itemSelect) itemSelect.innerHTML = '<option value="">Select item</option>';
    if (itemInputLabel) itemInputLabel.textContent = 'Item';
    if (taskDataSection) taskDataSection.style.display = 'none';
    if (taskDataList) taskDataList.innerHTML = '';
    projectItems = [];
    itemsLoadedProjectId = null;
  };

  projectSelect.addEventListener('change', async (e) => {
    await applyProjectSelection(e.target.value);
    if (pendingUnfinishedTask) {
      pendingUnfinishedTask = null;
      pendingTaskSelection = null;
      if (startTaskButton) startTaskButton.textContent = 'START';
    }
    if (pendingAssignment) {
      pendingAssignment = null;
      pendingAssignmentSelection = null;
    }
  });

  projectSelect.addEventListener('focus', async () => {
    await refreshProjectDataIfOnline();
  });

  projectSelect.addEventListener('mousedown', async () => {
    await refreshProjectDataIfOnline();
  });

  unfinishedButton?.addEventListener('click', async () => {
    if (!currentUser || !unfinishedList || !unfinishedCount) return;
    if (Number(unfinishedCount.textContent || 0) === 0) return;
    if (assignmentsList) assignmentsList.style.display = 'none';
    const shouldShow = unfinishedList.style.display === 'none';
    if (shouldShow) {
      const tasks = await loadUnfinishedTasks();
      renderUnfinishedTasks(tasks);
      unfinishedList.style.display = 'flex';
    } else {
      unfinishedList.style.display = 'none';
    }
  });

  assignmentsButton?.addEventListener('click', async () => {
    if (!currentUser || !assignmentsList || !assignmentsCount) return;
    if (Number(assignmentsCount.textContent || 0) === 0) return;
    if (unfinishedList) unfinishedList.style.display = 'none';
    const shouldShow = assignmentsList.style.display === 'none';
    if (shouldShow) {
      const assignments = await loadAssignments();
      renderAssignments(assignments);
      assignmentsList.style.display = 'flex';
    } else {
      assignmentsList.style.display = 'none';
    }
  });

  // ==================
  // Helpers
  // ==================
  async function handleClockIn(userId) {
    //console.log('[clock-in] click');
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

  function getTodayKey() {
    return new Date().toISOString().split('T')[0];
  }

  function readWorkTimerState() {
    try {
      const raw = localStorage.getItem(workTimerStateKey);
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      console.warn('[renderer] Failed to read work timer state:', err);
      return null;
    }
  }

  function persistWorkTimerState() {
    const elapsedMs =
      timerStartMs != null
        ? Date.now() - timerStartMs
        : workTimerPausedElapsedMs != null
          ? workTimerPausedElapsedMs
          : null;
    if (elapsedMs == null) return;
    const payload = { date: getTodayKey(), elapsedMs };
    try {
      localStorage.setItem(workTimerStateKey, JSON.stringify(payload));
    } catch (err) {
      console.warn('[renderer] Failed to persist work timer state:', err);
    }
  }

  function resumeOrStartWorkTimer() {
    const saved = readWorkTimerState();
    const today = getTodayKey();
    if (saved && saved.date === today && Number.isFinite(saved.elapsedMs)) {
      timerStartMs = Date.now() - saved.elapsedMs;
      updateTimerDisplay();
      timerIntervalId = setInterval(updateTimerDisplay, 1000);
      return;
    }
    startTimer();
  }

  function pauseWorkTimerForLunch() {
    if (!timerStartMs) return;
    workTimerPausedElapsedMs = Date.now() - timerStartMs;
    stopTimer(false);
    if (timerEl) timerEl.style.color = '#c0392b';
  }

  function resumeWorkTimerAfterLunch() {
    if (workTimerPausedElapsedMs == null) return;
    timerStartMs = Date.now() - workTimerPausedElapsedMs;
    updateTimerDisplay();
    timerIntervalId = setInterval(updateTimerDisplay, 1000);
    workTimerPausedElapsedMs = null;
    if (timerEl) timerEl.style.color = '';
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

  function getNoteValue(input) {
    const raw = input?.value ?? '';
    const trimmed = String(raw).trim();
    return trimmed.length ? trimmed : null;
  }

  function clearNoteInput(input) {
    if (input) input.value = '';
  }

  function resetProjectSelectionUi() {
    roleText.textContent = '';
    taskSection.style.display = 'none';
    taskSelect.innerHTML = '<option value="">Select Task</option>';
    taskSelect.disabled = true;
    updateStartButton();
    if (itemSection) itemSection.style.display = 'none';
    if (itemSelect) itemSelect.innerHTML = '<option value="">Select item</option>';
    if (itemInputLabel) itemInputLabel.textContent = 'Item';
    if (taskDataSection) taskDataSection.style.display = 'none';
    if (taskDataList) taskDataList.innerHTML = '';
    projectItems = [];
    itemTrackingTaskIds = new Set();
    itemsLoadedProjectId = null;
    currentProject = null;
  }

  async function startUnallocatedForCurrentUser() {
    if (!currentUser) return;
    const result = await window.electronAPI.startUnallocated(currentUser.id, 4);
    if (!result.success) {
      alert('Failed to start unallocated time: ' + result.error);
      return;
    }
    currentSessionUuid = result.uuid;
  }

  async function refreshProjectDataIfOnline({ updateOptions = true } = {}) {
    if (!currentUser || !window.network?.isOnline?.()) return;

    try {
      const selectedProjectId = projectSelect.value;
      const [projects, projectUsers, roles, customers] = await Promise.all([
        window.electronAPI.getAllProjects(),
        window.electronAPI.getAllProjectUsers(),
        window.electronAPI.getAllProjectRoles(),
        window.electronAPI.getAllCustomers(),
      ]);

      allProjects = projects;
      allProjectUsers = projectUsers;
      projectRoles = roles;
      allCustomers = customers;

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

  async function loadUnfinishedTasks() {
    if (!currentUser) return [];
    try {
      const tasks = await window.electronAPI.getUnfinishedTasks(currentUser.id);
      return Array.isArray(tasks) ? tasks : [];
    } catch (err) {
      console.warn('[renderer] Failed to load unfinished tasks:', err);
      return [];
    }
  }

  async function loadAssignments() {
    if (!currentUser) return [];
    try {
      const assignments = await window.electronAPI.getAssignments(currentUser.id);
      return Array.isArray(assignments) ? assignments : [];
    } catch (err) {
      console.warn('[renderer] Failed to load assignments:', err);
      return [];
    }
  }

  async function refreshUnfinishedTasksCount() {
    if (!unfinishedCount) return;
    const tasks = await loadUnfinishedTasks();
    const count = tasks.length;
    unfinishedCount.textContent = String(count);
    if (unfinishedButton) {
      unfinishedButton.classList.toggle('is-disabled', count === 0);
      unfinishedButton.disabled = count === 0;
    }
    unfinishedCount.classList.toggle('notes-badge--zero', count === 0);
    const assignments = await loadAssignments();
    assignmentsTotal = assignments.length;
    if (assignmentsCount) {
      assignmentsCount.textContent = String(assignmentsTotal);
      assignmentsCount.classList.toggle('notes-badge--zero', assignmentsTotal === 0);
    }
    if (assignmentsButton) {
      assignmentsButton.classList.toggle('is-disabled', assignmentsTotal === 0);
      assignmentsButton.disabled = assignmentsTotal === 0;
    }
  }

  async function refreshAssignmentsListIfOpen() {
    if (assignmentsList && assignmentsList.style.display !== 'none') {
      const assignments = await loadAssignments();
      renderAssignments(assignments);
    }
  }

  function renderUnfinishedTasks(tasks) {
    if (!unfinishedList) return;
    unfinishedList.innerHTML = '';
    if (tasks.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'notes-item';
      empty.textContent = 'No unfinished tasks.';
      unfinishedList.appendChild(empty);
      return;
    }
    tasks.forEach((task) => {
      const item = document.createElement('div');
      item.className = 'notes-item';
      item.addEventListener('click', async () => {
        pendingUnfinishedTask = task;
        pendingTaskSelection = {
          projectId: String(task.projectId),
          taskId: String(task.taskId ?? ''),
          itemId: String(task.itemId ?? ''),
        };
        pendingAssignment = null;
        pendingAssignmentSelection = null;
        if (projectSelect) {
          projectSelect.value = String(task.projectId);
        }
        await applyProjectSelection(String(task.projectId));
        if (taskSelect) {
          taskSelect.value = String(task.taskId ?? '');
          userSelectedTask = !!taskSelect.value;
          updateStartButton();
        }
        await updateItemSelection();
        await updateTaskDataSelection();
        if (itemSelect && task.itemId) {
          itemSelect.value = String(task.itemId);
        }
        if (startTaskButton) startTaskButton.textContent = 'CONTINUE';
        unfinishedList.style.display = 'none';
      });
      const project = document.createElement('div');
      project.className = 'notes-item__project';
      project.textContent = task.projectName || 'Unknown project';
      const detail = document.createElement('div');
      detail.className = 'notes-item__task';
      const itemLabel = task.itemName ? ` - ${task.itemName}` : '';
      detail.textContent = `${task.taskName || 'Unknown task'}${itemLabel}`;
      item.appendChild(project);
      item.appendChild(detail);
      unfinishedList.appendChild(item);
    });
  }

  function renderAssignments(assignments) {
    if (!assignmentsList) return;
    assignmentsList.innerHTML = '';
    if (assignments.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'notes-item';
      empty.textContent = 'No assignments.';
      assignmentsList.appendChild(empty);
      return;
    }

    assignments.forEach((assignment) => {
      const item = document.createElement('div');
      item.className = 'notes-item';
      item.addEventListener('click', async () => {
        pendingUnfinishedTask = null;
        pendingTaskSelection = null;
        if (projectSelect) {
          projectSelect.value = String(assignment.projectId);
        }
        await applyProjectSelection(String(assignment.projectId));
        if (taskSelect) {
          taskSelect.value = String(assignment.taskId ?? '');
          userSelectedTask = !!taskSelect.value;
          updateStartButton();
        }
        await updateItemSelection();
        await updateTaskDataSelection();
        if (itemSelect && assignment.itemId) {
          itemSelect.value = String(assignment.itemId);
        }
        if (startTaskButton) startTaskButton.textContent = 'START';
        pendingAssignment = assignment;
        pendingAssignmentSelection = {
          projectId: String(assignment.projectId),
          taskId: String(assignment.taskId ?? ''),
          itemId: String(assignment.itemId ?? ''),
        };
        assignmentsList.style.display = 'none';
      });
      const project = document.createElement('div');
      project.className = 'notes-item__project';
      project.textContent = assignment.projectName || 'Unknown project';
      const detail = document.createElement('div');
      detail.className = 'notes-item__task';
      const itemLabel = assignment.itemName ? ` - ${assignment.itemName}` : '';
      detail.textContent = `${assignment.taskName || 'Unknown task'}${itemLabel}`;
      item.appendChild(project);
      item.appendChild(detail);
      assignmentsList.appendChild(item);
    });
  }

  function showActivityOverlay(label) {
    if (!activityOverlay || !activityOverlayName || !activityOverlayTimer) return;
    activityOverlayName.textContent = label;
    clearNoteInput(activityOverlayNote);
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
    clearNoteInput(activityOverlayNote);
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
          item_type_id: project?.item_id,
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
    if (!itemSelect) return;
    const items = await window.electronAPI.getProjectItems(project.project_id, project.project_type_id);
    console.log('[renderer] Available items:', items);
    projectItems = items;
    itemSelect.innerHTML = '<option value="">Select item</option>';
    projectItems.forEach((item) => {
      const label = String(item.name || '').trim();
      if (!label) return;
      const status = item.status_label ? ` — ${item.status_label}` : ' — Registered';
      const option = document.createElement('option');
      option.value = String(item.id || label);
      option.textContent = `${label}${status}`;
      itemSelect.appendChild(option);
    });
  }

  async function refreshItemOptions(selectedId) {
    if (!currentProject || !itemSelect) return;
    await populateItems(currentProject);
    if (selectedId) {
      itemSelect.value = String(selectedId);
    }
  }

  async function updateItemSelection() {
    if (!itemSection || !itemSelect) return;
    const taskId = Number(taskSelect.value);
    if (!taskId || !itemTrackingTaskIds.has(taskId)) {
      itemSection.style.display = 'none';
      itemSelect.value = '';
      return;
    }

    itemSection.style.display = 'block';
    if (currentProject && itemsLoadedProjectId !== currentProject.project_id) {
      await populateItems(currentProject);
      itemsLoadedProjectId = currentProject.project_id;
    }
    if (itemInputLabel) {
      const itemTypeName = itemTypesById.get(Number(currentProject?.item_type_id)) || 'Item';
      itemInputLabel.textContent = itemTypeName;
    }
  }

  function renderTaskData(rows) {
    if (!taskDataList) return;
    taskDataList.innerHTML = '';
    if (!rows || rows.length === 0) {
      taskDataList.innerHTML = '<div class="task-data-row"><span class="task-data-label">No task data.</span></div>';
      return;
    }
    rows.forEach((row) => {
      const valueType = String(row.valueType || '').toLowerCase();
      let value = '';
      if (valueType === 'int' || valueType === 'integer') value = row.value_int ?? '';
      else if (valueType === 'decimal') value = row.value_decimal ?? '';
      else if (valueType === 'varchar') value = row.value_varchar ?? '';
      else if (valueType === 'text') value = row.value_text ?? '';
      else if (valueType === 'bool' || valueType === 'boolean') value = row.value_bool ? 'True' : 'False';
      else if (valueType === 'date') value = row.value_date ?? '';
      else if (valueType === 'datetime') value = row.value_datetime ?? '';
      else if (valueType === 'customer_id') value = row.value_customer_id ?? '';
      else if (valueType === 'json') value = row.value_json ?? '';
      else value = '';

      const item = document.createElement('div');
      item.className = 'task-data-row';
      const label = document.createElement('span');
      label.className = 'task-data-label';
      label.textContent = row.definitionLabel || 'Value';
      const valueEl = document.createElement('span');
      valueEl.className = 'task-data-value';
      valueEl.textContent = value === '' || value == null ? '?' : String(value);
      item.appendChild(label);
      item.appendChild(valueEl);
      taskDataList.appendChild(item);
    });
  }


  function focusTaskDataInput() {
    const input = taskOverlayDataList?.querySelector('input, textarea, select');
    if (input && typeof input.focus === 'function') {
      input.focus();
      return;
    }
    if (taskOverlayNote && typeof taskOverlayNote.focus === 'function') {
      taskOverlayNote.focus();
    }
  }

  function renderTaskDataOverlay(rows) {
    if (!taskOverlayData || !taskOverlayDataList) return;
    taskOverlayDataList.innerHTML = '';
    currentTaskDataRows = rows || [];

    if (!rows || rows.length === 0) {
      taskOverlayData.style.display = 'block';
      const empty = document.createElement('div');
      empty.className = 'task-data-row';
      empty.textContent = 'No task data definitions for this task.';
      taskOverlayDataList.appendChild(empty);
        return;
    }

    taskOverlayData.style.display = 'block';
    rows.forEach((row) => {
      const valueType = String(row.valueType || '').toLowerCase();
      const isBoolean = valueType === 'bool' || valueType === 'boolean';
      const isText = valueType === 'text' || valueType === 'json';
      const isDate = valueType === 'date';
      const isDateTime = valueType === 'datetime';
      const isNumber = valueType === 'int' || valueType === 'integer' || valueType === 'decimal';
      const isCustomer = valueType === 'customer_id';

      let value = '';
      if (valueType === 'int' || valueType === 'integer') value = row.value_int ?? '';
      else if (valueType === 'decimal') value = row.value_decimal ?? '';
      else if (valueType === 'varchar') value = row.value_varchar ?? '';
      else if (valueType === 'text') value = row.value_text ?? '';
      else if (valueType === 'bool' || valueType === 'boolean') value = row.value_bool ? '1' : '0';
      else if (valueType === 'date') value = row.value_date ?? '';
      else if (valueType === 'datetime') value = (row.value_datetime || '').replace(' ', 'T').slice(0, 16);
      else if (valueType === 'customer_id') value = row.value_customer_id ?? '';
      else if (valueType === 'json') value = row.value_json ?? '';

      const wrapper = document.createElement('div');
      wrapper.className = 'task-overlay__data-row';

      const label = document.createElement('label');
      label.textContent = row.definitionLabel || 'Value';
      wrapper.appendChild(label);

      let input;
      if (isCustomer) {
        input = document.createElement('select');
        const optEmpty = document.createElement('option');
        optEmpty.value = '';
        optEmpty.textContent = 'Select customer...';
        input.appendChild(optEmpty);

        const projectTypeId = Number(currentProject?.project_type_id);
        const allowedCustomerIds = new Set(
          (allProjects || [])
            .filter((p) => Number(p.type_id) === projectTypeId && p.customer_id)
            .map((p) => Number(p.customer_id))
        );

        const customerList = (allCustomers || [])
          .filter((c) => (allowedCustomerIds.size ? allowedCustomerIds.has(Number(c.id)) : true));

        customerList.forEach((customer) => {
          const opt = document.createElement('option');
          opt.value = String(customer.id);
          opt.textContent = customer.name;
          input.appendChild(opt);
        });

        input.value = String(value ?? '');
      } else if (isBoolean) {
        input = document.createElement('select');
        const optEmpty = document.createElement('option');
        optEmpty.value = '';
        optEmpty.textContent = 'Select...';
        input.appendChild(optEmpty);
        const optTrue = document.createElement('option');
        optTrue.value = '1';
        optTrue.textContent = 'True';
        input.appendChild(optTrue);
        const optFalse = document.createElement('option');
        optFalse.value = '0';
        optFalse.textContent = 'False';
        input.appendChild(optFalse);
        input.value = String(value);
      } else if (isText) {
        input = document.createElement('textarea');
        input.rows = 2;
        input.value = value ?? '';
      } else {
        input = document.createElement('input');
        input.type = isDate ? 'date' : isDateTime ? 'datetime-local' : 'text';
        if (isNumber) input.inputMode = 'decimal';
        input.value = value ?? '';
      }

      input.disabled = false;
      input.readOnly = false;

      input.setAttribute('data-task-data-id', row.id);
      input.setAttribute('data-def-id', row.dataDefId);
      input.setAttribute('data-value-type', row.valueType);
      wrapper.appendChild(input);
      taskOverlayDataList.appendChild(wrapper);
    });
    setTimeout(() => focusTaskDataInput(), 0);
  }

  async function loadTaskDataOverlay(projectId, taskId) {
    if (!taskOverlayData || !taskOverlayDataList) return;
    try {
      const rows = await window.electronAPI.getProjectTaskData(projectId, taskId);
      if (!rows || rows.length === 0) {
        renderTaskDataOverlay(currentTaskDataRows || []);
      } else {
        renderTaskDataOverlay(rows || []);
      }
    } catch (err) {
      console.warn('[renderer] Failed to load task data overlay:', err);
      renderTaskDataOverlay(currentTaskDataRows || []);
    }
  }
  async function updateTaskDataSelection() {
    if (!taskDataSection || !taskDataList) return;
    const projectId = Number(projectSelect.value);
    const taskId = Number(taskSelect.value);
    if (!projectId || !taskId) {
      taskDataSection.style.display = 'none';
      taskDataList.innerHTML = '';
      return;
    }
    try {
      const rows = await window.electronAPI.getProjectTaskData(projectId, taskId);
      currentTaskDataRows = rows || [];
      taskDataSection.style.display = 'block';
      renderTaskData(rows || []);
    } catch (err) {
      console.warn('[renderer] Failed to load task data:', err);
      taskDataSection.style.display = 'none';
      taskDataList.innerHTML = '';
      currentTaskDataRows = [];
    }
  }

});


