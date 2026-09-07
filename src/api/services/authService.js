// Auth service — wraps the auth endpoints. Persists ONLY tokens; user info is
// decoded from the access token elsewhere (auth/jwt.js).
import axios from 'axios';
import { apiClient, ApiError, CLIENT_APP, CLIENT_APP_HEADER } from '../apiClient';
import { errorFrom } from '../apiError';
import { ENDPOINTS } from '../endpoints';
import { tokenStore } from '../../auth/tokenStore';
import { API_BASE_URL, API_TIMEOUT } from '../../config/env';
import { acquireEntraToken, drainEntraRedirect, entraLog, logToken } from '../../auth/msal';

export async function login(email, password) {
  const data = await apiClient.post(ENDPOINTS.auth.login, { email, password });
  const session = { accessToken: data.accessToken, refreshToken: data.refreshToken };
  tokenStore.set(session);
  return session;
}

// Microsoft Entra sign-in. Two steps: MSAL hands us an Entra access token, the
// backend trades it for a GMS token pair after checking the Users/Roles tables.
// The session that comes back is the same { accessToken, refreshToken } shape a
// password login produced, which is why nothing downstream changes.
//
// Returns null when MSAL had to start an interactive sign-in: that redirects this
// tab to Entra, so there is no session yet and no code after the call runs. The
// browser comes back to the app and completeMicrosoftRedirect finishes the job.
//
// Bare axios, not apiClient: the request interceptor would overwrite the
// Authorization header with the (absent) GMS token, and this call's Bearer must be
// the ENTRA token.
export async function loginWithMicrosoft() {
  entraLog('loginWithMicrosoft: button clicked');
  const entraToken = await acquireEntraToken();
  if (!entraToken) {
    entraLog('loginWithMicrosoft: redirected away, no session yet');
    return null; // redirecting to Entra — this page is going away
  }
  return exchangeEntraToken(entraToken);
}

// The other half of the redirect flow, called once on boot. Returns the session
// when this page load was a return from Entra, null on any ordinary load.
export async function completeMicrosoftRedirect() {
  entraLog('completeMicrosoftRedirect: boot');
  const entraToken = await drainEntraRedirect();
  if (!entraToken) return null;
  return exchangeEntraToken(entraToken);
}

async function exchangeEntraToken(entraToken) {

console.log('zaib',API_BASE_URL)

  const url = `${API_BASE_URL}${ENDPOINTS.auth.entraExchange}`;
  entraLog('exchange -> POST', { url, clientApp: CLIENT_APP });
  logToken('exchange REQUEST bearer (entra)', entraToken);

  const res = await axios.post(
    `${API_BASE_URL}${ENDPOINTS.auth.entraExchange}`,
    null,
    {
      timeout: API_TIMEOUT,
      headers: {
        Authorization: `Bearer ${entraToken}`,
        [CLIENT_APP_HEADER]: CLIENT_APP,
      },
    },
  ).catch((err) => {
    const body = err.response?.data;
    entraLog('exchange FAILED', { status: err.response?.status, body, message: err.message });
    throw errorFrom(body, err.response?.status, err.message || 'Microsoft sign-in failed');
  });

  entraLog('exchange response', { status: res.status, body: res.data });

  const data = res.data?.data;
  if (!res.data?.success || !data?.accessToken) {
    entraLog('exchange rejected by backend', res.data);
    throw new ApiError(res.data?.message || 'Microsoft sign-in failed', { status: res.status });
  }

  const session = { accessToken: data.accessToken, refreshToken: data.refreshToken };
  logToken('GMS access token', session.accessToken);
  entraLog('GMS refresh token', session.refreshToken);
  tokenStore.set(session);
  entraLog('session stored — signed in');
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
