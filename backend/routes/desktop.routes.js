import express from 'express';
import pool from '../db.config.js';
import { getJwtExpiresIn, ROLE } from '../auth/auth-config.js';
import { signAccessToken } from '../auth/jwt.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = express.Router();

// Desktop API facade:
// This route group mirrors desktop direct-DB operations so desktop can switch
// from DB access to backend HTTP without behavior changes.
// Keep request/response payloads aligned with desktop IPC semantics.

const normalizeValueType = (valueType = '') =>
  String(valueType || '').trim().toLowerCase();

const isMissingTableError = (error) =>
  error?.code === 'ER_NO_SUCH_TABLE' || error?.code === 'ER_BAD_TABLE_ERROR';

const OPTIONAL_TABLE_WARN_COOLDOWN_MS = 5 * 60 * 1000;
const optionalTableWarnAt = new Map();

const warnOptionalTableMissing = (entityName) => {
  const now = Date.now();
  const previous = optionalTableWarnAt.get(entityName) || 0;
  if (now - previous < OPTIONAL_TABLE_WARN_COOLDOWN_MS) return;
  optionalTableWarnAt.set(entityName, now);
  console.warn(`[desktop-api] Optional table missing for ${entityName}, returning [].`);
};

const queryOptionalRows = async (sql, params, entityName) => {
  try {
    const [rows] = await pool.query(sql, params || []);
    return rows;
  } catch (error) {
    if (isMissingTableError(error)) {
      warnOptionalTableMissing(entityName);
      return [];
    }
    throw error;
  }
};

const parseRequiredNumber = (raw) => {
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : 0;
};

const resolveScopedUserId = (req, rawUserId) => {
  const requestedUserId = parseRequiredNumber(rawUserId);
  const authUserId = Number(req.user?.id || 0);
  const authUserRole = Number(req.user?.role || 0);

  if (authUserRole === ROLE.ADMIN) {
    return requestedUserId || authUserId;
  }

  return authUserId;
};

const getTaskDataColumn = (valueType = '') => {
  const type = normalizeValueType(valueType);
  switch (type) {
    case 'int':
    case 'integer':
      return 'value_int';
    case 'decimal':
      return 'value_decimal';
    case 'varchar':
      return 'value_varchar';
    case 'text':
      return 'value_text';
    case 'bool':
    case 'boolean':
      return 'value_bool';
    case 'date':
      return 'value_date';
    case 'datetime':
      return 'value_datetime';
    case 'customer_id':
      return 'value_customer_id';
    case 'json':
      return 'value_json';
    default:
      return null;
  }
};

const getTrackingDataColumn = (valueType = '') => {
  const type = normalizeValueType(valueType);
  if (type === 'customer_id') return 'value_int';
  return getTaskDataColumn(type);
};

const parseTaskDataValue = (valueType, value) => {
  const type = normalizeValueType(valueType);
  if (value == null || value === '') return null;
  if (type === 'int' || type === 'integer' || type === 'customer_id') {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  }
  if (type === 'decimal') {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  }
  if (type === 'bool' || type === 'boolean') {
    if (typeof value === 'boolean') return value ? 1 : 0;
    if (typeof value === 'number') return value ? 1 : 0;
    const normalized = String(value).trim().toLowerCase();
    return normalized === 'true' || normalized === '1' ? 1 : 0;
  }
  if (type === 'json') {
    try {
      return typeof value === 'string' ? value : JSON.stringify(value);
    } catch {
      return null;
    }
  }
  if (type === 'date') {
    const raw = String(value).trim();
    return raw ? raw.slice(0, 10) : null;
  }
  if (type === 'datetime') {
    const raw = String(value).trim();
    if (!raw) return null;
    const normalized = raw.includes('T') ? raw.replace('T', ' ') : raw;
    return normalized.length === 16 ? `${normalized}:00` : normalized;
  }
  return String(value);
};

const formatMySQLDatetime = (date) => {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
};

const diffMinutes = (start, end) => {
  const startMs = new Date(start).getTime();
  const endMs = new Date(end).getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return 0;
  const diff = Math.floor((endMs - startMs) / 60000);
  return diff > 0 ? diff : 0;
};

