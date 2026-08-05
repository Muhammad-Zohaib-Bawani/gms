import { apiClient } from '../apiClient';
import { ENDPOINTS } from '../endpoints';

// Rows come back as { id, name, contactPerson, phone, email, notes, vehicleCount }.
export const getFleetProviders = () => apiClient.get(ENDPOINTS.fleetProviders.base);

export const getFleetProvider = (id) => apiClient.get(ENDPOINTS.fleetProviders.byId(id));

// Body: { name, contactPerson?, phone?, email?, notes? }.
export const createFleetProvider = (body) => apiClient.post(ENDPOINTS.fleetProviders.base, body);

export const updateFleetProvider = (id, body) => apiClient.put(ENDPOINTS.fleetProviders.byId(id), body);

export const deleteFleetProvider = (id) => apiClient.delete(ENDPOINTS.fleetProviders.byId(id));
