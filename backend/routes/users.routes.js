import express from 'express';
import pool from '../db.config.js';

const router = express.Router();

// GET /api/users
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `
        SELECT id,
               first_name,
               last_name,
               login,
               system_role,
               is_active
        FROM users
        ORDER BY id;
      `
    );
    res.json(rows);
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE' || err.code === 'ER_BAD_TABLE_ERROR') {
      console.warn('[users] Missing users table, returning empty list.');
      return res.json([]);
    }
    console.error('Error fetching users:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