const getProjectTaskDataByTask = async (projectId, taskId) => {
  try {
    const [rows] = await pool.query(
      `
        SELECT ptd.id,
               ptd.project_task_id AS projectTaskId,
               ptd.data_def_id AS dataDefId,
               tdd.label AS definitionLabel,
               tdd.value_type AS valueType,
               ptd.is_required AS isRequired,
               ptd.value_int,
               ptd.value_decimal,
               ptd.value_varchar,
               ptd.value_text,
               ptd.value_bool,
               ptd.value_date,
               ptd.value_datetime,
               ptd.value_customer_id,
               ptd.value_json
        FROM project_task_data ptd
        JOIN project_tasks pt ON pt.id = ptd.project_task_id
        JOIN task_data_definitions tdd ON tdd.id = ptd.data_def_id
        WHERE pt.project_id = ? AND pt.task_id = ?
        ORDER BY ptd.id
      `,
      [projectId, taskId]
    );
    return rows;
  } catch (error) {
    if (error.code === 'ER_BAD_FIELD_ERROR') {
      const [rows] = await pool.query(
        `
          SELECT ptd.id,
                 ptd.project_task_id AS projectTaskId,
                 ptd.data_def_id AS dataDefId,
                 tdd.label AS definitionLabel,
                 tdd.value_type AS valueType,
                 ptd.value_int,
                 ptd.value_decimal,
                 ptd.value_varchar,
                 ptd.value_text,
                 ptd.value_bool,
                 ptd.value_date,
                 ptd.value_datetime,
                 ptd.value_customer_id,
                 ptd.value_json
          FROM project_task_data ptd
          JOIN project_tasks pt ON pt.id = ptd.project_task_id
          JOIN task_data_definitions tdd ON tdd.id = ptd.data_def_id
          WHERE pt.project_id = ? AND pt.task_id = ?
          ORDER BY ptd.id
        `,
        [projectId, taskId]
      );
      return rows.map((row) => ({ ...row, isRequired: 0 }));
    }
    if (error.code === 'ER_NO_SUCH_TABLE' || error.code === 'ER_BAD_TABLE_ERROR') return [];
    throw error;
  }
};

const upsertTrackingDataValue = async (conn, trackingUuid, dataDefId, valueType, value) => {
  const column = getTrackingDataColumn(valueType);
  if (!column) return;
  const parsedValue = parseTaskDataValue(valueType, value);
  await conn.query(
    `
      INSERT INTO users_time_tracking_data (tracking_uuid, data_def_id, ${column})
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE ${column} = VALUES(${column}), updated_at = CURRENT_TIMESTAMP
    `,
    [trackingUuid, dataDefId, parsedValue]
  );
};

