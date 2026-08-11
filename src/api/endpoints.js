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
  },

  // Public (no login) invite-accept flow — mirrors the guest invitation pattern.
  userInvite: {
    byToken: (token) => `/v1/user-invite/${token}`,
    accept: (token) => `/v1/user-invite/${token}/accept`,
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
    invite: '/v1/users/invite',
    pending: '/v1/users/pending',
    resendInvite: (id) => `/v1/users/${id}/resend-invite`,
    setPassword: (id) => `/v1/users/${id}/set-password`,
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
    importTemplate: '/v1/events/import-template',
    import: '/v1/events/import',
    importBatch: (batchId) => `/v1/events/import/${batchId}`,
    types: '/v1/events/types',
  },

  // Guest Overview — every guest, every event, one paged/filterable list, plus
  // an on-demand per-guest detail (sections: event, sessions, flights,
  // accommodations, transport, seatings, other dynamic services).
  guestOverview: {
    base: '/v1/guest-overview',
    byId: (id) => `/v1/guest-overview/${id}`,
  },

  guests: {
    base: '/v1/guest',
    byId: (id) => `/v1/guest/${id}`,
    // Slim feed for guest pickers — name/org/tier/photo, searched + paged server-side.
    picker: '/v1/guest/picker',
    // "Existing Guest" tab of the Add Guest modal — guests from every other event.
    otherEvents: '/v1/guest/other-events',
    import: (eventId) => `/v1/guest/import?eventId=${eventId}`,
    importBatch: (batchId) => `/v1/guest/import/${batchId}`,
    importTemplate: (eventId) => `/v1/guest/import-template?eventId=${eventId}`,
    deleteSelected: (eventId) => `/v1/guest/delete?eventId=${eventId}`,
    issueAccreditation: (id) => `/v1/guest/${id}/accreditation/issue`,
    revokeAccreditation: (id) => `/v1/guest/${id}/accreditation/revoke`,
  },

  upload: {
    image: '/v1/upload/image',
  },

  nationalities: {
    base: '/v1/nationality',
  },

  // Service catalogue + the guest grades built from it. Global in v2: a service
  // and a level are defined once and available to every event, Fixed or
  // Flexible. See docs/service-levels-v2.md.
  services: {
    base: '/v1/services',
    byId: (id) => `/v1/services/${id}`,
    entries: (id) => `/v1/services/${id}/entries`,
  },
  serviceLevels: {
    base: '/v1/service-levels',
    byId: (id) => `/v1/service-levels/${id}`,
  },
  guestServices: {
    base: (guestId) => `/v1/guests/${guestId}/services`,
    entry: (guestId, entryId) => `/v1/guests/${guestId}/services/${entryId}`,
  },

  // Reads are open to any signed-in user (so any module can fill an org
  // dropdown); writes require Organizations.Manage.
  organizations: {
    base: '/v1/organizations',
    byId: (id) => `/v1/organizations/${id}`,
  },

  // Fleet vehicles. Reads open to any signed-in user; writes need Travel.Manage.
  vehicles: {
    base: '/v1/vehicles',
    byId: (id) => `/v1/vehicles/${id}`,
    // Vehicles free over a time window — the booking forms' dropdown feed.
    available: '/v1/vehicles/available',
    // Which vehicle is booked when, and with which driver.
    bookings: '/v1/vehicles/bookings',
  },

  // Companies that supply fleet vehicles, contracted per event — hence nested
  // under the event, like the service catalog. Same access split as vehicles.
  fleetProviders: {
    base: (eventId) => `/v1/events/${eventId}/fleet-providers`,
    byId: (eventId, id) => `/v1/events/${eventId}/fleet-providers/${id}`,
  },

  // Per-event hotel contracts + the room blocks held under them. Hotels and room
  // types themselves stay global lookups.
  accommodationInventory: {
    contracts: (eventId) => `/v1/events/${eventId}/accommodation/contracts`,
    contract: (eventId, id) => `/v1/events/${eventId}/accommodation/contracts/${id}`,
    inventory: (eventId) => `/v1/events/${eventId}/accommodation/inventory`,
    inventoryById: (eventId, id) => `/v1/events/${eventId}/accommodation/inventory/${id}`,
    inventoryNight: (eventId, id) => `/v1/events/${eventId}/accommodation/inventory/${id}/night`,
    // Booking-form feeds: contracted hotels, that hotel's held room types, and
    // the per-night availability the calendar greys out.
    hotels: (eventId) => `/v1/events/${eventId}/accommodation/hotels`,
    hotelRoomTypes: (eventId, hotelId) => `/v1/events/${eventId}/accommodation/hotels/${hotelId}/room-types`,
    availability: (eventId) => `/v1/events/${eventId}/accommodation/availability`,
  },

  invitationTemplates: {
    base: '/v1/invitation-templates',
    byId: (id) => `/v1/invitation-templates/${id}`,
  },

  // Only code-defined guest enums survive here; all reference data moved to
  // dedicated tables (travel + venue endpoints).
  lookups: {
    guestEnums: '/v1/lookups/enums/guest',
    driverTypes: '/v1/lookups/enums/driver-types',
    flightTypes: '/v1/lookups/flight-types',
    flightClasses: '/v1/lookups/flight-classes',
    roomTypes: '/v1/lookups/room-types',
    vehicleTypes: '/v1/lookups/vehicle-types',
    hotels: '/v1/lookups/hotels',
    locations: '/v1/lookups/locations',
    airports: '/v1/lookups/airports',
    drivers: '/v1/lookups/drivers',

    locationById: (id) => `/v1/lookups/locations/${id}`,
    // Hotels are the one name-and-more lookup that's editable — the VIP app reads
    // their address and image, so those have to be fixable.
    hotelById: (id) => `/v1/lookups/hotels/${id}`,
  },

  venues: {
    base: '/v1/venue',
    byId: (id) => `/v1/venue/${id}`,
    clone: (id) => `/v1/venue/${id}/clone`,
    box: '/v1/venue/box',
    boxById: (id) => `/v1/venue/box/${id}`,
    // Adds one more block to whichever VenueBox already exists for this event.
    addBlock: (eventId) => `/v1/venue/${eventId}`,
    // Venue reference data (GET list / POST create share the path).
    types: '/v1/venue/types',
    elementTypes: '/v1/venue/element-types',
  },

  seating: {
    assign: '/v1/seating',
    unassign: (seatId) => `/v1/seating/${seatId}`,
    byBox: (venueBoxId) => `/v1/seating/box/${venueBoxId}`,
    byGuest: (guestId) => `/v1/seating/guest/${guestId}`,
  },

  // Guest travel: flight / accommodation / transport sections. A guest can
  // hold more than one of each — save targets a specific booking by id (in
  // the body) when editing one, or adds a new one when no id is given.
  travel: {
    guest: (id) => `/v1/travel/guest/${id}`,
    // Per-event booking lists — one per travel tab.
    eventFlights: (eventId) => `/v1/travel/event/${eventId}/flights`,
    eventAccommodation: (eventId) => `/v1/travel/event/${eventId}/accommodation`,
    eventTransport: (eventId) => `/v1/travel/event/${eventId}/transport`,
    // Read-only arrivals/departures board — its own endpoint so it can be
    // permission-gated separately from the flights list later.
    eventArrivalsDepartures: (eventId) => `/v1/travel/event/${eventId}/arrivals-departures`,
    // Remove one specific booking.
    deleteFlight: (id) => `/v1/travel/flight/${id}`,
    deleteAccommodation: (id) => `/v1/travel/accommodation/${id}`,
    deleteTransport: (id) => `/v1/travel/transport/${id}`,
  },

  locations: {
    create: '/v1/Location',
    flightTypes: '/v1/lookups/flight-types',
    flightClasses: '/v1/lookups/flight-classes',
    roomTypes: '/v1/lookups/room-types',
    vehicleTypes: '/v1/lookups/vehicle-types',
    hotels: '/v1/lookups/hotels',
  },

  meetings: {
    base: '/v1/meeting',
    // The route param is named "id" backend-side, but it's really the eventId —
    // this returns every meeting scoped to that event, not one meeting by its own id.
    byEvent: (eventId) => `/v1/meeting/${eventId}`,
  },

  dashboard: {
    byEvent: (eventId) => `/v1/Dashboard/${eventId}`,
  },

  // Public (no-login) invitation accept/reject surface.
  invitation: {
    byToken: (token) => `/v1/invitation/${token}`,
    respond: (token) => `/v1/invitation/${token}/respond`,
  },

  // Admin side of guest ↔ support chat. Read needs SupportChat.View; reply/read/
  // close/reopen need SupportChat.Manage. (The guest app's own /my/* side of this
  // API is a separate concern and has no admin-portal caller.)
  supportChat: {
    conversations: '/v1/support-chat/conversations',
    messages: (conversationId) => `/v1/support-chat/conversations/${conversationId}/messages`,
    // Starts (or continues) a conversation by guest id — no prior conversation
    // needs to exist yet.
    startByGuest: (guestId) => `/v1/support-chat/conversations/by-guest/${guestId}/messages`,
    read: (conversationId) => `/v1/support-chat/conversations/${conversationId}/read`,
    close: (conversationId) => `/v1/support-chat/conversations/${conversationId}/close`,
    reopen: (conversationId) => `/v1/support-chat/conversations/${conversationId}/reopen`,
  },

  notifications: {
    base: '/v1/notifications',
    count: '/v1/notifications/count',
    markAllRead: '/v1/notifications/mark-all-read',
    markRead: (id) => `/v1/notifications/${id}/mark-read`,
    markUnread: (id) => `/v1/notifications/${id}/mark-unread`,
    byId: (id) => `/v1/notifications/${id}`,
  },
};
