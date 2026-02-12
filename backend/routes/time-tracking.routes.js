import express from 'express';
import crypto from 'crypto';
import pool from '../db.config.js';

const router = express.Router();

// POST /api/time-tracking/bulk-delete
// Body: { ids: number[] }
router.post('/bulk-delete', async (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
  const parsedIds = ids
    .map((id) => Number(id))
    .filter((id) => Number.isFinite(id) && id > 0);

  if (parsedIds.length === 0) {
    return res.status(400).json({ error: 'ids is required' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.query(
      `
      SELECT uuid
      FROM users_time_tracking
      WHERE id IN (?)
      FOR UPDATE
      `,
      [parsedIds]
    );

    const uuids = rows
      .map((row) => String(row.uuid || '').trim())
      .filter(Boolean);

    if (uuids.length > 0) {
      await conn.query(
        `DELETE FROM users_time_tracking_data WHERE tracking_uuid IN (?)`,
        [uuids]
      );
    }

    const [result] = await conn.query(
      `DELETE FROM users_time_tracking WHERE id IN (?)`,
      [parsedIds]
    );

    await conn.commit();
    res.json({ success: true, deleted: result.affectedRows ?? 0 });
  } catch (error) {
    try {
      await conn.rollback();
    } catch {}
    console.error('Error bulk deleting time tracking entries:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    conn.release();
  }
});

// DELETE /api/time-tracking/:id
router.delete('/:id', async (req, res) => {
  const entryId = Number(req.params.id);
  if (!entryId) {
    return res.status(400).json({ error: 'Invalid entry id' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query(
      `SELECT uuid FROM users_time_tracking WHERE id = ? FOR UPDATE`,
      [entryId]
    );

    const uuid = rows.length ? String(rows[0].uuid || '').trim() : '';
    if (uuid) {
      await conn.query(
        `DELETE FROM users_time_tracking_data WHERE tracking_uuid = ?`,
        [uuid]
      );
    }

    const [result] = await conn.query(
      `DELETE FROM users_time_tracking WHERE id = ?`,
      [entryId]
    );

    await conn.commit();
    res.json({ success: true, deleted: result.affectedRows ?? 0 });
  } catch (error) {
    try {
      await conn.rollback();
    } catch {}
    console.error('Error deleting time tracking entry:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    conn.release();
  }
});

// PUT /api/time-tracking/:id
// Body supports:
// { startDate: "YYYY-MM-DD", startTime: "HH:MM", endDate: "YYYY-MM-DD", endTime: "HH:MM" | null, note?: string | null }
router.put('/:id', async (req, res) => {
  const entryId = Number(req.params.id);
  if (!entryId) {
    return res.status(400).json({ error: 'Invalid entry id' });
  }

  const normalizeDate = (value) => {
    const raw = String(value ?? '').trim();
    if (!raw) return null;
    const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;
    return raw;
  };

  const normalizeTime = (value) => {
    const raw = String(value ?? '').trim();
    if (!raw) return null;
    const match = raw.match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return null;
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  };

  const startDate = normalizeDate(req.body?.startDate ?? req.body?.start_date);
  const endDate = normalizeDate(req.body?.endDate ?? req.body?.end_date);
  const startTime = normalizeTime(req.body?.startTime ?? req.body?.start_time);
  const endTimeRaw = req.body?.endTime ?? req.body?.end_time;
  const endTime = endTimeRaw == null || String(endTimeRaw).trim() === '' ? null : normalizeTime(endTimeRaw);
  const note =
    req.body?.note === undefined
      ? undefined
      : req.body?.note == null
        ? null
        : String(req.body.note).trim() || null;

  if (!startDate || !endDate) {
    return res.status(400).json({ error: 'startDate and endDate are required (YYYY-MM-DD)' });
  }
  if (!startTime) {
    return res.status(400).json({ error: 'startTime is required (HH:MM)' });
  }
  if (endTimeRaw != null && endTimeRaw !== '' && !endTime) {
    return res.status(400).json({ error: 'endTime must be HH:MM or empty' });
  }
  if (endTime && endTime <= startTime) {
    return res.status(400).json({ error: 'End time must be after start time' });
  }
  if (startDate !== endDate) {
    return res.status(400).json({ error: 'Start date and end date must match' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [existing] = await conn.query(
      `
      SELECT id, user_id, date
      FROM users_time_tracking
      WHERE id = ?
      FOR UPDATE
      `,
      [entryId]
    );

    if (existing.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: 'Entry not found' });
    }

    const userId = Number(existing[0].user_id);
    const formatDateTime = (day, time) => `${day} ${time}:00`;

    const startStr = formatDateTime(startDate, startTime);
    const endStr = endTime ? formatDateTime(endDate, endTime) : null;

    if (endStr) {
      const [overlaps] = await conn.query(
        `
        SELECT utt.id
        FROM users_time_tracking utt
        WHERE utt.user_id = ?
          AND utt.date = ?
          AND utt.id <> ?
          AND utt.start_time < ?
          AND COALESCE(utt.end_time, utt.start_time) > ?
        LIMIT 1
        `,
        [userId, startDate, entryId, endStr, startStr]
      );

      if (overlaps.length > 0) {
        await conn.rollback();
        return res.status(409).json({ error: 'Time range overlaps an existing entry.' });
      }
    }

    const durationMinutes = endTime
      ? (Number(endTime.slice(0, 2)) * 60 + Number(endTime.slice(3, 5))) -
        (Number(startTime.slice(0, 2)) * 60 + Number(startTime.slice(3, 5)))
      : null;

    const updateFields = [];
    const updateValues = [];

    updateFields.push('date = ?');
    updateValues.push(startDate);

    updateFields.push('start_time = ?');
    updateValues.push(startStr);

    updateFields.push('end_time = ?');
    updateValues.push(endStr);

    updateFields.push('duration = ?');
    updateValues.push(durationMinutes);

    if (note !== undefined) {
      updateFields.push('note = ?');
      updateValues.push(note);
    }

    updateValues.push(entryId);

    await conn.query(
      `UPDATE users_time_tracking SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );

    await conn.commit();
    res.json({ success: true });
  } catch (error) {
    try {
      await conn.rollback();
    } catch {}
    console.error('Error updating time tracking entry:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    conn.release();
  }
});

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

  // Tasks that should show pages/min speed (pages stored in users_time_tracking_data.data_def_id=1 -> value_int).
  const allowedTaskIds = [1, 3, 6, 34, 36, 38];

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
        COALESCE(
          NULLIF(utt.duration, 0),
          CASE
            WHEN utt.end_time IS NULL THEN NULL
            ELSE GREATEST(1, CEIL(TIMESTAMPDIFF(SECOND, utt.start_time, utt.end_time) / 60))
          END
        ) AS duration,
        t.description AS task_name,
        p.name AS project_name,
        utd.value_int AS pages,
        CASE
          WHEN COALESCE(
            NULLIF(utt.duration, 0),
            CASE
              WHEN utt.end_time IS NULL THEN NULL
              ELSE GREATEST(1, CEIL(TIMESTAMPDIFF(SECOND, utt.start_time, utt.end_time) / 60))
            END
          ) > 0
           AND utd.value_int IS NOT NULL
          THEN ROUND(
            utd.value_int /
            COALESCE(
              NULLIF(utt.duration, 0),
              CASE
                WHEN utt.end_time IS NULL THEN NULL
                ELSE GREATEST(1, CEIL(TIMESTAMPDIFF(SECOND, utt.start_time, utt.end_time) / 60))
              END
            ),
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
    const tableExists = async (tableName) => {
      const [rows] = await pool.query(
        `
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = DATABASE()
          AND table_name = ?
        LIMIT 1
        `,
        [tableName]
      );
      return rows.length > 0;
    };

    const hasCfsItems = await tableExists('cfs_items');
    const hasImItems = await tableExists('im_items');
    const itemNameExpr = hasCfsItems && hasImItems
      ? 'COALESCE(i.label, cfs.label, im.label)'
      : hasCfsItems
        ? 'COALESCE(i.label, cfs.label)'
        : hasImItems
          ? 'COALESCE(i.label, im.label)'
          : 'i.label';

    const cfsJoin = hasCfsItems
      ? `
      LEFT JOIN cfs_items cfs
        ON cfs.id = utt.item_id
       AND cfs.project_id = utt.project_id`
      : '';
    const imJoin = hasImItems
      ? `
      LEFT JOIN im_items im
        ON im.id = utt.item_id
       AND im.project_id = utt.project_id`
      : '';

    const startDate = date ?? dateFrom;
    const endDate = date ?? dateTo;
    const [rows] = await pool.query(
      `
      SELECT
        utt.id,
        utt.activity_id,
        utt.project_id,
        utt.task_id,
        utt.item_id,
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
        ${itemNameExpr} AS item_name,
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
      LEFT JOIN items i ON i.id = utt.item_id
      ${cfsJoin}
      ${imJoin}
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
