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
        )
    `);

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
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS project_users (
        id INTEGER PRIMARY KEY,
        project_id INTEGER,
        user_id INTEGER,
        project_role_id INTEGER
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS ref_project_roles (
        id INTEGER PRIMARY KEY,
        name TEXT,
        label TEXT
        )
    `);
  
    db.run(`
    CREATE TABLE IF NOT EXISTS users_time_tracking (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT UNIQUE,
      user_id INTEGER,
      date DATE,
      project_id INTEGER,
      activity_id INTEGER,
      task_id INTEGER,
      item_id INTEGER,
      start_time DATETIME,
      end_time DATETIME,
      duration INTEGER,
      is_completed_project_task INTEGER,
      note TEXT
    )
  `);

    db.run(`
    CREATE TABLE IF NOT EXISTS sync_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        payload TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
    `);
});

function saveUsersToLocal(users) {
  const { db } = module.exports;

  db.serialize(() => {
    console.log('[local-db] Clearing local_users...');
    db.run('DELETE FROM local_users');

    const stmt = db.prepare(`
      INSERT INTO local_users (id, first_name, last_name, login, authcode, system_role, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    users.forEach((user, i) => {
      console.log(`[local-db] Inserting user ${i + 1}:`, user);

      stmt.run(
        user.id,
        user.first_name,
        user.last_name,
        user.login,
        user.authcode,
        user.system_role,
        user.is_active,
        (err) => {
          if (err) {
            console.error(`[local-db] Failed to insert user ${user.id}:`, err.message);
          }
        }
      );
    });

    stmt.finalize();
  });
}

function saveProjectsToLocal(projects) {
  const { db } = module.exports;

  db.serialize(() => {
    console.log('[local-db] Clearing projects...');
    db.run('DELETE FROM projects');

    const stmt = db.prepare(`
      INSERT INTO projects (id, code, name, type_id, item_id, is_active, created_at, customer_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    projects.forEach((project, i) => {
      console.log(`[local-db] Inserting project ${i + 1}:`, project);

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
          if (err) {
            console.error(`[local-db] Failed to insert project ${project.id}:`, err.message);
          }
        }
      );
    });

    stmt.finalize();
  });
}

function saveProjectUsersToLocal(projectUsers) {
  const { db } = module.exports;

  db.serialize(() => {
    console.log('[local-db] Clearing project_users...');
    db.run('DELETE FROM project_users');

    const stmt = db.prepare(`
      INSERT INTO project_users (id, user_id, project_id, project_role_id)
      VALUES (?, ?, ?, ?)
    `);

    projectUsers.forEach((pu, i) => {
      console.log(`[local-db] Inserting project_user ${i + 1}:`, pu);

      stmt.run(
        pu.id,
        pu.user_id,
        pu.project_id,
        pu.project_role_id,
        (err) => {
          if (err) {
            console.error(`[local-db] Failed to insert project_user ${pu.id}:`, err.message);
          }
        }
      );
    });

    stmt.finalize();
  });
}

function saveRefProjectRolesToLocal(roles) {
  const { db } = module.exports;

  db.serialize(() => {
    console.log('[local-db] Clearing ref_project_roles...');
    db.run('DELETE FROM ref_project_roles');

    const stmt = db.prepare(`
      INSERT INTO ref_project_roles (id, name, label)
      VALUES (?, ?, ?)
    `);

    roles.forEach((role, i) => {
      console.log(`[local-db] Inserting role ${i + 1}:`, role);

      stmt.run(
        role.id,
        role.name,
        role.label,
        (err) => {
          if (err) {
            console.error(`[local-db] Failed to insert role ${role.id}:`, err.message);
          }
        }
      );
    });

    stmt.finalize();
  });
}

async function syncQueue() {
  const { db } = module.exports;
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

          if (result.success || result.error === 'No active activity') {
            db.run(
              `DELETE FROM sync_queue WHERE id = ?`,
              [row.id],
              (err2) => {
                if (err2) {
                  console.error('[syncQueue] Failed to clear synced record:', err2.message);
                } else {
                  console.log(
                    `[syncQueue] Record synced and cleared: user=${payload.user_id}, uuid=${payload.uuid}, type=${payload.type}`
                  );
                }
              }
            );
            syncedCount++;
          } else {
            console.warn(
              `[syncQueue] Failed to sync record (user=${payload.user_id}, uuid=${payload.uuid}, type=${payload.type}): ${result.error}`
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
  const { db } = module.exports;
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
  const { db } = module.exports;
  const endTime = timestamp ? new Date(timestamp) : new Date();
  const endStr = formatMySQLDatetime(endTime);

  return new Promise((resolve, reject) => {
    db.get(
       `SELECT id, uuid, user_id, start_time 
        FROM users_time_tracking 
        WHERE uuid = ? AND end_time IS NULL 
        ORDER BY start_time DESC 
        LIMIT 1`,
        [uuid],
      (err, row) => {
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
          `[local-db] Completing activity (uuid=${uuid}), end=${endStr}, isTaskCompleted=${is_completed_project_task}`
        );

        db.run(
          `UPDATE users_time_tracking
           SET end_time = ?, duration = ?, is_completed_project_task = ?
           WHERE uuid = ?`,
          [endStr, durationMin, is_completed_project_task ? 1 : 0, uuid],
          (err2) => {
            if (err2) {
              console.error('[local-db] Failed to complete activity:', err2.message);
              return reject(err2);
            }

            const { isOnline } = require('../utils/network-status');
            isOnline().then((online) => {
              if (!online) {
                const payload = {
                  type: 'complete',
                  uuid,
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
                    } else {
                      console.log('[local-db] Offline mode: queued clock-out');
                    }
                  }
                );
              } else {
                console.log('[local-db] Online mode: skipping sync_queue for complete');
              }
            });

            return resolve({ success: true, uuid, endTime });
          }
        );
      }
    );
  });
}

module.exports = {
  db,
    saveUsersToLocal,
    saveProjectsToLocal,
    saveProjectUsersToLocal,
    saveRefProjectRolesToLocal,
    startUnallocatedActivityLocal,
    syncQueue,
    completeActiveActivityLocal
};
