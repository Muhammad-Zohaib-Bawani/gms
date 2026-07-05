// Client-side JWT decoding. This does NOT verify the signature (the server does
// that on every request) — it only reads the payload so the UI can show the
// user and gate buttons without storing a separate user object.

export function decodeJwt(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '==='.slice((b64.length + 3) % 4);
    const json = decodeURIComponent(
      atob(padded)
        .split('')
        .map((c) => '%' + ('00' + c?.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

// Normalize the JWT claims into the user object the app consumes.
export function userFromToken(token) {
  const c = decodeJwt(token);
  if (!c) return null;

  // "permission" is a single string when there's one, an array when many.
  const rawPerms = c.permission ?? c.permissions ?? [];
  const permissions = Array.isArray(rawPerms) ? rawPerms : [rawPerms];

  return {
    id: c.uid || c.sub || null,
    email: c.email || '',
    userName: c.userName || '',
    firstName: c.firstName || '',
    lastName: c.lastName || '',
    fullName: c.fullName || c.name || '',
    role: c.role || '',
    roleCode: c.roleCode || '',
    roleId: c.roleId || null,
    permissions,
    exp: c.exp || null,
  };
}

export function isTokenExpired(token, skewSeconds = 30) {
  const c = decodeJwt(token);
  if (!c?.exp) return false; // no exp claim → treat as non-expiring here
  return Date.now() >= (c.exp - skewSeconds) * 1000;
}
