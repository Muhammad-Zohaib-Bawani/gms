// Axios instance for the GMS backend.
//  - baseURL + timeout from config
//  - request interceptor: attaches the Bearer access token
//  - response interceptor: unwraps the ApiResponse<T> envelope, and on 401
//    transparently refreshes the token once and retries the original request
import axios from 'axios';
import { API_BASE_URL, API_TIMEOUT } from '../config/env';
import { ENDPOINTS } from './endpoints';
import { tokenStore } from '../auth/tokenStore';

// Normalized error thrown to callers (services/components catch this).
export class ApiError extends Error {
  constructor(message, { status, errors } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errors = errors || [];
  }
}

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

function refreshTokens() {
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
        const next = { accessToken: data.accessToken, refreshToken: data.refreshToken };
        tokenStore.set(next);
        return next;
      })
      .catch((err) => {
        tokenStore.clear();
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
  (response) => {
    const body = response.data;
    // Unwrap the backend envelope { success, message, data, errors }.
    if (body && typeof body === 'object' && 'success' in body && 'data' in body) {
      return body.data;
    }
    return body;
  },
  async (error) => {
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

    if (error.code === 'ECONNABORTED') {
      return Promise.reject(new ApiError('Request timed out', { status: 0 }));
    }

    const data = response?.data;
    const message = data?.message || error.message || 'Request failed';
    return Promise.reject(new ApiError(message, { status: response?.status, errors: data?.errors }));
  }
);
