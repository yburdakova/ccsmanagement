import { API_BASE_URL } from "../constants/api";
import type { ApiOptions } from "../types/api.types";
import { clearLoginSession, getAccessToken } from "./authSession";

export async function apiRequest<T>(endpoint: string, options: ApiOptions = {}): Promise<T> {
  const { method = 'GET', body, headers = {} } = options;
  const token = getAccessToken();
  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  };

  if (token && !requestHeaders.Authorization) {
    requestHeaders.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method,
    headers: requestHeaders,
    body: body ? JSON.stringify(body) : undefined,
  });

  const raw = await response.text();
  let data: any = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = raw;
  }

  if (!response.ok) {
    if (response.status === 401) {
      // Keep local session aligned with backend auth state.
      clearLoginSession();
    }

    const message =
      data && typeof data === 'object' && 'error' in data
        ? data.error
        : typeof data === 'string' && data.trim()
          ? data
          : 'Request failed';
    throw new Error(message);
  }

  return data as T;
}
