import { apiClient } from '../apiClient';
import { ENDPOINTS } from '../endpoints';

// ── Contracts: which hotels this event may use ────────────────────────────────
// Rows: { id, eventId, hotelId, hotelName, hotelAddress, hotelImageUrl, notes,
//         inventoryCount, totalRooms }.
export const getHotelContracts = (eventId) =>
  apiClient.get(ENDPOINTS.accommodationInventory.contracts(eventId));

// Body: { hotelId, notes? }.
export const createHotelContract = (eventId, body) =>
  apiClient.post(ENDPOINTS.accommodationInventory.contracts(eventId), body);

// Body: { notes? } — the hotel can't be changed, since every room block under the
// contract would silently move with it.
export const updateHotelContract = (eventId, id, body) =>
  apiClient.put(ENDPOINTS.accommodationInventory.contract(eventId, id), body);

export const deleteHotelContract = (eventId, id) =>
  apiClient.delete(ENDPOINTS.accommodationInventory.contract(eventId, id));

// ── Room blocks ───────────────────────────────────────────────────────────────
// Rows: { id, contractId, hotelId, hotelName, roomTypeId, roomTypeName,
//         roomCount, fromDate, toDate, nights, notes }.
// fromDate/toDate are INCLUSIVE NIGHTS — first night held and last night held.
export const getRoomInventory = (eventId, hotelId) =>
  apiClient.get(ENDPOINTS.accommodationInventory.inventory(eventId), hotelId ? { params: { hotelId } } : undefined);

// Body: { contractId, roomTypeId, roomCount, fromDate, toDate, notes? }.
export const createRoomInventory = (eventId, body) =>
  apiClient.post(ENDPOINTS.accommodationInventory.inventory(eventId), body);

// Body: same minus contractId — a block never moves hotel.
export const updateRoomInventory = (eventId, id, body) =>
  apiClient.put(ENDPOINTS.accommodationInventory.inventoryById(eventId, id), body);

export const deleteRoomInventory = (eventId, id) =>
  apiClient.delete(ENDPOINTS.accommodationInventory.inventoryById(eventId, id));

// ── Booking-form feeds ────────────────────────────────────────────────────────

// Hotels contracted for the event, in the same shape as the global hotel lookup.
export const getContractedHotels = (eventId) =>
  apiClient.get(ENDPOINTS.accommodationInventory.hotels(eventId));

// Room types with rooms held at that hotel. Empty = unmanaged hotel, so callers
// fall back to the global room-type lookup.
export const getHotelRoomTypes = (eventId, hotelId) =>
  apiClient.get(ENDPOINTS.accommodationInventory.hotelRoomTypes(eventId, hotelId));

// { from, to, series: [{ hotelId, hotelName, roomTypeId, roomTypeName,
//   nights: [{ date, total, booked, available }] }] }.
// Every series shares one date axis (from → to), so grid columns line up and any
// subtotal is just a column-wise sum of the series you're showing.
// Pass a hotel + room type to get just that pair (the booking form's blocked
// dates); pass neither for the whole event (the Inventory grid). An empty
// `series` means nothing is held for that scope, so nothing is enforced.
export const getRoomAvailability = (eventId, hotelId, roomTypeId) =>
  apiClient.get(ENDPOINTS.accommodationInventory.availability(eventId), {
    params: { hotelId: hotelId || undefined, roomTypeId: roomTypeId || undefined },
  });
