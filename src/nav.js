// Single source of truth for module → URL path mapping. Imported by both the
// layout (App.jsx, for sidebar/mobile-nav links + active state) and the router
// (router.jsx, for the actual <Route> paths), so the two never drift.

export const KEY_PATH = {
  dashboard:       '/dashboard',
  invitations:     '/invitations',
  guests:          '/guests',
  serviceLevels:   '/service-levels',
  travel:          '/travel',
  // Not in the sidebar — the dynamic services show as tabs inside /travel. The
  // route stays so an existing deep link still resolves.
  serviceOps:      '/service-ops',
  accreditation:   '/accreditation',
  seating:         '/seating',
  meetings:        '/meetings',
  venueConfig:     '/venue-config',
  events:          '/events',
  accountRequests: '/account-requests',
  userAccess:      '/user-access',
  users:           '/users',
  organizations:   '/organizations',
  services:        '/services',
  venues:          '/venues',
  vehicles:        '/vehicles',
  fleetProviders:  '/fleet-providers',
  fleetBookings:   '/fleet-bookings',
  roomInventory:   '/room-inventory',
  supportChat:     '/support-chat',
};

// NAV leaf key → URL. Lookup children use keys like "lookup-airline" and map to
// the dynamic /lookups/:lookupKey route.
export function pathForKey(key) {
  if (!key) return '/dashboard';
  if (key.startsWith('lookup-')) return '/lookups/' + key.slice('lookup-'.length);
  return KEY_PATH[key] || '/dashboard';
}
