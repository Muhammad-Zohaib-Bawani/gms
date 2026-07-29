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

// PUT /v1/users/{id} — firstName, lastName, phone, roleId, isActive.
// Email is immutable (it's the sign-in identity), so it isn't sent.
export const updateUser = (userId, payload) => apiClient.put(ENDPOINTS.users.byId(userId), payload);

// Admin-only invite flow — no password is set until the invitee accepts by email.
export const inviteUser = (payload) => apiClient.post(ENDPOINTS.users.invite, payload);
export const getPendingUsers = () => apiClient.get(ENDPOINTS.users.pending);
export const resendInvite = (userId) => apiClient.post(ENDPOINTS.users.resendInvite(userId));

// Distinct from the user's own change-password flow: no current-password
// check, for when a user forgot theirs and an admin sets a new one directly.
export const adminSetPassword = (userId, newPassword) =>
  apiClient.post(ENDPOINTS.users.setPassword(userId), { newPassword });