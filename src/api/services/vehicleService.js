import { apiClient } from '../apiClient';
import { ENDPOINTS } from '../endpoints';

// Rows come back as { id, vehicleTypeId, vehicleTypeName, vehicleModel,
// vehicleNumber, vehicleImage, capacity }.
export const getVehicles = () => apiClient.get(ENDPOINTS.vehicles.base);

export const getVehicle = (id) => apiClient.get(ENDPOINTS.vehicles.byId(id));

// Body: { vehicleTypeId (VehicleType public guid), vehicleModel, vehicleNumber,
// vehicleImage?, capacity? }. Upload the image via uploadService first and send
// back the returned url.
export const createVehicle = (body) => apiClient.post(ENDPOINTS.vehicles.base, body);

export const updateVehicle = (id, body) => apiClient.put(ENDPOINTS.vehicles.byId(id), body);

export const deleteVehicle = (id) => apiClient.delete(ENDPOINTS.vehicles.byId(id));
