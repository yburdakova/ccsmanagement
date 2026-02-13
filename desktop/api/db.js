console.log("[db.js] APP_ENV =", process.env.APP_ENV);
console.log("[db.js] DB_HOST =", process.env.DB_HOST);
console.log("[db.js] DB_PORT =", process.env.DB_PORT);
console.log("[db.js] DB_USER =", process.env.DB_USER);
console.log("[db.js] DB_NAME =", process.env.DB_NAME);

const mysql = require('mysql2/promise');
require('dotenv').config();
const { parseMysqlDate, diffMinutes, formatMySQLDatetime } = require('../utils/time');

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
});

async function getAllUsers() {
  const [rows] = await pool.query(`
    SELECT id, first_name, last_name, login, authcode, system_role, is_active
    FROM users
    WHERE is_active = 1
  `);
  return rows;
}

async function loginByAuthCode(code) {
  const [rows] = await pool.query(
    `SELECT id, first_name, last_name, login FROM users WHERE authcode = ? AND is_active = 1 LIMIT 1`,
    [code]
  );
  return rows[0]; 
}

async function getAllProjects() {
  const [rows] = await pool.query(`SELECT * FROM projects`);
  return rows;
}

async function getAllProjectUsers() {
  const [rows] = await pool.query(`
    SELECT pu.id, pu.project_id, pu.user_id, pu.project_role_id
    FROM project_users pu
    INNER JOIN projects p ON p.id = pu.project_id
    WHERE p.project_status_id = 1
  `);
  return rows;
}

async function getAllProjectRoles() {
  const [rows] = await pool.query(`SELECT * FROM ref_project_roles`);
  return rows;
}

async function getAllTasks() {
  const [rows] = await pool.query('SELECT * FROM tasks');
  return rows;
}

async function getAllCustomers() {
  try {
    const [rows] = await pool.query(`SELECT id, name FROM customers ORDER BY name`);
    return rows;
  } catch (error) {
    if (error.code === 'ER_NO_SUCH_TABLE' || error.code === 'ER_BAD_TABLE_ERROR') {
      console.warn('[server-db] Missing customers table, skipping.');
      return [];
    }
    throw error;
  }
}

async function getAllItemTypes() {
  try {
    const [rows] = await pool.query(`SELECT id, name FROM ref_item_types ORDER BY name`);
    return rows;
  } catch (error) {
    if (error.code === 'ER_NO_SUCH_TABLE' || error.code === 'ER_BAD_TABLE_ERROR') {
      console.warn('[server-db] Missing ref_item_types table, skipping.');
      return [];
    }
    throw error;
  }
}

async function getAllProjectTasks() {
  const [rows] = await pool.query('SELECT * FROM project_tasks');
  return rows;
}

async function getAllProjectTaskRoles() {
  const [rows] = await pool.query('SELECT * FROM project_task_roles');
  return rows;
}

async function getAllTaskDataDefinitions() {
  try {
    const [rows] = await pool.query(
      `SELECT id, \`key\`, label, value_type FROM task_data_definitions`
    );
    return rows;
  } catch (error) {
    if (error.code === 'ER_NO_SUCH_TABLE' || error.code === 'ER_BAD_TABLE_ERROR') {
      console.warn('[server-db] Missing task_data_definitions table, skipping.');
      return [];
    }
    throw error;
  }
}

async function getAllProjectTaskData() {
  try {
    const [rows] = await pool.query(`SELECT * FROM project_task_data`);
    return rows;
  } catch (error) {
    if (error.code === 'ER_NO_SUCH_TABLE' || error.code === 'ER_BAD_TABLE_ERROR') {
      console.warn('[server-db] Missing project_task_data table, skipping.');
      return [];
    }
    throw error;
  }
}

async function getProjectTaskDataByTask(projectId, taskId) {
  try {
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
      if (error.code !== 'ER_BAD_FIELD_ERROR') throw error;
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
  } catch (error) {
    if (error.code === 'ER_NO_SUCH_TABLE' || error.code === 'ER_BAD_TABLE_ERROR') {
      console.warn('[server-db] Missing project task data tables, skipping.');
      return [];
    }
    throw error;
  }
}

const normalizeValueType = (valueType = '') =>
  String(valueType || '').trim().toLowerCase();

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

