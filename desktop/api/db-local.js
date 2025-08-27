const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

// путь к папке db
const dbDir = path.join(__dirname, '../db');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir);
}

// путь к файлу базы
const dbPath = path.join(dbDir, 'local.db');

// создаём или открываем базу
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Failed to connect to local SQLite:', err);
  } else {
    console.log('Connected to local SQLite database.');
  }
});

// создаём таблицы
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
        role_id INTEGER
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS ref_project_roles (
        id INTEGER PRIMARY KEY,
        name TEXT,
        label TEXT
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
      INSERT INTO project_users (id, user_id, project_id, role_id)
      VALUES (?, ?, ?, ?)
    `);

    projectUsers.forEach((pu, i) => {
      console.log(`[local-db] Inserting project_user ${i + 1}:`, pu);

      stmt.run(
        pu.id,
        pu.user_id,
        pu.project_id,
        pu.role_id,
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


module.exports = {
  db,
    saveUsersToLocal,
    saveProjectsToLocal,
    saveProjectUsersToLocal,
    saveRefProjectRolesToLocal,
    saveRefProjectRolesToLocal
};
