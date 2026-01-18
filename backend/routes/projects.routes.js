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
          customer_id
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

    res.json({
      project,
      team: teamRows,
      tasks: Array.from(tasksMap.values()),
    });
  } catch (err) {
    console.error('Error fetching project details:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', async (req, res) => {
  const { project, team = [], tasks = [] } = req.body;

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
          customer_id
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        project.name,
        typeCode,
        itemId,
        unitId,
        projectStatusId,
        customerId,
      ]
    );

    const projectId = projectResult.insertId;

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
  const { project, team = [], tasks = [] } = req.body;

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

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    await connection.query(
      `
        UPDATE projects
        SET name = ?,
            type_code = ?,
            item_id = ?,
            unit_id = ?,
            project_status_id = ?,
            customer_id = ?
        WHERE id = ?
      `,
      [
        project.name,
        typeCode,
        itemId,
        unitId,
        projectStatusId,
        customerId,
        projectId,
      ]
    );

    await connection.query(
      `DELETE FROM project_users WHERE project_id = ?`,
      [projectId]
    );
    await connection.query(
      `DELETE FROM project_task_roles WHERE project_id = ?`,
      [projectId]
    );

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
