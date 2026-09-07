import { apiClient } from '../apiClient';
import { ENDPOINTS } from '../endpoints';

// Event-scoped guest participation API. Every id in this file is an
// EventGuest.PublicId (`GuestResponse.id`), NOT the master person id
// (`GuestResponse.personId`) — see guestOverviewService for the person-level
// side. Rows come back as { id: eventGuestId, personId, eventId, ... }.

// tier / invitationStatus / etc. are filtered server-side because the list is
// paged — filtering them in the browser would only ever filter the current page.
// `invitationStatuses` is an array (multi-select filter panel); joined into the
// comma-separated string the backend's GuestPagedRequest.InvitationStatuses expects.
export function listGuests({
  eventId, pageNumber = 1, pageSize = 50, search, excludeDeclined, tier, invitationStatus,
  invitationStatuses, organizationId, nationalityId, accreditationStatus,
} = {}) {
  return apiClient.get(ENDPOINTS.guests.base, {
    params: {
      eventId, pageNumber, pageSize,
      searchTerm: search || undefined,
      excludeDeclined: excludeDeclined || undefined,
      tier: tier || undefined,
      invitationStatus: invitationStatus || undefined,
      invitationStatuses: invitationStatuses?.length ? invitationStatuses.join(',') : undefined,
      organizationId: organizationId || undefined,
      nationalityId: nationalityId || undefined,
      accreditationStatus: accreditationStatus || undefined,
    },
  });
}

// Picker rows: { id: eventGuestId, personId, fullName, email, organization,
// tier, photoUrl }. `id` is this person's participation in `eventId`, which is
// what seating / meetings / travel all take. Declined guests are excluded
// server-side, so no flag for it. Page size is capped at 100.
export function getGuestPicker({ eventId, search, pageNumber = 1, pageSize = 20 } = {}) {
  return apiClient.get(ENDPOINTS.guests.picker, {
    params: { eventId, pageNumber, pageSize, searchTerm: search || undefined },
  });
}

// "Existing Guest" tab of the Add Guest modal — participations in every OTHER
// event. One row per past participation (not deduped by person), so the same
// person can appear more than once if they attended several other events.
// Row shape: { id: eventGuestId (in that OTHER event), personId, email, ... }.
// Adding one to THIS event means POSTing /guest with the same email — the
// backend reuses that master Guest and only creates the new participation.
export function getGuestsFromOtherEvents({ currentEventId, search, pageNumber = 1, pageSize = 20 } = {}) {
  return apiClient.get(ENDPOINTS.guests.otherEvents, {
    params: { currentEventId, pageNumber, pageSize, searchTerm: search || undefined },
  });
}

export const getGuest = (eventGuestId) => apiClient.get(ENDPOINTS.guests.byId(eventGuestId));

// An `email` that already belongs to a guest reuses that master Guest (and their
// login) and only adds a participation — that IS the "add an existing guest to
// this event" path. Same email already on THIS event is a 409 carrying
// errorCode GUEST_ALREADY_ON_EVENT.
export const createGuest = (body) => apiClient.post(ENDPOINTS.guests.base, body);

export const updateGuest = (eventGuestId, body) => apiClient.put(ENDPOINTS.guests.byId(eventGuestId), body);

export const deleteGuest = (eventGuestId) => apiClient.delete(ENDPOINTS.guests.byId(eventGuestId));

// Kicks off a background import job and returns immediately — { batchId, status }.
// The actual CSV parsing/insert happens in a Hangfire job; poll getGuestImportBatch.
export const importGuests = (eventId, file) => {
  const formData = new FormData();
  formData.append('file', file);
  return apiClient.post(ENDPOINTS.guests.import(eventId), formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

export const getGuestImportBatch = (batchId) => apiClient.get(ENDPOINTS.guests.importBatch(batchId));

// The template is generated fresh per event — its dropdowns (Guest Type,
// Organization, Nationality, Service Level) reflect what currently exists,
// and its date columns are validated against this event's own date range.
export const getGuestImportTemplate = (eventId) =>
  apiClient.get(ENDPOINTS.guests.importTemplate(eventId), { responseType: 'blob' });

// Removes participations, not people — the master Guest survives in whatever
// other events they're on.
export const deleteSelectedGuests = (eventId, eventGuestIds) =>
  apiClient.delete(ENDPOINTS.guests.deleteSelected(eventId), {
    data: { selectedGuestsToDelete: eventGuestIds },
  });
export const getGuestEnums = () => apiClient.get(ENDPOINTS.lookups.guestEnums);

// Accreditation is per event, so both take the participation id.
export const issueAccreditation = (eventGuestId) => apiClient.post(ENDPOINTS.guests.issueAccreditation(eventGuestId));
export const revokeAccreditation = (eventGuestId) => apiClient.post(ENDPOINTS.guests.revokeAccreditation(eventGuestId));