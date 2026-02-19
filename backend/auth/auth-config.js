const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);

export const ROLE = Object.freeze({
  ADMIN: 1,
  EMPLOYEE: 2,
  CUSTOMER: 3,
});

export function isAuthRequired() {
  const raw = String(process.env.AUTH_REQUIRED ?? '').trim().toLowerCase();
  return TRUE_VALUES.has(raw);
}

export function getJwtSecret() {
  return String(process.env.JWT_SECRET ?? '').trim();
}

export function getJwtExpiresIn() {
  return String(process.env.JWT_EXPIRES_IN ?? '8h').trim();
}

