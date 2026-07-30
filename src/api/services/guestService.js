import { apiClient } from '../apiClient';
import { ENDPOINTS } from '../endpoints';

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

// Picker rows: { id, fullName, organization, tier, photoUrl }. Declined guests are
// excluded server-side, so no flag for it. Page size is capped at 100.
export function getGuestPicker({ eventId, search, pageNumber = 1, pageSize = 20 } = {}) {
  return apiClient.get(ENDPOINTS.guests.picker, {
    params: { eventId, pageNumber, pageSize, searchTerm: search || undefined },
  });
}

export const getGuest = (id) => apiClient.get(ENDPOINTS.guests.byId(id));

export const createGuest = (body) => apiClient.post(ENDPOINTS.guests.base, body);

export const updateGuest = (id, body) => apiClient.put(ENDPOINTS.guests.byId(id), body);

export const deleteGuest = (id) => apiClient.delete(ENDPOINTS.guests.byId(id));

export const importGuests = (eventId, file) => {
  const formData = new FormData();
  formData.append('file', file);
  return apiClient.post(ENDPOINTS.guests.import(eventId), formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

export const deleteSelectedGuests = (eventId, guestIds) =>
  apiClient.delete(ENDPOINTS.guests.deleteSelected(eventId), {
    data: { selectedGuestsToDelete: guestIds },
  });
export const getGuestEnums = () => apiClient.get(ENDPOINTS.lookups.guestEnums);

export const issueAccreditation = (id) => apiClient.post(ENDPOINTS.guests.issueAccreditation(id));
export const revokeAccreditation = (id) => apiClient.post(ENDPOINTS.guests.revokeAccreditation(id));