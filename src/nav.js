// Single source of truth for module → URL path mapping. Imported by both the
// layout (App.jsx, for sidebar/mobile-nav links + active state) and the router
// (router.jsx, for the actual <Route> paths), so the two never drift.

export const KEY_PATH = {
  dashboard:       '/dashboard',
  invitations:     '/invitations',
  guests:          '/guests',
  travel:          '/travel',
  accreditation:   '/accreditation',
  seating:         '/seating',
  meetings:        '/meetings',
  venueConfig:     '/venue-config',
  events:          '/events',
  accountRequests: '/account-requests',
  userAccess:      '/user-access',
  users:           '/users',
};

// NAV leaf key → URL. Lookup children use keys like "lookup-airline" and map to
// the dynamic /lookups/:lookupKey route.
export function pathForKey(key) {
  if (!key) return '/dashboard';
  if (key.startsWith('lookup-')) return '/lookups/' + key.slice('lookup-'.length);
  return KEY_PATH[key] || '/dashboard';
}
