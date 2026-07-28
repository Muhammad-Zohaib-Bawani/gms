import { apiClient } from '../apiClient';
import { ENDPOINTS } from '../endpoints';

// Admin inbox — paged + searchable, same envelope as GET /guest:
// { items, totalCount, pageNumber, pageSize }. Ordered server-side
// unread-first, then most-recently-active (SupportChatService.GetConversationsAsync).
// Row shape: { id, guestId, guestName, guestEmail, status, lastMessagePreview,
// lastMessageAt, lastMessageFromGuest, unreadCount }.
export const getConversations = ({ pageNumber = 1, pageSize = 10, search, onlyUnread, status } = {}) =>
  apiClient.get(ENDPOINTS.supportChat.conversations, {
    params: {
      pageNumber, pageSize,
      searchTerm: search || undefined,
      onlyUnread: onlyUnread || undefined,
      status: status || undefined,
    },
  });

// Messages come back oldest-first within the requested window (the backend
// takes the most recent `pageSize` by SentAt desc, then reverses them) — so
// "load earlier history" is done by re-requesting page 1 with a larger
// pageSize, not by walking to page 2. Row shape: { id, body, fromGuest, sentAt,
// isRead, readAt, attachmentUrl, attachmentType, senderName }.
export const getMessages = (conversationId, { pageSize = 50 } = {}) =>
  apiClient.get(ENDPOINTS.supportChat.messages(conversationId), {
    params: { pageNumber: 1, pageSize },
  });

// Returns the created SupportMessageResponse.
export const replyToConversation = (conversationId, body) =>
  apiClient.post(ENDPOINTS.supportChat.messages(conversationId), { body });

// Marks every unread *guest* message in this conversation read (admin's side).
export const markConversationRead = (conversationId) =>
  apiClient.post(ENDPOINTS.supportChat.read(conversationId));

export const closeConversation = (conversationId) =>
  apiClient.post(ENDPOINTS.supportChat.close(conversationId));

export const reopenConversation = (conversationId) =>
  apiClient.post(ENDPOINTS.supportChat.reopen(conversationId));