// -------------------------
// Auth + bootstrap
// -------------------------
router.post('/login-authcode', async (req, res) => {
  const code = String(req.body?.code ?? '').trim();
  if (!code) return res.status(400).json({ error: 'code is required' });
  try {
    const [rows] = await pool.query(
      `SELECT id, first_name, last_name, login, system_role FROM users WHERE authcode = ? AND is_active = 1 LIMIT 1`,
      [code]
    );
    const user = rows[0] || null;
    if (!user) return res.json(null);

    const accessToken = signAccessToken({
      id: user.id,
      role: user.system_role,
      login: user.login,
    });

    res.json({
      ...user,
      accessToken,
      tokenType: accessToken ? 'Bearer' : null,
      expiresIn: accessToken ? getJwtExpiresIn() : null,
    });
  } catch (error) {
    console.error('[desktop-api] login-authcode failed:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Keep login endpoint public and protect everything below.
router.use(requireAuth);

router.get('/bootstrap', async (_req, res) => {
  try {
    const [
      [users],
      [projects],
      [projectUsers],
      [projectRoles],
      [tasks],
      [projectTasks],
      [projectTaskRoles],
      [customers],
      itemTypes,
      taskDataDefinitions,
      projectTaskData,
      refItemStatus,
      cfsItems,
      imItems,
    ] = await Promise.all([
      pool.query(`SELECT id, first_name, last_name, login, system_role, is_active FROM users WHERE is_active = 1`),
      pool.query(`SELECT * FROM projects`),
      pool.query(`
        SELECT pu.id, pu.project_id, pu.user_id, pu.project_role_id
        FROM project_users pu
        INNER JOIN projects p ON p.id = pu.project_id
        WHERE p.project_status_id = 1
      `),
      pool.query(`SELECT * FROM ref_project_roles`),
      pool.query(`SELECT * FROM tasks`),
      pool.query(`SELECT * FROM project_tasks`),
      pool.query(`SELECT * FROM project_task_roles`),
      pool.query(`SELECT id, name FROM customers ORDER BY name`),
      queryOptionalRows(`SELECT id, name FROM ref_item_types ORDER BY name`, [], 'ref_item_types'),
      queryOptionalRows(`SELECT id, \`key\`, label, value_type FROM task_data_definitions`, [], 'task_data_definitions'),
      queryOptionalRows(`SELECT * FROM project_task_data`, [], 'project_task_data'),
      queryOptionalRows(`SELECT id, label AS name, label FROM ref_item_status`, [], 'ref_item_status'),
      queryOptionalRows(`SELECT id, project_id, label, task_status_id FROM cfs_items`, [], 'cfs_items'),
      queryOptionalRows(`SELECT id, project_id, label, task_status_id FROM im_items`, [], 'im_items'),
    ]);

    res.json({
      users,
      projects,
      projectUsers,
      projectRoles,
      tasks,
      customers,
      itemTypes,
      projectTasks,
      projectTaskRoles,
      taskDataDefinitions,
      projectTaskData,
      refItemStatus,
      cfsItems,
      imItems,
    });
  } catch (error) {
    console.error('[desktop-api] bootstrap failed:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// -------------------------
// Task data + availability
// -------------------------
router.get('/project-task-data', async (req, res) => {
  const projectId = parseRequiredNumber(req.query.projectId);
  const taskId = parseRequiredNumber(req.query.taskId);
  if (!projectId || !taskId) return res.status(400).json({ error: 'projectId and taskId are required' });
  try {
    const rows = await getProjectTaskDataByTask(projectId, taskId);
    res.json(rows);
  } catch (error) {
    console.error('[desktop-api] project-task-data failed:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/task-data', async (req, res) => {
  const projectId = parseRequiredNumber(req.body?.projectId);
  const taskId = parseRequiredNumber(req.body?.taskId);
  const dataDefId = parseRequiredNumber(req.body?.dataDefId);
  const valueType = String(req.body?.valueType || '');
  const value = req.body?.value;
  if (!projectId || !taskId || !dataDefId || !valueType) {
    return res.status(400).json({ error: 'projectId, taskId, dataDefId and valueType are required' });
  }
  const column = getTaskDataColumn(valueType);
  if (!column) return res.status(400).json({ error: 'Invalid value type' });
  try {
    const [[projectTask]] = await pool.query(
      `SELECT id FROM project_tasks WHERE project_id = ? AND task_id = ? LIMIT 1`,
      [projectId, taskId]
    );
    if (!projectTask) return res.status(404).json({ error: 'Project task not found' });
    const projectTaskId = projectTask.id;
    const [existingRows] = await pool.query(
      `SELECT id FROM project_task_data WHERE project_task_id = ? AND data_def_id = ? LIMIT 1`,
      [projectTaskId, dataDefId]
    );
    const parsedValue = parseTaskDataValue(valueType, value);
    const clearColumns = `
      value_int = NULL,
      value_decimal = NULL,
      value_varchar = NULL,
      value_text = NULL,
      value_bool = NULL,
      value_date = NULL,
      value_datetime = NULL,
      value_customer_id = NULL,
      value_json = NULL
    `;
    if (existingRows.length) {
      await pool.query(
        `UPDATE project_task_data SET ${clearColumns}, ${column} = ?, updated_at = NOW() WHERE id = ?`,
        [parsedValue, existingRows[0].id]
      );
      return res.json({ success: true, updated: true });
    }
    await pool.query(
      `INSERT INTO project_task_data (project_task_id, data_def_id, ${column}, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())`,
      [projectTaskId, dataDefId, parsedValue]
    );
    res.json({ success: true, created: true });
  } catch (error) {
    console.error('[desktop-api] task-data failed:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/available-tasks', async (req, res) => {
  const userId = resolveScopedUserId(req, req.query.userId);
  const projectId = parseRequiredNumber(req.query.projectId);
  if (!userId || !projectId) return res.status(400).json({ error: 'userId and projectId are required' });
  try {
    const [rows] = await pool.query(
      `
        SELECT t.id, t.description, 0 AS is_default, ptr.role_id AS roleId
        FROM project_users pu
        JOIN project_task_roles ptr
          ON ptr.project_id = pu.project_id
          AND ptr.role_id = pu.project_role_id
        JOIN tasks t ON t.id = ptr.task_id
        WHERE pu.user_id = ? AND pu.project_id = ?
      `,
      [userId, projectId]
    );
    res.json(rows);
  } catch (error) {
    console.error('[desktop-api] available-tasks failed:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// -------------------------
// Items + status rules
// -------------------------
router.get('/project-items', async (req, res) => {
  const projectId = parseRequiredNumber(req.query.projectId);
  const projectTypeId = Number(req.query.projectTypeId || 0);
  if (!projectId) return res.status(400).json({ error: 'projectId is required' });
  try {
    const [rows] = await pool.query(
      `
        SELECT i.id, i.label AS name, s.label AS status_label
        FROM items i
        LEFT JOIN ref_item_status s ON s.id = i.status_id
        WHERE i.project_id = ?
        ORDER BY i.id
      `,
      [projectId]
    );
    if (rows.length > 0) return res.json(rows);

    if (projectTypeId === 1) {
      const [cfsRows] = await pool.query(`SELECT id, label AS name FROM cfs_items WHERE project_id = ?`, [projectId]);
      return res.json(cfsRows);
    }
    if (projectTypeId === 2) {
      const [imRows] = await pool.query(`SELECT id, label AS name FROM im_items WHERE project_id = ?`, [projectId]);
      return res.json(imRows);
    }
    return res.json([]);
  } catch (error) {
    if (isMissingTableError(error)) {
      return res.json([]);
    }
    console.error('[desktop-api] project-items failed:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/item-tracking-tasks', async (req, res) => {
  const projectId = parseRequiredNumber(req.query.projectId);
  if (!projectId) return res.status(400).json({ error: 'projectId is required' });
  try {
    const [rows] = await pool.query(
      `
        SELECT DISTINCT ist.task_id
        FROM itemstatus_task ist
        INNER JOIN ref_item_status ris ON ris.id = ist.item_status_id
        WHERE ris.project_id = ?
        ORDER BY ist.task_id
      `,
      [projectId]
    );
    res.json(rows.map((row) => row.task_id));
  } catch (error) {
    if (isMissingTableError(error)) return res.json([]);
    console.error('[desktop-api] item-tracking-tasks failed:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/item-status-rule', async (req, res) => {
  const projectId = parseRequiredNumber(req.query.projectId);
  const taskId = parseRequiredNumber(req.query.taskId);
  const applyAfterFinishRaw = req.query.applyAfterFinish;
  const applyAfterFinish = applyAfterFinishRaw == null || applyAfterFinishRaw === ''
    ? null
    : Number(applyAfterFinishRaw);
  if (!projectId || !taskId) return res.status(400).json({ error: 'projectId and taskId are required' });
  try {
    const [rows] = await pool.query(
      `
        SELECT ist.item_status_id AS statusId,
               ist.apply_after_finish AS applyAfterFinish
        FROM itemstatus_task ist
        INNER JOIN ref_item_status ris ON ris.id = ist.item_status_id
        WHERE ris.project_id = ?
          AND ist.task_id = ?
          AND (? IS NULL OR ist.apply_after_finish = ?)
        LIMIT 1
      `,
      [projectId, taskId, applyAfterFinish, applyAfterFinish]
    );
    if (!rows.length) return res.json(null);
    res.json({
      statusId: rows[0].statusId,
      applyAfterFinish: Number(rows[0].applyAfterFinish) === 1 ? 1 : 0,
    });
  } catch (error) {
    if (isMissingTableError(error)) return res.json(null);
    console.error('[desktop-api] item-status-rule failed:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/item-status', async (req, res) => {
  const itemId = parseRequiredNumber(req.body?.itemId);
  const statusId = parseRequiredNumber(req.body?.statusId);
  if (!itemId || !statusId) return res.status(400).json({ error: 'itemId and statusId are required' });
  try {
    await pool.query(`UPDATE items SET status_id = ? WHERE id = ?`, [statusId, itemId]);
    res.json({ success: true });
  } catch (error) {
    console.error('[desktop-api] item-status failed:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// -------------------------
// Unfinished + assignments
// -------------------------
router.get('/unfinished-tasks', async (req, res) => {
  const userId = resolveScopedUserId(req, req.query.userId);
  if (!userId) return res.status(400).json({ error: 'userId is required' });
  try {
    const [rows] = await pool.query(
      `
        SELECT utt.id,
               utt.uuid,
               utt.task_id AS taskId,
               utt.item_id AS itemId,
               utt.project_id AS projectId,
               p.name AS projectName,
               t.description AS taskName,
               i.label AS itemName
        FROM users_time_tracking utt
        LEFT JOIN projects p ON p.id = utt.project_id
        LEFT JOIN tasks t ON t.id = utt.task_id
        LEFT JOIN items i ON i.id = utt.item_id
        WHERE utt.user_id = ?
          AND utt.activity_id = 2
          AND utt.is_finished = 0
        ORDER BY utt.start_time DESC
      `,
      [userId]
    );
    res.json(rows);
  } catch (error) {
    console.error('[desktop-api] unfinished-tasks failed:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/assignments', async (req, res) => {
  const userId = resolveScopedUserId(req, req.query.userId);
  if (!userId) return res.status(400).json({ error: 'userId is required' });
  try {
    const [rows] = await pool.query(
      `
        SELECT a.id,
               a.project_id AS projectId,
               a.task_id AS taskId,
               a.item_id AS itemId,
               a.is_accepted AS isAccepted,
               p.name AS projectName,
               t.description AS taskName,
               i.label AS itemName
        FROM assigments a
        LEFT JOIN projects p ON p.id = a.project_id
        LEFT JOIN tasks t ON t.id = a.task_id
        LEFT JOIN items i ON i.id = a.item_id
        WHERE a.user_id = ?
          AND (a.is_accepted = 0 OR a.is_accepted = '0' OR a.is_accepted IS NULL)
        ORDER BY a.id DESC
      `,
      [userId]
    );
    res.json(rows);
  } catch (error) {
    console.error('[desktop-api] assignments failed:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/assignment-accepted', async (req, res) => {
  const assignmentId = parseRequiredNumber(req.body?.assignmentId);
  if (!assignmentId) return res.status(400).json({ error: 'assignmentId is required' });
  try {
    await pool.query(`UPDATE assigments SET is_accepted = 1 WHERE id = ?`, [assignmentId]);
    res.json({ success: true });
  } catch (error) {
    console.error('[desktop-api] assignment-accepted failed:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/unfinished-finished', async (req, res) => {
  const recordId = parseRequiredNumber(req.body?.recordId || 0);
  const uuid = String(req.body?.uuid || '').trim();
  if (!recordId && !uuid) return res.status(400).json({ error: 'recordId or uuid is required' });
  try {
    if (uuid) {
      await pool.query(`UPDATE users_time_tracking SET is_finished = 1 WHERE uuid = ?`, [uuid]);
    } else {
      await pool.query(`UPDATE users_time_tracking SET is_finished = 1 WHERE id = ?`, [recordId]);
    }
    res.json({ success: true });
  } catch (error) {
    console.error('[desktop-api] unfinished-finished failed:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// -------------------------
// Activity lifecycle
// -------------------------
router.post('/activities/start-unallocated', async (req, res) => {
  const uuid = String(req.body?.uuid || '').trim();
  const userId = resolveScopedUserId(req, req.body?.user_id ?? req.body?.userId);
  const activityId = parseRequiredNumber(req.body?.activity_id ?? req.body?.activityId ?? 4);
  const timestamp = req.body?.timestamp ? new Date(req.body.timestamp) : new Date();
  if (!uuid || !userId || !activityId) {
    return res.status(400).json({ error: 'uuid, user_id/userId and activity_id/activityId are required' });
  }
  const startTime = formatMySQLDatetime(timestamp);
  const dateStr = timestamp.toISOString().split('T')[0];
  try {
    await pool.query(
      `
        INSERT INTO users_time_tracking (
          uuid, user_id, date, project_id, activity_id, task_id, item_id,
          start_time, end_time, duration, is_finished, note
        )
        VALUES (?, ?, ?, NULL, ?, NULL, NULL, ?, NULL, NULL, NULL, NULL)
      `,
      [uuid, userId, dateStr, activityId, startTime]
    );
    res.json({ success: true });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return res.json({ success: true, duplicate: true });
    console.error('[desktop-api] start-unallocated failed:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/activities/start-task', async (req, res) => {
  const uuid = String(req.body?.uuid || '').trim();
  const userId = resolveScopedUserId(req, req.body?.user_id ?? req.body?.userId);
  const projectId = parseRequiredNumber(req.body?.project_id ?? req.body?.projectId);
  const taskId = parseRequiredNumber(req.body?.task_id ?? req.body?.taskId);
  const itemIdRaw = req.body?.item_id ?? req.body?.itemId;
  const itemId = itemIdRaw == null || itemIdRaw === '' ? null : Number(itemIdRaw);
  const timestamp = req.body?.timestamp ? new Date(req.body.timestamp) : new Date();
  if (!uuid || !userId || !projectId || !taskId) {
    return res.status(400).json({ error: 'uuid, user_id/userId, project_id/projectId and task_id/taskId are required' });
  }
  const startTime = formatMySQLDatetime(timestamp);
  const dateStr = timestamp.toISOString().split('T')[0];
  try {
    await pool.query(
      `
        INSERT INTO users_time_tracking (
          uuid, user_id, date, project_id, activity_id, task_id, item_id,
          start_time, end_time, duration, is_finished, note
        )
        VALUES (?, ?, ?, ?, 2, ?, ?, ?, NULL, NULL, NULL, NULL)
      `,
      [uuid, userId, dateStr, projectId, taskId, itemId, startTime]
    );
    res.json({ success: true });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return res.json({ success: true, duplicate: true });
    console.error('[desktop-api] start-task failed:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/activities/complete', async (req, res) => {
  const uuid = String(req.body?.uuid || '').trim();
  const userId = resolveScopedUserId(req, req.body?.user_id ?? req.body?.userId);
  const isCompletedProjectTask =
    Number(req.body?.is_completed_project_task ?? req.body?.isTaskCompleted ?? 0) === 1 ? 1 : 0;
  const note = req.body?.note == null ? null : String(req.body.note).trim().slice(0, 500);
  const taskData = Array.isArray(req.body?.taskData ?? req.body?.task_data)
    ? (req.body.taskData ?? req.body.task_data)
    : [];
  const endTime = req.body?.timestamp ? new Date(req.body.timestamp) : new Date();
  const endStr = formatMySQLDatetime(endTime);
  if (!uuid || !userId) return res.status(400).json({ error: 'uuid and user_id/userId are required' });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.query(
      `
        SELECT id, start_time, end_time, activity_id, user_id, project_id, task_id, item_id
        FROM users_time_tracking
        WHERE uuid = ?
        LIMIT 1
      `,
      [uuid]
    );

    if (!rows.length) {
      await conn.rollback();
      return res.json({ success: true, ignored: true });
    }
    const activity = rows[0];
    if (activity.end_time) {
      await conn.rollback();
      return res.json({ success: true, duplicate: true });
    }

    const durationMin = Math.min(diffMinutes(activity.start_time, endTime), 255);
    const isFinished =
      Number(activity.activity_id) !== 2
        ? 1
        : isCompletedProjectTask
          ? 1
          : 0;

    await conn.query(
      `UPDATE users_time_tracking SET end_time = ?, duration = ?, is_finished = ? WHERE uuid = ?`,
      [endStr, durationMin, isFinished, uuid]
    );

    for (const row of taskData) {
      const dataDefId = Number(row?.data_def_id ?? row?.dataDefId);
      const valueType = String(row?.value_type ?? row?.valueType ?? '').trim();
      if (!dataDefId || !valueType) continue;
      await upsertTrackingDataValue(conn, uuid, dataDefId, valueType, row?.value);
    }

    if (note) {
      if (Number(activity.activity_id) === 2) {
        await conn.query(
          `
            INSERT INTO prod_notes (
              item_id, unit_id, user_id, task_id, activity_id, note, created_at, project_id
            )
            VALUES (?, ?, ?, ?, ?, ?, NOW(), ?)
          `,
          [
            activity.item_id ?? null,
            null,
            userId,
            activity.task_id ?? null,
            activity.activity_id,
            note,
            activity.project_id ?? null,
          ]
        );
      } else {
        await conn.query(`UPDATE users_time_tracking SET note = ? WHERE uuid = ?`, [note, uuid]);
      }
    }

    await conn.commit();
    res.json({ success: true });
  } catch (error) {
    try { await conn.rollback(); } catch {}
    console.error('[desktop-api] complete failed:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    conn.release();
  }
});

export default router;
