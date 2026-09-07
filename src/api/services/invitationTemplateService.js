import { apiClient } from '../apiClient';
import { ENDPOINTS } from '../endpoints';

export const getTemplates = (eventId) =>
  apiClient.get(ENDPOINTS.invitationTemplates.base, { params: { eventId } });

export const createTemplate = (body) =>
  apiClient.post(ENDPOINTS.invitationTemplates.base, body);

export const updateTemplate = (id, body) =>
  apiClient.put(ENDPOINTS.invitationTemplates.byId(id), body);

export const deleteTemplate = (id) =>
  apiClient.delete(ENDPOINTS.invitationTemplates.byId(id));
