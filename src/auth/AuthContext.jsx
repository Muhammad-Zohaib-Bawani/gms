import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import * as authApi from '../api/services/authService';
import { tokenStore } from './tokenStore';
import { userFromToken, isTokenExpired } from './jwt';
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

  // Authenticated if demo, or we hold an access token that hasn't expired
  // (an expired token still lets the client try a refresh on the next call).
  const isAuthenticated = demo || (!!session?.accessToken && !isTokenExpired(session.accessToken));

  // Real backend, real token required — demo mode has neither.
  useEffect(() => {
    if (isAuthenticated && !demo) connectHub();
    else disconnectHub();
    return () => disconnectHub();
  }, [isAuthenticated, demo]);

  const value = useMemo(
    () => ({
      session,
      user,
      isAuthenticated,
      isDemo: demo,
      permissions: user?.permissions || [],
      signIn,
      signOut,
      enterDemo,
      can,
    }),
    [session, user, isAuthenticated, demo, signIn, signOut, enterDemo, can]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
