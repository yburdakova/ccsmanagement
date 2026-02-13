const listeners = new Set();

let pending = false;
let pendingReason = 'db-write';
const EMIT_DEBOUNCE_MS = 150;

function notify(reason = 'db-write') {
  for (const listener of listeners) {
    try {
      listener({
        type: 'db-changed',
        reason,
        ts: Date.now(),
      });
    } catch (error) {
      console.warn('[db-change-bus] Listener failed:', error.message);
    }
  }
}

export function scheduleDbChanged(reason = 'db-write') {
  pendingReason = reason || 'db-write';
  if (pending) return;
  pending = true;
  setTimeout(() => {
    pending = false;
    notify(pendingReason);
  }, EMIT_DEBOUNCE_MS);
}

export function subscribeDbChanged(listener) {
  if (typeof listener !== 'function') return () => {};
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

