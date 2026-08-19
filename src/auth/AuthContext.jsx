import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import * as authApi from '../api/services/authService';
import { refreshTokens } from '../api/apiClient';
import { tokenStore } from './tokenStore';
import { userFromToken, isTokenExpired, needsBootRefresh } from './jwt';
import { connectHub, disconnectHub } from '../lib/realtimeHub';

const AuthContext = createContext(null);

// "Explore demo" pseudo-user — no token, every `can()` is true so the static
// UI still renders without a backend.
const DEMO_USER = { fullName: 'Demo User', role: 'Demo', permissions: ['*'], demo: true };

export function AuthProvider({ children }) {
  // We persist only { accessToken, refreshToken }. The user is always derived
  // from the access token — never stored separately.
  const [session, setSession] = useState(() => tokenStore.get());
  const [demo, setDemo] = useState(false);

  // The access token expires long before the refresh token does, so on a normal
  // return visit the stored one is stale. Spend a refresh call before deciding
  // anything about auth state — this is what used to dump the user on /login
  // every time the portal was reopened.
  const [booting, setBooting] = useState(() => needsBootRefresh(tokenStore.get()));

  // Follow token writes we didn't make here: the api client's silent refresh and
  // other tabs. Without this the context holds the old token forever.
  useEffect(() => tokenStore.subscribe(() => setSession(tokenStore.get())), []);

  useEffect(() => {
    if (!booting) return undefined;
    let alive = true;
    (async () => {
      try { await refreshTokens(); } catch { /* refreshTokens clears on a real rejection */ }
      if (alive) {
        setSession(tokenStore.get());
        setBooting(false);
      }
    })();
    return () => { alive = false; };
  }, [booting]);

  const user = useMemo(() => {
    if (demo) return DEMO_USER;
    return session?.accessToken ? userFromToken(session.accessToken) : null;
  }, [session, demo]);

  const signIn = useCallback(async (email, password) => {
    const next = await authApi.login(email, password);
    setDemo(false);
    setSession(next);
    return next;
  }, []);

  const signOut = useCallback(async () => {
    if (!demo) await authApi.logout();
    tokenStore.clear();
    setDemo(false);
    setSession(null);
  }, [demo]);

  const enterDemo = useCallback(() => setDemo(true), []);

  const can = useCallback(
    (permission) => {
      const perms = user?.permissions || [];
      if (demo || perms.includes('*')) return true;
      if (!permission) return true;
      return perms.includes(permission);
    },
    [user, demo]
  );

  // Authenticated if demo, or we hold a live access token, or we still hold a
  // refresh token — a stale access token with a refresh token in hand is a
  // recoverable session, not a signed-out one. The api client refreshes it on the
  // next call; if that refresh is rejected the store is cleared and this flips.
  const isAuthenticated = demo
    || (!!session?.accessToken && !isTokenExpired(session.accessToken))
    || !!session?.refreshToken;

  // Real backend, real token required — demo mode has neither. Held off until the
  // boot refresh lands so the hub doesn't connect with the stale access token.
  useEffect(() => {
    if (isAuthenticated && !demo && !booting) connectHub();
    else disconnectHub();
    return () => disconnectHub();
  }, [isAuthenticated, demo, booting]);

  const value = useMemo(
    () => ({
      session,
      user,
      isAuthenticated,
      isBooting: booting,
      isDemo: demo,
      permissions: user?.permissions || [],
      signIn,
      signOut,
      enterDemo,
      can,
    }),
    [session, user, isAuthenticated, booting, demo, signIn, signOut, enterDemo, can]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