// `users_time_tracking_data` schema does NOT have `value_customer_id`.
// Customer IDs are stored as numeric values in `value_int` (BIGINT in MySQL).
const getTrackingDataColumn = (valueType = '') => {
  const type = normalizeValueType(valueType);
  if (type === 'customer_id') return 'value_int';
  return getTaskDataColumn(type);
};

const upsertTrackingDataValue = async (conn, trackingUuid, dataDefId, valueType, value) => {
  const column = getTrackingDataColumn(valueType);
  if (!column) {
    return { success: false, error: 'Invalid value type' };
  }

  const parsedValue = parseTaskDataValue(valueType, value);

  await conn.query(
    `
      INSERT INTO users_time_tracking_data (tracking_uuid, data_def_id, ${column})
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE ${column} = VALUES(${column}), updated_at = CURRENT_TIMESTAMP
    `,
    [trackingUuid, dataDefId, parsedValue]
  );

  return { success: true };
};

// Manual test:
// 1) Start tracking, finish with pages_count=240.
// 2) Verify: SELECT * FROM users_time_tracking_data WHERE tracking_uuid = '<uuid>' AND data_def_id = 1;

async function saveTaskDataValueGlobal({ projectId, taskId, dataDefId, valueType, value }) {
  const column = getTaskDataColumn(valueType);
  if (!column) {
    return { success: false, error: 'Invalid value type' };
  }

  try {
    const [[projectTask]] = await pool.query(
      `
        SELECT id
        FROM project_tasks
        WHERE project_id = ? AND task_id = ?
        LIMIT 1
      `,
      [projectId, taskId]
    );

    if (!projectTask) {
      return { success: false, error: 'Project task not found' };
    }

    const projectTaskId = projectTask.id;
    const [existingRows] = await pool.query(
      `
        SELECT id
        FROM project_task_data
        WHERE project_task_id = ? AND data_def_id = ?
        LIMIT 1
      `,
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
        `
          UPDATE project_task_data
          SET ${clearColumns},
              ${column} = ?,
              updated_at = NOW()
          WHERE id = ?
        `,
        [parsedValue, existingRows[0].id]
      );
      return { success: true, updated: true };
    }

    await pool.query(
      `
        INSERT INTO project_task_data (project_task_id, data_def_id, ${column}, created_at, updated_at)
        VALUES (?, ?, ?, NOW(), NOW())
      `,
      [projectTaskId, dataDefId, parsedValue]
    );
    return { success: true, created: true };
  } catch (error) {
    console.error('[server-db] Failed to save task data value:', error.message);
    return { success: false, error: error.message };
  }
}

async function getAvailableTasksForUser(userId, projectId) {
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
  return rows;
}

async function getCfsItemsByProject(projectId) {
  try {
    const [rows] = await pool.query(
      `SELECT id, label AS name FROM cfs_items WHERE project_id = ?`,
      [projectId]
    );
    return rows;
  } catch (error) {
    if (error.code === 'ER_NO_SUCH_TABLE' || error.code === 'ER_BAD_TABLE_ERROR') {
      console.warn('[server-db] Missing cfs_items table, skipping.');
      return [];
    }
    throw error;
  }
}

async function getAllRefItemStatus() {
  try {
    const [rows] = await pool.query(`SELECT id, name, label FROM ref_item_status`);
    return rows;
  } catch (error) {
    if (error.code === 'ER_BAD_FIELD_ERROR') {
      const [rows] = await pool.query(
        `SELECT id, label AS name, label FROM ref_item_status`
      );
      return rows;
    }
    if (error.code === 'ER_NO_SUCH_TABLE' || error.code === 'ER_BAD_TABLE_ERROR') {
      console.warn('[server-db] Missing ref_item_status table, skipping.');
      return [];
    }
    throw error;
  }
}

async function getAllCfsItems() {
  try {
    const [rows] = await pool.query(`SELECT id, project_id, label, task_status_id FROM cfs_items`);
    return rows;
  } catch (error) {
    if (error.code === 'ER_NO_SUCH_TABLE' || error.code === 'ER_BAD_TABLE_ERROR') {
      console.warn('[server-db] Missing cfs_items table, skipping.');
      return [];
    }
    throw error;
  }
}

async function getAllImItems() {
  try {
    const [rows] = await pool.query(`SELECT id, project_id, label, task_status_id FROM im_items`);
    return rows;
  } catch (error) {
    if (error.code === 'ER_NO_SUCH_TABLE' || error.code === 'ER_BAD_TABLE_ERROR') {
      console.warn('[server-db] Missing im_items table, skipping.');
      return [];
    }
    throw error;
  }
}

