import { apiClient } from '../apiClient';
import { ENDPOINTS } from '../endpoints';

// Create a flight/hotel/ground-transfer booking for a guest.
export const createBooking = (body) => apiClient.post(ENDPOINTS.travelLogistics.createBooking, body);

// ── Admin travel tabs: per-event booking lists (one call per active tab) ─────
export const getEventFlights       = (eventId) => apiClient.get(ENDPOINTS.travel.eventFlights(eventId));
export const getEventAccommodation = (eventId) => apiClient.get(ENDPOINTS.travel.eventAccommodation(eventId));
export const getEventTransport     = (eventId) => apiClient.get(ENDPOINTS.travel.eventTransport(eventId));

// ── Guest travel (flight / accommodation / transport) ────────────────────────

// Separate GET per lookup — each reads its own table.
export const getFlightTypes   = () => apiClient.get(ENDPOINTS.travel.flightTypes);
export const getFlightClasses = () => apiClient.get(ENDPOINTS.travel.flightClasses);
export const getRoomTypes     = () => apiClient.get(ENDPOINTS.travel.roomTypes);
export const getVehicleTypes  = () => apiClient.get(ENDPOINTS.travel.vehicleTypes);
export const getHotels        = () => apiClient.get(ENDPOINTS.travel.hotels);
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

// Prefill for edit — { flight?, accommodation?, transport? } (sections may be null).
export const getGuestTravel = (guestId) => apiClient.get(ENDPOINTS.travel.guest(guestId));

// Save only the sections the admin selected — send { flight?, accommodation?, transport? }
// with the unused sections omitted.
export const saveGuestTravel = (guestId, body) =>
  apiClient.post(ENDPOINTS.travel.guest(guestId), body);

// ── Create wizard-dropdown lookup records ────────────────────────────────────
// Name-only lookups return { id, name }; hotel returns { id, name, address }.
export const createFlightType  = (name)          => apiClient.post(ENDPOINTS.travel.flightTypes,  { name });
export const createFlightClass = (name)          => apiClient.post(ENDPOINTS.travel.flightClasses, { name });
export const createRoomType    = (name)          => apiClient.post(ENDPOINTS.travel.roomTypes,    { name });
export const createVehicleType = (name)          => apiClient.post(ENDPOINTS.travel.vehicleTypes, { name });
export const createHotel       = (name, address) => apiClient.post(ENDPOINTS.travel.hotels,       { name, address });

// Airport: { code, city, country, continent, locationId? }.
export const createAirport     = (body)          => apiClient.post(ENDPOINTS.lookups.airports, body);
