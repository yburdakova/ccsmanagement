import jwt from 'jsonwebtoken';
import { getJwtExpiresIn, getJwtSecret, isAuthRequired } from './auth-config.js';

function requireJwtSecretIfNeeded() {
  const secret = getJwtSecret();
  if (!secret && isAuthRequired()) {
    throw new Error('JWT_SECRET is required when AUTH_REQUIRED=true');
  }
  return secret;
}

export function signAccessToken(user) {
  const secret = requireJwtSecretIfNeeded();
  if (!secret) return null;

  const payload = {
    sub: Number(user?.id),
    role: Number(user?.role ?? user?.system_role),
    login: String(user?.login ?? ''),
  };

  return jwt.sign(payload, secret, { expiresIn: getJwtExpiresIn() });
}

export function verifyAccessToken(token) {
  const secret = requireJwtSecretIfNeeded();
  if (!secret) return null;
  return jwt.verify(token, secret);
}

