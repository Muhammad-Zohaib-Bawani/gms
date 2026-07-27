import { apiClient } from '../apiClient';
import { ENDPOINTS } from '../endpoints';

export function listGuests({ eventId, pageNumber = 1, pageSize = 50, search, excludeDeclined } = {}) {
  return apiClient.get(ENDPOINTS.guests.base, {
    params: {
      eventId, pageNumber, pageSize,
      searchTerm: search || undefined,
      excludeDeclined: excludeDeclined || undefined,
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