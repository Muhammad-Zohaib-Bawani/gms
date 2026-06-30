// Roles service (read used by the account-request approval dropdown).
import { apiClient } from '../apiClient';
import { ENDPOINTS } from '../endpoints';

export const listRoles = () => apiClient.get(ENDPOINTS.roles.base);
