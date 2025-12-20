import express from 'express';
import pool from '../db.config.js';

const router = express.Router();

console.log('Projects route loaded');

router.get('/', async (req, res) => {
  try {
    const query = `
        SELECT 
            p.id,
            p.name,
            p.type_code AS code,
            pt.label AS project_type,
            st.label AS project_status,
            c.name AS customer_name,
            p.created_at
        FROM projects p
        LEFT JOIN ref_project_types  pt ON pt.code = p.type_code
        LEFT JOIN ref_project_status st ON st.id = p.project_status_id
        LEFT JOIN customers          c  ON c.id = p.customer_id
        ORDER BY p.created_at DESC;

    `;

    const [rows] = await pool.query(query);
    res.json(rows);

  } catch (err) {
    console.error('Error fetching projects:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
