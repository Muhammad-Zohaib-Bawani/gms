import { apiClient } from '../apiClient';
import { ENDPOINTS } from '../endpoints';

// Admin-managed generic reference data (airlines, airports, vehicle types, hotels).

export const getLookupCategories = () => apiClient.get(ENDPOINTS.lookups.categories);

// The "call by code" helper — e.g. getLookupItems('AIRPORT').
export const getLookupItems = (categoryCode, { includeInactive = false } = {}) =>
  apiClient.get(ENDPOINTS.lookups.items(categoryCode), {
    params: { includeInactive: includeInactive || undefined },
  });

export const createLookupItem = (body) => apiClient.post(ENDPOINTS.lookups.createItem, body);

export const updateLookupItem = (id, body) => apiClient.put(ENDPOINTS.lookups.itemById(id), body);

export const deleteLookupItem = (id) => apiClient.delete(ENDPOINTS.lookups.itemById(id));

// Code-defined guest option sets (tier, type, statuses) for form dropdowns.
// Returns { GuestTier: [...], GuestType: [...], GuestInvitationStatus: [...], GuestAccreditationStatus: [...] }
export const getGuestEnums = () => apiClient.get(ENDPOINTS.lookups.guestEnums);
