import { apiClient } from '../apiClient';
import { ENDPOINTS } from '../endpoints';

// Public endpoints — reached from the no-login invite-accept page. No auth
// token is present on the invitee's device; the backend routes are [AllowAnonymous].
export const getUserInvite = (token) => apiClient.get(ENDPOINTS.userInvite.byToken(token));

export const acceptUserInvite = (token, password, confirmPassword) =>
  apiClient.post(ENDPOINTS.userInvite.accept(token), { password, confirmPassword });