async function getImItemsByProject(projectId) {
  try {
    const [rows] = await pool.query(
      `SELECT id, label AS name FROM im_items WHERE project_id = ?`,
      [projectId]
    );
    return rows;
  } catch (error) {
    if (error.code === 'ER_NO_SUCH_TABLE' || error.code === 'ER_BAD_TABLE_ERROR') {
      console.warn('[server-db] Missing im_items table, skipping.');
      return [];
    }
    throw error;
  }
}

async function getItemsByProject(projectId) {
  try {
    const [rows] = await pool.query(
      `
        SELECT i.id,
               i.label AS name,
               s.label AS status_label
        FROM items i
        LEFT JOIN ref_item_status s ON s.id = i.status_id
        WHERE i.project_id = ?
        ORDER BY i.id
      `,
      [projectId]
    );
    return rows;
  } catch (error) {
    if (error.code === 'ER_NO_SUCH_TABLE' || error.code === 'ER_BAD_TABLE_ERROR') {
      console.warn('[server-db] Missing items table, skipping.');
      return [];
    }
    throw error;
  }
}

async function getItemTrackingTasksByProject(projectId) {
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
    return rows.map((row) => row.task_id);
  } catch (error) {
    if (error.code === 'ER_NO_SUCH_TABLE' || error.code === 'ER_BAD_TABLE_ERROR') {
      console.warn('[server-db] Missing item tracking tables, skipping.');
      return [];
    }
    throw error;
  }
}

async function getItemStatusRuleByTask(projectId, taskId, applyAfterFinish) {
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
    if (!rows.length) return null;
    return {
      statusId: rows[0].statusId,
      applyAfterFinish: Number(rows[0].applyAfterFinish) === 1 ? 1 : 0
    };
  } catch (error) {
    if (error.code === 'ER_NO_SUCH_TABLE' || error.code === 'ER_BAD_TABLE_ERROR') {
      console.warn('[server-db] Missing item tracking tables, skipping.');
      return null;
    }
    throw error;
  }
}

async function updateItemStatusGlobal(itemId, statusId) {
  try {
    await pool.query(
      `
        UPDATE items
        SET status_id = ?
        WHERE id = ?
      `,
      [statusId, itemId]
    );
    return { success: true };
  } catch (error) {
    if (error.code === 'ER_NO_SUCH_TABLE' || error.code === 'ER_BAD_TABLE_ERROR') {
      console.warn('[server-db] Missing items table, skipping.');
      return { success: false, error: 'Missing items table' };
    }
    throw error;
  }
}

