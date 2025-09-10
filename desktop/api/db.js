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

async function getAllProjectTasks() {
  const [rows] = await pool.query('SELECT * FROM project_tasks');
  return rows;
}

async function getAllProjectTaskRoles() {
  const [rows] = await pool.query('SELECT * FROM project_task_roles');
  return rows;
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
        start_time, end_time, duration, is_completed_project_task, note
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


async function completeActiveActivityGlobal({ uuid, is_completed_project_task, timestamp }) {
  const endTime = timestamp ? new Date(timestamp) : new Date();
  const conn = await pool.getConnection();
  const endStr = formatMySQLDatetime(endTime);

  try {
    const [rows] = await conn.query(
      `SELECT id, start_time, end_time FROM users_time_tracking WHERE uuid = ?`,
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

    console.log(`[server-db] Completing activity (uuid=${uuid}), isTaskCompleted=${is_completed_project_task}`);

    await conn.query(
      `
      UPDATE users_time_tracking
      SET end_time = ?, duration = ?, is_completed_project_task = ?
      WHERE uuid = ?
      `,
      [endStr, durationMin, is_completed_project_task ? 1 : 0, uuid]
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
  getAllProjectTasks,
  getAllProjectTaskRoles,
  startUnallocatedActivityGlobal,
  completeActiveActivityGlobal
};
