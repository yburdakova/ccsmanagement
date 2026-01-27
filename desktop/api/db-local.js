const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const sqlite3 = require('sqlite3').verbose();
const { formatMySQLDatetime, parseSqliteDate, diffMinutes } = require('../utils/time');

const normalizeValueType = (valueType = '') =>
  String(valueType || '').trim().toLowerCase();

const getTaskDataColumn = (valueType = '') => {
  const type = normalizeValueType(valueType);
  switch (type) {
    case 'int':
    case 'integer':
      return 'value_int';
    case 'decimal':
      return 'value_decimal';
    case 'varchar':
      return 'value_varchar';
    case 'text':
      return 'value_text';
    case 'bool':
    case 'boolean':
      return 'value_bool';
    case 'date':
      return 'value_date';
    case 'datetime':
      return 'value_datetime';
    case 'customer_id':
      return 'value_customer_id';
    case 'json':
      return 'value_json';
    default:
      return null;
  }
};

const parseTaskDataValue = (valueType, value) => {
  const type = normalizeValueType(valueType);
  if (value == null || value === '') return null;
  if (type === 'int' || type === 'integer' || type === 'customer_id') {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  }
  if (type === 'decimal') {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  }
  if (type === 'bool' || type === 'boolean') {
    if (typeof value === 'boolean') return value ? 1 : 0;
    if (typeof value === 'number') return value ? 1 : 0;
    const normalized = String(value).trim().toLowerCase();
    return normalized === 'true' || normalized === '1' ? 1 : 0;
  }
  if (type === 'json') {
    try {
      return typeof value === 'string' ? value : JSON.stringify(value);
    } catch {
      return null;
    }
  }
  if (type === 'date') {
    const raw = String(value).trim();
    return raw ? raw.slice(0, 10) : null;
  }
  if (type === 'datetime') {
    const raw = String(value).trim();
    if (!raw) return null;
    const normalized = raw.includes('T') ? raw.replace('T', ' ') : raw;
    return normalized.length === 16 ? `${normalized}:00` : normalized;
  }
  return String(value);
};

const dbDir = path.join(__dirname, '../db');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir);
}

const dbPath = path.join(dbDir, 'local.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Failed to connect to local SQLite:', err);
  } else {
    console.log('Connected to local SQLite database.');
  }
});

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS local_users (
      id INTEGER PRIMARY KEY,
      first_name TEXT,
      last_name TEXT,
      login TEXT,
      authcode TEXT,
      system_role INTEGER,
      is_active INTEGER
    )`);

  db.run(`
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY,
      name TEXT
    )`);

  db.run(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY,
      code TEXT,
      name TEXT,
      type_id INTEGER,
      item_id INTEGER,
      is_active INTEGER,
      created_at TEXT,
      customer_id INTEGER
    )`);

  db.run(`
    CREATE TABLE IF NOT EXISTS project_users (
      id INTEGER PRIMARY KEY,
      project_id INTEGER,
      user_id INTEGER,
      project_role_id INTEGER
    )`);

  db.run(`
    CREATE TABLE IF NOT EXISTS ref_project_roles (
      id INTEGER PRIMARY KEY,
      name TEXT,
      label TEXT
    )`);

  db.run(`
    CREATE TABLE IF NOT EXISTS users_time_tracking (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT UNIQUE,
      user_id INTEGER,
      date TEXT,
      project_id INTEGER,
      activity_id INTEGER,
      task_id INTEGER,
      item_id INTEGER,
      start_time TEXT,
      end_time TEXT,
      duration INTEGER,
      is_finished INTEGER,
      note TEXT
    )`);

  db.all(`PRAGMA table_info(users_time_tracking)`, (err, rows) => {
    if (err) {
      console.error('[local-db] Failed to inspect users_time_tracking:', err.message);
      return;
    }
    const hasIsFinished = rows.some((row) => row.name === 'is_finished');
    if (!hasIsFinished) {
      db.run(`ALTER TABLE users_time_tracking ADD COLUMN is_finished INTEGER`, (alterErr) => {
        if (alterErr) {
          console.error('[local-db] Failed to add is_finished column:', alterErr.message);
        } else {
          console.log('[local-db] Added is_finished column to users_time_tracking');
        }
      });
    }
  });

  db.run(`
    CREATE TABLE IF NOT EXISTS sync_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      payload TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`);

  db.run(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY,
      name TEXT,
      description TEXT,
      category_id INTEGER,
      default_role_id INTEGER,
      in_progress_status_id INTEGER,
      completed_status_id INTEGER
    )`);

  db.run(`
    CREATE TABLE IF NOT EXISTS project_tasks (
      id INTEGER PRIMARY KEY,
      project_id INTEGER,
      task_id INTEGER,
      order_number INTEGER,
      only_after_number INTEGER,
      is_mandatory INTEGER,
      override_role_id INTEGER
    )`);

  db.run(`
    CREATE TABLE IF NOT EXISTS project_task_roles (
      id TEXT PRIMARY KEY,
      project_id INTEGER,
      task_id INTEGER,
      role_id INTEGER,
      is_default INTEGER DEFAULT 0
    )`);

  db.run(`
    CREATE TABLE IF NOT EXISTS task_data_definitions (
      id INTEGER PRIMARY KEY,
      \`key\` TEXT,
      label TEXT,
      value_type TEXT
    )`);

  db.run(`
    CREATE TABLE IF NOT EXISTS project_task_data (
      id INTEGER PRIMARY KEY,
      project_task_id INTEGER,
      data_def_id INTEGER,
      value_int INTEGER,
      value_decimal REAL,
      value_varchar TEXT,
      value_text TEXT,
      value_bool INTEGER,
      value_date TEXT,
      value_datetime TEXT,
      value_customer_id INTEGER,
      value_json TEXT,
      created_at TEXT,
      updated_at TEXT
    )`);

    db.run(`
      CREATE TABLE IF NOT EXISTS ref_item_status (
        id INTEGER PRIMARY KEY,
        name TEXT,
        label TEXT
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS cfs_items (
        id INTEGER PRIMARY KEY,
        project_id INTEGER,
        label TEXT,
        task_status_id INTEGER
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS im_items (
        id INTEGER PRIMARY KEY,
        project_id INTEGER,
        label TEXT,
        task_status_id INTEGER
      )
    `);
});

