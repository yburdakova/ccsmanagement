const WebSocket = require('ws');

let socket = null;
let currentUserId = null;
let reconnectTimer = null;
let shouldReconnect = false;

function toWsEndpoint() {
  const base = String(process.env.BACKEND_BASE_URL || '').trim();
  if (!base) return null;

  try {
    const url = new URL(base);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    url.pathname = '/ws/desktop';
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
}

function clearReconnect() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

function scheduleReconnect() {
  if (!shouldReconnect || !currentUserId) return;
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectDesktopWs(currentUserId);
  }, 3000);
}

function connectDesktopWs(userId) {
  const endpoint = toWsEndpoint();
  if (!endpoint) {
    console.warn('[desktop-ws] BACKEND_BASE_URL is not configured. Skipping WS connection.');
    return;
  }

  if (socket && socket.readyState === WebSocket.OPEN && currentUserId === userId) return;
  if (socket && socket.readyState === WebSocket.CONNECTING) return;

  disconnectDesktopWs(false);
  currentUserId = userId;
  shouldReconnect = true;

  socket = new WebSocket(endpoint);

  socket.on('open', () => {
    clearReconnect();
    socket.send(JSON.stringify({ type: 'identify', userId }));
    console.log(`[desktop-ws] Connected to ${endpoint} as user=${userId}`);
  });

  socket.on('message', (raw) => {
    const text = Buffer.isBuffer(raw) ? raw.toString('utf8') : String(raw);
    try {
      const payload = JSON.parse(text);
      if (payload?.type === 'pong') return;
    } catch {}
  });

  socket.on('close', () => {
    console.warn('[desktop-ws] Connection closed');
    socket = null;
    scheduleReconnect();
  });

  socket.on('error', (err) => {
    console.warn('[desktop-ws] Connection error:', err.message);
  });
}

function disconnectDesktopWs(resetUser = true) {
  shouldReconnect = false;
  clearReconnect();
  if (socket) {
    try {
      socket.close();
    } catch {}
    socket = null;
  }
  if (resetUser) currentUserId = null;
}

module.exports = {
  connectDesktopWs,
  disconnectDesktopWs,
};

