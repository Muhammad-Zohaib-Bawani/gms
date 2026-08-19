import { apiClient } from '../apiClient';
import { ENDPOINTS } from '../endpoints';

// Body: { eventId, name, date, location?, startTime?, endTime?, meetingAgenda?,
// eventGuestIds }. Attendees are EventGuest.PublicIds — a meeting belongs to one
// event, so every attendee must be a participation in THAT event.
export const createMeeting = (body) => apiClient.post(ENDPOINTS.meetings.base, body);

export const getMeetings = (eventId) => apiClient.get(ENDPOINTS.meetings.byEvent(eventId));

// Partial update — omit a field to leave it unchanged; pass eventGuestIds: [] to
// clear all attendees (as opposed to omitting it, which leaves them as-is).
// Response guests[] carry both `id` (eventGuestId) and `personId`.
export const editMeeting = (body) => apiClient.put(ENDPOINTS.meetings.base, body);
