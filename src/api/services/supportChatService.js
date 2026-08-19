import { apiClient } from '../apiClient';
import { ENDPOINTS } from '../endpoints';

// Admin inbox — paged + searchable, same envelope as GET /guest:
// { items, totalCount, pageNumber, pageSize }. Ordered server-side
// unread-first, then most-recently-active (SupportChatService.GetConversationsAsync).
// Row shape: { id, guestId, guestName, guestEmail, status, lastMessagePreview,
// lastMessageAt, lastMessageFromGuest, unreadCount }. `guestId` here is the
// PERSON id (Guest.PublicId / GuestResponse.personId) — support chat is one
// thread per human, so it is never an eventGuestId.
export const getConversations = ({
  pageNumber = 1, pageSize = 10, search, onlyUnread, status, organizationId, nationalityId, tier,
} = {}) =>
  apiClient.get(ENDPOINTS.supportChat.conversations, {
    params: {
      pageNumber, pageSize,
      searchTerm: search || undefined,
      onlyUnread: onlyUnread || undefined,
      status: status || undefined,
      organizationId: organizationId || undefined,
      nationalityId: nationalityId || undefined,
      tier: tier || undefined,
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

// `message` = { body, attachmentUrl?, attachmentType? } — body may be empty
// HTML/string when an attachment is present, but not both empty (backend
// rejects that). Returns the created SupportMessageResponse, which now also
// carries `conversationId`.
export const replyToConversation = (conversationId, message) =>
  apiClient.post(ENDPOINTS.supportChat.messages(conversationId), message);

// Admin-initiated: no conversation needs to exist for this person yet. Safe to
// call even if one already does (e.g. the admin's local list was stale) — the
// backend just continues that thread instead of erroring or duplicating it.
// Takes the PERSON id (`GuestResponse.personId`), not an eventGuestId: a guest
// has one support thread across all their events.
export const startConversationWithGuest = (personId, message) =>
  apiClient.post(ENDPOINTS.supportChat.startByGuest(personId), message);

// Marks every unread *guest* message in this conversation read (admin's side).
export const markConversationRead = (conversationId) =>
  apiClient.post(ENDPOINTS.supportChat.read(conversationId));

export const closeConversation = (conversationId) =>
  apiClient.post(ENDPOINTS.supportChat.close(conversationId));

export const reopenConversation = (conversationId) =>
  apiClient.post(ENDPOINTS.supportChat.reopen(conversationId));
