(function initDesktopErrorHandler() {
  const rawConsoleError = console.error.bind(console);
  const rawConsoleWarn = console.warn.bind(console);
  const rawConsoleInfo = console.info.bind(console);
  const seen = new Map();
  const COOLDOWN_MS = 15000;

  function shouldNotify(key) {
    const now = Date.now();
    const prev = seen.get(key) || 0;
    if (now - prev < COOLDOWN_MS) return false;
    seen.set(key, now);
    return true;
  }

  async function notify(level, title, message, detail) {
    const key = `${level}:${title}:${message}`;
    if (!shouldNotify(key)) return;

    try {
      if (window.electronAPI?.showUserMessage) {
        await window.electronAPI.showUserMessage({
          level,
          title,
          message,
          detail: detail ? String(detail) : '',
          dedupeKey: key,
        });
        return;
      }
    } catch (err) {
      console.error('[renderer-error] Failed to notify via main process:', err);
    }

    // Fallback for environments where IPC bridge is unavailable.
    alert(`${title}\n${message}`);
  }

  function normalizeError(err) {
    if (err instanceof Error) return { message: err.message, detail: err.stack || err.message };
    return { message: String(err || 'Unknown error'), detail: String(err || '') };
  }

  window.desktopError = {
    async error(context, err) {
      const normalized = normalizeError(err);
      rawConsoleError(`[renderer] ${context}:`, normalized.detail);
      await notify('error', 'Desktop Error', `${context}: ${normalized.message}`, normalized.detail);
    },
    async warn(context, err) {
      const normalized = normalizeError(err);
      rawConsoleWarn(`[renderer] ${context}:`, normalized.message);
      await notify('warning', 'Desktop Warning', `${context}: ${normalized.message}`, normalized.detail);
    },
    async info(context, message) {
      const text = String(message || '');
      rawConsoleInfo(`[renderer] ${context}:`, text);
      await notify('info', 'Desktop Info', `${context}: ${text}`, '');
    },
  };

  const bridgeConsole = (level, args) => {
    try {
      const text = args.map((part) => String(part)).join(' ');
      if (!text.trim()) return;
      if (text.includes('[renderer-error]')) return;
      notify(
        level,
        level === 'error' ? 'Desktop Error' : 'Desktop Warning',
        text.slice(0, 300),
        text
      );
    } catch {}
  };

  console.error = (...args) => {
    rawConsoleError(...args);
    bridgeConsole('error', args);
  };

  console.warn = (...args) => {
    rawConsoleWarn(...args);
    bridgeConsole('warning', args);
  };

  window.addEventListener('error', (event) => {
    const err = event?.error || new Error(String(event?.message || 'Unknown renderer error'));
    window.desktopError.error('Unhandled renderer error', err);
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event?.reason || new Error('Unhandled promise rejection');
    window.desktopError.error('Unhandled promise rejection', reason);
  });
})();
