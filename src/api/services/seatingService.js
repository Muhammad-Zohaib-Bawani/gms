import { apiClient } from '../apiClient';
import { ENDPOINTS } from '../endpoints';

// Assign (or move) a guest onto a seat. Body:
// { seatId, eventGuestId, eventId, sessionId }. Seating is per event, so the
// seat goes to an EventGuest.PublicId (`GuestResponse.id`), not a personId.
export const assignSeat = (body) => apiClient.post(ENDPOINTS.seating.assign, body);

// Unassign a seat within a specific (venue box, event, session) scope.
export const unassignSeat = (seatId, { venueBoxId, eventId, sessionId }) =>
  apiClient.delete(ENDPOINTS.seating.unassign(seatId), {
    params: { venueBoxId, eventId, sessionId: sessionId || undefined },
  });

// All current seat assignments for a venue box under a given event/session.
// Row shape: { seatId, eventGuestId }.
export const getSeatAssignments = (venueBoxId, { eventId, sessionId }) =>
  apiClient.get(ENDPOINTS.seating.byBox(venueBoxId), {
    params: { eventId, sessionId: sessionId || undefined },
  });

// Every seat this participation currently holds (across sessions/scopes) — row
// shape: { eventTitle, sessionTitle (nullable), seatCode }. Used to warn before
// deleting a seated guest (see DeleteGuestsModal).
export const getGuestSeatAssignments = (eventGuestId) =>
  apiClient.get(ENDPOINTS.seating.byGuest(eventGuestId));
