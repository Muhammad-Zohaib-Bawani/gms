import { apiClient } from '../apiClient';
import { ENDPOINTS } from '../endpoints';

// ── Admin travel tabs: per-event booking lists (one call per active tab) ─────
// Paged like GET /guest — returns { items, totalCount, pageNumber, pageSize }.
// The tabs group bookings by guest client-side, so they pull one large page
// rather than paging server-side (a guest's bookings must not straddle pages);
// DataTable then paginates what's on screen.
const TAB_PAGE_SIZE = 200;

const pagedParams = ({ pageNumber = 1, pageSize = TAB_PAGE_SIZE, search } = {}) =>
  ({ params: { pageNumber, pageSize, searchTerm: search || undefined } });

export const getEventFlights       = (eventId, opts) => apiClient.get(ENDPOINTS.travel.eventFlights(eventId), pagedParams(opts));
export const getEventAccommodation = (eventId, opts) => apiClient.get(ENDPOINTS.travel.eventAccommodation(eventId), pagedParams(opts));
export const getEventTransport     = (eventId, opts) => apiClient.get(ENDPOINTS.travel.eventTransport(eventId), pagedParams(opts));

// Arrivals & departures — one row per guest, pairing their inbound and outbound
// flights. Unlike the tabs above this pages by GUEST server-side, so a page can
// never split a guest's flights and true server pagination is safe.
// direction: 'all' | 'inbound' | 'outbound'.
// fromDate/toDate are inclusive 'YYYY-MM-DD' bounds on the flight's legs.
export const getEventArrivalsDepartures = (
  eventId,
  { pageNumber = 1, pageSize = 10, search, direction = 'all', fromDate, toDate } = {},
) =>
  apiClient.get(ENDPOINTS.travel.eventArrivalsDepartures(eventId), {
    params: {
      pageNumber, pageSize, direction,
      searchTerm: search || undefined,
      fromDate: fromDate || undefined,
      toDate: toDate || undefined,
    },
  });

// ── Guest travel (flight / accommodation / transport) ────────────────────────

// Separate GET per lookup — each reads its own table.
export const getFlightTypes   = () => apiClient.get(ENDPOINTS.lookups.flightTypes);
export const getFlightClasses = () => apiClient.get(ENDPOINTS.lookups.flightClasses);
export const getRoomTypes     = () => apiClient.get(ENDPOINTS.lookups.roomTypes);
export const getVehicleTypes  = () => apiClient.get(ENDPOINTS.lookups.vehicleTypes);
export const getHotels        = () => apiClient.get(ENDPOINTS.lookups.hotels);
export const getLocations     = () => apiClient.get(ENDPOINTS.lookups.locations);
export const getAirports      = () => apiClient.get(ENDPOINTS.lookups.airports);
export const getDrivers       = () => apiClient.get(ENDPOINTS.lookups.drivers);

// Fills every wizard dropdown by calling the lookup endpoints in parallel.
export const getTravelLookups = async () => {
  const [flightTypes, flightClasses, roomTypes, vehicleTypes, hotels, locations, airports, drivers] = await Promise.all([
    getFlightTypes(), getFlightClasses(), getRoomTypes(), getVehicleTypes(), getHotels(), getLocations(),
    // ponytail: one failing lookup shouldn't blank every other dropdown (Promise.all is all-or-nothing).
    getAirports().catch(() => []),
    getDrivers().catch(() => []),
  ]);
  return { flightTypes, flightClasses, roomTypes, vehicleTypes, hotels, locations, airports, drivers };
};

// Prefill for edit — { flight?, accommodation?, transport? } (sections may be
// null, or may not be the guest's only booking of that kind — each Input's
// `id` says which specific booking this is, so saving it back updates that
// one in place instead of duplicating it).
export const getGuestTravel = (guestId) => apiClient.get(ENDPOINTS.travel.guest(guestId));

// Save the selected sections — send { flight?, accommodation?, transport? }
// with the unused sections omitted. Include a section's `id` to update that
// exact booking in place; omit it to add a new one for the guest.
export const saveGuestTravel = (guestId, body) =>
  apiClient.post(ENDPOINTS.travel.guest(guestId), body);

// Remove one specific booking (a guest may have several of a kind).
export const deleteFlight       = (id) => apiClient.delete(ENDPOINTS.travel.deleteFlight(id));
export const deleteAccommodation = (id) => apiClient.delete(ENDPOINTS.travel.deleteAccommodation(id));
export const deleteTransport    = (id) => apiClient.delete(ENDPOINTS.travel.deleteTransport(id));

// ── Create wizard-dropdown lookup records ────────────────────────────────────
// Name-only lookups return { id, name }; hotel returns { id, name, address }.
export const createFlightType  = (name)          => apiClient.post(ENDPOINTS.lookups.flightTypes,  { name });
export const createFlightClass = (name)          => apiClient.post(ENDPOINTS.lookups.flightClasses, { name });
export const createRoomType    = (name)          => apiClient.post(ENDPOINTS.lookups.roomTypes,    { name });
export const createVehicleType = (name)          => apiClient.post(ENDPOINTS.lookups.vehicleTypes, { name });
export const createHotel       = (name, address) => apiClient.post(ENDPOINTS.lookups.hotels,       { name, address });

// Airport: { code, city, country, continent, locationId? }.
export const createAirport     = (body)          => apiClient.post(ENDPOINTS.lookups.airports, body);