async function initializeLocalDb() {
  const { isOnline } = require('../utils/network-status');
  const globalApi = require('./db');

  const online = await isOnline();

  if (online) {
    console.log('[init] Online mode: syncing from global DB');

    try {
      const users = await globalApi.getAllUsers();
      const projects = await globalApi.getAllProjects();
      const projectUsers = await globalApi.getAllProjectUsers();
      const roles = await globalApi.getAllProjectRoles();
      const tasks = await globalApi.getAllTasks();
      const customers = await globalApi.getAllCustomers();
      const projectTasks = await globalApi.getAllProjectTasks();
      const projectTaskRoles = await globalApi.getAllProjectTaskRoles();
      const taskDataDefinitions = await globalApi.getAllTaskDataDefinitions();
      const projectTaskData = await globalApi.getAllProjectTaskData();
      const refItemStatus = await globalApi.getAllRefItemStatus();
      const cfsItems = await globalApi.getAllCfsItems();
      const imItems = await globalApi.getAllImItems();

      saveRefItemStatusToLocal(refItemStatus);
      saveCfsItemsToLocal(cfsItems);
      saveImItemsToLocal(imItems);
      saveUsersToLocal(users);
      saveProjectsToLocal(projects);
      saveProjectUsersToLocal(projectUsers);
      saveRefProjectRolesToLocal(roles);
      saveTasksToLocal(tasks);
      saveCustomersToLocal(customers);
      saveProjectTasksToLocal(projectTasks);
      saveProjectTaskRolesToLocal(projectTaskRoles);
      saveTaskDataDefinitionsToLocal(taskDataDefinitions);
      saveProjectTaskDataToLocal(projectTaskData);

      console.log('[init] Local DB refreshed from global DB');
      const syncResult = await syncQueue();
      console.log(`[init] Sync queue processed: ${syncResult.synced} record(s) synced`);
    } catch (err) {
      console.error('[init] Failed to sync local DB from global:', err.message);
    }
  } else {
    console.log('[init] Offline mode: using cached local DB');
  }
}

