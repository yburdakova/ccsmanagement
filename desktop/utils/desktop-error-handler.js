const { dialog, BrowserWindow } = require('electron');

const rawConsoleError = console.error.bind(console);
const rawConsoleWarn = console.warn.bind(console);
const rawConsoleInfo = console.info.bind(console);

const NOTIFY_COOLDOWN_MS = 15000;
const recentNotifications = new Map();
let dialogQueue = Promise.resolve();

function normalizeLevel(level) {
  const raw = String(level || '').toLowerCase();
  if (raw === 'warning' || raw === 'warn') return 'warning';
  if (raw === 'info') return 'info';
  return 'error';
}

function nowMs() {
  return Date.now();
}

function shouldNotify(key) {
  const now = nowMs();
  const previous = recentNotifications.get(key) || 0;
  if (now - previous < NOTIFY_COOLDOWN_MS) return false;
  recentNotifications.set(key, now);
  return true;
}

function safeDetail(error, detail) {
  if (detail) return String(detail);
  if (!error) return '';
  if (error instanceof Error) return String(error.stack || error.message || error);
  return String(error);
}

function getActiveWindow() {
  const focused = BrowserWindow.getFocusedWindow();
  if (focused && !focused.isDestroyed()) return focused;
  const all = BrowserWindow.getAllWindows();
  return all.find((w) => !w.isDestroyed()) || null;
}

async function showUserMessage({ level = 'error', title, message, detail, dedupeKey }) {
  const type = normalizeLevel(level);
  const safeTitle = String(title || (type === 'error' ? 'Error' : type === 'warning' ? 'Warning' : 'Info'));
  const safeMessage = String(message || 'Unexpected application message.');
  const safeDetailText = detail ? String(detail) : '';
  const key = dedupeKey || `${type}:${safeTitle}:${safeMessage}`;

  if (!shouldNotify(key)) return { shown: false, deduped: true };

  dialogQueue = dialogQueue
    .catch(() => {})
    .then(async () => {
      try {
        await dialog.showMessageBox(getActiveWindow(), {
          type,
          title: safeTitle,
          message: safeMessage,
          detail: safeDetailText,
        });
      } catch (err) {
        console.error('[error-handler] Failed to show message box:', err.message);
      }
    });

  await dialogQueue;
  return { shown: true };
}

async function reportException(context, error, options = {}) {
  const level = normalizeLevel(options.level || 'error');
  const contextText = String(context || 'Desktop');
  const errorMessage =
    options.message ||
    (error instanceof Error ? error.message : error ? String(error) : 'Unknown error');
  const message = `${contextText}: ${errorMessage}`;
  const detail = safeDetail(error, options.detail);
  const dedupeKey = options.dedupeKey || `${level}:${contextText}:${errorMessage}`;

  if (level === 'warning') rawConsoleWarn(`[${contextText}]`, errorMessage);
  else if (level === 'info') rawConsoleInfo(`[${contextText}]`, errorMessage);
  else rawConsoleError(`[${contextText}]`, detail || errorMessage);

  return await showUserMessage({
    level,
    title: options.title || (level === 'error' ? 'Desktop Error' : level === 'warning' ? 'Desktop Warning' : 'Desktop Info'),
    message,
    detail,
    dedupeKey,
  });
}

function installMainConsoleBridge() {
  const bridge = (level, args) => {
    try {
      const text = args.map((part) => String(part)).join(' ');
      if (!text.trim()) return;
      if (text.includes('[error-handler]') || text.includes('show-user-message failed')) return;
      showUserMessage({
        level,
        title: level === 'error' ? 'Desktop Error' : 'Desktop Warning',
        message: text.slice(0, 300),
        detail: text,
        dedupeKey: `${level}:console:${text}`,
      }).catch(() => {});
    } catch {}
  };

  console.error = (...args) => {
    rawConsoleError(...args);
    bridge('error', args);
  };

  console.warn = (...args) => {
    rawConsoleWarn(...args);
    bridge('warning', args);
  };
}

module.exports = {
  showUserMessage,
  reportException,
  installMainConsoleBridge,
};
