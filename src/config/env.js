// Central runtime config. Values come from Vite env vars (see .env.example).
export const API_BASE_URL = import.meta.env.VITE_BACKEND_ORIGIN + '/api';
export const API_TIMEOUT = Number(import.meta.env.VITE_API_TIMEOUT) || 20000;

// SignalR hub — same backend, sibling of /api (not under it). Relative in dev
// (vite proxies it, see vite.config.js); in prod, derived by stripping the
// trailing /api off the absolute API_BASE_URL.
export const HUB_URL = API_BASE_URL.startsWith('/')
  ? '/realtimehub'
  : `${API_BASE_URL.replace(/\/api\/?$/, '')}/realtimehub`;

// localStorage key holding ONLY { accessToken, refreshToken }.
export const AUTH_STORAGE_KEY = 'gms-auth';

// ── How portal users sign in ────────────────────────────────────────────────
// 'entra'  -> Microsoft Entra ID (SSO). Must match the backend's Auth:Mode, which 
.
//             rejects portal password logins outright when it is EntraId.
// 'local'  -> email + password (the pre-Entra behaviour).
// Guests and drivers are unaffected either way: they are managed locally and sign
// in on their own apps with an emailed code.
export const AUTH_MODE = (import.meta.env.VITE_AUTH_MODE || 'local').toLowerCase();

export const ENTRA = {
  instance: import.meta.env.VITE_ENTRA_INSTANCE || 'https://login.microsoftonline.com',
  tenantId: import.meta.env.VITE_ENTRA_TENANT_ID || '',
  clientId: import.meta.env.VITE_ENTRA_CLIENT_ID || '',
  // The API scope, NOT a Graph scope: the token has to carry our own API as its
  // audience or the backend rejects it. Derived from the client id because the app
  // registration exposes api://{clientId}/access_as_user.
  scope: import.meta.env.VITE_ENTRA_SCOPE
    || (import.meta.env.VITE_ENTRA_CLIENT_ID
      ? `api://${import.meta.env.VITE_ENTRA_CLIENT_ID}/access_as_user`
      : ''),
};

// Both halves matter: a build that says 'entra' but was given no client id would
// render a button that can only throw.
export const ENTRA_ENABLED = AUTH_MODE === 'entra' && !!ENTRA.clientId && !!ENTRA.tenantId;
