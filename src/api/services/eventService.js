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
export const updateEventStatus = (id, status) => apiClient.put(ENDPOINTS.events.status(id), { status });
export const deleteEvent = (id) => apiClient.delete(ENDPOINTS.events.byId(id));

// Always reflects the venues that exist right now — re-export before every
// bulk import so the Venue dropdown (and validation) isn't stale.
export const getEventImportTemplate = () =>
  apiClient.get(ENDPOINTS.events.importTemplate, { responseType: 'blob' });

// Kicks off a background import job and returns immediately — { batchId, status }.
// The actual parsing/insert happens in a Hangfire job; poll getEventImportBatch.
export const importEvents = (file) => {
  const formData = new FormData();
  formData.append('file', file);
  return apiClient.post(ENDPOINTS.events.import, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

export const getEventImportBatch = (batchId) => apiClient.get(ENDPOINTS.events.importBatch(batchId));
// -> ImportBatchStatusDto { id, kind, status, total, imported, failed, errorMessage, rows: [{ row, title, success, error, errorCategory }] }

// Admin-managed lookup — replaces the old hardcoded EVENT_TYPES list.
export const getEventTypes = () => apiClient.get(ENDPOINTS.events.types);
export const createEventType = (name) => apiClient.post(ENDPOINTS.events.types, { name });

export const listSessions = (eventId) => apiClient.get(ENDPOINTS.events.sessions(eventId));
export const addSession = (eventId, body) => apiClient.post(ENDPOINTS.events.sessions(eventId), body);
export const updateSession = (eventId, sessionId, body) => apiClient.put(ENDPOINTS.events.session(eventId, sessionId), body);
export const deleteSession = (eventId, sessionId) => apiClient.delete(ENDPOINTS.events.session(eventId, sessionId));
