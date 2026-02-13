import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { scheduleDbChanged } from './events/db-change-bus.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env file
const envPath = process.env.NODE_ENV === 'remotetest' ? '.env.remotetest' :
                process.env.NODE_ENV === 'remote' ? '.env.remote' : '.env.local';
dotenv.config({ path: path.resolve(__dirname, envPath) });


const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

const MUTATION_SQL = /^(insert|update|delete|replace|create|alter|drop|truncate|rename)\b/i;

function isMutationSql(sql) {
  if (typeof sql !== 'string') return false;
  const normalized = sql.trim().replace(/^\(+/, '');
  return MUTATION_SQL.test(normalized);
}

function resultHasMutation(result) {
  if (!result) return false;

  if (Array.isArray(result)) {
    return result.some((entry) => resultHasMutation(entry));
  }

  if (typeof result === 'object') {
    if (Number(result.affectedRows) > 0) return true;
    if (Number(result.insertId) > 0) return true;
  }

  return false;
}

const rawPoolQuery = pool.query.bind(pool);
pool.query = async function patchedPoolQuery(sql, values) {
  const response = await rawPoolQuery(sql, values);
  const isMutation = isMutationSql(sql);
  if (isMutation && resultHasMutation(response?.[0])) {
    scheduleDbChanged('pool-query');
  }
  return response;
};

const rawPoolExecute = pool.execute.bind(pool);
pool.execute = async function patchedPoolExecute(sql, values) {
  const response = await rawPoolExecute(sql, values);
  const isMutation = isMutationSql(sql);
  if (isMutation && resultHasMutation(response?.[0])) {
    scheduleDbChanged('pool-execute');
  }
  return response;
};

const rawGetConnection = pool.getConnection.bind(pool);
pool.getConnection = async function patchedGetConnection() {
  const connection = await rawGetConnection();

  const state = {
    inTransaction: false,
    hasMutationInTransaction: false,
  };

  const rawBeginTransaction = connection.beginTransaction.bind(connection);
  connection.beginTransaction = async function patchedBeginTransaction() {
    const response = await rawBeginTransaction();
    state.inTransaction = true;
    state.hasMutationInTransaction = false;
    return response;
  };

  const rawCommit = connection.commit.bind(connection);
  connection.commit = async function patchedCommit() {
    const response = await rawCommit();
    if (state.hasMutationInTransaction) {
      scheduleDbChanged('transaction-commit');
    }
    state.inTransaction = false;
    state.hasMutationInTransaction = false;
    return response;
  };

  const rawRollback = connection.rollback.bind(connection);
  connection.rollback = async function patchedRollback() {
    const response = await rawRollback();
    state.inTransaction = false;
    state.hasMutationInTransaction = false;
    return response;
  };

  const rawConnectionQuery = connection.query.bind(connection);
  connection.query = async function patchedConnectionQuery(sql, values) {
    const response = await rawConnectionQuery(sql, values);
    const isMutation = isMutationSql(sql);
    if (isMutation && resultHasMutation(response?.[0])) {
      if (state.inTransaction) {
        state.hasMutationInTransaction = true;
      } else {
        scheduleDbChanged('connection-query');
      }
    }
    return response;
  };

  const rawConnectionExecute = connection.execute.bind(connection);
  connection.execute = async function patchedConnectionExecute(sql, values) {
    const response = await rawConnectionExecute(sql, values);
    const isMutation = isMutationSql(sql);
    if (isMutation && resultHasMutation(response?.[0])) {
      if (state.inTransaction) {
        state.hasMutationInTransaction = true;
      } else {
        scheduleDbChanged('connection-execute');
      }
    }
    return response;
  };

  return connection;
};

export default pool;
