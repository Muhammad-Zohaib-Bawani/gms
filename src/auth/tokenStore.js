// Single source of truth for the auth tokens. We persist ONLY the tokens —
// all user info/permissions are decoded from the access token (see jwt.js).
import { AUTH_STORAGE_KEY } from '../config/env';

export const tokenStore = {
  get() {
    try {
      return JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY) || 'null');
    } catch {
      return null;
    }
  },
  set(session) {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
  },
  clear() {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  },
  accessToken() {
    return this.get()?.accessToken || null;
  },
  refreshToken() {
    return this.get()?.refreshToken || null;
  },
};
