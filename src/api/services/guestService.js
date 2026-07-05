import { apiClient } from '../apiClient';
import { ENDPOINTS } from '../endpoints';

export function listGuests({ eventId, pageNumber = 1, pageSize = 50, search } = {}) {
  return apiClient.get(ENDPOINTS.guests.base, {
    params: { eventId, pageNumber, pageSize, searchTerm: search || undefined },
  });
}

export const getGuest = (id) => apiClient.get(ENDPOINTS.guests.byId(id));

export const createGuest = (body) => apiClient.post(ENDPOINTS.guests.base, body);
