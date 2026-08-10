import { apiClient } from '../apiClient';
import { ENDPOINTS } from '../endpoints';

// Rows come back as { id, vehicleTypeId, vehicleTypeName, fleetProviderId,
// fleetProviderName, eventId, vehicleModel, vehicleNumber, vehicleImage, capacity }.
// Pass eventId to see only what this event can use — its providers' cars plus
// in-house ones (a vehicle inherits its event from its provider).
export const getVehicles = (eventId) =>
  apiClient.get(ENDPOINTS.vehicles.base, eventId ? { params: { eventId } } : undefined);

// The same list minus anything already booked over [from, to). `to` is optional
// (the server falls back to its default ride duration). Pass the transport being
// edited as excludeTransportId so its own vehicle stays in the list.
export const getAvailableVehicles = ({ from, to, eventId, excludeTransportId }) =>
  apiClient.get(ENDPOINTS.vehicles.available, {
    params: { from, to: to || undefined, eventId: eventId || undefined, excludeTransportId: excludeTransportId || undefined },
  });

// One row per booked slot: { id, vehicleId, vehicleNumber, vehicleModel,
// vehicleTypeName, vehicleImage, fleetProviderName, driverId, driverName,
// driverPhone, guestId, guestName, guestEmail, guestPhotoUrl, pickupTime,
// dropoffTime, pickup, dropoff, status, rideSource }. Sorted by vehicle, then
// time. Cancelled rides excluded.
export const getVehicleBookings = ({ eventId, from, to, vehicleId, driverId } = {}) =>
  apiClient.get(ENDPOINTS.vehicles.bookings, {
    params: {
      eventId: eventId || undefined,
      from: from || undefined,
      to: to || undefined,
      vehicleId: vehicleId || undefined,
      driverId: driverId || undefined,
    },
  });

export const getVehicle = (id) => apiClient.get(ENDPOINTS.vehicles.byId(id));

// Body: { vehicleTypeId (VehicleType public guid), fleetProviderId?,
// vehicleModel, vehicleNumber, vehicleImage?, capacity? }. Upload the image via
// uploadService first and send back the returned url.
export const createVehicle = (body) => apiClient.post(ENDPOINTS.vehicles.base, body);

export const updateVehicle = (id, body) => apiClient.put(ENDPOINTS.vehicles.byId(id), body);

export const deleteVehicle = (id) => apiClient.delete(ENDPOINTS.vehicles.byId(id));
