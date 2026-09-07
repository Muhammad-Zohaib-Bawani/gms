// Microsoft Entra ID sign-in for the portal.
//
// MSAL is only on the sign-in path. It obtains one Entra access token, that token
// is exchanged once for a normal GMS token pair (POST /v1/auth/entra/exchange),
// and from then on every request — and the silent refresh, and the SignalR
// handshake — uses the GMS token exactly as it did under password login. Nothing
// else in the app knows Entra exists.
//
// Consequences worth knowing:
//  * redirect, not popup. Sign-in navigates this tab to Entra and comes back to
//    redirectUri (window.location.origin, which must be registered as a SPA
//    redirect URI on the app registration). No second window, so nothing for a
//    popup blocker or an embedded/mobile webview to swallow. The cost is that the
//    response has to be drained on boot — see drainEntraRedirect, called once by
//    AuthProvider.
//  * cacheLocation is localStorage, not sessionStorage: the redirect is a full
//    page navigation, and the request state MSAL wrote before leaving has to
//    still be there when Entra sends the browser back.
//  * navigateToLoginRequestUrl: false is passed to handleRedirectPromise, NOT to
//    the auth config. msal-browser v5 moved it out of BrowserAuthOptions and the
//    old spot is silently ignored — with the default (true) MSAL bounces the tab
//    from redirectUri back to the URL sign-in started from (/login), stashes the
//    response in its temporary cache instead of the URL, and the app looks like it
//    "refreshed itself back to the login page" with no session.
import { PublicClientApplication, InteractionRequiredAuthError } from '@azure/msal-browser';
import { ENTRA, ENTRA_ENABLED } from '../config/env';
import { decodeJwt } from './jwt';

// ── Debug tracing ───────────────────────────────────────────────────────────
// On by default so the redirect flow can be watched in a deployed build, where
// the interesting failures live. Silence it with:
//     localStorage.setItem('gms-debug-entra', '0')
//
// SECURITY: this prints whole bearer tokens to the console. Fine while wiring
// Entra up; flip the default to off (or delete the calls) before real users.
const DEBUG = (() => {
  try { return localStorage.getItem('gms-debug-entra') !== '0'; } catch { return true; }
})();

export function entraLog(step, data) {
  if (!DEBUG) return;
  if (data === undefined) console.log(`%c[entra]%c ${step}`, 'color:#0078d4;font-weight:bold', '');
  else console.log(`%c[entra]%c ${step}`, 'color:#0078d4;font-weight:bold', '', data);
}

// Tokens are logged whole (that is the point) plus their decoded claims, which is
// where the answers actually are: aud must be our API, exp must be in the future.
export function logToken(label, token) {
  if (!DEBUG) return;
  if (!token) return entraLog(`${label}: (none)`);
  const c = decodeJwt(token);
  entraLog(label, {
    token,
    length: token.length,
    claims: c,
    aud: c?.aud,
    iss: c?.iss,
    scp: c?.scp,
    roles: c?.roles,
    upn: c?.upn || c?.preferred_username || c?.email,
    expiresAt: c?.exp ? new Date(c.exp * 1000).toISOString() : null,
    expired: c?.exp ? c.exp * 1000 < Date.now() : null,
  });
}

let instance = null;
let initPromise = null;

// MSAL v3+ requires initialize() before any other call, and it must happen exactly
// once — hence the cached promise rather than a bare await.
function getInstance() {
  if (!ENTRA_ENABLED) {
    throw new Error('Microsoft sign-in is not configured for this build');
  }
  if (!instance) {
    instance = new PublicClientApplication({
      auth: {
        clientId: ENTRA.clientId,
        authority: `${ENTRA.instance.replace(/\/$/, '')}/${ENTRA.tenantId}`,
        redirectUri: window.location.origin,
        postLogoutRedirectUri: window.location.origin,
      },
      cache: { cacheLocation: 'localStorage', storeAuthStateInCookie: false },
    });
    entraLog('msal config', {
      clientId: ENTRA.clientId,
      authority: `${ENTRA.instance.replace(/\/$/, '')}/${ENTRA.tenantId}`,
      redirectUri: window.location.origin,
      scope: ENTRA.scope,
      cacheLocation: 'localStorage',
      msalVersion: '5.x — navigateToLoginRequestUrl is a handleRedirectPromise option here',
    });
    initPromise = instance.initialize().then(() => entraLog('msal initialized'));
  }
  return initPromise.then(() => instance);
}

