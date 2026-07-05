import { apiClient } from '../apiClient';
import { ENDPOINTS } from '../endpoints';

export async function getUserModuleAccess(userId) {
  return apiClient.get(ENDPOINTS.userAccess.byUser(userId));
}

export async function setUserModuleAccess(userId, grantedModules) {
  return apiClient.put(ENDPOINTS.userAccess.byUser(userId), { grantedModules });
}

export async function getAllUsers() {
  return apiClient.get(ENDPOINTS.users.base);
}

export async function deleteUser(userId) {
  return apiClient.delete(ENDPOINTS.users.deleteUser(userId));
}