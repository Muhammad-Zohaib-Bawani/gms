// Account-request admin service (review queue). Public submit lives in
// authService.requestAccount.
import { apiClient } from '../apiClient';
import { ENDPOINTS } from '../endpoints';

export function listAccountRequests({ pageNumber = 1, pageSize = 20, search, status = 'pending' } = {}) {
  return apiClient.get(ENDPOINTS.accountRequests.base, {
    params: { pageNumber, pageSize, search: search || undefined, status: status || undefined },
  });
}

export const approveAccountRequest = (id, roleId, reviewNote) =>
  apiClient.post(ENDPOINTS.accountRequests.approve(id), { roleId, reviewNote });

export const rejectAccountRequest = (id, reviewNote) =>
  apiClient.post(ENDPOINTS.accountRequests.reject(id), { reviewNote });
