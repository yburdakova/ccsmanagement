import express from 'express';
import pool from '../db.config.js';

const router = express.Router();

const normalizeString = (value) => String(value ?? '').trim();

// GET /api/customers
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `
        SELECT id,
               name,
               state,
               county,
               contact_name,
               contact_email,
               contact_phone
        FROM customers
        ORDER BY id;
      `
    );
    res.json(rows);
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE' || err.code === 'ER_BAD_TABLE_ERROR') {
      console.warn('[customers] Missing customers table, returning empty list.');
      return res.json([]);
    }
    console.error('Error fetching customers:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/customers
router.post('/', async (req, res) => {
  const payload = {
    name: normalizeString(req.body?.name),
    state: normalizeString(req.body?.state),
    county: normalizeString(req.body?.county),
    contact_name: normalizeString(req.body?.contact_name),
    contact_email: normalizeString(req.body?.contact_email),
    contact_phone: normalizeString(req.body?.contact_phone),
  };

  if (
    !payload.name ||
    !payload.state ||
    !payload.county ||
    !payload.contact_name ||
    !payload.contact_email ||
    !payload.contact_phone
  ) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  try {
    const [result] = await pool.query(
      `
        INSERT INTO customers
          (name, state, county, contact_name, contact_email, contact_phone)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        payload.name,
        payload.state,
        payload.county,
        payload.contact_name,
        payload.contact_email,
        payload.contact_phone,
      ]
    );

    res.status(201).json({ id: result.insertId, ...payload });
  } catch (err) {
    console.error('Error creating customer:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/customers/:id
router.put('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ error: 'Invalid customer id' });
  }

  const payload = {
    name: normalizeString(req.body?.name),
    state: normalizeString(req.body?.state),
    county: normalizeString(req.body?.county),
    contact_name: normalizeString(req.body?.contact_name),
    contact_email: normalizeString(req.body?.contact_email),
    contact_phone: normalizeString(req.body?.contact_phone),
  };

  if (
    !payload.name ||
    !payload.state ||
    !payload.county ||
    !payload.contact_name ||
    !payload.contact_email ||
    !payload.contact_phone
  ) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  try {
    const [result] = await pool.query(
      `
        UPDATE customers
        SET name = ?,
            state = ?,
            county = ?,
            contact_name = ?,
            contact_email = ?,
            contact_phone = ?
        WHERE id = ?
      `,
      [
        payload.name,
        payload.state,
        payload.county,
        payload.contact_name,
        payload.contact_email,
        payload.contact_phone,
        id,
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    res.json({ id, ...payload });
  } catch (err) {
    console.error('Error updating customer:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/customers/:id
router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ error: 'Invalid customer id' });
  }

  try {
    const [result] = await pool.query(`DELETE FROM customers WHERE id = ?`, [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting customer:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
