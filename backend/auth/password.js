import bcrypt from 'bcryptjs';

const BCRYPT_HASH_RE = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;

function getBcryptRounds() {
  const value = Number(process.env.BCRYPT_ROUNDS ?? 12);
  if (!Number.isFinite(value)) return 12;
  if (value < 8) return 8;
  if (value > 15) return 15;
  return Math.floor(value);
}

export function isBcryptHash(value) {
  return BCRYPT_HASH_RE.test(String(value || ''));
}

export async function hashPassword(plainPassword) {
  const plain = String(plainPassword ?? '');
  if (!plain) {
    throw new Error('Password is required');
  }
  const rounds = getBcryptRounds();
  return await bcrypt.hash(plain, rounds);
}

export async function verifyPassword(plainPassword, storedPassword) {
  const plain = String(plainPassword ?? '');
  const stored = String(storedPassword ?? '');
  if (!plain || !stored) return false;

  if (isBcryptHash(stored)) {
    return await bcrypt.compare(plain, stored);
  }

  // Backward compatibility for existing plaintext rows.
  return plain === stored;
}

