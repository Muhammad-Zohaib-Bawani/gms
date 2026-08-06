// How a `lookup` form field turns an existing lookup table into dropdown
// options. Mirrors Core.Constants.ServiceLookupSources on the server, which
// validates the key on save.
//
// Stored value is the row's id, never its label — renaming an airport or a
// hotel must not corrupt bookings already completed against it.
import { apiClient } from '../../api/apiClient';

// Each source says where to fetch and how to label a row. Labels live here
// rather than server-side because they are presentation: an airport reads best
// as "DOH — Doha", a driver as their name and phone.
const SOURCES = {
  airports: {
    label: 'Airports',
    labelAr: 'المطارات',
    path: '/v1/lookups/airports',
    text: (r) => [r.code, r.city].filter(Boolean).join(' — ') || r.name || r.id,
  },
  hotels: {
    label: 'Hotels', labelAr: 'الفنادق', path: '/v1/lookups/hotels',
    text: (r) => r.name || r.id,
  },
  roomTypes: {
    label: 'Room types', labelAr: 'أنواع الغرف', path: '/v1/lookups/room-types',
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

// One in-flight request and one result per source for the life of the page.
// Several fields on one form routinely share a source (From and To are both
// airports), and a form can be opened repeatedly — refetching each time would
// be pure waste.
const cache = new Map();

export function loadLookupOptions(key) {
  const src = SOURCES[key];
  if (!src) return Promise.resolve([]);
  if (cache.has(key)) return cache.get(key);

  const p = apiClient
    .get(src.path)
    .then((res) => {
      // Endpoints return either a bare array or a paginated envelope.
      const rows = Array.isArray(res) ? res : (res?.items || []);
      return rows
        .filter((r) => r?.id)
        .map((r) => ({ value: String(r.id), label: src.text(r) }));
    })
    .catch(() => {
      // Don't cache a failure: the next open should try again.
      cache.delete(key);
      return [];
    });

  cache.set(key, p);
  return p;
}

/** Resolves a stored id back to its label, for read-only display. */
export function lookupLabelFor(key, value, options) {
  if (!value) return '';
  const hit = (options || []).find((o) => o.value === String(value));
  return hit ? hit.label : String(value);
}
