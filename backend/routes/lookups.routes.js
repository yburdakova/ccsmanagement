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
        [taskCategoriesRows],
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
            SELECT t.id,
                t.description,
                t.category_id AS categoryId,
                c.name AS categoryName
            FROM tasks t
            LEFT JOIN ref_task_category c
                ON c.id = t.category_id
            ORDER BY t.id;
      `),

        pool.query(`
            SELECT id, name
            FROM ref_task_category
            ORDER BY name;
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
      taskCategories: taskCategoriesRows,
    });
  } catch (err) {
    console.error('Error fetching project form lookups:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/lookups/task-categories
router.get('/task-categories', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT id, name
      FROM ref_task_category
      ORDER BY name;
    `);

    res.json(rows);
  } catch (err) {
    console.error('Error fetching task categories:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
