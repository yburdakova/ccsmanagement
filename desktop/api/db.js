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
    SELECT id, first_name, last_name, login, role
    FROM users
    WHERE is_active = 1
  `);
  return rows;
}

module.exports = {
  getAllUsers,
};
