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

async function completeActiveActivityGlobal({ uuid, is_completed_project_task, timestamp }) {
  const endTime = timestamp ? new Date(timestamp) : new Date();
  const conn = await pool.getConnection();
  const endStr = formatMySQLDatetime(endTime);

  try {
    const [rows] = await conn.query(
      `SELECT id, start_time, end_time, activity_id FROM users_time_tracking WHERE uuid = ?`,
      [uuid]
    );

    if (rows.length === 0) {
      conn.release();
      console.warn(`[server-db] No activity found for uuid=${uuid}, ignoring`);
      return { success: true, ignored: true };
    }

    const activity = rows[0];

    if (activity.end_time) {
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

    conn.release();
    return { success: true };
  } catch (err) {
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
  getAllItemTypes,
  getAllProjectTasks,
  getAllProjectTaskRoles,
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
  markUnfinishedTaskFinished,
  startUnallocatedActivityGlobal,
  startTaskActivityGlobal,
  completeActiveActivityGlobal
};
