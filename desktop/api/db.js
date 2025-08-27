const mysql = require('mysql2/promise');
require('dotenv').config();

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
  const [rows] = await pool.query(`SELECT * FROM project_users`);
  return rows;
}

async function getAllProjectRoles() {
  const [rows] = await pool.query(`SELECT * FROM ref_project_roles`);
  return rows;
}

function formatMySQLDatetime(date) {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

async function startUnallocatedActivityGlobal(userId, activityId, startTime) {
  const dateStr = startTime.toISOString().split('T')[0];
  const timeStr = formatMySQLDatetime(startTime);

  try {
    await pool.query(
      `
      INSERT INTO users_time_tracking (
        user_id, date, project_id, activity_id, task_id, item_id,
        start_time, end_time, duration, is_completed_project_task, note
      )
      VALUES (?, ?, NULL, ?, NULL, NULL, ?, NULL, NULL, NULL, NULL)
      `,
      [userId, dateStr, activityId, timeStr]
    );

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}


module.exports = {
  getAllUsers,
  loginByAuthCode,
  getAllProjects,
  getAllProjectUsers, 
  getAllProjectRoles,
  startUnallocatedActivityGlobal
};
