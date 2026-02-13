const WebSocket = require('ws');

let socket = null;
let currentUserId = null;
let reconnectTimer = null;
let shouldReconnect = false;
let connected = false;
let statusListener = null;
let reconnectDelayMs = 1000;
let stableConnectionTimer = null;

const MIN_RECONNECT_MS = 1000;
const MAX_RECONNECT_MS = 30000;
const STABLE_RESET_MS = 60000;
const JITTER_RATIO = 0.2;

function emitStatus(nextConnected) {
  if (connected === nextConnected) return;
  connected = nextConnected;
  if (typeof statusListener === 'function') {
    statusListener({ connected });
  }
}

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

function clearStableTimer() {
  if (stableConnectionTimer) {
    clearTimeout(stableConnectionTimer);
    stableConnectionTimer = null;
  }
}

function withJitter(delayMs) {
  const range = Math.floor(delayMs * JITTER_RATIO);
  const offset = Math.floor(Math.random() * (range * 2 + 1)) - range;
  return Math.max(MIN_RECONNECT_MS, delayMs + offset);
}

function advanceReconnectDelay() {
  reconnectDelayMs = Math.min(MAX_RECONNECT_MS, reconnectDelayMs * 2);
}

function scheduleReconnect() {
  if (!shouldReconnect || !currentUserId) return;
  if (reconnectTimer) return;
  const delay = withJitter(reconnectDelayMs);
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectDesktopWs(currentUserId);
  }, delay);
  advanceReconnectDelay();
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
    emitStatus(true);
    clearStableTimer();
    stableConnectionTimer = setTimeout(() => {
      reconnectDelayMs = MIN_RECONNECT_MS;
    }, STABLE_RESET_MS);
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
    emitStatus(false);
    clearStableTimer();
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
  clearStableTimer();
  emitStatus(false);
  if (socket) {
    try {
      socket.close();
    } catch {}
    socket = null;
  }
  if (resetUser) currentUserId = null;
  reconnectDelayMs = MIN_RECONNECT_MS;
}

module.exports = {
  connectDesktopWs,
  disconnectDesktopWs,
  isDesktopWsConnected: () => connected,
  setDesktopWsStatusListener: (listener) => {
    statusListener = listener;
  },
};
