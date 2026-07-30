import { apiClient } from '../apiClient';
import { ENDPOINTS } from '../endpoints';

// Row shape: { id, userId, title, message, type, read, createdAt, redirectUrl, data }.
export const getNotifications = ({ pageNumber = 1, pageSize = 10 } = {}) =>
  apiClient.get(ENDPOINTS.notifications.base, { params: { pageNumber, pageSize } });

export const getUnreadCount = () => apiClient.get(ENDPOINTS.notifications.count);

export const markAllNotificationsRead = () => apiClient.put(ENDPOINTS.notifications.markAllRead);

export const markNotificationRead = (id) => apiClient.put(ENDPOINTS.notifications.markRead(id));

export const markNotificationUnread = (id) => apiClient.put(ENDPOINTS.notifications.markUnread(id));

export const deleteNotification = (id) => apiClient.delete(ENDPOINTS.notifications.byId(id));
