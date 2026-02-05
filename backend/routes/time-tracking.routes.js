import express from 'express';
import crypto from 'crypto';
import pool from '../db.config.js';

const router = express.Router();

// GET /api/time-tracking/metrics?userId=1&date=YYYY-MM-DD
// Returns rows for specific production tasks with pages-per-minute derived from
// users_time_tracking_data (data_def_id=1 => pages).
router.get('/metrics', async (req, res) => {
  const userId = Number(req.query.userId);
  const date = req.query.date;
  const dateFrom = req.query.dateFrom;
  const dateTo = req.query.dateTo;

  if (!userId || (!date && !(dateFrom && dateTo))) {
    return res.status(400).json({
      error: 'userId and either date or dateFrom/dateTo are required',
    });
  }

  const allowedTaskIds = [1, 2, 3, 4, 5, 6, 30];

  try {
    const startDate = date ?? dateFrom;
    const endDate = date ?? dateTo;
    const [rows] = await pool.query(
      `
      SELECT
        utt.id,
        utt.project_id,
        utt.task_id,
        utt.date,
        utt.start_time,
        utt.end_time,
        COALESCE(utt.duration, TIMESTAMPDIFF(MINUTE, utt.start_time, utt.end_time)) AS duration,
        t.description AS task_name,
        p.name AS project_name,
        COALESCE(utd.value_int, CAST(utd.value_decimal AS SIGNED)) AS pages,
        CASE
          WHEN COALESCE(utt.duration, TIMESTAMPDIFF(MINUTE, utt.start_time, utt.end_time)) > 0
           AND COALESCE(utd.value_int, utd.value_decimal) IS NOT NULL
          THEN ROUND(
            COALESCE(utd.value_int, utd.value_decimal) /
            COALESCE(utt.duration, TIMESTAMPDIFF(MINUTE, utt.start_time, utt.end_time)),
            2
          )
          ELSE NULL
        END AS pagesPerMinute
      FROM users_time_tracking utt
      LEFT JOIN tasks t ON t.id = utt.task_id
      LEFT JOIN projects p ON p.id = utt.project_id
      LEFT JOIN users_time_tracking_data utd
        ON utd.tracking_uuid = utt.uuid
       AND utd.data_def_id = 1
      WHERE utt.user_id = ?
        AND utt.date BETWEEN ? AND ?
        AND utt.activity_id = 2
        AND utt.task_id IN (?)
      ORDER BY utt.date DESC, utt.start_time DESC, utt.id DESC
      `,
      [userId, startDate, endDate, allowedTaskIds]
    );

    res.json(rows);
  } catch (error) {
    console.error('Error fetching metrics:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/time-tracking?userId=1&date=YYYY-MM-DD
router.get('/', async (req, res) => {
  const userId = Number(req.query.userId);
  const date = req.query.date;
  const dateFrom = req.query.dateFrom;
  const dateTo = req.query.dateTo;

  if (!userId || (!date && !(dateFrom && dateTo))) {
    return res
      .status(400)
      .json({ error: 'userId and either date or dateFrom/dateTo are required' });
  }

  try {
    const startDate = date ?? dateFrom;
    const endDate = date ?? dateTo;
    const [rows] = await pool.query(
      `
      SELECT
        utt.id,
        utt.activity_id,
        utt.project_id,
        utt.task_id,
        utt.date,
        utt.start_time,
        utt.end_time,
        utt.duration,
        utt.note AS note,
        a.name AS activity_name,
        a.description AS activity_description,
        t.description AS task_name,
        c.name AS task_type,
        p.name AS project_name,
        COALESCE(utd.value_int, CAST(utd.value_decimal AS SIGNED)) AS pages,
        CASE
          WHEN utt.activity_id = 2
           AND COALESCE(utt.duration, TIMESTAMPDIFF(MINUTE, utt.start_time, utt.end_time)) > 0
           AND COALESCE(utd.value_int, utd.value_decimal) IS NOT NULL
          THEN ROUND(
            COALESCE(utd.value_int, utd.value_decimal) /
            COALESCE(utt.duration, TIMESTAMPDIFF(MINUTE, utt.start_time, utt.end_time)),
            2
          )
          ELSE NULL
        END AS pagesPerMinute
      FROM users_time_tracking utt
      LEFT JOIN activities a ON a.id = utt.activity_id
      LEFT JOIN tasks t ON t.id = utt.task_id
      LEFT JOIN ref_task_category c ON c.id = t.category_id
      LEFT JOIN projects p ON p.id = utt.project_id
      LEFT JOIN users_time_tracking_data utd
        ON utd.tracking_uuid = utt.uuid
       AND utd.data_def_id = 1
      WHERE utt.user_id = ?
        AND utt.date BETWEEN ? AND ?
      ORDER BY utt.date DESC, utt.start_time DESC, utt.id DESC
      `,
      [userId, startDate, endDate]
    );

    res.json(rows);
  } catch (error) {
    console.error('Error fetching time tracking:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/time-tracking
router.post('/', async (req, res) => {
  const { userId, date, activityId, startTime, endTime, note, itemId } = req.body || {};

  const parsedUserId = Number(userId);
  const parsedActivityId = Number(activityId);
  if (!parsedUserId || !date || !startTime || !endTime || !parsedActivityId) {
    return res.status(400).json({ error: 'userId, date, activityId, startTime, and endTime are required' });
  }

  const parseMinutes = (value) => {
    const [hours, minutes] = value.split(':').map((part) => Number(part));
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
    return hours * 60 + minutes;
  };

  const startMinutes = parseMinutes(startTime);
  const endMinutes = parseMinutes(endTime);
  if (startMinutes == null || endMinutes == null) {
    return res.status(400).json({ error: 'Invalid start or end time' });
  }
  if (endMinutes <= startMinutes) {
    return res.status(400).json({ error: 'End time must be after start time' });
  }

  const durationMinutes = endMinutes - startMinutes;
  const formatDateTime = (day, time) => `${day} ${time}:00`;

  try {
    const startStr = formatDateTime(date, startTime);
    const endStr = formatDateTime(date, endTime);
    const [overlaps] = await pool.query(
      `
      SELECT utt.id
      FROM users_time_tracking utt
      WHERE utt.user_id = ?
        AND utt.date = ?
        AND utt.start_time < ?
        AND COALESCE(utt.end_time, utt.start_time) > ?
      LIMIT 1
      `,
      [parsedUserId, date, endStr, startStr]
    );

    if (overlaps.length > 0) {
      return res.status(409).json({ error: 'Time range overlaps an existing entry.' });
    }

    const uuid = crypto.randomUUID();
    const [result] = await pool.query(
      `
      INSERT INTO users_time_tracking (
        uuid, user_id, date, project_id, activity_id, task_id, item_id,
        start_time, end_time, duration, is_finished, note
      )
      VALUES (?, ?, ?, NULL, ?, NULL, ?, ?, ?, ?, NULL, ?)
      `,
      [
        uuid,
        parsedUserId,
        date,
        parsedActivityId,
        itemId ? Number(itemId) : null,
        startStr,
        endStr,
        durationMinutes,
        note ?? null,
      ]
    );

    res.status(201).json({ id: result.insertId, uuid });
  } catch (error) {
    console.error('Error creating time tracking entry:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/time-tracking/:id/note
router.put('/:id/note', async (req, res) => {
  const entryId = Number(req.params.id);
  const { note } = req.body || {};

  if (!entryId) {
    return res.status(400).json({ error: 'Invalid entry id' });
  }

  try {
    await pool.query(
      `UPDATE users_time_tracking SET note = ? WHERE id = ?`,
      [note ?? null, entryId]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating time tracking note:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
