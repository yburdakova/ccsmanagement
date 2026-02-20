// API base URL is provided by Vite mode-specific env files (.env.local / .env.remote).
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL as string | undefined;

if (!apiBaseUrl) {
  throw new Error('Missing VITE_API_BASE_URL. Set it in frontend/.env.local or frontend/.env.remote.');
}

// Normalize a possible trailing slash to keep endpoint joining predictable.
export const API_BASE_URL = apiBaseUrl.replace(/\/+$/, '');