/**
 * Drains the redirect response. Returns the Entra ACCESS token when this load was
 * a return from sign-in, null otherwise. Safe — and required — on every boot of an
 * Entra build: the response is not always in the URL (MSAL may have parked it in
 * its temporary cache), and this call is also what clears a stale
 * interaction_in_progress flag left by an abandoned sign-in.
 */
export async function drainEntraRedirect() {
  const msal = await getInstance();
  entraLog('draining redirect response…');
  const result = await msal.handleRedirectPromise({ navigateToLoginRequestUrl: false }).catch((err) => {
    entraLog('handleRedirectPromise FAILED', { name: err?.name, errorCode: err?.errorCode, message: err?.message, err });
    throw err;
  });
  entraLog('redirect result', result);
  if (!result) {
    entraLog('no redirect response on this load (ordinary boot)');
    return null;
  }
  entraLog('redirect account', {
    username: result.account?.username,
    name: result.account?.name,
    tenantId: result.account?.tenantId,
    scopes: result.scopes,
    expiresOn: result.expiresOn,
    fromCache: result.fromCache,
  });
  logToken('redirect ACCESS token', result.accessToken);
  logToken('redirect ID token', result.idToken);
  if (result.account) msal.setActiveAccount(result.account);
  // An id-token-only result would be rejected by the exchange endpoint with a
  // confusing "audience" error, so say what is actually wrong.
  if (!result.accessToken) {
    throw new Error('Microsoft sign-in returned no API token — check the app registration scope');
  }
  return result.accessToken;
}

/**
 * Returns an Entra ACCESS token for the GMS API (not an id token — the API
 * validates the audience, and an id token's audience is the client, not the API).
 *
 * Returns null when it had to start an interactive sign-in: that navigates this
 * tab away, so there is no token to give the caller and nothing after the call
 * will run. The token arrives on the next page load via drainEntraRedirect.
 */
export async function acquireEntraToken() {
  const msal = await getInstance();
  const scopes = [ENTRA.scope];

  const account = msal.getActiveAccount() || msal.getAllAccounts()[0] || null;
  entraLog('acquireEntraToken', {
    scopes,
    cachedAccounts: msal.getAllAccounts().map((a) => a.username),
    using: account?.username || null,
  });

  if (account) {
    try {
      const silent = await msal.acquireTokenSilent({ scopes, account });
      entraLog('silent token OK', { scopes: silent.scopes, expiresOn: silent.expiresOn, fromCache: silent.fromCache });
      logToken('silent ACCESS token', silent.accessToken);
      return silent.accessToken;
    } catch (err) {
      entraLog('silent token failed', { name: err?.name, errorCode: err?.errorCode, message: err?.message });
      // Anything other than "we need the user" is a real failure worth surfacing;
      // consent/MFA/expired-session all land here and are recoverable by asking.
      if (!(err instanceof InteractionRequiredAuthError)) throw err;
    }
  }

  entraLog('starting loginRedirect — leaving the app', { scopes, prompt: account ? undefined : 'select_account' });
  await msal.loginRedirect({ scopes, prompt: account ? undefined : 'select_account' });
  return null;
}

/**
 * Ends the Entra session too. Without this, "sign out" only drops the GMS tokens:
 * the very next click on Sign in with Microsoft would silently re-authenticate the
 * same account, so the user could never switch accounts or actually leave.
 * Navigates away — the caller must have cleared the local session first.
 */
export async function entraSignOut() {
  if (!ENTRA_ENABLED || !instance) return;
  try {
    const msal = await getInstance();
    const account = msal.getActiveAccount() || msal.getAllAccounts()[0];
    entraLog('logoutRedirect', { account: account?.username || null });
    if (account) await msal.logoutRedirect({ account });
  } catch (err) {
    entraLog('logout failed (ignored)', { message: err?.message });
    /* ignore — the local session is already cleared by the caller */
  }
}
