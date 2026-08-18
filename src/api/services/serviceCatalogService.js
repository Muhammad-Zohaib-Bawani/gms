import { apiClient } from '../apiClient';
import { ENDPOINTS } from '../endpoints';

// The global service catalogue, the guest grades built from it, and each
// guest's service plan. Nothing here is event-scoped — see
// docs/service-levels-v2.md.
//
// Not to be confused with the guest's `allowedServices` (GuestServiceType)
// VIP-app self-request permissions, which is a separate concept sharing the
// word "service".

// ── Services ────────────────────────────────────────────────────────────────
// Row: { id, code, name, nameAr, description, icon, sortOrder, isActive,
//        form: { sections: [{ key, label, fields: [...] }] }, levelCount }
export const getServices = (includeInactive = false) =>
  apiClient.get(ENDPOINTS.services.base, { params: { includeInactive } });

export const getService = (id) => apiClient.get(ENDPOINTS.services.byId(id));

export const createService = (body) => apiClient.post(ENDPOINTS.services.base, body);
export const updateService = (id, body) => apiClient.put(ENDPOINTS.services.byId(id), body);
export const deleteService = (id) => apiClient.delete(ENDPOINTS.services.byId(id));

// Every guest in an event holding this service — the operational listings.
// params: { eventId, pageNumber, pageSize, searchTerm }
// Row shape: { entryId, eventGuestId, guestName, photoUrl, email, organization,
// serviceLevelName, serviceLevelColor, status, completedAt, values }.
export const getServiceEntries = (serviceId, params) =>
  apiClient.get(ENDPOINTS.services.entries(serviceId), { params });

// ── Service levels ──────────────────────────────────────────────────────────
// Row: { id, code, name, nameAr, description, color, sortOrder, isActive,
//        requiredGuestFields: [...], guestCount,
//        services: [{ serviceId, code, name, icon, sortOrder }] }
//
// `serviceIds` order IS the completion sequence a Fixed event enforces.
export const getServiceLevels = (includeInactive = false) =>
  apiClient.get(ENDPOINTS.serviceLevels.base, { params: { includeInactive } });

export const getServiceLevel = (id) => apiClient.get(ENDPOINTS.serviceLevels.byId(id));

export const createServiceLevel = (body) => apiClient.post(ENDPOINTS.serviceLevels.base, body);
export const updateServiceLevel = (id, body) => apiClient.put(ENDPOINTS.serviceLevels.byId(id), body);
export const deleteServiceLevel = (id) => apiClient.delete(ENDPOINTS.serviceLevels.byId(id));

// ── One participation's service plan ────────────────────────────────────────
// A plan is per EVENT PARTICIPATION, so all three take an EventGuest.PublicId
// (`GuestResponse.id`) — the master personId is not accepted.
// { eventGuestId, serviceLevelId, serviceLevelName, guestModel, isComplete,
//   slots: [{ serviceId, name, icon, form, entries: [...], status,
//             isUnlocked, isRequired, lockedReason }] }
export const getGuestServicePlan = (eventGuestId) =>
  apiClient.get(ENDPOINTS.guestServices.base(eventGuestId));

// body: { id?, serviceId, values: {key: value}, markCompleted }
export const saveGuestServiceEntry = (eventGuestId, body) =>
  apiClient.post(ENDPOINTS.guestServices.base(eventGuestId), body);

export const deleteGuestServiceEntry = (eventGuestId, entryId) =>
  apiClient.delete(ENDPOINTS.guestServices.entry(eventGuestId, entryId));
