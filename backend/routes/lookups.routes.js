import express from 'express';
import pool from '../db.config.js';

const router = express.Router();
console.log('Lookups route loaded');

// GET /api/lookups/project-form
router.get('/project-form', async (req, res) => {
  try {
    const loadUnits = async () => {
      try {
        const [rows] = await pool.query(`
            SELECT id, name
            FROM units
            ORDER BY name;
        `);
        return rows;
      } catch (err) {
        if (err.code === 'ER_BAD_FIELD_ERROR') {
          const [rows] = await pool.query(`
              SELECT id, label AS name
              FROM units
              ORDER BY label;
          `);
          return rows;
        }
        if (err.code === 'ER_NO_SUCH_TABLE' || err.code === 'ER_BAD_TABLE_ERROR') {
          const [rows] = await pool.query(`
              SELECT id, name
              FROM ref_unit_types
              ORDER BY name;
          `);
          return rows;
        }
        throw err;
      }
    };

    let unitsRows = await loadUnits();
    if (!unitsRows || unitsRows.length === 0) {
      const [fallbackRows] = await pool.query(`
          SELECT id, name
          FROM ref_unit_types
          ORDER BY name;
      `);
      unitsRows = fallbackRows;
    }

    const [
        [projectTypesRows],
        [statusRows],
        [customersRows],
        [itemsRows],
        [usersRows],
        [rolesRows],
        [tasksRows],
        [taskCategoriesRows],
        [itemStatusRows],
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

        pool.query(`
            SELECT id,
                   label,
                   label AS name
            FROM ref_item_status
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
      taskCategories: taskCategoriesRows,
      itemStatuses: itemStatusRows,
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

// GET /api/lookups/item-categories
router.get('/item-categories', async (req, res) => {
  try {
    const projectTypeCode = req.query.projectTypeCode
      ? String(req.query.projectTypeCode)
      : null;

    let typeId = null;
    if (projectTypeCode) {
      const [[typeRow]] = await pool.query(
        `
          SELECT id
          FROM ref_project_types
          WHERE code = ?
          LIMIT 1
        `,
        [projectTypeCode]
      );
      typeId = typeRow?.id ?? null;
    }

    const [rows] = await pool.query(
      `
        SELECT id,
               label,
               label AS name
        FROM ref_item_category
        WHERE (? IS NULL OR project_specific_id = ? OR project_specific_id IS NULL)
        ORDER BY label;
      `,
      [typeId, typeId]
    );

    res.json(
      rows.map((row) => ({
        id: row.id,
        label: row.label || row.name,
      }))
    );
  } catch (err) {
    console.error('Error fetching item categories:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
