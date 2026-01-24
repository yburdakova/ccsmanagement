import express from 'express';
import pool from '../db.config.js';

const router = express.Router();

console.log('Projects route loaded');

const idColumnCache = new Map();

const getIdColumnMode = async (connection, tableName) => {
  if (idColumnCache.has(tableName)) {
    return idColumnCache.get(tableName);
  }

  const [rows] = await connection.query(
    `SHOW COLUMNS FROM ?? LIKE 'id'`,
    [tableName]
  );
  if (rows.length === 0) {
    idColumnCache.set(tableName, 'none');
    return 'none';
  }
  const extra = rows[0].Extra ?? '';
  const mode = extra.includes('auto_increment') ? 'auto' : 'manual';
  idColumnCache.set(tableName, mode);
  return mode;
};

const getNextId = async (connection, tableName) => {
  const [rows] = await connection.query(
    `SELECT COALESCE(MAX(id), 0) AS maxId FROM ${tableName} FOR UPDATE`
  );
  return Number(rows[0].maxId) + 1;
};

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
            p.is_jira AS isJira,
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

router.get('/:id', async (req, res) => {
  const projectId = Number(req.params.id);
  if (!projectId) {
    return res.status(400).json({ error: 'Invalid project id' });
  }

  try {
    const [[project]] = await pool.query(
      `
        SELECT 
          id,
          name,
          type_code,
          item_id,
          unit_id,
          project_status_id,
          customer_id,
          is_jira AS isJira
        FROM projects
        WHERE id = ?
      `,
      [projectId]
    );

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const [teamRows] = await pool.query(
      `
        SELECT user_id AS userId, project_role_id AS roleId
        FROM project_users
        WHERE project_id = ?
      `,
      [projectId]
    );

    const [taskRoleRows] = await pool.query(
      `
        SELECT ptr.task_id AS taskId,
               ptr.role_id AS roleId,
               t.description AS taskTitle,
               t.category_id AS categoryId
        FROM project_task_roles ptr
        JOIN tasks t ON t.id = ptr.task_id
        WHERE ptr.project_id = ?
      `,
      [projectId]
    );

    const tasksMap = new Map();
    for (const row of taskRoleRows) {
      const key = String(row.taskId);
      if (!tasksMap.has(key)) {
        tasksMap.set(key, {
          taskId: row.taskId,
          taskTitle: row.taskTitle,
          categoryId: row.categoryId,
          rolesId: [],
        });
      }
      const entry = tasksMap.get(key);
      entry.rolesId.push(row.roleId);
    }

    const [itemStatusRows] = await pool.query(
      `
        SELECT ris.id AS statusId,
               ris.label AS statusText,
               ist.task_id AS taskId,
               ist.apply_after_finish AS applyAfterFinish
        FROM ref_item_status ris
        LEFT JOIN itemstatus_task ist ON ist.item_status_id = ris.id
        WHERE ris.project_id = ?
      `,
      [projectId]
    );

    const itemTrackingMap = new Map();
    for (const row of itemStatusRows) {
      const key = String(row.statusId);
      if (!itemTrackingMap.has(key)) {
        itemTrackingMap.set(key, {
          statusText: row.statusText,
          taskIds: [],
          applyAfterFinish: 0,
        });
      }
      const entry = itemTrackingMap.get(key);
      if (row.taskId) {
        entry.taskIds.push(row.taskId);
      }
      if (Number(row.applyAfterFinish) === 1) {
        entry.applyAfterFinish = 1;
      }
    }

    res.json({
      project,
      team: teamRows,
      tasks: Array.from(tasksMap.values()),
      itemTracking: Array.from(itemTrackingMap.values()),
    });
  } catch (err) {
    console.error('Error fetching project details:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id/jira', async (req, res) => {
  const projectId = Number(req.params.id);
  if (!projectId) {
    return res.status(400).json({ error: 'Invalid project id' });
  }

  const isJira = req.body?.isJira ?? req.body?.is_jira;
  if (isJira === undefined) {
    return res.status(400).json({ error: 'isJira is required' });
  }

  try {
    await pool.query(
      `
        UPDATE projects
        SET is_jira = ?
        WHERE id = ?
      `,
      [Number(isJira) ? 1 : 0, projectId]
    );
    res.json({ id: projectId });
  } catch (err) {
    console.error('Error updating project Jira flag:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', async (req, res) => {
  const { project, team = [], tasks = [], itemTracking = [] } = req.body;

  if (!project || !project.name) {
    return res.status(400).json({ error: 'Project name is required' });
  }

  const projectStatusId =
    project.project_status_id ?? project.project_status_id === 0
      ? project.project_status_id
      : 1;
  const typeCode = project.type_code || null;
  const itemId = project.item_id || null;
  const unitId = project.unit_id || null;
  const customerId = project.customer_id || null;
  const isJira =
    project.is_jira ?? project.isJira ?? 0;

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [projectResult] = await connection.query(
      `
        INSERT INTO projects (
          name,
          type_code,
          item_id,
          unit_id,
          project_status_id,
          customer_id,
          is_jira
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        project.name,
        typeCode,
        itemId,
        unitId,
        projectStatusId,
        customerId,
        Number(isJira) ? 1 : 0,
      ]
    );

    const projectId = projectResult.insertId;
    const taskTempMap = new Map();

    const projectUsersIdMode = await getIdColumnMode(connection, 'project_users');
    let nextProjectUserId =
      projectUsersIdMode === 'manual'
        ? await getNextId(connection, 'project_users')
        : null;
    for (const row of team) {
      if (!row.userId || !row.roleId) continue;
      if (projectUsersIdMode === 'manual') {
        await connection.query(
          `
            INSERT INTO project_users (id, project_id, user_id, project_role_id)
            VALUES (?, ?, ?, ?)
          `,
          [nextProjectUserId, projectId, row.userId, row.roleId]
        );
        nextProjectUserId += 1;
      } else {
        await connection.query(
          `
            INSERT INTO project_users (project_id, user_id, project_role_id)
            VALUES (?, ?, ?)
          `,
          [projectId, row.userId, row.roleId]
        );
      }
    }

    const projectTaskRolesIdMode = await getIdColumnMode(
      connection,
      'project_task_roles'
    );
    let nextProjectTaskRoleId =
      projectTaskRolesIdMode === 'manual'
        ? await getNextId(connection, 'project_task_roles')
        : null;
    for (const task of tasks) {
      let taskId = task.taskId;

      if (!taskId && task.taskTitle) {
        const [taskResult] = await connection.query(
          `
            INSERT INTO tasks (description, category_id)
            VALUES (?, ?)
          `,
          [task.taskTitle, task.categoryId ?? null]
        );
        taskId = taskResult.insertId;
        if (task.taskTempId) {
          taskTempMap.set(String(task.taskTempId), taskId);
        }
      }

      if (!taskId) continue;

      const roles = Array.isArray(task.rolesId) ? task.rolesId : [];
      for (const roleId of roles) {
        if (!roleId) continue;
        if (projectTaskRolesIdMode === 'manual') {
          await connection.query(
            `
              INSERT INTO project_task_roles (id, project_id, task_id, role_id)
              VALUES (?, ?, ?, ?)
            `,
            [nextProjectTaskRoleId, projectId, taskId, roleId]
          );
          nextProjectTaskRoleId += 1;
        } else {
          await connection.query(
            `
              INSERT INTO project_task_roles (project_id, task_id, role_id)
              VALUES (?, ?, ?)
            `,
            [projectId, taskId, roleId]
          );
        }
      }
    }

    if (Array.isArray(itemTracking) && itemTracking.length > 0) {
      for (const row of itemTracking) {
        const statusText = String(row.statusText || '').trim();
        if (!statusText) continue;
        const applyAfterFinish = row.statusMoment === 'task_finished' ? 1 : 0;
        const taskRefs = Array.isArray(row.taskRefs) ? row.taskRefs : [];
        const resolvedTaskIds = taskRefs
          .map((ref) =>
            ref?.taskId ??
            (ref?.taskTempId ? taskTempMap.get(String(ref.taskTempId)) : null)
          )
          .filter((id) => Boolean(id));
        if (resolvedTaskIds.length === 0) continue;

        const [statusResult] = await connection.query(
          `
            INSERT INTO ref_item_status (label, project_id)
            VALUES (?, ?)
          `,
          [statusText, projectId]
        );
        const statusId = statusResult.insertId;

        for (const resolvedTaskId of resolvedTaskIds) {
          await connection.query(
            `
              INSERT INTO itemstatus_task (item_status_id, task_id, apply_after_finish)
              VALUES (?, ?, ?)
            `,
            [statusId, resolvedTaskId, applyAfterFinish]
          );
        }
      }
    }

    await connection.commit();
    res.status(201).json({ id: projectId });
  } catch (err) {
    await connection.rollback();
    console.error('Error creating project:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    connection.release();
  }
});

router.put('/:id', async (req, res) => {
  const projectId = Number(req.params.id);
  const { project, team = [], tasks = [], itemTracking = [] } = req.body;

  if (!projectId) {
    return res.status(400).json({ error: 'Invalid project id' });
  }
  if (!project || !project.name) {
    return res.status(400).json({ error: 'Project name is required' });
  }

  const projectStatusId =
    project.project_status_id ?? project.project_status_id === 0
      ? project.project_status_id
      : 1;
  const typeCode = project.type_code || null;
  const itemId = project.item_id || null;
  const unitId = project.unit_id || null;
  const customerId = project.customer_id || null;
  const isJira =
    project.is_jira ?? project.isJira;

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const taskTempMap = new Map();

    await connection.query(
      `
        UPDATE projects
        SET name = ?,
            type_code = ?,
            item_id = ?,
            unit_id = ?,
            project_status_id = ?,
            customer_id = ?,
            is_jira = COALESCE(?, is_jira)
        WHERE id = ?
      `,
      [
        project.name,
        typeCode,
        itemId,
        unitId,
        projectStatusId,
        customerId,
        isJira ?? null,
        projectId,
      ]
    );

    const [existingProjectUsers] = await connection.query(
      `
        SELECT id, user_id AS userId, project_role_id AS roleId
        FROM project_users
        WHERE project_id = ?
      `,
      [projectId]
    );

    const desiredUsers = team
      .filter((row) => row.userId && row.roleId)
      .map((row) => ({ userId: Number(row.userId), roleId: Number(row.roleId) }));

    const existingUserKeyToId = new Map(
      existingProjectUsers.map((row) => [`${row.userId}:${row.roleId}`, row.id])
    );
    const desiredUserKeys = new Set(
      desiredUsers.map((row) => `${row.userId}:${row.roleId}`)
    );

    for (const row of existingProjectUsers) {
      const key = `${row.userId}:${row.roleId}`;
      if (!desiredUserKeys.has(key)) {
        await connection.query(`DELETE FROM project_users WHERE id = ?`, [row.id]);
      }
    }

    const projectUsersIdMode = await getIdColumnMode(connection, 'project_users');
    let nextProjectUserId =
      projectUsersIdMode === 'manual'
        ? await getNextId(connection, 'project_users')
        : null;
    for (const row of desiredUsers) {
      const key = `${row.userId}:${row.roleId}`;
      if (existingUserKeyToId.has(key)) continue;
      if (projectUsersIdMode === 'manual') {
        await connection.query(
          `
            INSERT INTO project_users (id, project_id, user_id, project_role_id)
            VALUES (?, ?, ?, ?)
          `,
          [nextProjectUserId, projectId, row.userId, row.roleId]
        );
        nextProjectUserId += 1;
      } else {
        await connection.query(
          `
            INSERT INTO project_users (project_id, user_id, project_role_id)
            VALUES (?, ?, ?)
          `,
          [projectId, row.userId, row.roleId]
        );
      }
    }

    const projectTaskRolesIdMode = await getIdColumnMode(
      connection,
      'project_task_roles'
    );
    let nextProjectTaskRoleId =
      projectTaskRolesIdMode === 'manual'
        ? await getNextId(connection, 'project_task_roles')
        : null;
    const resolvedTasks = [];
    for (const task of tasks) {
      let taskId = task.taskId;

      if (!taskId && task.taskTitle) {
        const [taskResult] = await connection.query(
          `
            INSERT INTO tasks (description, category_id)
            VALUES (?, ?)
          `,
          [task.taskTitle, task.categoryId ?? null]
        );
        taskId = taskResult.insertId;
        if (task.taskTempId) {
          taskTempMap.set(String(task.taskTempId), taskId);
        }
      }

      if (!taskId) continue;
      resolvedTasks.push({
        taskId,
        rolesId: Array.isArray(task.rolesId) ? task.rolesId : [],
      });
    }

    const [existingTaskRoles] = await connection.query(
      `
        SELECT id, task_id AS taskId, role_id AS roleId
        FROM project_task_roles
        WHERE project_id = ?
      `,
      [projectId]
    );
    const desiredTaskRoles = [];
    for (const task of resolvedTasks) {
      for (const roleId of task.rolesId) {
        if (!roleId) continue;
        desiredTaskRoles.push({ taskId: task.taskId, roleId: Number(roleId) });
      }
    }
    const existingTaskRoleKeyToId = new Map(
      existingTaskRoles.map((row) => [`${row.taskId}:${row.roleId}`, row.id])
    );
    const desiredTaskRoleKeys = new Set(
      desiredTaskRoles.map((row) => `${row.taskId}:${row.roleId}`)
    );

    for (const row of existingTaskRoles) {
      const key = `${row.taskId}:${row.roleId}`;
      if (!desiredTaskRoleKeys.has(key)) {
        await connection.query(`DELETE FROM project_task_roles WHERE id = ?`, [row.id]);
      }
    }

    for (const row of desiredTaskRoles) {
      const key = `${row.taskId}:${row.roleId}`;
      if (existingTaskRoleKeyToId.has(key)) continue;
      if (projectTaskRolesIdMode === 'manual') {
        await connection.query(
          `
            INSERT INTO project_task_roles (id, project_id, task_id, role_id)
            VALUES (?, ?, ?, ?)
          `,
          [nextProjectTaskRoleId, projectId, row.taskId, row.roleId]
        );
        nextProjectTaskRoleId += 1;
      } else {
        await connection.query(
          `
            INSERT INTO project_task_roles (project_id, task_id, role_id)
            VALUES (?, ?, ?)
          `,
          [projectId, row.taskId, row.roleId]
        );
      }
    }

    const [existingStatuses] = await connection.query(
      `
        SELECT id, label
        FROM ref_item_status
        WHERE project_id = ?
      `,
      [projectId]
    );
    const existingStatusByLabel = new Map(
      existingStatuses.map((row) => [String(row.label || ''), row.id])
    );
    const desiredStatusLabels = new Set(
      (itemTracking || [])
        .map((row) => String(row.statusText || '').trim())
        .filter((label) => label)
    );
    const statusIdsToDelete = existingStatuses
      .filter((row) => !desiredStatusLabels.has(String(row.label || '')))
      .map((row) => row.id);

    if (statusIdsToDelete.length > 0) {
      await connection.query(
        `
          UPDATE items
          SET status_id = NULL
          WHERE status_id IN (?)
        `,
        [statusIdsToDelete]
      );

      await connection.query(
        `DELETE FROM itemstatus_task WHERE item_status_id IN (?)`,
        [statusIdsToDelete]
      );

      await connection.query(
        `DELETE FROM ref_item_status WHERE id IN (?)`,
        [statusIdsToDelete]
      );
    }

    if (Array.isArray(itemTracking) && itemTracking.length > 0) {
      for (const row of itemTracking) {
        const statusText = String(row.statusText || '').trim();
        if (!statusText) continue;
        const applyAfterFinish = row.statusMoment === 'task_finished' ? 1 : 0;
        const taskRefs = Array.isArray(row.taskRefs) ? row.taskRefs : [];
        const resolvedTaskIds = taskRefs
          .map((ref) =>
            ref?.taskId ??
            (ref?.taskTempId ? taskTempMap.get(String(ref.taskTempId)) : null)
          )
          .filter((id) => Boolean(id));
        if (resolvedTaskIds.length === 0) continue;

        let statusId = existingStatusByLabel.get(statusText);
        if (!statusId) {
          const [statusResult] = await connection.query(
            `
              INSERT INTO ref_item_status (label, project_id)
              VALUES (?, ?)
            `,
            [statusText, projectId]
          );
          statusId = statusResult.insertId;
          existingStatusByLabel.set(statusText, statusId);
        }

        const [existingLinks] = await connection.query(
          `
            SELECT id, task_id AS taskId, apply_after_finish AS applyAfterFinish
            FROM itemstatus_task
            WHERE item_status_id = ?
          `,
          [statusId]
        );
        const existingLinkMap = new Map(
          existingLinks.map((link) => [Number(link.taskId), link])
        );
        const desiredTaskIdSet = new Set(resolvedTaskIds.map((id) => Number(id)));

        for (const taskId of resolvedTaskIds) {
          const numericTaskId = Number(taskId);
          const link = existingLinkMap.get(numericTaskId);
          if (link) {
            if (Number(link.applyAfterFinish) !== applyAfterFinish) {
              await connection.query(
                `
                  UPDATE itemstatus_task
                  SET apply_after_finish = ?
                  WHERE id = ?
                `,
                [applyAfterFinish, link.id]
              );
            }
          } else {
            await connection.query(
              `
                INSERT INTO itemstatus_task (item_status_id, task_id, apply_after_finish)
                VALUES (?, ?, ?)
              `,
              [statusId, numericTaskId, applyAfterFinish]
            );
          }
        }

        for (const link of existingLinks) {
          if (!desiredTaskIdSet.has(Number(link.taskId))) {
            await connection.query(`DELETE FROM itemstatus_task WHERE id = ?`, [link.id]);
          }
        }
      }
    }

    await connection.commit();
    res.json({ id: projectId });
  } catch (err) {
    await connection.rollback();
    console.error('Error updating project:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    connection.release();
  }
});

export default router;
