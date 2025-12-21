import { API_BASE_URL } from "../constants/api";
import type { ApiOptions } from "../types/api.types";

export async function apiRequest<T>(endpoint: string, options: ApiOptions = {}): Promise<T> {
  const { method = 'GET', body, headers = {} } = options;

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  let data: any = null;
  try {
    data = await response.json();
  } catch {
    data = await response.text();
  }

  if (!response.ok) {
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
