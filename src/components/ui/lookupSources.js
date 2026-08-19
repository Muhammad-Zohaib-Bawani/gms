// How a `lookup` form field turns an existing lookup table into dropdown
// options. Mirrors Core.Constants.ServiceLookupSources on the server, which
// validates the key on save.
//
// Stored value is the row's id, never its label — renaming an airport or a
// hotel must not corrupt bookings already completed against it.
import { apiClient } from '../../api/apiClient';
import { ENDPOINTS } from '../../api/endpoints';

// Each source says where to fetch and how to label a row. Labels live here
// rather than server-side because they are presentation: an airport reads best
// as "DOH — Doha", a driver as their name and phone.
//
// `path` may be a function of a context object — { eventId, hotelId } — for the
// sources that are only meaningful inside an event. `needs` lists the context
// keys it reads, which is also what scopes the cache. `fallbackPath` is used
// when the scoped list comes back empty, so an event that holds no inventory
// still offers the global list rather than an empty dropdown.
const SOURCES = {
  airports: {
    label: 'Airports',
    labelAr: 'المطارات',
    path: '/v1/lookups/airports',
    text: (r) => [r.code, r.city].filter(Boolean).join(' — ') || r.name || r.id,
  },
  hotels: {
    // Hotels the event actually holds a contract with — booking one it doesn't
    // is not a real option. Same row shape as the global lookup.
    label: 'Hotels', labelAr: 'الفنادق',
    path: (ctx) => (ctx.eventId
      ? ENDPOINTS.accommodationInventory.hotels(ctx.eventId)
      : ENDPOINTS.lookups.hotels),
    needs: ['eventId'],
    fallbackPath: ENDPOINTS.lookups.hotels,
    text: (r) => r.name || r.id,
  },
  roomTypes: {
    // Only types with rooms held at the hotel picked on the same form. An
    // unmanaged hotel holds none, so `fallbackPath` restores the global list.
    label: 'Room types', labelAr: 'أنواع الغرف',
    path: (ctx) => (ctx.eventId && ctx.hotelId
      ? ENDPOINTS.accommodationInventory.hotelRoomTypes(ctx.eventId, ctx.hotelId)
      : ENDPOINTS.lookups.roomTypes),
    needs: ['eventId', 'hotelId'],
    fallbackPath: ENDPOINTS.lookups.roomTypes,
    text: (r) => r.name || r.id,
  },
  flightClasses: {
    label: 'Flight classes', labelAr: 'درجات الطيران', path: '/v1/lookups/flight-classes',
    text: (r) => r.name || r.id,
  },
  locations: {
    // LocationDto has no `name` — the addressable field is `address`.
    label: 'Locations', labelAr: 'المواقع', path: '/v1/lookups/locations',
    text: (r) => r.address || r.name || r.id,
  },
  vehicles: {
    // VehicleResponse fields are vehicleNumber/vehicleModel, not plateNumber/model.
    label: 'Vehicles', labelAr: 'المركبات', path: '/v1/vehicles',
    text: (r) => [r.vehicleNumber, r.vehicleModel].filter(Boolean).join(' · ') || r.name || r.id,
  },
  vehicleTypes: {
    label: 'Vehicle types', labelAr: 'أنواع المركبات', path: '/v1/lookups/vehicle-types',
    text: (r) => r.name || r.id,
  },
  drivers: {
    label: 'Drivers', labelAr: 'السائقون', path: '/v1/lookups/drivers',
    text: (r) => [r.fullName || r.name, r.phone].filter(Boolean).join(' · ') || r.id,
  },
  nationalities: {
    label: 'Nationalities', labelAr: 'الجنسيات', path: '/v1/nationality',
    text: (r) => [r.flag, r.name].filter(Boolean).join(' ') || r.id,
  },
  organizations: {
    label: 'Organisations', labelAr: 'المؤسسات', path: '/v1/organizations',
    text: (r) => r.name || r.id,
  },
};

export const LOOKUP_SOURCE_KEYS = Object.keys(SOURCES);

export function lookupSourceLabel(key, isAr) {
  const s = SOURCES[key];
  if (!s) return key;
  return (isAr ? s.labelAr : null) || s.label;
}

// One in-flight request and one result per source *per scope* for the life of
// the page. Several fields on one form routinely share a source (From and To are
// both airports), and a form can be opened repeatedly — refetching each time
// would be pure waste. Scoped sources key on their context too, so switching
// hotel fetches that hotel's room types once and then reuses them.
const cache = new Map();

// Bare array, or a paginated envelope.
const rowsOf = (res) => (Array.isArray(res) ? res : (res?.items || []));

export function loadLookupOptions(key, ctx = {}) {
  const src = SOURCES[key];
  if (!src) return Promise.resolve([]);

  const scope = (src.needs || []).map((n) => ctx[n] || '').join('|');
  const cacheKey = scope ? `${key}|${scope}` : key;
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  const path = typeof src.path === 'function' ? src.path(ctx) : src.path;
  const asOptions = (res) => rowsOf(res)
    .filter((r) => r?.id)
    .map((r) => ({ value: String(r.id), label: src.text(r) }));

  const p = apiClient
    .get(path)
    .then((res) => {
      const opts = asOptions(res);
      // Nothing held for this scope → not "no room types exist". Fall back so the
      // dropdown stays usable, exactly as the legacy travel form does.
      if (opts.length === 0 && src.fallbackPath && src.fallbackPath !== path) {
        return apiClient.get(src.fallbackPath).then(asOptions);
      }
      return opts;
    })
    .catch(() => {
      // Don't cache a failure: the next open should try again.
      cache.delete(cacheKey);
      return [];
    });

  cache.set(cacheKey, p);
  return p;
}

/** Resolves a stored id back to its label, for read-only display. */
export function lookupLabelFor(key, value, options) {
  if (!value) return '';
  const hit = (options || []).find((o) => o.value === String(value));
  return hit ? hit.label : String(value);
}
