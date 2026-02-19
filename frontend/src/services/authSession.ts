import type { LoginResponse } from '../types/login.types';

const USER_STORAGE_KEY = 'user';
const ACCESS_TOKEN_STORAGE_KEY = 'accessToken';

export function getAccessToken(): string | null {
  const value = localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
  const token = String(value ?? '').trim();
  return token || null;
}

export function setLoginSession(payload: LoginResponse): void {
  const user = {
    id: payload.id,
    first_name: payload.first_name,
    last_name: payload.last_name,
    role: payload.role,
  };

  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));

  const token = String(payload.accessToken ?? '').trim();
  if (token) {
    localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, token);
  } else {
    localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
  }
}

export function clearLoginSession(): void {
  localStorage.removeItem(USER_STORAGE_KEY);
  localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
}

