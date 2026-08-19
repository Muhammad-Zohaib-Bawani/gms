import { apiClient } from '../apiClient';
import { ENDPOINTS } from '../endpoints';

// Providers are contracted per event, so every call is scoped by the active
// event's id. Rows come back as { id, eventId, name, contactPerson, phone,
// email, notes, vehicleCount }.
export const getFleetProviders = (eventId) => apiClient.get(ENDPOINTS.fleetProviders.base(eventId));

export const getFleetProvider = (eventId, id) => apiClient.get(ENDPOINTS.fleetProviders.byId(eventId, id));

// Body: { name, contactPerson?, phone?, email?, notes? }.
export const createFleetProvider = (eventId, body) =>
  apiClient.post(ENDPOINTS.fleetProviders.base(eventId), body);

export const updateFleetProvider = (eventId, id, body) =>
  apiClient.put(ENDPOINTS.fleetProviders.byId(eventId, id), body);

export const deleteFleetProvider = (eventId, id) =>
  apiClient.delete(ENDPOINTS.fleetProviders.byId(eventId, id));
