import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import * as authApi from '../api/services/authService';
import { refreshTokens } from '../api/apiClient';
import { tokenStore } from './tokenStore';
import { userFromToken, isTokenExpired, needsBootRefresh } from './jwt';
import { entraSignOut, entraLog, logToken } from './msal';
import { ENTRA_ENABLED } from '../config/env';
import { connectHub, disconnectHub } from '../lib/realtimeHub';

const AuthContext = createContext(null);

// "Explore demo" pseudo-user — no token. AccessContext short-circuits every
// canRead/canWrite for it, so the static UI still renders without a backend.
const DEMO_USER = { fullName: 'Demo User', role: 'Demo', read: [], write: [], demo: true };

export function AuthProvider({ children }) {
  // We persist only { accessToken, refreshToken }. The user is always derived
  // from the access token — never stored separately.
  const [session, setSession] = useState(() => tokenStore.get());
  const [demo, setDemo] = useState(false);

  // The access token expires long before the refresh token does, so on a normal
  // return visit the stored one is stale. Spend a refresh call before deciding
  // anything about auth state — this is what used to dump the user on /login
  // every time the portal was reopened.
  //
  // An Entra build always boots held: sign-in comes back as a redirect, and the
  // response has to be drained and exchanged before anything decides the user is
  // signed out. MSAL does not always leave the response in the URL, so there is
  // nothing cheaper to test than asking it.
  const [booting, setBooting] = useState(
    () => needsBootRefresh(tokenStore.get()) || ENTRA_ENABLED
  );

  // A failed exchange happens during boot, not under a button, so there is no
  // catch block near a form to show it. AuthView reads it off the context.
  const [authError, setAuthError] = useState(null);

  // Follow token writes we didn't make here: the api client's silent refresh and
  // other tabs. Without this the context holds the old token forever.
  useEffect(() => tokenStore.subscribe(() => setSession(tokenStore.get())), []);

  useEffect(() => {
    if (!booting) return undefined;
    let alive = true;
    entraLog('boot start', { entraEnabled: ENTRA_ENABLED });
    (async () => {
      let viaEntra = null;
      try {
        if (ENTRA_ENABLED) viaEntra = await authApi.completeMicrosoftRedirect();
      } catch (err) {
        // The backend's own sentence ("No GMS account exists for this Microsoft
        // user") is the only thing the user can act on, and this happened during
        // boot — there is no form nearby to catch it.
        entraLog('entra boot exchange failed', { message: err?.message, err });
        if (alive) setAuthError(err.message || 'Microsoft sign-in failed.');
      }
      // Not a sign-in return: an ordinary reload with a stale access token still
      // needs the refresh it always did.
      try {
        if (!viaEntra && needsBootRefresh(tokenStore.get())) await refreshTokens();
      } catch { /* refreshTokens clears on a real rejection */ }
      if (alive) {
        const stored = tokenStore.get();
        logToken('boot session access token', stored?.accessToken);
        setSession(stored);
        setBooting(false);
        entraLog('boot done', { signedIn: !!stored?.accessToken, viaEntra: !!viaEntra });
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

  // Entra sign-in. On success the AuthProvider re-renders the app shell off the
  // new token. Returns null when it redirected this tab to Entra: the session
  // then arrives on the next page load, drained by the boot effect above.
  const signInWithMicrosoft = useCallback(async () => {
    setAuthError(null);
    const next = await authApi.loginWithMicrosoft();
    entraLog('signInWithMicrosoft result', next ? 'session' : 'null (redirecting)');
    if (!next) return null;
    setDemo(false);
    setSession(next);
    return next;
  }, []);

  const signOut = useCallback(async () => {
    if (!demo) await authApi.logout();
    tokenStore.clear();
    setDemo(false);
    setSession(null);
    // Drop the Entra session too, or the next sign-in silently re-authenticates
    // the same account and the user can never switch or actually leave.
    entraLog('signOut', { demo, entraEnabled: ENTRA_ENABLED });
    if (ENTRA_ENABLED && !demo) await entraSignOut();
  }, [demo]);

  const enterDemo = useCallback(() => setDemo(true), []);

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
      authError,
      signIn,
      signInWithMicrosoft,
      signOut,
      enterDemo,
    }),
    [session, user, isAuthenticated, booting, demo, authError, signIn, signInWithMicrosoft, signOut, enterDemo]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
