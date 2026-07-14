import { apiClient } from '../apiClient';
import { ENDPOINTS } from '../endpoints';

// Assign (or move) a guest onto a seat. Body: { seatId, guestId, eventId, sessionId }.
export const assignSeat = (body) => apiClient.post(ENDPOINTS.seating.assign, body);

// Unassign a seat within a specific (venue box, event, session) scope.
export const unassignSeat = (seatId, { venueBoxId, eventId, sessionId }) =>
  apiClient.delete(ENDPOINTS.seating.unassign(seatId), {
    params: { venueBoxId, eventId, sessionId: sessionId || undefined },
  });

// All current seat->guest assignments for a venue box under a given event/session.
export const getSeatAssignments = (venueBoxId, { eventId, sessionId }) =>
  apiClient.get(ENDPOINTS.seating.byBox(venueBoxId), {
    params: { eventId, sessionId: sessionId || undefined },
  });
