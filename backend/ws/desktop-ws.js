import { WebSocketServer } from 'ws';
import pool from '../db.config.js';
import { subscribeDbChanged } from '../events/db-change-bus.js';
import { isAuthRequired } from '../auth/auth-config.js';
import { verifyAccessToken } from '../auth/jwt.js';

/**
 * Attaches desktop WebSocket endpoint to an existing HTTP server.
 * Endpoint: /ws/desktop
 */
export function createDesktopWsServer(httpServer) {
  const wsServer = new WebSocketServer({ noServer: true });
  const clients = new Set();

  const heartbeatInterval = setInterval(() => {
    for (const socket of clients) {
      if (!socket.isAlive) {
        socket.terminate();
        continue;
      }
      socket.isAlive = false;
      socket.ping();
    }
  }, 30_000);

  const unsubscribeDbChanged = subscribeDbChanged((event) => {
    if (clients.size === 0) return;
    const message = JSON.stringify({
      type: 'db-changed',
      reason: event?.reason || 'db-write',
      ts: event?.ts || Date.now(),
    });
    for (const socket of clients) {
      if (socket.readyState === socket.OPEN) {
        socket.send(message);
      }
    }
    console.log('[ws] Broadcasted db-changed event to desktop clients');
  });

  wsServer.on('connection', (socket, request) => {
    socket.isAlive = true;
    socket.desktopUserId = null;
    socket.desktopUserName = null;
    socket.authUserId = Number(request?.authClaims?.sub || 0) || null;
    clients.add(socket);

    socket.on('pong', () => {
      socket.isAlive = true;
    });

    socket.on('message', async (raw) => {
      const text = Buffer.isBuffer(raw) ? raw.toString('utf8') : String(raw);
      let payload = null;
      try {
        payload = JSON.parse(text);
      } catch {
        payload = { type: 'text', data: text };
      }

      if (payload?.type === 'ping') {
        socket.send(JSON.stringify({ type: 'pong', ts: Date.now() }));
        return;
      }

      if (payload?.type === 'identify') {
        const userId = Number(payload?.userId);
        if (Number.isFinite(userId) && userId > 0) {
          if (isAuthRequired() && socket.authUserId && Number(socket.authUserId) !== userId) {
            socket.send(JSON.stringify({ type: 'identified', ok: false, error: 'Forbidden', ts: Date.now() }));
            socket.close(4403, 'Forbidden');
            return;
          }
          socket.desktopUserId = userId;
          let userName = `User #${userId}`;
          try {
            const [rows] = await pool.query(
              `
                SELECT CONCAT(TRIM(first_name), ' ', TRIM(last_name)) AS fullName
                FROM users
                WHERE id = ?
                LIMIT 1
              `,
              [userId]
            );
            if (rows.length && rows[0].fullName && String(rows[0].fullName).trim()) {
              userName = String(rows[0].fullName).trim();
            }
          } catch (error) {
            console.warn('[ws] Failed to resolve user name:', error.message);
          }
          socket.desktopUserName = userName;
          console.log(`Desktop user ${userName} connected`);
          socket.send(JSON.stringify({ type: 'identified', ok: true, userId, ts: Date.now() }));
          return;
        }
      }

      // Reserved for future command handling from desktop -> backend.
      if (payload?.type === 'subscribe') {
        socket.send(JSON.stringify({ type: 'subscribed', ok: true, ts: Date.now() }));
      }
    });

    socket.on('close', () => {
      if (socket.desktopUserName || socket.desktopUserId) {
        const userLabel = socket.desktopUserName || `User #${socket.desktopUserId}`;
        console.log(`Desktop user ${userLabel} disconnected`);
      }
      clients.delete(socket);
    });

    socket.on('error', () => {
      clients.delete(socket);
    });

    socket.send(
      JSON.stringify({
        type: 'connected',
        endpoint: '/ws/desktop',
        ts: Date.now(),
      })
    );

    console.log(`[ws] desktop connected (${request.socket.remoteAddress || 'unknown'})`);
  });

  httpServer.on('upgrade', (request, socket, head) => {
    const url = request.url || '';
    const pathname = url.split('?')[0];
    if (pathname !== '/ws/desktop') {
      socket.destroy();
      return;
    }

    if (isAuthRequired()) {
      const header = String(request.headers?.authorization || '').trim();
      const [scheme, token] = header.split(/\s+/, 2);
      if (!/^bearer$/i.test(scheme || '') || !token) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      try {
        const claims = verifyAccessToken(token);
        if (!claims?.sub) {
          socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
          socket.destroy();
          return;
        }
        request.authClaims = claims;
      } catch {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }
    }

    wsServer.handleUpgrade(request, socket, head, (ws) => {
      wsServer.emit('connection', ws, request);
    });
  });

  httpServer.on('close', () => {
    clearInterval(heartbeatInterval);
    unsubscribeDbChanged();
    for (const socket of clients) {
      socket.terminate();
    }
    clients.clear();
  });

  return {
    broadcast(event) {
      const message = JSON.stringify(event);
      for (const socket of clients) {
        if (socket.readyState === socket.OPEN) {
          socket.send(message);
        }
      }
    },
    getClientCount() {
      return clients.size;
    },
  };
}
