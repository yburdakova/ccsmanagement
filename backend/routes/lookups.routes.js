import express from 'express';
import pool from '../db.config.js';

const router = express.Router();
console.log('Lookups route loaded');

// GET /api/lookups/project-form
router.get('/project-form', async (req, res) => {
  try {
    const [
        [projectTypesRows],
        [statusRows],
        [customersRows],
        [itemsRows],
        [unitsRows],
        [usersRows],
        [rolesRows],
        [tasksRows],
    ] = await Promise.all([
        pool.query(`
            SELECT id, code, label
            FROM ref_project_types
            ORDER BY label;
        `),

        pool.query(`
            SELECT id, label AS label
            FROM ref_project_status
            ORDER BY id;
        `),

        pool.query(`
            SELECT id, name
            FROM customers
            ORDER BY name;
        `),

        pool.query(`
            SELECT id, name
            FROM ref_item_types
            ORDER BY name;
        `),

        pool.query(`
            SELECT id, name
            FROM ref_unit_types
            ORDER BY name;
        `),

        pool.query(`
            SELECT ID AS id,
                CONCAT(first_name, ' ', last_name) AS fullName
            FROM users
            ORDER BY fullName;
        `),

        pool.query(`
            SELECT id, label
            FROM ref_project_roles
            ORDER BY label;
        `),

        pool.query(`
            SELECT id, description
            FROM tasks
            ORDER BY id;
      `),
    ]);

    res.json({
      projectTypes: projectTypesRows,
      statuses: statusRows,
      customers: customersRows,
      items: itemsRows,
      units: unitsRows,
      users: usersRows,
      roles: rolesRows,
      tasks: tasksRows,
    });
  } catch (err) {
    console.error('Error fetching project form lookups:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
