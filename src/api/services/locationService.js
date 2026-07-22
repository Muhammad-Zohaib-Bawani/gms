import { apiClient } from '../apiClient';
import { ENDPOINTS } from '../endpoints';

// Persists a map-picked point as a real Location row and returns its id.
export const createLocation = (body) => apiClient.post(ENDPOINTS.locations.create, body);
