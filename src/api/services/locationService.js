import { apiClient } from '../apiClient';
import { ENDPOINTS } from '../endpoints';

// Persists a map-picked point as a real Location row and returns its id.
// Body: { address, type, latitude, longitude } — lat/lng are strings.
export const createLocation = (body) => apiClient.post(ENDPOINTS.lookups.locations, body);

// Same body shape as create.
export const updateLocation = (id, body) => apiClient.put(ENDPOINTS.lookups.locationById(id), body);
