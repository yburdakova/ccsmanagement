import express from 'express';
import pool from '../db.config.js';

const router = express.Router();

// GET /api/time-tracking?userId=1&date=YYYY-MM-DD
router.get('/', async (req, res) => {
  const userId = Number(req.query.userId);
  const date = req.query.date;

  if (!userId || !date) {
    return res.status(400).json({ error: 'userId and date are required' });
  }

  try {
    const [rows] = await pool.query(
      `
      SELECT
        utt.id,
        utt.task_id,
        utt.start_time,
        utt.end_time,
        utt.duration,
        t.description AS task_name,
        c.name AS task_type
      FROM users_time_tracking utt
      LEFT JOIN tasks t ON t.id = utt.task_id
      LEFT JOIN ref_task_category c ON c.id = t.category_id
      WHERE utt.user_id = ? AND utt.date = ?
      ORDER BY utt.start_time
      `,
      [userId, date]
    );

    res.json(rows);
  } catch (error) {
    console.error('Error fetching time tracking:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
