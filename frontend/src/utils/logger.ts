const isDebugLogsEnabled = String(import.meta.env.VITE_DEBUG_LOGS ?? '').toLowerCase() === 'true';

export function debugLog(message: string, ...args: unknown[]): void {
  if (!isDebugLogsEnabled) return;
  // Keep debug output behind an explicit runtime flag.
  console.log(message, ...args);
}
