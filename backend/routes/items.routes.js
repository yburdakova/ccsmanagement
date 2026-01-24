import express from 'express';
import pool from '../db.config.js';

const router = express.Router();

const formatMysqlDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 19).replace('T', ' ');
};

const getJiraAuthHeader = () => {
  const jiraEmail = process.env.JIRA_EMAIL || '';
  const jiraToken = process.env.JIRA_API_TOKEN || '';
  if (!jiraEmail || !jiraToken) {
    return null;
  }
  const basic = Buffer.from(`${jiraEmail}:${jiraToken}`).toString('base64');
  return `Basic ${basic}`;
};

// GET /api/items/status-summary?projectId=#
router.get('/status-summary', async (req, res) => {
  const parsedProjectId = Number(req.query.projectId);

  if (!parsedProjectId) {
    return res.status(400).json({ error: 'projectId is required' });
  }

  try {
    const [statusRows] = await pool.query(
      `
        SELECT ris.id,
               ris.label,
               COUNT(i.id) AS count
        FROM ref_item_status ris
        LEFT JOIN items i
          ON i.status_id = ris.id
          AND i.project_id = ?
        WHERE ris.project_id = ?
        GROUP BY ris.id, ris.label
        ORDER BY ris.label
      `,
      [parsedProjectId, parsedProjectId]
    );

    const [[registeredRow]] = await pool.query(
      `
        SELECT COUNT(*) AS count
        FROM items
        WHERE project_id = ?
          AND status_id IS NULL
      `,
      [parsedProjectId]
    );

    const summary = [
      {
        id: null,
        label: 'Registered',
        count: Number(registeredRow?.count || 0),
      },
      ...statusRows.map((row) => ({
        id: row.id,
        label: row.label,
        count: Number(row.count || 0),
      })),
    ];

    res.json(summary);
  } catch (error) {
    console.error('Error fetching item status summary:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

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

// POST /api/items/jira-sync
router.post('/jira-sync', async (req, res) => {
  const parsedProjectId = Number(req.body?.projectId ?? req.query?.projectId);
  const parsedUserId = req.body?.userId ? Number(req.body.userId) : null;

  if (!parsedProjectId) {
    return res.status(400).json({ error: 'projectId is required' });
  }

  const jiraBaseUrl = process.env.JIRA_BASE_URL || '';
  const authHeader = getJiraAuthHeader();
  if (!jiraBaseUrl || !authHeader) {
    return res.status(500).json({ error: 'Jira credentials are not configured' });
  }

  const connection = await pool.getConnection();
  let inTransaction = false;
  try {
    const [[project]] = await connection.query(
      `
        SELECT id, name, is_jira
        FROM projects
        WHERE id = ?
      `,
      [parsedProjectId]
    );

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (Number(project.is_jira) !== 1) {
      return res.status(400).json({ error: 'Project is not Jira-connected' });
    }

    const projectSearchUrl = new URL(
      `${jiraBaseUrl.replace(/\/$/, '')}/rest/api/3/project/search`
    );
    projectSearchUrl.searchParams.set('query', project.name);

    const projectResponse = await fetch(projectSearchUrl.toString(), {
      headers: {
        Authorization: authHeader,
        Accept: 'application/json',
      },
    });

    if (!projectResponse.ok) {
      const payload = await projectResponse.text();
      throw new Error(`Jira project search failed: ${payload}`);
    }

    const projectSearch = await projectResponse.json();
    const jiraProject =
      (projectSearch?.values || []).find(
        (entry) =>
          String(entry?.name || '').toLowerCase() ===
          String(project.name || '').toLowerCase()
      ) || (projectSearch?.values || [])[0];

    if (!jiraProject?.key) {
      return res.status(404).json({ error: 'Matching Jira project not found' });
    }

    const issues = [];
    let startAt = 0;
    let total = 0;

    do {
      const searchUrl = new URL(
        `${jiraBaseUrl.replace(/\/$/, '')}/rest/api/3/search/jql`
      );
      searchUrl.searchParams.set('jql', `project="${jiraProject.key}"`);
      searchUrl.searchParams.set(
        'fields',
        'key,assignee,status,created'
      );
      searchUrl.searchParams.set('startAt', String(startAt));
      searchUrl.searchParams.set('maxResults', '100');

      const issuesResponse = await fetch(searchUrl.toString(), {
        headers: {
          Authorization: authHeader,
          Accept: 'application/json',
        },
      });

      if (!issuesResponse.ok) {
        const payload = await issuesResponse.text();
        throw new Error(`Jira issue search failed: ${payload}`);
      }

      const issuesPayload = await issuesResponse.json();
      const batch = Array.isArray(issuesPayload?.issues)
        ? issuesPayload.issues
        : [];
      issues.push(...batch);
      total = Number(issuesPayload?.total || 0);
      startAt += batch.length;
    } while (startAt < total);

    await connection.beginTransaction();
    inTransaction = true;

    const [statusRows] = await connection.query(
      `
        SELECT id, label
        FROM ref_item_status
        WHERE project_id = ?
      `,
      [parsedProjectId]
    );
    const statusMap = new Map(
      statusRows.map((row) => [String(row.label || ''), row.id])
    );

    const [existingItems] = await connection.query(
      `
        SELECT id, code
        FROM items
        WHERE project_id = ?
      `,
      [parsedProjectId]
    );
    const itemMap = new Map(
      existingItems.map((row) => [String(row.code || ''), row.id])
    );

    const syncedIssues = [];

    for (const issue of issues) {
      const issueKey = String(issue?.key || '').trim();
      if (!issueKey) continue;
      const statusLabel = String(issue?.fields?.status?.name || '').trim();
      const createdAt = formatMysqlDate(issue?.fields?.created);
      const assigneeName = String(
        issue?.fields?.assignee?.displayName || ''
      ).trim();

      let statusId = null;
      if (statusLabel) {
        statusId = statusMap.get(statusLabel) || null;
        if (!statusId) {
          const [statusResult] = await connection.query(
            `
              INSERT INTO ref_item_status (label, project_id)
              VALUES (?, ?)
            `,
            [statusLabel, parsedProjectId]
          );
          statusId = statusResult.insertId;
          statusMap.set(statusLabel, statusId);
        }
      }

      let itemId = itemMap.get(issueKey);
      if (itemId) {
        await connection.query(
          `
            UPDATE items
            SET label = ?,
                item_type_id = 4,
                item_category_id = NULL,
                unit_type_id = NULL,
                status_id = ?,
                updated_at = NOW()
            WHERE id = ?
          `,
          [issueKey, statusId, itemId]
        );
      } else {
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
            VALUES (?, ?, ?, 4, NULL, NULL, ?, ?, ?)
          `,
          [
            issueKey,
            issueKey,
            parsedProjectId,
            statusId,
            parsedUserId,
            createdAt || formatMysqlDate(new Date()),
          ]
        );
        itemId = itemResult.insertId;
        itemMap.set(issueKey, itemId);
      }

      if (assigneeName && itemId) {
        const nameParts = assigneeName.split(/\s+/);
        const firstName = nameParts.shift() || '';
        const lastName = nameParts.join(' ');
        if (firstName && lastName) {
          const [[userRow]] = await connection.query(
            `
              SELECT id
              FROM users
              WHERE LOWER(first_name) = LOWER(?)
                AND LOWER(last_name) = LOWER(?)
              LIMIT 1
            `,
            [firstName, lastName]
          );

          if (userRow?.id) {
            const [[existingAssignment]] = await connection.query(
              `
                SELECT id
                FROM assigments
                WHERE user_id = ?
                  AND project_id = ?
                  AND item_id = ?
                  AND task_id = 27
                LIMIT 1
              `,
              [userRow.id, parsedProjectId, itemId]
            );

            if (!existingAssignment?.id) {
              await connection.query(
                `
                  INSERT INTO assigments (
                    user_id,
                    project_id,
                    item_id,
                    task_id,
                    role_id,
                    is_accepted
                  )
                  VALUES (?, ?, ?, 27, NULL, 0)
                `,
                [userRow.id, parsedProjectId, itemId]
              );
            }
          }
        }
      }

      syncedIssues.push({
        key: issueKey,
        status: statusLabel || null,
        assignee: issue?.fields?.assignee?.displayName || null,
      });
    }

    await connection.commit();
    inTransaction = false;
    console.log(
      `Jira sync completed for project ${parsedProjectId} (${jiraProject.key}): ${syncedIssues.length} issue(s).`
    );
    res.json({ projectKey: jiraProject.key, count: syncedIssues.length, issues: syncedIssues });
  } catch (error) {
    if (inTransaction) {
      await connection.rollback();
    }
    console.error('Error syncing Jira items:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    connection.release();
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
