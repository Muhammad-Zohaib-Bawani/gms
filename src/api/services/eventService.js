// Events service — wraps the Events endpoints (gms-backend EventsController).
import { apiClient } from '../apiClient';
import { ENDPOINTS } from '../endpoints';

export function listEvents({ pageNumber = 1, pageSize = 20, search, status } = {}) {
  return apiClient.get(ENDPOINTS.events.base, {
    params: { pageNumber, pageSize, search: search || undefined, status: status || undefined },
  }); // -> PaginatedResponse<EventResponse>
}

export const getEvent = (id) => apiClient.get(ENDPOINTS.events.byId(id));
export const createEvent = (body) => apiClient.post(ENDPOINTS.events.base, body);
export const updateEvent = (id, body) => apiClient.put(ENDPOINTS.events.byId(id), body);
export const updateEventStatus = (id, status) => apiClient.patch(ENDPOINTS.events.status(id), { status });
export const deleteEvent = (id) => apiClient.delete(ENDPOINTS.events.byId(id));

export const addSession = (eventId, body) => apiClient.post(ENDPOINTS.events.sessions(eventId), body);
export const updateSession = (eventId, sessionId, body) => apiClient.put(ENDPOINTS.events.session(eventId, sessionId), body);
export const deleteSession = (eventId, sessionId) => apiClient.delete(ENDPOINTS.events.session(eventId, sessionId));
