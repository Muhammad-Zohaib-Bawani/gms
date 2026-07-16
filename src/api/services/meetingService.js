import { apiClient } from '../apiClient';
import { ENDPOINTS } from '../endpoints';

export const createMeeting = (body) => apiClient.post(ENDPOINTS.meetings.base, body);

export const getMeetings = (eventId) => apiClient.get(ENDPOINTS.meetings.byEvent(eventId));
