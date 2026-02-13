const dns = require('dns');
const net = require('net');

function checkHostPort(host, port, timeoutMs = 2000) {
  return new Promise((resolve) => {
    const socket = net.connect(port, host);
    const done = (result) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(result);
    };

    socket.setTimeout(timeoutMs);
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false));
    socket.once('error', () => done(false));
  });
}

async function isOnline() {
  const appEnv = String(process.env.APP_ENV || '').trim().toLowerCase();

  if (appEnv === 'backend') {
    const baseUrl = String(process.env.BACKEND_BASE_URL || '').trim();
    if (!baseUrl) return false;
    try {
      const url = new URL(baseUrl);
      const host = url.hostname;
      const port =
        Number(url.port) ||
        (url.protocol === 'https:' ? 443 : 80);
      return await checkHostPort(host, port);
    } catch {
      return false;
    }
  }

  const host = process.env.DB_HOST;
  const port = Number(process.env.DB_PORT) || 3306;

  if (host) {
    const reachable = await checkHostPort(host, port);
    if (reachable) return true;
  }

  return new Promise((resolve) => {
    dns.lookup('google.com', (err) => resolve(!err));
  });
}

module.exports = { isOnline };
