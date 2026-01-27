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

    let taskDataDefinitionsRows = [];
    try {
      const [rows] = await pool.query(`
          SELECT id, \`key\`, label, value_type AS valueType
          FROM task_data_definitions
          ORDER BY label;
      `);
      taskDataDefinitionsRows = rows;
    } catch (err) {
      if (
        err.code === 'ER_NO_SUCH_TABLE' ||
        err.code === 'ER_BAD_TABLE_ERROR'
      ) {
        console.warn('[lookups] Missing task_data_definitions table, skipping.');
      } else {
        throw err;
      }
    }

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
      taskDataDefinitions: taskDataDefinitionsRows,
    });
  } catch (err) {
    console.error('Error fetching project form lookups:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/lookups/task-data-definitions
router.get('/task-data-definitions', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT id, \`key\`, label, value_type AS valueType
      FROM task_data_definitions
      ORDER BY label;
    `);
    res.json(rows);
  } catch (err) {
    if (
      err.code === 'ER_NO_SUCH_TABLE' ||
      err.code === 'ER_BAD_TABLE_ERROR'
    ) {
      console.warn('[lookups] Missing task_data_definitions table.');
      return res.json([]);
    }
    console.error('Error fetching task data definitions:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/lookups/task-data-definitions
router.post('/task-data-definitions', async (req, res) => {
  const rawLabel = String(req.body?.label ?? '').trim();
  const rawKey = String(req.body?.key ?? '').trim();
  const rawValueType = String(req.body?.valueType ?? req.body?.value_type ?? '').trim();

  if (!rawLabel) {
    return res.status(400).json({ error: 'label is required' });
  }

  const valueType = rawValueType || 'varchar';
  const key =
    rawKey ||
    rawLabel
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');

  try {
    const [result] = await pool.query(
      `
        INSERT INTO task_data_definitions (\`key\`, label, value_type)
        VALUES (?, ?, ?)
      `,
      [key, rawLabel, valueType]
    );
    res.status(201).json({
      id: result.insertId,
      key,
      label: rawLabel,
      valueType
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      const [rows] = await pool.query(
        `
          SELECT id, \`key\`, label, value_type AS valueType
          FROM task_data_definitions
          WHERE \`key\` = ? OR label = ?
          LIMIT 1
        `,
        [key, rawLabel]
      );
      if (rows.length) {
        return res.status(200).json(rows[0]);
      }
    }
    console.error('Error creating task data definition:', err);
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
