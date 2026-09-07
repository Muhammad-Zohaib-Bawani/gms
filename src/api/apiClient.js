// Axios instance for the GMS backend.
//  - baseURL + timeout from config
//  - request interceptor: attaches the Bearer access token
//  - response interceptor: unwraps the ApiResponse<T> envelope, turns
//    `success: false` into a thrown ApiError, and on 401 transparently
//    refreshes the token once and retries the original request
import axios from 'axios';
import { API_BASE_URL, API_TIMEOUT } from '../config/env';
import { ENDPOINTS } from './endpoints';
import { tokenStore } from '../auth/tokenStore';
import { ApiError, errorFrom, jsonFromBlob, unwrap } from './apiError';

// Re-exported so `import { ApiError } from './apiClient'` keeps working.
export { ApiError };

// Tells the backend which client is calling. Login rejects a role without
// portal access (Roles.PortalAccess), and it's stamped into the token as the
// "client" claim. The driver app sends 'driver-app'.
export const CLIENT_APP_HEADER = 'X-Client-App';
export const CLIENT_APP = 'portal';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    [CLIENT_APP_HEADER]: CLIENT_APP,
  },
});

// ── Request interceptor: attach the access token ─────────────────────────────
apiClient.interceptors.request.use((config) => {
  const token = tokenStore.accessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  config.headers[CLIENT_APP_HEADER] = CLIENT_APP;
  return config;
});

// ── Token refresh (de-duped across concurrent 401s) ──────────────────────────
let refreshPromise = null;

export function refreshTokens() {
  const refresh = tokenStore.refreshToken();
  if (!refresh) return Promise.reject(new ApiError('Session expired', { status: 401 }));

  if (!refreshPromise) {
    // Bare axios call (not apiClient) so it skips these interceptors.
    refreshPromise = axios
      .post(`${API_BASE_URL}${ENDPOINTS.auth.refresh}`, { refreshToken: refresh }, {
        timeout: API_TIMEOUT,
        headers: { [CLIENT_APP_HEADER]: CLIENT_APP },
      })
      .then((res) => {
        const data = res.data?.data;
        if (!res.data?.success || !data) throw new ApiError('Session expired', { status: 401 });
        // The server keeps the refresh token stable; fall back to the one we sent
        // so a response that omits it doesn't wipe the session.
        const next = { accessToken: data.accessToken, refreshToken: data.refreshToken || refresh };
        tokenStore.set(next);
        return next;
      })
      .catch((err) => {
        // Only a rejected token means the session is over. A timeout, a 429 from
        // the auth rate limiter, or a 5xx must NOT log the user out — clearing on
        // those was turning every blip into a trip to the login screen.
        const status = err.response?.status ?? err.status;
        if (status === 401 || status === 403) tokenStore.clear();
        throw err;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

// ── Response interceptor: unwrap ApiResponse<T> + handle errors ──────────────
apiClient.interceptors.response.use(
  unwrap,
  async (error) => {
    // Our own throw from the fulfilled handler above — already normalized.
    if (error instanceof ApiError) return Promise.reject(error);

    const { response, config } = error;

    // Transparent refresh-and-retry once on 401 (never for the auth endpoints).
    const isAuthCall = config?.url?.includes('/auth/');
    if (response?.status === 401 && config && !config.__isRetry && !isAuthCall) {
      try {
        await refreshTokens();
        config.__isRetry = true;
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${tokenStore.accessToken()}`;
        return apiClient(config);
      } catch {
        // fall through to normalized rejection
      }
    }

    if (!response) {
      const timedOut = error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT';
      return Promise.reject(new ApiError(
        timedOut ? 'Request timed out' : 'Cannot reach the server. Check your connection.',
        { status: 0 },
      ));
    }

    const data = (await jsonFromBlob(response.data)) || response.data;
    return Promise.reject(errorFrom(data, response.status, error.message));
  }
);
