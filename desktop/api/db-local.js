const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const sqlite3 = require('sqlite3').verbose();
const { formatMySQLDatetime, parseSqliteDate, diffMinutes } = require('../utils/time');

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
      is_completed_project_task INTEGER,
      note TEXT
    )`);

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
      id TEXT PRIMARY KEY,             -- исправлено: MySQL VARCHAR → TEXT
      project_id INTEGER,
      task_id INTEGER,
      role_id INTEGER
    )`);
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
      const projectTasks = await globalApi.getAllProjectTasks();
      const projectTaskRoles = await globalApi.getAllProjectTaskRoles();

      saveUsersToLocal(users);
      saveProjectsToLocal(projects);
      saveProjectUsersToLocal(projectUsers);
      saveRefProjectRolesToLocal(roles);
      saveTasksToLocal(tasks);
      saveProjectTasksToLocal(projectTasks);
      saveProjectTaskRolesToLocal(projectTaskRoles);

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
      INSERT INTO project_task_roles (id, project_id, task_id, role_id)
      VALUES (?, ?, ?, ?)
    `);

    projectTaskRoles.forEach((ptr, i) => {
      stmt.run(
        ptr.id,
        ptr.project_id,
        ptr.task_id,
        ptr.role_id,
        (err) => {
          if (err) console.error(`[local-db] Failed to insert project_task_role ${ptr.id}:`, err.message);
        }
      );
    });

    stmt.finalize();
  });
}

function getAvailableTasksForUser(userId, projectId) {
  return new Promise((resolve, reject) => {
    db.all(`
      SELECT t.id, t.name, t.description
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

async function syncQueue() {
  const {
    startUnallocatedActivityGlobal,
    completeActiveActivityGlobal
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
          } else if (type === 'complete') {
            result = await completeActiveActivityGlobal(payload);
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

function startUnallocatedActivityLocal(userId, activityId) {
  const startTime = new Date();
  const dateStr = startTime.toISOString().split('T')[0];
  const timeStr = formatMySQLDatetime(startTime);
  const uuid = crypto.randomUUID();

  return new Promise((resolve, reject) => {
    db.run(`
      INSERT INTO users_time_tracking (  
        uuid, user_id, date, project_id, activity_id, task_id, item_id,
        start_time, end_time, duration, is_completed_project_task, note
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

function completeActiveActivityLocal({ uuid, is_completed_project_task, timestamp }) {
  const endTime = timestamp ? new Date(timestamp) : new Date();
  const endStr = formatMySQLDatetime(endTime);

  return new Promise((resolve, reject) => {
    const query = uuid
      ? `SELECT id, uuid, user_id, start_time 
         FROM users_time_tracking 
         WHERE uuid = ? AND end_time IS NULL 
         ORDER BY start_time DESC 
         LIMIT 1`
      : `SELECT id, uuid, user_id, start_time 
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

      db.run(
        `UPDATE users_time_tracking
         SET end_time = ?, duration = ?, is_completed_project_task = ?
         WHERE uuid = ?`,
        [endStr, durationMin, is_completed_project_task ? 1 : 0, row.uuid],
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
            timestamp: endTime.toISOString()
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
  saveUsersToLocal,
  saveProjectsToLocal,
  saveProjectUsersToLocal,
  saveRefProjectRolesToLocal,
  saveTasksToLocal,
  saveProjectTasksToLocal,
  saveProjectTaskRolesToLocal,
  startUnallocatedActivityLocal,
  getAvailableTasksForUser,
  syncQueue,
  completeActiveActivityLocal,
  initializeLocalDb
};
