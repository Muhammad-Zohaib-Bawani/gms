// Single source of truth for the auth tokens. We persist ONLY the tokens —
// all user info/permissions are decoded from the access token (see jwt.js).
import { AUTH_STORAGE_KEY } from '../config/env';

// AuthContext subscribes so it sees writes it didn't make itself — chiefly the
// api client's silent refresh. Without that the context keeps rendering from the
// old expired access token and the router bounces to /login.
const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn());

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
    emit();
  },
  clear() {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    emit();
  },
  accessToken() {
    return this.get()?.accessToken || null;
  },
  refreshToken() {
    return this.get()?.refreshToken || null;
  },
  // Returns an unsubscribe fn. The 'storage' event only fires for writes from
  // OTHER tabs, which is exactly what emit() can't see.
  subscribe(fn) {
    listeners.add(fn);
    const onStorage = (e) => { if (e.key === AUTH_STORAGE_KEY) fn(); };
    window.addEventListener('storage', onStorage);
    return () => {
      listeners.delete(fn);
      window.removeEventListener('storage', onStorage);
    };
  },
};