async function getUnfinishedTasksByUser(userId) {
  try {
    const [rows] = await pool.query(
      `
        SELECT utt.id,
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
    return rows;
  } catch (error) {
    if (error.code === 'ER_NO_SUCH_TABLE' || error.code === 'ER_BAD_TABLE_ERROR') {
      console.warn('[server-db] Missing tables for unfinished tasks query.');
      return [];
    }
    throw error;
  }
}

async function getAssignmentsByUser(userId) {
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
    return rows;
  } catch (error) {
    if (error.code === 'ER_NO_SUCH_TABLE' || error.code === 'ER_BAD_TABLE_ERROR') {
      console.warn('[server-db] Missing assigments table, skipping.');
      return [];
    }
    throw error;
  }
}

async function markUnfinishedTaskFinished(recordId) {
  try {
    await pool.query(
      `
        UPDATE users_time_tracking
        SET is_finished = 1
        WHERE id = ?
      `,
      [recordId]
    );
    return { success: true };
  } catch (error) {
    if (error.code === 'ER_NO_SUCH_TABLE' || error.code === 'ER_BAD_TABLE_ERROR') {
      console.warn('[server-db] Missing users_time_tracking table.');
      return { success: false, error: 'Missing users_time_tracking table' };
    }
    throw error;
  }
}

async function markUnfinishedTaskFinishedByUuid(uuid) {
  try {
    await pool.query(
      `
        UPDATE users_time_tracking
        SET is_finished = 1
        WHERE uuid = ?
      `,
      [uuid]
    );
    return { success: true };
  } catch (error) {
    if (error.code === 'ER_NO_SUCH_TABLE' || error.code === 'ER_BAD_TABLE_ERROR') {
      console.warn('[server-db] Missing users_time_tracking table.');
      return { success: false, error: 'Missing users_time_tracking table' };
    }
    throw error;
  }
}

async function markAssignmentAccepted(assignmentId) {
  try {
    await pool.query(
      `
        UPDATE assigments
        SET is_accepted = 1
        WHERE id = ?
      `,
      [assignmentId]
    );
    return { success: true };
  } catch (error) {
    if (error.code === 'ER_NO_SUCH_TABLE' || error.code === 'ER_BAD_TABLE_ERROR') {
      console.warn('[server-db] Missing assigments table, skipping.');
      return { success: false, error: 'Missing assigments table' };
    }
    throw error;
  }
}

function getItemStatusLocal(itemId, projectTypeId) {
  return new Promise((resolve, reject) => {
    const table = projectTypeId === 1 ? 'cfs_items' : 'im_items';

    db.get(`
      SELECT i.id, i.label, i.task_status_id, s.name AS status_name, s.label AS status_label
      FROM ${table} i
      LEFT JOIN ref_item_status s ON s.id = i.task_status_id
      WHERE i.id = ?
    `, [itemId], (err, row) => {
      if (err) {
        console.error('[local-db] Failed to fetch item status:', err.message);
        return reject(err);
      }
      resolve(row || null);
    });
  });
}

function updateItemStatusLocal(itemId, projectTypeId, newStatusId) {
  return new Promise((resolve, reject) => {
    const table = projectTypeId === 1 ? 'cfs_items' : 'im_items';

    db.run(`
      UPDATE ${table}
      SET task_status_id = ?
      WHERE id = ?
    `, [newStatusId, itemId], (err) => {
      if (err) {
        console.error('[local-db] Failed to update item status:', err.message);
        return reject(err);
      }

      console.log(`[local-db] Updated item ${itemId} in ${table} to status ${newStatusId}`);

      const { isOnline } = require('../utils/network-status');
      isOnline().then((online) => {
        if (!online) {
          const payload = {
            type: 'update-item-status',
            table,
            item_id: itemId,
            new_status_id: newStatusId
          };

          db.run(
            `INSERT INTO sync_queue (payload) VALUES (?)`,
            [JSON.stringify(payload)],
            (err2) => {
              if (err2) {
                console.error('[local-db] Failed to queue item status update:', err2.message);
              } else {
                console.log('[local-db] Offline mode: queued item status update');
              }
            }
          );
        } else {
          console.log('[local-db] Online mode: skipping sync_queue for item update');
        }
      });

      resolve({ success: true });
    });
  });
}

async function startUnallocatedActivityGlobal({ uuid, user_id, activity_id, timestamp }) {
  const startTime = timestamp ? new Date(timestamp) : new Date();
  const dateStr = startTime.toISOString().split('T')[0];
  const timeStr = formatMySQLDatetime(startTime);

  try {
    await pool.query(
      `
      INSERT INTO users_time_tracking (
        uuid, user_id, date, project_id, activity_id, task_id, item_id,
        start_time, end_time, duration, is_finished, note
      )
      VALUES (?, ?, ?, NULL, ?, NULL, NULL, ?, NULL, NULL, NULL, NULL)
      `,
      [uuid, user_id, dateStr, activity_id, timeStr]
    );
    console.log(`[server-db] Clock-in recorded (uuid=${uuid})`);
    return { success: true };
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      console.warn(`[server-db] Duplicate uuid ignored (uuid=${uuid})`);
      return { success: true, duplicate: true };
    }
    console.error('[server-db] Clock-in failed:', error.message);
    return { success: false, error: error.message };
  }
}

async function startTaskActivityGlobal({ uuid, user_id, project_id, task_id, item_id, timestamp }) {
  const startTime = timestamp ? new Date(timestamp) : new Date();
  const dateStr = startTime.toISOString().split('T')[0];
  const timeStr = formatMySQLDatetime(startTime);

  try {
    await pool.query(
      `
      INSERT INTO users_time_tracking (
        uuid, user_id, date, project_id, activity_id, task_id, item_id,
        start_time, end_time, duration, is_finished, note
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, NULL)
      `,
      [uuid, user_id, dateStr, project_id, 2, task_id, item_id ?? null, timeStr]
    );
    console.log(`[server-db] Task start recorded (uuid=${uuid}, project=${project_id}, task=${task_id})`);
    return { success: true };
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      console.warn(`[server-db] Duplicate uuid ignored (uuid=${uuid})`);
      return { success: true, duplicate: true };
    }
    console.error('[server-db] Task start failed:', error.message);
    return { success: false, error: error.message };
  }
}

async function completeActiveActivityGlobal({ uuid, is_completed_project_task, timestamp, note, taskData }) {
  const endTime = timestamp ? new Date(timestamp) : new Date();
  const conn = await pool.getConnection();
  const endStr = formatMySQLDatetime(endTime);
  const safeNote = note != null ? String(note).trim().slice(0, 500) : null;

  try {
    if (!uuid || typeof uuid !== 'string') {
      conn.release();
      return { success: false, error: 'Missing tracking uuid' };
    }

    await conn.beginTransaction();

    const [rows] = await conn.query(
      `
      SELECT id, start_time, end_time, activity_id, user_id, project_id, task_id, item_id
      FROM users_time_tracking
      WHERE uuid = ?
      `,
      [uuid]
    );

    if (rows.length === 0) {
      await conn.rollback();
      conn.release();
      console.warn(`[server-db] No activity found for uuid=${uuid}, ignoring`);
      return { success: true, ignored: true };
    }

    const activity = rows[0];

    if (activity.end_time) {
      await conn.rollback();
      conn.release();
      console.warn(`[server-db]  Activity already completed (uuid=${uuid}), skipping`);
      return { success: true, duplicate: true }; 
    }

    const start = parseMysqlDate(activity.start_time);
    const durationMin = diffMinutes(start, endTime);
    const maxDuration = 255;
    const normalizedDuration = Number.isFinite(durationMin) && durationMin > 0 ? durationMin : 0;
    const safeDurationMin = Math.min(normalizedDuration, maxDuration);

    console.log(`[server-db] Completing activity (uuid=${uuid}), isTaskCompleted=${is_completed_project_task}`);

    const isFinished =
      activity.activity_id !== 2 ? 1 : is_completed_project_task ? 1 : 0;

    await conn.query(
      `
      UPDATE users_time_tracking
      SET end_time = ?, duration = ?, is_finished = ?
      WHERE uuid = ?
      `,
      [endStr, safeDurationMin, isFinished, uuid]
    );

    if (Array.isArray(taskData) && taskData.length > 0) {
      for (const row of taskData) {
        const dataDefId = Number(row.data_def_id);
        const valueType = row.value_type || '';
        if (!dataDefId || !valueType) continue;
        await upsertTrackingDataValue(conn, uuid, dataDefId, valueType, row.value);
      }
    }

    if (safeNote) {
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
            activity.user_id,
            activity.task_id ?? null,
            activity.activity_id,
            safeNote,
            activity.project_id ?? null
          ]
        );
      } else {
        await conn.query(
          `UPDATE users_time_tracking SET note = ? WHERE uuid = ?`,
          [safeNote, uuid]
        );
      }
    }

    await conn.commit();
    conn.release();
    return { success: true };
  } catch (err) {
    try {
      await conn.rollback();
    } catch {}
    conn.release();
    console.error('[server-db] Complete activity failed:', err.message);
    return { success: false, error: err.message };
  }
}

module.exports = {
  getAllUsers,
  loginByAuthCode,
  getAllProjects,
  getAllProjectUsers, 
  getAllProjectRoles,
  getAllTasks,
  getAllCustomers,
  getAllItemTypes,
  getAllProjectTasks,
  getAllProjectTaskRoles,
  getAllTaskDataDefinitions,
  getAllProjectTaskData,
  getProjectTaskDataByTask,
  saveTaskDataValueGlobal,
  getAvailableTasksForUser,
  getCfsItemsByProject,
  getImItemsByProject,
  getItemsByProject,
  getItemTrackingTasksByProject,
  getItemStatusRuleByTask,
  getAllRefItemStatus,
  getAllCfsItems,
  getAllImItems,
  getItemStatusLocal,
  updateItemStatusLocal,
  updateItemStatusGlobal,
  getUnfinishedTasksByUser,
  getAssignmentsByUser,
  markUnfinishedTaskFinished,
  markUnfinishedTaskFinishedByUuid,
  markAssignmentAccepted,
  startUnallocatedActivityGlobal,
  startTaskActivityGlobal,
  completeActiveActivityGlobal
};
