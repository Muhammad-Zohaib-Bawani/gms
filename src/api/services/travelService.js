import { apiClient } from '../apiClient';
import { ENDPOINTS } from '../endpoints';

// Create a flight/hotel/ground-transfer booking for a guest.
export const createBooking = (body) => apiClient.post(ENDPOINTS.travelLogistics.createBooking, body);
