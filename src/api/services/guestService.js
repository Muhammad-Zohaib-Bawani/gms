import { apiClient } from '../apiClient';
import { ENDPOINTS } from '../endpoints';

// tier / invitationStatus are filtered server-side because the list is paged —
// filtering them in the browser would only ever filter the current page.
export function listGuests({ eventId, pageNumber = 1, pageSize = 50, search, excludeDeclined, tier, invitationStatus } = {}) {
  return apiClient.get(ENDPOINTS.guests.base, {
    params: {
      eventId, pageNumber, pageSize,
      searchTerm: search || undefined,
      excludeDeclined: excludeDeclined || undefined,
      tier: tier || undefined,
      invitationStatus: invitationStatus || undefined,
    },
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