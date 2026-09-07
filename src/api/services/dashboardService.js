import { apiClient } from '../apiClient';
import { ENDPOINTS } from '../endpoints';

// Aggregated event summary: sessions, guest funnel counts, meetings, recent guests.
export const getDashboard = (eventId) => apiClient.get(ENDPOINTS.dashboard.byEvent(eventId));
