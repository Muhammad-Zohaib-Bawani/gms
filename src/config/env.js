// Central runtime config. Values come from Vite env vars (see .env.example).
export const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
export const API_TIMEOUT = Number(import.meta.env.VITE_API_TIMEOUT) || 20000;

// SignalR hub — same backend, sibling of /api (not under it). Relative in dev
// (vite proxies it, see vite.config.js); in prod, derived by stripping the
// trailing /api off the absolute API_BASE_URL.
export const HUB_URL = API_BASE_URL.startsWith('/')
  ? '/realtimehub'
  : `${API_BASE_URL.replace(/\/api\/?$/, '')}/realtimehub`;

// localStorage key holding ONLY { accessToken, refreshToken }.
export const AUTH_STORAGE_KEY = 'gms-auth';