function loginByAuthCodeLocal(code) {
  const { db } = module.exports;
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT id, first_name, last_name, login 
       FROM local_users 
       WHERE authcode = ? AND is_active = 1 
       LIMIT 1`,
      [code],
      (err, row) => {
        if (err) {
          console.error('[local-db] Login query failed:', err.message);
          return reject(err);
        }
        resolve(row || null);
      }
    );
  });
}

function saveUsersToLocal(users) {
  if (!users || users.length === 0) {
    console.warn('[local-db] Skipping users update: empty dataset');
    return;
  }

  db.serialize(() => {
    console.log('[local-db] Clearing local_users...');
    db.run('DELETE FROM local_users');

    const stmt = db.prepare(`
      INSERT INTO local_users (id, first_name, last_name, login, authcode, system_role, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    users.forEach((user, i) => {
      stmt.run(
        user.id,
        user.first_name,
        user.last_name,
        user.login,
        user.authcode,
        user.system_role,
        user.is_active,
        (err) => {
          if (err) console.error(`[local-db] Failed to insert user ${user.id}:`, err.message);
        }
      );
    });

    stmt.finalize();
  });
}

function saveProjectsToLocal(projects) {
  if (!projects || projects.length === 0) {
    console.warn('[local-db] Skipping projects update: empty dataset');
    return;
  }

  db.serialize(() => {
    console.log('[local-db] Clearing projects...');
    db.run('DELETE FROM projects');

    const stmt = db.prepare(`
      INSERT INTO projects (id, code, name, type_id, item_id, is_active, created_at, customer_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    projects.forEach((project, i) => {
      stmt.run(
        project.id,
        project.code,
        project.name,
        project.type_id,
        project.item_id,
        project.is_active,
        project.created_at,
        project.customer_id,
        (err) => {
          if (err) console.error(`[local-db] Failed to insert project ${project.id}:`, err.message);
        }
      );
    });

    stmt.finalize();
  });
}

function saveProjectUsersToLocal(projectUsers) {
  if (!projectUsers || projectUsers.length === 0) {
    console.warn('[local-db] Skipping project_users update: empty dataset');
    return;
  }

  db.serialize(() => {
    console.log('[local-db] Clearing project_users...');
    db.run('DELETE FROM project_users');

    const stmt = db.prepare(`
      INSERT INTO project_users (id, user_id, project_id, project_role_id)
      VALUES (?, ?, ?, ?)
    `);

    projectUsers.forEach((pu, i) => {
      stmt.run(
        pu.id,
        pu.user_id,
        pu.project_id,
        pu.project_role_id,
        (err) => {
          if (err) console.error(`[local-db] Failed to insert project_user ${pu.id}:`, err.message);
        }
      );
    });

    stmt.finalize();
  });
}

function saveRefProjectRolesToLocal(roles) {
  if (!roles || roles.length === 0) {
    console.warn('[local-db] Skipping roles update: empty dataset');
    return;
  }

  db.serialize(() => {
    console.log('[local-db] Clearing ref_project_roles...');
    db.run('DELETE FROM ref_project_roles');

    const stmt = db.prepare(`
      INSERT INTO ref_project_roles (id, name, label)
      VALUES (?, ?, ?)
    `);

    roles.forEach((role, i) => {
      stmt.run(
        role.id,
        role.name,
        role.label,
        (err) => {
          if (err) console.error(`[local-db] Failed to insert role ${role.id}:`, err.message);
        }
      );
    });

    stmt.finalize();
  });
}

function saveTasksToLocal(tasks) {
  if (!tasks || tasks.length === 0) {
    console.warn('[local-db] Skipping tasks update: empty dataset');
    return;
  }

  db.serialize(() => {
    console.log('[local-db] Clearing tasks...');
    db.run('DELETE FROM tasks');

    const stmt = db.prepare(`
      INSERT INTO tasks (id, name, description, category_id, default_role_id, in_progress_status_id, completed_status_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    tasks.forEach((task, i) => {
      stmt.run(
        task.id,
        task.name,
        task.description,
        task.category_id,
        task.default_role_id,
        task.in_progress_status_id,
        task.completed_status_id,
        (err) => {
          if (err) console.error(`[local-db] Failed to insert task ${task.id}:`, err.message);
        }
      );
    });

    stmt.finalize();
  });
}

function saveCustomersToLocal(customers) {
  if (!customers || customers.length === 0) {
    console.warn('[local-db] Skipping customers update: empty dataset');
    return;
  }

  db.serialize(() => {
    console.log('[local-db] Clearing customers...');
    db.run('DELETE FROM customers');

    const stmt = db.prepare(`
      INSERT INTO customers (id, name)
      VALUES (?, ?)
    `);

    customers.forEach((customer) => {
      stmt.run(customer.id, customer.name, (err) => {
        if (err) console.error(`[local-db] Failed to insert customer ${customer.id}:`, err.message);
      });
    });

    stmt.finalize();
  });
}

function getAllCustomersLocal() {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT id, name FROM customers ORDER BY name`,
      (err, rows) => {
        if (err) {
          console.error('[local-db] Failed to fetch customers:', err.message);
          return reject(err);
        }
        resolve(rows);
      }
    );
  });
}

function saveProjectTasksToLocal(projectTasks) {
  if (!projectTasks || projectTasks.length === 0) {
    console.warn('[local-db] Skipping project_tasks update: empty dataset');
    return;
  }

  db.serialize(() => {
    console.log('[local-db] Clearing project_tasks...');
    db.run('DELETE FROM project_tasks');

    const stmt = db.prepare(`
      INSERT INTO project_tasks (id, project_id, task_id, order_number, only_after_number, is_mandatory, override_role_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    projectTasks.forEach((pt, i) => {
      stmt.run(
        pt.id,
        pt.project_id,
        pt.task_id,
        pt.order_number,
        pt.only_after_number,
        pt.is_mandatory,
        pt.override_role_id,
        (err) => {
          if (err) console.error(`[local-db] Failed to insert project_task ${pt.id}:`, err.message);
        }
      );
    });

    stmt.finalize();
  });
}

function saveProjectTaskRolesToLocal(projectTaskRoles) {
  if (!projectTaskRoles || projectTaskRoles.length === 0) {
    console.warn('[local-db] Skipping project_task_roles update: empty dataset');
    return;
  }

  db.serialize(() => {
    console.log('[local-db] Clearing project_task_roles...');
    db.run('DELETE FROM project_task_roles');

    const stmt = db.prepare(`
      INSERT INTO project_task_roles (id, project_id, task_id, role_id, is_default)
      VALUES (?, ?, ?, ?, ?)
    `);

    projectTaskRoles.forEach((ptr, i) => {
      stmt.run(
        ptr.id,
        ptr.project_id,
        ptr.task_id,
        ptr.role_id,
        ptr.is_default ?? 0,   // ✅ если null, то 0
        (err) => {
          if (err) console.error(`[local-db] Failed to insert project_task_role ${ptr.id}:`, err.message);
        }
      );
    });

    stmt.finalize();
  });
}

function saveTaskDataDefinitionsToLocal(definitions) {
  if (!definitions || definitions.length === 0) {
    console.warn('[local-db] Skipping task_data_definitions update: empty dataset');
    return;
  }

  db.serialize(() => {
    console.log('[local-db] Clearing task_data_definitions...');
    db.run('DELETE FROM task_data_definitions');

    const stmt = db.prepare(`
      INSERT INTO task_data_definitions (id, \`key\`, label, value_type)
      VALUES (?, ?, ?, ?)
    `);

    definitions.forEach((def) => {
      stmt.run(
        def.id,
        def.key,
        def.label,
        def.value_type ?? def.valueType,
        (err) => {
          if (err) console.error(`[local-db] Failed to insert task_data_definition ${def.id}:`, err.message);
        }
      );
    });

    stmt.finalize();
  });
}

function saveProjectTaskDataToLocal(taskData) {
  if (!taskData || taskData.length === 0) {
    console.warn('[local-db] Skipping project_task_data update: empty dataset');
    return;
  }

  db.serialize(() => {
    console.log('[local-db] Clearing project_task_data...');
    db.run('DELETE FROM project_task_data');

    const stmt = db.prepare(`
      INSERT INTO project_task_data (
        id, project_task_id, data_def_id,
        value_int, value_decimal, value_varchar, value_text, value_bool,
        value_date, value_datetime, value_customer_id, value_json,
        created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    taskData.forEach((row) => {
      stmt.run(
        row.id,
        row.project_task_id,
        row.data_def_id,
        row.value_int,
        row.value_decimal,
        row.value_varchar,
        row.value_text,
        row.value_bool,
        row.value_date,
        row.value_datetime,
        row.value_customer_id,
        row.value_json,
        row.created_at,
        row.updated_at,
        (err) => {
          if (err) console.error(`[local-db] Failed to insert project_task_data ${row.id}:`, err.message);
        }
      );
    });

    stmt.finalize();
  });
}

function saveRefItemStatusToLocal(statuses) {
  if (!statuses || statuses.length === 0) return;

  db.serialize(() => {
    console.log('[local-db] Clearing ref_item_status...');
    db.run('DELETE FROM ref_item_status');

    const stmt = db.prepare(`
      INSERT INTO ref_item_status (id, name, label)
      VALUES (?, ?, ?)
    `);

    statuses.forEach((s, i) => {
      stmt.run(s.id, s.name, s.label, (err) => {
        if (err) console.error(`[local-db] Failed to insert ref_item_status ${s.id}:`, err.message);
      });
    });

    stmt.finalize();
  });
}

function saveCfsItemsToLocal(items) {
  if (!items || items.length === 0) return;

  db.serialize(() => {
    console.log('[local-db] Clearing cfs_items...');
    db.run('DELETE FROM cfs_items');

    const stmt = db.prepare(`
      INSERT INTO cfs_items (id, project_id, label, task_status_id)
      VALUES (?, ?, ?, ?)
    `);

    items.forEach((item, i) => {
      stmt.run(item.id, item.project_id, item.label, item.task_status_id, (err) => {
        if (err) console.error(`[local-db] Failed to insert cfs_item ${item.id}:`, err.message);
      });
    });

    stmt.finalize();
  });
}

function saveImItemsToLocal(items) {
  if (!items || items.length === 0) return;

  db.serialize(() => {
    console.log('[local-db] Clearing im_items...');
    db.run('DELETE FROM im_items');

    const stmt = db.prepare(`
      INSERT INTO im_items (id, project_id, label, task_status_id)
      VALUES (?, ?, ?, ?)
    `);

    items.forEach((item, i) => {
      stmt.run(item.id, item.project_id, item.label, item.task_status_id, (err) => {
        if (err) console.error(`[local-db] Failed to insert im_item ${item.id}:`, err.message);
      });
    });

    stmt.finalize();
  });
}

function getAvailableTasksForUser(userId, projectId) {
  return new Promise((resolve, reject) => {
    db.all(`
      SELECT t.id, t.name, t.description, ptr.is_default, ptr.role_id AS roleId
      FROM project_users pu
      JOIN project_task_roles ptr 
        ON ptr.project_id = pu.project_id 
        AND ptr.role_id = pu.project_role_id
      JOIN tasks t ON t.id = ptr.task_id
      WHERE pu.user_id = ? AND pu.project_id = ?
    `, [userId, projectId], (err, rows) => {
      if (err) {
        console.error('[local-db] Failed to fetch available tasks:', err.message);
        return reject(err);
      }
      resolve(rows);
    });
  });
}

function replaceProjectTaskDataForTask(projectId, taskId, taskData) {
  return new Promise((resolve, reject) => {
    db.get(
      `
        SELECT id
        FROM project_tasks
        WHERE project_id = ? AND task_id = ?
        LIMIT 1
      `,
      [projectId, taskId],
      (err, row) => {
        if (err) {
          console.error('[local-db] Failed to find project_task_id:', err.message);
          return reject(err);
        }
        if (!row) return resolve({ success: true, skipped: true });

        const projectTaskId = row.id;
        db.serialize(() => {
          db.run(
            `DELETE FROM project_task_data WHERE project_task_id = ?`,
            [projectTaskId],
            (err2) => {
              if (err2) {
                console.error('[local-db] Failed to clear project_task_data:', err2.message);
                return reject(err2);
              }

              if (!taskData || taskData.length === 0) {
                return resolve({ success: true, cleared: true });
              }

              const stmt = db.prepare(`
                INSERT INTO project_task_data (
                  id, project_task_id, data_def_id,
                  value_int, value_decimal, value_varchar, value_text, value_bool,
                  value_date, value_datetime, value_customer_id, value_json,
                  created_at, updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              `);

              taskData.forEach((rowData) => {
                stmt.run(
                  rowData.id,
                  rowData.projectTaskId ?? projectTaskId,
                  rowData.dataDefId,
                  rowData.value_int,
                  rowData.value_decimal,
                  rowData.value_varchar,
                  rowData.value_text,
                  rowData.value_bool,
                  rowData.value_date,
                  rowData.value_datetime,
                  rowData.value_customer_id,
                  rowData.value_json,
                  rowData.created_at ?? null,
                  rowData.updated_at ?? null,
                  (err3) => {
                    if (err3) console.error('[local-db] Failed to insert project_task_data:', err3.message);
                  }
                );
              });

              stmt.finalize();
              resolve({ success: true, replaced: true });
            }
          );
        });
      }
    );
  });
}

function getProjectTaskDataByTask(projectId, taskId) {
  return new Promise((resolve, reject) => {
    db.all(
      `
        SELECT ptd.id,
               ptd.project_task_id AS projectTaskId,
               ptd.data_def_id AS dataDefId,
               tdd.label AS definitionLabel,
               tdd.value_type AS valueType,
               ptd.value_int,
               ptd.value_decimal,
               ptd.value_varchar,
               ptd.value_text,
               ptd.value_bool,
               ptd.value_date,
               ptd.value_datetime,
               ptd.value_customer_id,
               ptd.value_json
        FROM project_task_data ptd
        JOIN project_tasks pt ON pt.id = ptd.project_task_id
        JOIN task_data_definitions tdd ON tdd.id = ptd.data_def_id
        WHERE pt.project_id = ? AND pt.task_id = ?
        ORDER BY ptd.id
      `,
      [projectId, taskId],
      (err, rows) => {
        if (err) {
          console.error('[local-db] Failed to fetch project task data:', err.message);
          return reject(err);
        }
        resolve(rows);
      }
    );
  });
}

function saveTaskDataValueLocal({ projectId, taskId, dataDefId, valueType, value }) {
  const column = getTaskDataColumn(valueType);
  if (!column) {
    return Promise.resolve({ success: false, error: 'Invalid value type' });
  }

  const parsedValue = parseTaskDataValue(valueType, value);

  return new Promise((resolve, reject) => {
    db.get(
      `
        SELECT id
        FROM project_tasks
        WHERE project_id = ? AND task_id = ?
        LIMIT 1
      `,
      [projectId, taskId],
      (err, row) => {
        if (err) {
          console.error('[local-db] Failed to find project_task_id:', err.message);
          return reject(err);
        }
        if (!row) {
          return resolve({ success: false, error: 'Project task not found' });
        }

        const projectTaskId = row.id;

        db.get(
          `
            SELECT id
            FROM project_task_data
            WHERE project_task_id = ? AND data_def_id = ?
            LIMIT 1
          `,
          [projectTaskId, dataDefId],
          (err2, existing) => {
            if (err2) {
              console.error('[local-db] Failed to fetch project_task_data:', err2.message);
              return reject(err2);
            }

            const clearColumns = `
              value_int = NULL,
              value_decimal = NULL,
              value_varchar = NULL,
              value_text = NULL,
              value_bool = NULL,
              value_date = NULL,
              value_datetime = NULL,
              value_customer_id = NULL,
              value_json = NULL
            `;

            const finish = (result) => {
              const { isOnline } = require('../utils/network-status');
              isOnline().then((online) => {
                if (!online) {
                  const payload = {
                    type: 'task-data',
                    project_id: projectId,
                    task_id: taskId,
                    data_def_id: dataDefId,
                    value_type: valueType,
                    value: parsedValue
                  };

                  db.run(
                    `INSERT INTO sync_queue (payload) VALUES (?)`,
                    [JSON.stringify(payload)],
                    (err3) => {
                      if (err3) {
                        console.error('[local-db] Failed to queue task data update:', err3.message);
                      } else {
                        console.log('[local-db] Offline mode: queued task data update');
                      }
                    }
                  );
                }
              });
              resolve(result);
            };

            if (existing) {
              db.run(
                `
                  UPDATE project_task_data
                  SET ${clearColumns},
                      ${column} = ?,
                      updated_at = CURRENT_TIMESTAMP
                  WHERE id = ?
                `,
                [parsedValue, existing.id],
                (err3) => {
                  if (err3) {
                    console.error('[local-db] Failed to update project_task_data:', err3.message);
                    return reject(err3);
                  }
                  finish({ success: true, updated: true });
                }
              );
              return;
            }

            db.run(
              `
                INSERT INTO project_task_data (
                  project_task_id,
                  data_def_id,
                  ${column},
                  created_at,
                  updated_at
                )
                VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
              `,
              [projectTaskId, dataDefId, parsedValue],
              (err3) => {
                if (err3) {
                  console.error('[local-db] Failed to insert project_task_data:', err3.message);
                  return reject(err3);
                }
                finish({ success: true, created: true });
              }
            );
          }
        );
      }
    );
  });
}

async function syncQueue() {
  const {
    startUnallocatedActivityGlobal,
    startTaskActivityGlobal,
    completeActiveActivityGlobal,
    saveTaskDataValueGlobal
  } = require('./db');

  return new Promise((resolve, reject) => {
    db.all(`SELECT * FROM sync_queue`, async (err, rows) => {
      if (err) {
        console.error('[syncQueue] Failed to read queue:', err.message);
        return reject({ success: false, error: err.message });
      }

      let syncedCount = 0;

      for (const row of rows) {
        try {
          const payload = JSON.parse(row.payload);
          const type = payload.type;
          let result;

          if (type === 'start') {
            result = await startUnallocatedActivityGlobal(payload);
          } else if (type === 'start-task') {
            result = await startTaskActivityGlobal(payload);
          } else if (type === 'complete') {
            result = await completeActiveActivityGlobal(payload);
          } else if (type === 'task-data') {
            result = await saveTaskDataValueGlobal({
              projectId: payload.project_id,
              taskId: payload.task_id,
              dataDefId: payload.data_def_id,
              valueType: payload.value_type,
              value: payload.value
            });
          } else {
            console.warn('[syncQueue] Unknown payload type:', type);
            continue;
          }

          // 👇 считаем успешным, если:
          if (
            result.success || 
            result.duplicate || 
            result.ignored || 
            result.error === 'No active activity' || 
            result.error?.includes('ER_DUP_ENTRY')
          ) {
            db.run(
              `DELETE FROM sync_queue WHERE id = ?`,
              [row.id],
              (err2) => {
                if (err2) {
                  console.error('[syncQueue] Failed to clear synced record:', err2.message);
                } else {
                  console.log(
                    `[syncQueue] Record synced and cleared: uuid=${payload.uuid}, type=${payload.type}`
                  );
                }
              }
            );
            syncedCount++;
          } else {
            console.warn(
              `[syncQueue] Failed to sync record: ${result.error || 'Unknown error'}`
            );
          }
        } catch (err2) {
          console.error('[syncQueue] Error during sync:', err2.message);
        }
      }

      resolve({ success: true, synced: syncedCount });
    });
  });
}

function startTaskActivityLocal(userId, projectId, taskId, itemId) {
  const startTime = new Date();
  const dateStr = startTime.toISOString().split('T')[0];
  const timeStr = formatMySQLDatetime(startTime);
  const uuid = crypto.randomUUID();

  return new Promise((resolve, reject) => {
    db.run(`
      INSERT INTO users_time_tracking (  
        uuid, user_id, date, project_id, activity_id, task_id, item_id,
        start_time, end_time, duration, is_finished, note
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, NULL)
    `, [uuid, userId, dateStr, projectId, 2, taskId, itemId ?? null, timeStr], (err) => {
      if (err) {
        console.error('[local-db] Task start failed:', err.message);
        return reject(err);
      }

      console.log(`[local-db] Task start recorded (uuid=${uuid}, project=${projectId}, task=${taskId})`);

      const { isOnline } = require('../utils/network-status');
      isOnline().then((online) => {
        if (!online) {
          const payload = {
            type: 'start-task',
            uuid,
            user_id: userId,
            project_id: projectId,
            task_id: taskId,
            item_id: itemId ?? null,
            timestamp: startTime.toISOString()
          };

          db.run(
            `INSERT INTO sync_queue (payload) VALUES (?)`,
            [JSON.stringify(payload)],
            (err2) => {
              if (err2) {
                console.error('[local-db] Failed to queue task start:', err2.message);
              } else {
                console.log('[local-db] Offline mode: queued task start');
              }
            }
          );
        } else {
          console.log('[local-db] Online mode: skipping sync_queue for task start');
        }
      });

      resolve({ uuid });
    });
  });
}

function startUnallocatedActivityLocal(userId, activityId) {
  const startTime = new Date();
  const dateStr = startTime.toISOString().split('T')[0];
  const timeStr = formatMySQLDatetime(startTime);
  const uuid = crypto.randomUUID();

  return new Promise((resolve, reject) => {
    db.run(`
      INSERT INTO users_time_tracking (  
        uuid, user_id, date, project_id, activity_id, task_id, item_id,
        start_time, end_time, duration, is_finished, note
      ) VALUES (?, ?, ?, NULL, ?, NULL, NULL, ?, NULL, NULL, NULL, NULL)
    `, [uuid, userId, dateStr, activityId, timeStr], (err) => {
      if (err) {
        console.error('[local-db] Clock-in failed:', err.message);
        return reject(err);
      } else {
        console.log(`[local-db] Clock-in recorded (uuid=${uuid})`);

        const { isOnline } = require('../utils/network-status');
        isOnline().then((online) => {
          if (!online) {
            const payload = {
              type: 'start',
              uuid,
              user_id: userId,
              activity_id: activityId,
              timestamp: startTime.toISOString()
            };

            db.run(
              `INSERT INTO sync_queue (payload) VALUES (?)`,
              [JSON.stringify(payload)],
              (err) => {
                if (err) {
                  console.error('[local-db] Failed to queue clock-in:', err.message);
                } else {
                  console.log('[local-db] Offline mode: queued clock-in');
                }
              }
            );
          } else {
            console.log('[local-db] Online mode: skipping sync_queue');
          }
        });

        resolve({ uuid });
      }
    });
  });
}

function completeActiveActivityLocal({ uuid, is_completed_project_task, timestamp, note }) {
  const endTime = timestamp ? new Date(timestamp) : new Date();
  const endStr = formatMySQLDatetime(endTime);
  const safeNote = note != null ? String(note).trim().slice(0, 500) : null;

  return new Promise((resolve, reject) => {
    const query = uuid
      ? `SELECT id, uuid, user_id, activity_id, project_id, task_id, item_id, start_time 
         FROM users_time_tracking 
         WHERE uuid = ? AND end_time IS NULL 
         ORDER BY start_time DESC 
         LIMIT 1`
      : `SELECT id, uuid, user_id, activity_id, project_id, task_id, item_id, start_time 
         FROM users_time_tracking 
         WHERE end_time IS NULL 
         ORDER BY start_time DESC 
         LIMIT 1`;

    const params = uuid ? [uuid] : [];

    db.get(query, params, (err, row) => {
      if (err) {
        console.error('[local-db] Failed to find active activity:', err.message);
        return reject(err);
      }

      if (!row) {
        console.warn('[local-db] No active activity to complete');
        return resolve({ success: false, error: 'No active activity' });
      }

      const start = parseSqliteDate(row.start_time);
      const durationMin = diffMinutes(start, endTime);

      console.log(
        `[local-db] Completing activity (uuid=${row.uuid}), end=${endStr}, isTaskCompleted=${is_completed_project_task}`
      );

      const isFinished =
        row.activity_id !== 2 ? 1 : is_completed_project_task ? 1 : 0;

      db.run(
        `UPDATE users_time_tracking
         SET end_time = ?, duration = ?, is_finished = ?, note = ?
         WHERE uuid = ?`,
        [endStr, durationMin, isFinished, safeNote, row.uuid],
        (err2) => {
          if (err2) {
            console.error('[local-db] Failed to complete activity:', err2.message);
            return reject(err2);
          }

          // всегда кладём в очередь, независимо от онлайна
          const payload = {
            type: 'complete',
            uuid: row.uuid,
            user_id: row.user_id,
            is_completed_project_task,
            timestamp: endTime.toISOString(),
            note: safeNote
          };

          db.run(
            `INSERT INTO sync_queue (payload) VALUES (?)`,
            [JSON.stringify(payload)],
            (err3) => {
              if (err3) {
                console.error('[local-db] Failed to queue clock-out:', err3.message);
                return reject(err3);
              } else {
                console.log('[local-db] Queued clock-out (uuid=' + row.uuid + ')');
                // ✅ теперь resolve только после успешной вставки в очередь
                return resolve({ success: true, uuid: row.uuid, endTime, userId: row.user_id });
              }
            }
          );
        }
      );
    });
  });
}


module.exports = {
  db,
  loginByAuthCodeLocal,
  saveUsersToLocal,
  saveProjectsToLocal,
  saveProjectUsersToLocal,
  saveRefProjectRolesToLocal,
  saveTasksToLocal,
  saveProjectTasksToLocal,
  saveProjectTaskRolesToLocal,
  saveCustomersToLocal,
  saveTaskDataDefinitionsToLocal,
  saveProjectTaskDataToLocal,
  replaceProjectTaskDataForTask,
  startTaskActivityLocal,
  startUnallocatedActivityLocal,
  saveRefItemStatusToLocal,
  saveCfsItemsToLocal,
  saveImItemsToLocal,
  getAvailableTasksForUser,
  getAllCustomersLocal,
  saveTaskDataValueLocal,
  getProjectTaskDataByTask,
  syncQueue,
  completeActiveActivityLocal,
  initializeLocalDb
};
