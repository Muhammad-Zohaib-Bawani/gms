// Permission evaluation — the one place the rules live.
//
// Deliberately React-free: AccessContext wraps this, but nothing here knows
// about hooks, so the rules can be exercised directly (see permissions.check.mjs)
// and no component ever has to reimplement `write.includes(...)`.
//
// The inputs are the JWT's own `read` / `write` claims — the SAME claims the
// backend's [HasPermission] policy reads (Core/Authorization/AccessEvaluator.cs).
// That is what makes the button and the endpoint agree by construction: there is
// no second, client-side model of who may do what, only a local read of the
// server's answer. The frontend is still not a security boundary — hiding a
// button never replaces the server check, it just stops offering an action the
// server would refuse.

/**
 * @typedef {'read'|'write'} AccessLevel
 * @typedef {Object} AccessEvaluator
 * @property {(code: string) => boolean} canRead
 * @property {(code: string) => boolean} canWrite
 * @property {(codes: string[]) => boolean} canReadAny
 * @property {(codes: string[]) => boolean} canWriteAny
 * @property {(code: string, level?: AccessLevel) => boolean} hasPermission
 */

// ── Permission codes ──────────────────────────────────────────────────────
// One name per Permissions.Code row, so a rename is a compile-time-ish find and
// a typo is not a silent denial. Values must stay identical to
// Core/Common/PermissionCodes.cs and to the codes in nav.js / the seed script.
export const PERM = {
  DASHBOARD: 'dashboard',
  GUESTS: 'guests',
  GUEST_OVERVIEW: 'guest-overview',

  /** The Travel & Logistics module. Its route is /travel — the code stayed 'services'. */
  SERVICES: 'services',
  MANAGE_SERVICES: 'manage-services',
  SERVICE_LEVELS: 'service-levels',

  SUPPORT_CHAT: 'support-chat',
  ACCREDITATION: 'accreditation',
  SEATING: 'seating',
  MEETINGS: 'meetings',

  VENUE_CONFIG: 'venue-config',
  VENUES: 'venues',

  VEHICLES: 'vehicles',
  FLEET_PROVIDERS: 'fleet-providers',
  FLEET_BOOKINGS: 'fleet-bookings',

  ROOM_INVENTORY: 'room-inventory',
  TEMPLATE_BUILDER: 'template-builder',
  EVENTS: 'events',
  ORGANIZATIONS: 'organizations',

  USERS: 'users',
  ROLE_ACCESS: 'role-access',
};

/**
 * Per-service permission code. Every service in the catalogue owns a Permissions
 * row of its own (`service-flight`, `service-arrival-departure`, and one per
 * dynamic service), kept in step by ServiceCatalogService — so a role granted the
 * Travel page still only sees the services it holds.
 *
 * READ is per service. WRITE is not: every travel/service write endpoint gates on
 * PermissionCodes.Services (see TravelController), so writes check PERM.SERVICES.
 * @param {string} code
 */
export const svcPerm = (code) => `service-${String(code || '').trim().toLowerCase()}`;

/** Lookup screens are one route per code: `lookup-airports` → /lookups/airports. */
export const lookupPerm = (key) => `lookup-${String(key || '').trim().toLowerCase()}`;

const toSet = (list) => new Set(Array.isArray(list) ? list.filter(Boolean) : []);

/**
 * Builds the checks for one user's claims.
 *
 * Fail-closed throughout: an absent code, an unknown code, an empty claim list
 * and a missing user all evaluate to false. There is deliberately no
 * `if (!permissions) return true` escape — the only thing that grants access is
 * a claim that is actually present.
 *
 * @param {{ read?: string[], write?: string[], allowAll?: boolean }} claims
 *   `allowAll` is the demo mode's escape hatch (no backend, no token, so no
 *   claims to read); it is set from AuthContext's isDemo and nothing else.
 * @returns {AccessEvaluator}
 */
export function createAccessEvaluator({ read, write, allowAll = false } = {}) {
  const readable = toSet(read);
  const writable = toSet(write);

  // Write is never implied by Read. Read IS implied by Write — a role that may
  // edit a page may obviously open it. Same rule as the server's AccessEvaluator,
  // so the two cannot drift.
  const canRead = (code) =>
    allowAll || (!!code && (readable.has(code) || writable.has(code)));

  const canWrite = (code) => allowAll || (!!code && writable.has(code));

  // ANY-of, matching [HasPermission(AccessLevel.Write, PermissionCodes.Guests,
  // PermissionCodes.Services)] — a handful of endpoints genuinely serve several
  // menus, and without this the UI has to hardcode one of the two codes and hide
  // the action from a role the server would have accepted.
  const canReadAny = (codes) => (codes || []).some(canRead);
  const canWriteAny = (codes) => (codes || []).some(canWrite);

  const hasPermission = (code, level = 'read') =>
    (level === 'write' ? canWrite : canRead)(code);

  return { canRead, canWrite, canReadAny, canWriteAny, hasPermission };
}
