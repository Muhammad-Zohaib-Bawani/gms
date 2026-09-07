import { apiClient } from '../apiClient';
import { ENDPOINTS } from '../endpoints';

// Rows come back as { id, name, nameAr, code, locationId, address, latitude, longitude }.
export const getOrganizations = () => apiClient.get(ENDPOINTS.organizations.base);

export const getOrganization = (id) => apiClient.get(ENDPOINTS.organizations.byId(id));

// Body: { name, nameAr?, code, location: { latitude, longitude, address? } }.
// The backend writes the Location row (type "organization") as part of the same
// save — don't create it separately first.
export const createOrganization = (body) => apiClient.post(ENDPOINTS.organizations.base, body);

export const updateOrganization = (id, body) => apiClient.put(ENDPOINTS.organizations.byId(id), body);

export const deleteOrganization = (id) => apiClient.delete(ENDPOINTS.organizations.byId(id));
