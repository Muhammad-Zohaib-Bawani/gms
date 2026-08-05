import { apiClient } from '../apiClient';
import { ENDPOINTS } from '../endpoints';

// Per-event service catalog + guest grades. Everything here is event-scoped —
// there is no global list, so every call needs an eventId.
//
// Not to be confused with `travelService`'s flight/accommodation/transport
// bookings, nor with the guest's `allowedServices` (GuestServiceType) VIP-app
// self-request permissions. Those are separate concepts that happen to share
// the word "service".

// ── Services (the catalog) ───────────────────────────────────────────────────
// Row shape: { id, eventId, name, nameAr, description, sortOrder,
//              fields: [{key,label,labelAr,type,required,options[]}],
//              usedByLevelCount }
export const getServices = (eventId) => apiClient.get(ENDPOINTS.services.base(eventId));

// body: { name, nameAr?, description?, sortOrder?, fields: [...] }
export const createService = (eventId, body) =>
  apiClient.post(ENDPOINTS.services.base(eventId), body);

export const updateService = (eventId, id, body) =>
  apiClient.put(ENDPOINTS.services.byId(eventId, id), body);

export const deleteService = (eventId, id) =>
  apiClient.delete(ENDPOINTS.services.byId(eventId, id));

// ── Service levels (guest grades) ────────────────────────────────────────────
// Row shape: { id, eventId, name, nameAr, code, description, color, sortOrder,
//              capacity, requiredGuestFields: [...], guestCount,
//              services: [{ serviceId, serviceName, fields: [...], values: {} }] }
export const getServiceLevels = (eventId) => apiClient.get(ENDPOINTS.serviceLevels.base(eventId));

export const getServiceLevel = (eventId, id) => apiClient.get(ENDPOINTS.serviceLevels.byId(eventId, id));

// body: { name, nameAr?, code?, description?, color?, sortOrder?, capacity?,
//         requiredGuestFields: [...], services: [{ serviceId, values: {} }] }
// Omitting `services` entirely leaves the level's existing set untouched.
export const createServiceLevel = (eventId, body) =>
  apiClient.post(ENDPOINTS.serviceLevels.base(eventId), body);

export const updateServiceLevel = (eventId, id, body) =>
  apiClient.put(ENDPOINTS.serviceLevels.byId(eventId, id), body);

export const deleteServiceLevel = (eventId, id) =>
  apiClient.delete(ENDPOINTS.serviceLevels.byId(eventId, id));

// Dry-run of the assignment rules so the guest form can warn (and offer an
// override) before saving. Returns { passes, violations[], missingFields[] }.
// `excludeGuestId` stops a guest already on the level counting against its own
// capacity when editing.
export const checkServiceLevelRules = (eventId, levelId, { excludeGuestId } = {}) =>
  apiClient.get(ENDPOINTS.serviceLevels.ruleCheck(eventId, levelId), {
    params: { excludeGuestId: excludeGuestId || undefined },
  });
