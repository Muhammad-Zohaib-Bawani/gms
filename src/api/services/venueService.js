import { apiClient } from '../apiClient';
import { ENDPOINTS } from '../endpoints';

export const createVenue = (body) => apiClient.post(ENDPOINTS.venues.base, body);

export const getVenues = () => apiClient.get(ENDPOINTS.venues.base);

export const getVenue = (id) => apiClient.get(ENDPOINTS.venues.byId(id));

// Edit-only fields: name, location, image. Floor-plan layout is untouched.
export const updateVenue = (id, body) => apiClient.put(ENDPOINTS.venues.byId(id), body);

// Deep-clones one layout (box) of this venue into a brand-new, independent
// venue — no event/session attached yet. Returns the new venue (with its one
// cloned box) same shape as getVenue.
export const cloneVenue = (id, body) => apiClient.post(ENDPOINTS.venues.clone(id), body);

// Create an arrangement (box) for a venue — event/session scoped.
export const createVenueBox = (body) => apiClient.post(ENDPOINTS.venues.box, body);

// Delete an arrangement (box) — exactly one of eventId/sessionId must be passed,
// matching whichever scope the box was created under.
export const deleteVenueBox = (id, { venueId, eventId, sessionId }) =>
  apiClient.delete(ENDPOINTS.venues.boxById(id), {
    params: { venueId, eventId: eventId || undefined, sessionId: sessionId || undefined },
  });

// Delete a venue outright. The backend refuses (409) if any of its seats are
// already assigned to a guest, or if it has event seating data.
export const deleteVenue = (id) => apiClient.delete(ENDPOINTS.venues.byId(id));

// Add one more stadium block to the VenueBox already saved for this venue/event/session.
// Returns the full venue (with updated VenueBoxes) — same shape as getVenue.
export const addVenueBlock = (eventId, sessionId, venueId, body) =>
  apiClient.post(ENDPOINTS.venues.addBlock(eventId), body, {
    params: { sessionId: sessionId || undefined, venueId },
  });

// ── Venue reference data (dedicated tables) ──────────────────────────────────
export const getVenueTypes    = () => apiClient.get(ENDPOINTS.venues.types);
export const createVenueType  = (name, nameAr) => apiClient.post(ENDPOINTS.venues.types, { name, nameAr });
export const getElementTypes  = () => apiClient.get(ENDPOINTS.venues.elementTypes);
export const createElementType = (code, name, nameAr) =>
  apiClient.post(ENDPOINTS.venues.elementTypes, { code, name, nameAr });
