import express from 'express';
import pool from '../db.config.js';

const router = express.Router();

// GET /api/items?projectId=#
router.get('/', async (req, res) => {
  const parsedProjectId = Number(req.query.projectId);

  if (!parsedProjectId) {
    return res.status(400).json({ error: 'projectId is required' });
  }

  try {
    const [rows] = await pool.query(
      `
        SELECT i.id,
               i.code,
               i.label,
               i.project_id AS projectId,
               i.item_category_id AS categoryId,
               i.created_at AS createdAt,
               i.updated_at AS updatedAt,
               s.label AS statusLabel
        FROM items i
        LEFT JOIN ref_item_status s
          ON s.id = i.status_id
        WHERE i.project_id = ?
        ORDER BY i.id;
      `,
      [parsedProjectId]
    );

    res.json(rows);
  } catch (error) {
    console.error('Error fetching items:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/items
router.post('/', async (req, res) => {
  const { projectId, categoryId, userId, count } = req.body || {};
  const parsedProjectId = Number(projectId);
  const parsedCategoryId = categoryId ? Number(categoryId) : null;
  const parsedUserId = userId ? Number(userId) : null;
  const parsedCount = Math.max(1, Number(count || 1));

  if (!parsedProjectId) {
    return res.status(400).json({ error: 'projectId is required' });
  }

  if (!Number.isFinite(parsedCount) || parsedCount < 1) {
    return res.status(400).json({ error: 'count must be at least 1' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [[project]] = await connection.query(
      `
        SELECT item_id AS itemTypeId, unit_id AS unitTypeId
        FROM projects
        WHERE id = ?
      `,
      [parsedProjectId]
    );

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const itemTypeId = project.itemTypeId ?? null;
    const unitTypeId = project.unitTypeId ?? null;

    if (!itemTypeId) {
      return res.status(400).json({ error: 'Project is missing item type.' });
    }

    const [[itemTypeRow]] = await connection.query(
      `
        SELECT name
        FROM ref_item_types
        WHERE id = ?
      `,
      [itemTypeId]
    );

    const itemTypeName = (itemTypeRow?.name || 'NA').trim();

    const [[projectSeqRow]] = await connection.query(
      `SELECT COUNT(*) AS count FROM items WHERE project_id = ?`,
      [parsedProjectId]
    );
    let projectSequence = Number(projectSeqRow?.count || 0) + 1;

    let categoryLabel = 'NA';
    if (parsedCategoryId) {
      const [[category]] = await connection.query(
        `
          SELECT label
          FROM ref_item_category
          WHERE id = ?
        `,
        [parsedCategoryId]
      );
      categoryLabel = (category?.label || 'NA').trim();
    }

    const [[categorySeqRow]] = await connection.query(
      `
        SELECT COUNT(*) AS count
        FROM items
        WHERE project_id = ?
          AND (
            (? IS NULL AND item_category_id IS NULL)
            OR item_category_id = ?
          )
      `,
      [parsedProjectId, parsedCategoryId, parsedCategoryId]
    );
    let categorySequence = Number(categorySeqRow?.count || 0) + 1;

    const createdItems = [];
    for (let index = 0; index < parsedCount; index += 1) {
      const [itemResult] = await connection.query(
        `
          INSERT INTO items (
            code,
            label,
            project_id,
            item_type_id,
            item_category_id,
            unit_type_id,
            status_id,
            created_by_user_id,
            created_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
        `,
        [
          '',
          `${categoryLabel} ${itemTypeName}${categorySequence}`.trim(),
          parsedProjectId,
          itemTypeId,
          parsedCategoryId,
          unitTypeId,
          null,
          parsedUserId,
        ]
      );

      const itemId = itemResult.insertId;
      const code = `${categoryLabel || 'NA'}-${parsedProjectId}.${itemId}-${projectSequence}-${categorySequence}`;

      await connection.query(
        `UPDATE items SET code = ? WHERE id = ?`,
        [code, itemId]
      );

      createdItems.push({ id: itemId, code });
      projectSequence += 1;
      categorySequence += 1;
    }

    await connection.commit();
    res.status(201).json({ items: createdItems });
  } catch (error) {
    await connection.rollback();
    console.error('Error creating item:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    connection.release();
  }
});

export default router;
