// Permission code → URL path.
//
// The DATABASE is the source of truth for which menus exist, what they are
// called, how they nest and in what order — that all arrives from
// GET /role-access/me and is what the sidebar renders. What the database cannot
// carry is a React component, so this file maps a permission code to the route
// the router mounts, and router.jsx maps the same code to the component.
//
// Codes and paths here MUST match Permissions.Code / Permissions.Path in the
// database; the seed script (Backend/docs/role-access-seed.sql) is the other half
// of the contract. Paths are the ones the app already shipped — only
// /user-access was renamed (to /role-access), because that page was misnamed.
// Where a code and its path disagree (services → /travel) the path is the older,
// bookmarked one and is deliberately left alone.
export const KEY_PATH = {
  dashboard:          '/dashboard',
  guests:             '/guests',
  services:           '/travel',
  'support-chat':     '/support-chat',

  accreditation:      '/accreditation',
  seating:            '/seating',
  meetings:           '/meetings',

  'venue-config':     '/venue-config',
  venues:             '/venues',

  vehicles:           '/vehicles',
  'fleet-providers':  '/fleet-providers',
  'fleet-bookings':   '/fleet-bookings',

  'room-inventory':   '/room-inventory',

  'template-builder': '/invitations',
  events:             '/events',
  'guest-overview':   '/guest-overview',
  organizations:      '/organizations',
  'service-levels':   '/service-levels',
  'manage-services':  '/services',

  users:              '/users',
  'role-access':      '/role-access',
};

// Lookup leaves are one dynamic route: code "lookup-airports" → /lookups/airports.
export const LOOKUP_KEY_PREFIX = 'lookup-';

export function pathForKey(key) {
  if (!key) return '/dashboard';
  if (key.startsWith(LOOKUP_KEY_PREFIX)) return '/lookups/' + key.slice(LOOKUP_KEY_PREFIX.length);
  return KEY_PATH[key] || '/dashboard';
}
