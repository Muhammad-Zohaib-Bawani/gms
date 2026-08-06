import { apiClient } from '../apiClient';
import { ENDPOINTS } from '../endpoints';
import { getVehicles } from './vehicleService';
import { getContractedHotels } from './accommodationInventoryService';

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

// Separate GET per lookup — each reads its own table, except flight types which
// are a code-defined enum: [{ code, name, nameAr }].
export const getFlightTypes   = () => apiClient.get(ENDPOINTS.lookups.flightTypes);
export const getFlightClasses = () => apiClient.get(ENDPOINTS.lookups.flightClasses);
export const getRoomTypes     = () => apiClient.get(ENDPOINTS.lookups.roomTypes);
export const getVehicleTypes  = () => apiClient.get(ENDPOINTS.lookups.vehicleTypes);
export const getHotels        = () => apiClient.get(ENDPOINTS.lookups.hotels);
export const getLocations     = () => apiClient.get(ENDPOINTS.lookups.locations);
export const getAirports      = () => apiClient.get(ENDPOINTS.lookups.airports);
// No args = the full fixed-driver roster. Pass from (+ optional to) to get only
// drivers with no ride over that window, and excludeTransportId for the ride
// being edited so its own driver stays in the list.
export const getDrivers = ({ from, to, excludeTransportId } = {}) =>
  apiClient.get(ENDPOINTS.lookups.drivers, {
    params: { from: from || undefined, to: to || undefined, excludeTransportId: excludeTransportId || undefined },
  });

// Transport is assigned a concrete vehicle (not just a category) — the fleet
// list comes from the vehicles module.
export { getVehicles };

// Fills every wizard dropdown by calling the lookup endpoints in parallel. Pass
// eventId to scope the two event-specific lists: vehicles to this event's fleet
// (its providers' cars plus in-house ones), hotels to the ones it holds a
// contract with. `roomTypes` stays the global list — the accommodation form
// narrows it per hotel once one is picked (useHotelRoomTypes).
export const getTravelLookups = async (eventId) => {
  const [flightTypes, flightClasses, roomTypes, vehicles, hotels, locations, airports, drivers] = await Promise.all([
    getFlightTypes(), getFlightClasses(), getRoomTypes(), getVehicles(eventId),
    // An event with no contracts yet would leave the hotel dropdown empty, which
    // is correct — add the contract on Accommodation › Inventory first.
    eventId ? getContractedHotels(eventId) : getHotels(),
    getLocations(),
    // ponytail: one failing lookup shouldn't blank every other dropdown (Promise.all is all-or-nothing).
    getAirports().catch(() => []),
    getDrivers().catch(() => []),
  ]);
  return { flightTypes, flightClasses, roomTypes, vehicles, hotels, locations, airports, drivers };
};

// Prefill for edit — { flight?, accommodation?, transport? }. Pass bookingId to
// prefill that exact booking (Services' per-row Edit); without it the most
// recent booking of each kind comes back (the guest wizard's accordion). Each
// section's `id` says which booking it is, so saving updates it in place.
export const getGuestTravel = (guestId, bookingId) =>
  apiClient.get(ENDPOINTS.travel.guest(guestId), bookingId ? { params: { bookingId } } : undefined);

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
export const createFlightClass = (name)          => apiClient.post(ENDPOINTS.lookups.flightClasses, { name });
export const createRoomType    = (name)          => apiClient.post(ENDPOINTS.lookups.roomTypes,    { name });
export const createVehicleType = (name)          => apiClient.post(ENDPOINTS.lookups.vehicleTypes, { name });
// { name, address?, imageUrl? } — imageUrl must already have its SAS token stripped.
export const createHotel       = (body)          => apiClient.post(ENDPOINTS.lookups.hotels, body);
// Same body as create: { name, address, imageUrl?, locationId? }. Address is
// required both ways — the VIP app shows it on the guest's accommodation screen.
export const updateHotel       = (id, body)      => apiClient.put(ENDPOINTS.lookups.hotelById(id), body);

// Airport: { code, city, country, continent, locationId? }.
export const createAirport     = (body)          => apiClient.post(ENDPOINTS.lookups.airports, body);
