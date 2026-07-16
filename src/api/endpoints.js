// All API endpoint paths in one place. Services reference these constants
// instead of hard-coding URLs, so a route change is a one-line edit here.
// Paths are relative to API_BASE_URL (default "/api").

export const ENDPOINTS = {
  auth: {
    login: '/v1/auth/login',
    refresh: '/v1/auth/refresh',
    logout: '/v1/auth/logout',
    forgotPassword: '/v1/auth/forgot-password',
    resetPassword: '/v1/auth/reset-password',
    verifyOtp: '/v1/auth/verify-otp',
    resendOtp: '/v1/auth/resend-otp',
    register: '/v1/auth/register', // self-service account request (pending approval)
    requestableRoles: '/v1/auth/roles', // public: roles a person may request
  },

  // Admin review queue for self-service account requests.
  accountRequests: {
    base: '/v1/account-requests',
    byId: (id) => `/v1/account-requests/${id}`,
    approve: (id) => `/v1/account-requests/${id}/approve`,
    reject: (id) => `/v1/account-requests/${id}/reject`,
  },

  users: {
    base: '/v1/users',
    byId: (id) => `/v1/users/${id}`,
    changePassword: (id) => `/v1/users/${id}/change-password`,
    deleteUser: (id) => `/v1/users/${id}`,
  },

  // Per-user cross-module read access (admin only).
  userAccess: {
    byUser: (userId) => `/v1/user-access/${userId}`,
  },

  roles: { base: '/v1/roles', byId: (id) => `/v1/roles/${id}` },
  permissions: { base: '/v1/permissions' },

  events: {
    base: '/v1/events',
    byId: (id) => `/v1/events/${id}`,
    status: (id) => `/v1/events/${id}/status`,
    sessions: (id) => `/v1/events/${id}/sessions`,
    session: (id, sessionId) => `/v1/events/${id}/sessions/${sessionId}`,
  },

  guests: {
    base: '/v1/guest',
    byId: (id) => `/v1/guest/${id}`,
    import: (eventId) => `/v1/guest/import?eventId=${eventId}`,
    deleteSelected: (eventId) => `/v1/guest/delete?eventId=${eventId}`,
  },

  nationalities: {
    base: '/v1/nationality',
  },

  invitationTemplates: {
    base: '/v1/invitation-templates',
    byId: (id) => `/v1/invitation-templates/${id}`,
  },

  lookups: {
    categories: '/v1/lookups/categories',
    items: (categoryCode) => `/v1/lookups/${categoryCode}/items`,
    createItem: '/v1/lookups/items',
    itemById: (id) => `/v1/lookups/items/${id}`,
    guestEnums: '/v1/lookups/enums/guest',
  },

  venues: {
    base: '/v1/venue',
    byId: (id) => `/v1/venue/${id}`,
    box: '/v1/venue/box',
    boxById: (id) => `/v1/venue/box/${id}`,
    // Adds one more block to whichever VenueBox already exists for this event.
    addBlock: (eventId) => `/v1/venue/${eventId}`,
  },

  seating: {
    assign: '/v1/seating',
    unassign: (seatId) => `/v1/seating/${seatId}`,
    byBox: (venueBoxId) => `/v1/seating/box/${venueBoxId}`,
  },

  meetings: {
    base: '/v1/meeting',
    // The route param is named "id" backend-side, but it's really the eventId —
    // this returns every meeting scoped to that event, not one meeting by its own id.
    byEvent: (eventId) => `/v1/meeting/${eventId}`,
  },
};
