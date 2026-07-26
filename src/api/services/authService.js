// Auth service — wraps the auth endpoints. Persists ONLY tokens; user info is
// decoded from the access token elsewhere (auth/jwt.js).
import { apiClient } from '../apiClient';
import { ENDPOINTS } from '../endpoints';
import { tokenStore } from '../../auth/tokenStore';

export async function login(email, password) {
  const data = await apiClient.post(ENDPOINTS.auth.login, { email, password });
  const session = { accessToken: data.accessToken, refreshToken: data.refreshToken };
  tokenStore.set(session);
  return session;
}

export async function logout() {
  const refreshToken = tokenStore.refreshToken();
  try {
    if (refreshToken) await apiClient.post(ENDPOINTS.auth.logout, { refreshToken });
  } catch {
    // ignore — we clear locally regardless
  } finally {
    tokenStore.clear();
  }
}

export const forgotPassword = (email) => apiClient.post(ENDPOINTS.auth.forgotPassword, { email });
