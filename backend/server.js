import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import http from 'http';
import { createDesktopWsServer } from './ws/desktop-ws.js';
import pool from './db.config.js';

import loginRoutes from './routes/login.routes.js';
import projectsRoutes from './routes/projects.routes.js';
import lookupsRoutes from './routes/lookups.routes.js';
import timeTrackingRoutes from './routes/time-tracking.routes.js';
import itemsRoutes from './routes/items.routes.js';
import usersRoutes from './routes/users.routes.js';
import customersRoutes from './routes/customers.routes.js';
import desktopRoutes from './routes/desktop.routes.js';
import { ROLE } from './auth/auth-config.js';
import { requireAuth, requireRole } from './middleware/auth.middleware.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;
const dbname = process.env.DB_NAME;
const PROCESS_START_AT = new Date().toISOString();
const SHUTDOWN_GRACE_MS = Number(process.env.SHUTDOWN_GRACE_MS || 15000);
const SHUTDOWN_FORCE_MS = Number(process.env.SHUTDOWN_FORCE_MS || 30000);

let shuttingDown = false;
let shutdownStartedAt = null;

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'backend',
    startedAt: PROCESS_START_AT,
    uptimeSec: Math.floor(process.uptime()),
    shuttingDown,
  });
});

app.get('/ready', async (_req, res) => {
  if (shuttingDown) {
    return res.status(503).json({ status: 'not-ready', reason: 'shutting-down' });
  }

  try {
    await pool.query('SELECT 1 AS ok');
    return res.status(200).json({ status: 'ready' });
  } catch (error) {
    return res.status(503).json({
      status: 'not-ready',
      reason: 'db-unreachable',
      error: error?.message || 'Unknown DB error',
    });
  }
});

app.use('/api/login', loginRoutes);
app.use('/api/projects', requireAuth, requireRole([ROLE.ADMIN, ROLE.EMPLOYEE]), projectsRoutes);
app.use('/api/lookups', requireAuth, lookupsRoutes);
app.use('/api/time-tracking', requireAuth, requireRole([ROLE.ADMIN, ROLE.EMPLOYEE]), timeTrackingRoutes);
app.use('/api/items', requireAuth, requireRole([ROLE.ADMIN, ROLE.EMPLOYEE]), itemsRoutes);
app.use('/api/users', requireAuth, requireRole([ROLE.ADMIN]), usersRoutes);
app.use('/api/customers', requireAuth, requireRole([ROLE.ADMIN, ROLE.EMPLOYEE]), customersRoutes);
app.use('/api/desktop', desktopRoutes);


const server = http.createServer(app);
const desktopWs = createDesktopWsServer(server);
const sockets = new Set();

server.on('connection', (socket) => {
  sockets.add(socket);
  socket.on('close', () => sockets.delete(socket));
});

server.listen(PORT, () => {
    console.log(`API HTTP server running on port ${PORT}`);
    console.log(`Connected DB: ${dbname}`);
    console.log(`WebSocket started on endpoint: ws://<host>:${PORT}/ws/desktop`);
    console.log('Desktop WS clients: ' + desktopWs.getClientCount());
});

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  shutdownStartedAt = Date.now();
  console.log(`[shutdown] Received ${signal}. Starting graceful shutdown.`);

  // Stop keep-alive and allow sockets to drain.
  server.closeIdleConnections?.();

  const forceKillTimer = setTimeout(() => {
    console.error('[shutdown] Force shutdown timeout reached. Destroying sockets and exiting.');
    for (const socket of sockets) {
      try { socket.destroy(); } catch {}
    }
    process.exit(1);
  }, SHUTDOWN_FORCE_MS);

  const gracefulClose = new Promise((resolve) => {
    server.close(() => resolve(true));
  });

  // Ask clients to finish promptly.
  setTimeout(() => {
    for (const socket of sockets) {
      try { socket.end(); } catch {}
    }
  }, SHUTDOWN_GRACE_MS);

  try {
    await gracefulClose;
    await pool.end();
    const elapsedMs = Date.now() - shutdownStartedAt;
    console.log(`[shutdown] Completed graceful shutdown in ${elapsedMs}ms.`);
    clearTimeout(forceKillTimer);
    process.exit(0);
  } catch (error) {
    console.error('[shutdown] Graceful shutdown failed:', error);
    clearTimeout(forceKillTimer);
    process.exit(1);
  }
}

process.on('SIGTERM', () => {
  shutdown('SIGTERM');
});

process.on('SIGINT', () => {
  shutdown('SIGINT');
});
