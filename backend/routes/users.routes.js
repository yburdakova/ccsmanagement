import express from 'express';
import pool from '../db.config.js';

const router = express.Router();

const toFlag = (value) => {
  if (value === true || value === 'true' || value === 1 || value === '1') return 1;
  return 0;
};

const normalizeString = (value) => String(value ?? '').trim();

// GET /api/users
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `
        SELECT id,
               first_name,
               last_name,
               email,
               login,
               system_role,
               is_active,
               is_ccs
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

// GET /api/users/roles
router.get('/roles', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `
        SELECT id, name, label
        FROM ref_system_roles
        ORDER BY id;
      `
    );
    res.json(rows);
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE' || err.code === 'ER_BAD_TABLE_ERROR') {
      console.warn('[users] Missing ref_system_roles table, returning empty list.');
      return res.json([]);
    }
    console.error('Error fetching system roles:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/users
router.post('/', async (req, res) => {
  const payload = {
    first_name: normalizeString(req.body?.first_name),
    last_name: normalizeString(req.body?.last_name),
    email: normalizeString(req.body?.email),
    login: normalizeString(req.body?.login),
    password: normalizeString(req.body?.password),
    authcode: normalizeString(req.body?.authcode),
    system_role: req.body?.system_role,
    is_active: toFlag(req.body?.is_active),
    is_ccs: toFlag(req.body?.is_ccs),
  };

  if (
    !payload.first_name ||
    !payload.last_name ||
    !payload.email ||
    !payload.login ||
    !payload.password ||
    !payload.authcode ||
    payload.system_role == null
  ) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  const systemRoleId = Number(payload.system_role);
  if (!Number.isFinite(systemRoleId)) {
    return res.status(400).json({ error: 'system_role must be a number' });
  }

  try {
    const [existing] = await pool.query(
      `
        SELECT id
        FROM users
        WHERE login = ? OR email = ? OR authcode = ?
        LIMIT 1
      `,
      [payload.login, payload.email, payload.authcode]
    );
    if (existing.length) {
      return res.status(409).json({ error: 'User with same login/email/authcode exists' });
    }

    const [result] = await pool.query(
      `
        INSERT INTO users
          (first_name, last_name, email, login, password, authcode, system_role, is_active, is_ccs)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        payload.first_name,
        payload.last_name,
        payload.email,
        payload.login,
        payload.password,
        payload.authcode,
        systemRoleId,
        payload.is_active,
        payload.is_ccs,
      ]
    );

    res.status(201).json({
      id: result.insertId,
      first_name: payload.first_name,
      last_name: payload.last_name,
      email: payload.email,
      login: payload.login,
      system_role: systemRoleId,
      is_active: payload.is_active,
      is_ccs: payload.is_ccs,
    });
  } catch (err) {
    console.error('Error creating user:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/users/:id
router.put('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ error: 'Invalid user id' });
  }

  const payload = {
    first_name: normalizeString(req.body?.first_name),
    last_name: normalizeString(req.body?.last_name),
    email: normalizeString(req.body?.email),
    login: normalizeString(req.body?.login),
    password: normalizeString(req.body?.password),
    authcode: normalizeString(req.body?.authcode),
    system_role: req.body?.system_role,
    is_active: toFlag(req.body?.is_active),
    is_ccs: toFlag(req.body?.is_ccs),
  };

  if (
    !payload.first_name ||
    !payload.last_name ||
    !payload.email ||
    !payload.login ||
    !payload.password ||
    !payload.authcode ||
    payload.system_role == null
  ) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  const systemRoleId = Number(payload.system_role);
  if (!Number.isFinite(systemRoleId)) {
    return res.status(400).json({ error: 'system_role must be a number' });
  }

  try {
    const [existing] = await pool.query(
      `
        SELECT id
        FROM users
        WHERE (login = ? OR email = ? OR authcode = ?)
          AND id <> ?
        LIMIT 1
      `,
      [payload.login, payload.email, payload.authcode, id]
    );
    if (existing.length) {
      return res.status(409).json({ error: 'User with same login/email/authcode exists' });
    }

    const [result] = await pool.query(
      `
        UPDATE users
        SET first_name = ?,
            last_name = ?,
            email = ?,
            login = ?,
            password = ?,
            authcode = ?,
            system_role = ?,
            is_active = ?,
            is_ccs = ?
        WHERE id = ?
      `,
      [
        payload.first_name,
        payload.last_name,
        payload.email,
        payload.login,
        payload.password,
        payload.authcode,
        systemRoleId,
        payload.is_active,
        payload.is_ccs,
        id,
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      id,
      first_name: payload.first_name,
      last_name: payload.last_name,
      email: payload.email,
      login: payload.login,
      system_role: systemRoleId,
      is_active: payload.is_active,
      is_ccs: payload.is_ccs,
    });
  } catch (err) {
    console.error('Error updating user:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/users/:id
router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ error: 'Invalid user id' });
  }

  try {
    const [result] = await pool.query(`DELETE FROM users WHERE id = ?`, [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting user:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
