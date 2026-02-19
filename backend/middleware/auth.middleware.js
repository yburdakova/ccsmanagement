import { isAuthRequired } from '../auth/auth-config.js';
import { verifyAccessToken } from '../auth/jwt.js';

function extractBearerToken(req) {
  const header = String(req.headers?.authorization ?? '').trim();
  if (!header) return null;
  const [scheme, token] = header.split(/\s+/, 2);
  if (!/^bearer$/i.test(scheme || '') || !token) return null;
  return token;
}

export function requireAuth(req, res, next) {
  if (!isAuthRequired()) {
    return next();
  }

  const token = extractBearerToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Missing bearer token' });
  }

  try {
    const claims = verifyAccessToken(token);
    if (!claims || !Number(claims.sub)) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    req.user = {
      id: Number(claims.sub),
      role: Number(claims.role),
      login: String(claims.login || ''),
    };
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function requireRole(allowedRoles = []) {
  const allowed = new Set((allowedRoles || []).map((value) => Number(value)));

  return (req, res, next) => {
    if (!isAuthRequired()) {
      return next();
    }

    const role = Number(req.user?.role);
    if (!allowed.has(role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    return next();
  };
}

