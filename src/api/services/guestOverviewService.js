import { apiClient } from '../apiClient';
import { ENDPOINTS } from '../endpoints';

// System-wide guest table (Guest Overview). Server-paged/filtered/searched —
// same reasoning as listGuests: filtering client-side would only ever act on
// the current page. eventId here is an optional filter, not a scope.
export function getGuestOverview({
  pageNumber = 1, pageSize = 25, search, sortBy, sortDescending,
  eventId, serviceLevelId, organizationId, nationalityId, sessionId,
  guestType, tier, invitationStatus, accreditationStatus,
  hasFlight, hasAccommodation, hasTransport, hasPendingServices,
  arrivalFrom, arrivalTo, departureFrom, departureTo,
} = {}) {
  return apiClient.get(ENDPOINTS.guestOverview.base, {
    params: {
      pageNumber, pageSize,
      searchTerm: search || undefined,
      sortBy: sortBy || undefined,
      sortDescending: sortDescending || undefined,
      eventId: eventId || undefined,
      serviceLevelId: serviceLevelId || undefined,
      organizationId: organizationId || undefined,
      nationalityId: nationalityId || undefined,
      sessionId: sessionId || undefined,
      guestType: guestType || undefined,
      tier: tier || undefined,
      invitationStatus: invitationStatus || undefined,
      accreditationStatus: accreditationStatus || undefined,
      hasFlight: hasFlight ?? undefined,
      hasAccommodation: hasAccommodation ?? undefined,
      hasTransport: hasTransport ?? undefined,
      hasPendingServices: hasPendingServices ?? undefined,
      arrivalFrom: arrivalFrom || undefined,
      arrivalTo: arrivalTo || undefined,
      departureFrom: departureFrom || undefined,
      departureTo: departureTo || undefined,
    },
  }); // -> PaginatedResponse<GuestOverviewRow>
}

// Fetched only when a row expands — sections: event, sessions, flights,
// accommodations, transport, seatings, otherServices.
export const getGuestOverviewDetail = (id) => apiClient.get(ENDPOINTS.guestOverview.byId(id));
