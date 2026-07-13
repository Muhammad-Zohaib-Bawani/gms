import { apiClient } from '../apiClient';
import { ENDPOINTS } from '../endpoints';

// Admin-managed generic reference data (airlines, airports, vehicle types, hotels, …).

export const getLookupCategories = () => apiClient.get(ENDPOINTS.lookups.categories);

// The "call by code" helper — e.g. getLookupItems('AIRPORT'). Always hits the API.
export const getLookupItems = (categoryCode, { includeInactive = false } = {}) =>
  apiClient.get(ENDPOINTS.lookups.items(categoryCode), {
    params: { includeInactive: includeInactive || undefined },
  });

// ── localStorage cache for consumer dropdowns ───────────────────────────────
// Reference data changes rarely, so cache active items per category and reuse
// them instead of re-calling the API. The cache is invalidated whenever an item
// in that category is created/updated/deleted (see below).
const CACHE_PREFIX = 'gms-lookup-';
const cacheKey = (categoryCode) => `${CACHE_PREFIX}${categoryCode}`;

export function clearLookupCache(categoryCode) {
  try {
    if (categoryCode) {
      localStorage.removeItem(cacheKey(categoryCode));
      return;
    }
    // No category given → drop every lookup cache entry
    Object.keys(localStorage)
      .filter(k => k.startsWith(CACHE_PREFIX))
      .forEach(k => localStorage.removeItem(k));
  } catch { /* ignore storage errors */ }
}

// Returns active items for a category, served from localStorage after the first
// load. Pass { force: true } to bypass the cache and refresh it.
export async function getCachedLookupItems(categoryCode, { force = false } = {}) {
  const key = cacheKey(categoryCode);
  if (!force) {
    try {
      const cached = localStorage.getItem(key);
      if (cached) return JSON.parse(cached);
    } catch { /* fall through to API */ }
  }
  const items = (await getLookupItems(categoryCode)) || [];
  try { localStorage.setItem(key, JSON.stringify(items)); } catch { /* ignore */ }
  return items;
}

// Mutations invalidate the cache so consumers pick up changes on next load.
export const createLookupItem = async (body) => {
  const r = await apiClient.post(ENDPOINTS.lookups.createItem, body);
  clearLookupCache(body?.categoryCode);
  return r;
};

export const updateLookupItem = async (id, body) => {
  const r = await apiClient.put(ENDPOINTS.lookups.itemById(id), body);
  clearLookupCache(body?.categoryCode);
  return r;
};

export const deleteLookupItem = async (id) => {
  const r = await apiClient.delete(ENDPOINTS.lookups.itemById(id));
  clearLookupCache(); // id-only → category unknown, clear all lookup caches
  return r;
};

// Code-defined guest option sets (tier, type, statuses) for form dropdowns.
// Returns { GuestTier: [...], GuestType: [...], GuestInvitationStatus: [...], GuestAccreditationStatus: [...] }
export const getGuestEnums = () => apiClient.get(ENDPOINTS.lookups.guestEnums);
