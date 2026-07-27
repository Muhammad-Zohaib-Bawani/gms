import { apiClient } from '../apiClient';
import { ENDPOINTS } from '../endpoints';

// ── Admin travel tabs: per-event booking lists (one call per active tab) ─────
export const getEventFlights       = (eventId) => apiClient.get(ENDPOINTS.travel.eventFlights(eventId));
export const getEventAccommodation = (eventId) => apiClient.get(ENDPOINTS.travel.eventAccommodation(eventId));
export const getEventTransport     = (eventId) => apiClient.get(ENDPOINTS.travel.eventTransport(eventId));

// ── Guest travel (flight / accommodation / transport) ────────────────────────

// Separate GET per lookup — each reads its own table.
export const getFlightTypes   = () => apiClient.get(ENDPOINTS.lookups.flightTypes);
export const getFlightClasses = () => apiClient.get(ENDPOINTS.lookups.flightClasses);
export const getRoomTypes     = () => apiClient.get(ENDPOINTS.lookups.roomTypes);
export const getVehicleTypes  = () => apiClient.get(ENDPOINTS.lookups.vehicleTypes);
export const getHotels        = () => apiClient.get(ENDPOINTS.lookups.hotels);
export const getLocations     = () => apiClient.get(ENDPOINTS.lookups.locations);
export const getAirports      = () => apiClient.get(ENDPOINTS.lookups.airports);

// Fills every wizard dropdown by calling the endpoints in parallel.
export const getTravelLookups = async () => {
  const [flightTypes, flightClasses, roomTypes, vehicleTypes, hotels, locations, airports] = await Promise.all([
    getFlightTypes(), getFlightClasses(), getRoomTypes(), getVehicleTypes(), getHotels(), getLocations(), getAirports(),
  ]);
  return { flightTypes, flightClasses, roomTypes, vehicleTypes, hotels, locations, airports };
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
export const createAirport     = (code, city, country, continent) =>
  apiClient.post(ENDPOINTS.lookups.airports, { code, city, country, continent });
