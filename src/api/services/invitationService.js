import { apiClient } from '../apiClient';
import { ENDPOINTS } from '../endpoints';

// Public endpoints — reached from the no-login invitation page. No auth token
// is present on the guest's device; the backend routes are [AllowAnonymous].
export const getInvitation = (token) => apiClient.get(ENDPOINTS.invitation.byToken(token));

export const respondToInvitation = (token, accept) =>
  apiClient.post(ENDPOINTS.invitation.respond(token), { accept });
