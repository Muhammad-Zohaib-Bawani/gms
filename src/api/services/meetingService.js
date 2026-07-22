import { apiClient } from '../apiClient';
import { ENDPOINTS } from '../endpoints';

export const createMeeting = (body) => apiClient.post(ENDPOINTS.meetings.base, body);

export const getMeetings = (eventId) => apiClient.get(ENDPOINTS.meetings.byEvent(eventId));

// Partial update — omit a field to leave it unchanged; pass guestIds: [] to
// clear all attendees (as opposed to omitting it, which leaves them as-is).
export const editMeeting = (body) => apiClient.put(ENDPOINTS.meetings.base, body);
