# API Documentation — Endpoint Inventory

> All routes are under `api/v1`. Every endpoint returns an **`ApiResponse<T>`** envelope. Auth column: `Anon` = `[AllowAnonymous]`, `Auth` = authenticated only, `Perm:X` = `[HasPermission(X)]`, `//X` = permission attribute **commented out** in code (auth-only in practice). Request/Response DTOs are the classes in `Core/ViewModel/*`. "FE consumer" = frontend service/view. Fields not individually verified → see the DTO class. Endpoints marked **⚠ NC** are referenced by the frontend `endpoints.js` but were **not** seen in the controller route grep — **Needs confirmation**.

## Auth — `AuthController` (`api/v1/auth`)
| Method | Route | Auth | Request | FE consumer |
|---|---|---|---|---|
| POST | `/login` | Anon (rate-limited `auth`) | `LoginModel` | `authService.login` / `AuthView` |
| POST | `/refresh` | Anon | `RefreshTokenRequest` | `apiClient` refresh, `authService` |
| POST | `/logout` | Auth | `LogoutRequest` | `authService.logout` |
| POST | `/verify-otp` | Anon | `VerifyOtpRequest` | `authService` |
| POST | `/resend-otp` | Anon | `ResendOtpRequest` | `authService` |
| POST | `/forgot-password` | Anon | `ForgotPasswordRequest` | `AuthView` forgot |
| POST | `/validate-reset-password-token` | Anon | `ValidateToken` | reset-password flow |
| POST | `/reset-password` | Anon | `ResetPasswordRequest` | reset-password flow |
| GET | `/validate-token/{token}` | Anon | — | token validation |

**Service:** `IAuthService` → `AuthService`. **Repos:** `Users`, `UserRefreshTokens`, `OtpVerifications`.

## Account Requests — `AccountRequestsController` (`api/v1/account-requests`)
| Method | Route | Auth | Request | FE consumer |
|---|---|---|---|---|
| GET | `` | Perm:`AccountRequests.View` | query paging | `accountRequestService` / `AccountRequestsView` |
| POST | `/{id}/approve` | Perm:`AccountRequests.Manage` | `ApproveAccountRequest` | `AccountRequestsView` |
| POST | `/{id}/reject` | Perm:`AccountRequests.Manage` | `RejectAccountRequest` | `AccountRequestsView` |

> Self-service **register** submits an `AccountRequest`. **NC:** the public register endpoint wasn't in the grep for this controller — confirm where `RegisterAccountRequest` is posted (previously `auth/register`).

## User Invite — `UserInviteController` (`api/v1/user-invite`) — public
| Method | Route | Auth | Request | FE consumer |
|---|---|---|---|---|
| GET | `/{token}` | Anon | — | `userInviteService` / `UserInviteAcceptView` |
| POST | `/{token}/accept` | Anon | `AcceptInviteRequest` | `UserInviteAcceptView` |

## Users — `UsersController` (`api/v1/users`)
| Method | Route | Auth | Request | FE consumer |
|---|---|---|---|---|
| POST | `` | Perm:`Users.Create` | `CreateUserRequest` | `UsersView` |
| GET | `/{id}` | Perm:`Users.View` | — | `UsersView` |
| GET | `` | Perm:`Users.View` | query paging | `UsersView` |
| PUT | `/{id}` | Perm:`Users.Update` | `UpdateUserRequest` | `UsersView` |
| DELETE | `/{id}` | Perm:`Users.Delete` | — | `UsersView` |
| POST | `/{id}/change-password` | Auth | `ChangePasswordRequest` | user profile |
| POST | `/invite` **⚠ NC** | — | invite body | `UsersView` invite |
| GET | `/pending` **⚠ NC** | — | — | `UsersView` pending |
| POST | `/{id}/resend-invite` **⚠ NC** | — | — | `UsersView` |
| POST | `/{id}/set-password` **⚠ NC** | — | — | invite accept |

## User Access — `UserAccessController` (`api/v1/user-access`)
| Method | Route | Auth | Request | FE consumer |
|---|---|---|---|---|
| GET | `/{userId}` | Perm:`UserAccess.Manage` | — | `userAccessService` / `UserAccessView` |
| PUT | `/{userId}` | Perm:`UserAccess.Manage` | `SetModuleAccessRequest` | `UserAccessView` |

## Roles — `RolesController` (`api/v1/roles`)
| Method | Route | Auth | Request | FE |
|---|---|---|---|---|
| POST | `` | Perm:`Roles.Manage` | `CreateRoleRequest` | `roleService` |
| GET | `/{id}` | Perm:`Roles.View` | — | `roleService` |
| GET | `` | Perm:`Roles.View` | — | `roleService` |
| PUT | `/{id}` | Perm:`Roles.Manage` | `UpdateRoleRequest` | `roleService` |
| DELETE | `/{id}` | Perm:`Roles.Manage` | — | `roleService` |

## Permissions — `PermissionsController` (`api/v1/permissions`)
| Method | Route | Auth | Request | FE |
|---|---|---|---|---|
| GET | `?module=` | Auth | — | `roleService`/permissions UI |
| GET | `/modules` | Auth | — | permissions UI |
| POST | `` | Perm:`Roles.Manage` | `CreatePermissionRequest` | admin |

## Events — `EventsController` (`api/v1/events`)
| Method | Route | Auth | Request | FE |
|---|---|---|---|---|
| GET | `` | `//Events.View` (auth) | query paging | `eventService.listEvents` / `EventsContext`, `EventsView` |
| GET | `/{id}` | Perm:`Events.View` | — | `EventsView` |
| GET | `/types` | Auth | — | `EventTypeDto[]` (`eventService.getEventTypes`) — admin-managed lookup, replaces the old hardcoded `EVENT_TYPES` list |
| POST | `/types` | Perm:`Events.Create` | `CreateEventTypeRequest{Name}` | Lookups admin page (`event-types` in `lookupConfig.js`) |
| GET | `/import-template` | Perm:`Events.Import` | — | `.xlsx` blob (`eventService.getEventImportTemplate`) — headers Title*/Venue/Type/Start Date/End Date/Image URL; Venue/Type are real Excel dropdowns (Stop-style validation) sourced from current Venues + the `EventTypes` lookup table; Start/End Date get Date validation (calendar picker, rejects past dates) |
| GET | `/import/{batchId}` | Perm:`Events.Create` | — | `ImportBatchStatusDto` — polled by `eventService.getEventImportBatch` while a background import job runs (see below) |
| POST | `/import` | Perm:`Events.Import` | multipart `file` (.xlsx) | `ImportEventsResult` (`eventService.importEvents` → `ImportEventsModal`) — bulk-creates events; per-row pass/fail, no N+1 queries (venues/appkeys preloaded once, one `SaveChanges` for all valid rows) |
| POST | `` | Perm:`Events.Create` | `CreateEventRequest` (now incl. `VenueId`) | `EventsView` |
| PUT | `/{id}` | Perm:`Events.Update` | `UpdateEventRequest` (now incl. `VenueId`) | `EventsView` |
| PATCH | `/{id}/status` | Perm:`Events.ManageStatus` | `UpdateEventStatusRequest` | `EventsView` |
| DELETE | `/{id}` | Perm:`Events.Delete` | — | `EventsView` |
| GET | `/{id}/sessions` | Auth | — | `eventService.listSessions` (venue/seating) |
| POST | `/{id}/sessions` | Perm:`Events.ManageSessions` | `CreateSessionRequest` | `EventsView` |
| PUT | `/{id}/sessions/{sessionId}` | Perm:`Events.ManageSessions` | `UpdateSessionRequest` | `EventsView` |
| DELETE | `/{id}/sessions/{sessionId}` | Perm:`Events.ManageSessions` | — | `EventsView` |

`Event.VenueId` (a direct nullable FK, distinct from the per-event/session `VenueBox.EventId` relation) is now actually resolved and set on create/update (bug fix — it used to only ever store the denormalized `VenueName` string, mirroring how `Session.VenueId` already worked). It's also backfilled by `VenueService.CreateVenueBoxAsync` (`useVenueEditor.saveLayout`) the first time a layout is saved for an event whose `VenueId` is still null.

## Guests — `GuestController` (`api/v1/guest`)
| Method | Route | Auth | Request | FE |
|---|---|---|---|---|
| GET | `` | `//Guests.View` (auth) | `?eventId` + `PagedRequest` | `guestService.listGuests` / `GuestsView` |
| GET | `/{id}` | `//Guests.View` (auth) | — | `GuestDetailView` |
| POST | `` | Perm:`Guests.Create` | `CreateGuestRequest` | `GuestModal` |
| POST | `/import` | Perm:`Guests.Import` | `IFormFile` (CSV) `?eventId` | `ImportGuestsPanel` (Import Guest tab in `GuestModal`) — returns `StartImportResponse` immediately (background job, see below) |
| GET | `/import/{batchId}` | Perm:`Guests.Import` | — | `ImportBatchStatusDto` — polled by `guestService.getGuestImportBatch` |
| DELETE | `/{id}` | Perm:`Guests.Delete` | — | `GuestsView` |
| DELETE | `/delete` | Perm:`Guests.Delete` | `?eventId` + `DeleteMultipleGuests` | `DeleteGuestsModal` |
| PUT | `/{id}` | Perm:`Guests.Update` | `CreateGuestRequest` | `GuestModal` |
| POST | `/{id}/accreditation/issue` | Perm:`Guests.Update` | — | `AccreditationView`/`AccreditationModal` |
| POST | `/{id}/accreditation/revoke` | Perm:`Guests.Update` | — | `AccreditationView` |
| GET | `/picker` **⚠ NC** | — | search/paged | `guestService` guest picker |
| GET | `/other-events` **⚠ NC** | — | `?currentEventId` + `PagedRequest` | `guestService.getGuestsFromOtherEvents` — "Existing Guest" tab in `GuestModal` (`ExistingGuestPicker`, table-based multi-select); guests from every *other* event, one row per past booking (not deduped by person), searched system-wide; row includes `Tier`/`AccreditationRequired`/`InvitationStatus`/`AccreditationStatus` from that past booking for display only (never applied to the new guest) |

> **Note:** accreditation issue/revoke are gated by `Guests.Update` (not `Accreditation.Issue/Revoke`). — flagged in [current-status.md](current-status.md).

## Invitation (public) — `InvitationController` (`api/v1/invitation`)
| Method | Route | Auth | Request | FE |
|---|---|---|---|---|
| GET | `/{token}` | Anon | — | `invitationService.getInvitation` / `InvitationResponseView` |
| POST | `/{token}/respond` | Anon | `RespondToInvitationRequest` | `InvitationResponseView` |

## Invitation Templates — `InvitationTemplateController` (`api/v1/invitation-templates`)
| Method | Route | Auth | Request | Response | FE |
|---|---|---|---|---|---|
| GET | `?eventId=` | Perm:`Invitations.View` | — | `List<InvitationTemplateResponse>` | `invitationTemplateService.getTemplates` / `InvitationsView` |
| POST | `` | Perm:`Invitations.ManageTemplates` | `CreateInvitationTemplateRequest` (incl. `Body` HTML + `DesignConfig`) | `InvitationTemplateResponse` | `InvitationsView` builder |
| PUT | `/{id}` | Perm:`Invitations.ManageTemplates` | `UpdateInvitationTemplateRequest` (incl. `DesignConfig`) | `InvitationTemplateResponse` | `InvitationsView` edit |
| DELETE | `/{id}` | Perm:`Invitations.ManageTemplates` | — | `bool` | `InvitationsView` |

## Travel — `TravelController` (`api/v1/travel`)
`FlightLeg` now carries its own `FlightClassId`/`Seat` (a return booking's outbound/inbound legs can be on different fare classes/seats — Status stays booking-level on `Flight`, deliberately not per-leg). `Flight.FlightClassId`/`Seat` remain as a "primary" copy mirrored from the first leg (same pattern as `Flight.DepartureTime`/`ArrivalTime`), so anything showing one collapsed value per booking still has something to read. `FlightLegInput`/`FlightLegRow` both carry the new fields; saving diffs legs by id same as before, just also writing `FlightClassId`/`Seat` per leg.
| Method | Route | Auth | Request | FE |
|---|---|---|---|---|
| GET | `/event/{eventId}/flights` | Auth | — | `travelService` / `TravelView` |
| GET | `/event/{eventId}/accommodation` | Auth | — | `TravelView` |
| GET | `/event/{eventId}/transport` | Auth | — | `TravelView` |
| GET | `/guest/{guestId}` | Auth | — | `GuestDetailView`/`TravelAccordion` |
| POST | `/guest/{guestId}` | Auth | `GuestTravelRequest` | `TravelAccordion` |
| DELETE | `/flight/{id}` | Auth | — | `TravelView` |
| DELETE | `/accommodation/{id}` | Auth | — | `TravelView` |
| DELETE | `/transport/{id}` | Auth | — | `TravelView` |
| GET | `/event/{eventId}/arrivals-departures` **⚠ NC** | — | — | `TravelView` board |

> Travel write endpoints have **no `[HasPermission]`** (auth-only) so seating/guest flows can manage travel — confirm intended.

## Lookups — `LookupController` (`api/v1/lookups`)
Reads (Auth): `GET enums/guest`, `flight-types`, `flight-classes`, `room-types`, `hotels`, `locations`, `vehicle-types`, `drivers`, `airports`. Writes (Perm:`Travel.Manage`): `POST flight-types|flight-classes|room-types|hotels|vehicle-types|airports|locations`, `PUT locations/{id}`. Request DTOs: `CreateNamedLookupRequest`, `CreateHotelRequest`, `CreateAirportRequest`, `LocationRequest`. FE: `lookupService`, `locationService`, `TravelView`, `LookupsView`, venue/travel dropdowns. **NC:** FE also references `enums/driver-types`.

## Nationality — `NationalityController` (`api/v1/nationality`)
| GET `` | Auth | `nationalityService` (guest forms). |

## Venue — `VenueController` (`api/v1/venue`)
| Method | Route | Auth | Request | FE |
|---|---|---|---|---|
| POST | `` | Perm:`Venue.Manage` | `CreateVenueRequest` (now incl. `LocationId`, `ImageUrl`) | `AddVenueModal` |
| POST | `/{id}` (addBlock) | Perm:`Venue.Manage` | `?sessionId&venueId` + `CreateVenueBlockDto` | `useVenueEditor` |
| POST | `/{id}/clone` | Perm:`Venue.Manage` | `CloneVenueRequest` (`SourceBoxId` + editable Name/Type/Category/Color/LocationId/ImageUrl) | `CloneVenueModal` → `useVenueEditor.cloneCurrentVenue` |
| POST | `/box` | Perm:`Venue.Manage` | `CreateVenueBoxRequest` | `useVenueEditor.saveLayout` |
| GET | `` | `//Venue.View` (auth) | — | `venueService.getVenues` (list also drives the `VenuesView` admin page) |
| PUT | `/{id}` | Perm:`Venue.Manage` | `UpdateVenueRequest` (Name/LocationId/ImageUrl only — layout untouched) | `VenuesView` edit modal |
| DELETE | `/box/{id}` | Perm:`Venue.Manage` | query | `useVenueEditor.clearLayout` |
| GET | `/{id}` | `//Venue.View` (auth) | — | `venueService.getVenue`; response now nests `Location` (full `LocationDto`) and `ImageUrl` |
| DELETE | `/{id}` | Perm:`Venue.Manage` | — | `useVenueEditor.deleteVenue` |
| GET | `/types` | Auth | — | venue type dropdown |
| POST | `/types` | Perm:`Venue.Manage` | `CreateVenueTypeRequest` | `AddVenueModal` |
| GET | `/element-types` | Auth | — | `useVenueEditor` element palette |
| POST | `/element-types` | Perm:`Venue.Manage` | `CreateElementTypeRequest` | element palette |

**Events/Guests bulk import run as Hangfire background jobs, not inline in the request.** `POST /events/import` and `POST /guest/import` only upload the file to blob storage, insert an `ImportBatch` row (`Status="queued"`), enqueue `IEventService.ProcessEventsImportBatchAsync`/`IGuestService.ProcessGuestsImportBatchAsync` via `IBackgroundJobClient.Enqueue<T>(...)`, and return `StartImportResponse{BatchId,Status}` immediately — the caller never waits on the parse/insert work and can navigate away. The job re-downloads the file (`IBlobService.DownloadAsync`), does the same validation as before, writes one `ImportBatchRow` per source row, and on completion pushes a notification via the shared `IImportBatchService.NotifyFinishedAsync` (`NotificationManagerService.SendToUserAsync`, `RedirectUrl` = `/events?importBatch={id}` or `/guests?importBatch={id}`) — clicking it deep-links back to the exact modal with results already loaded. Poll via `GET /{controller}/import/{batchId}` → shared `IImportBatchService.GetStatusAsync`.

`Venue` entity now carries `LocationId` (FK → `Location`, auto-created with `Type="venue"` via the shared `LocationPickerModal` in persisting mode) and `ImageUrl` (blob-uploaded, same pattern as event covers). Clone deep-copies one `VenueBox` (Blocks→Props→Seats, VenueLayouts→Props→Seats) into a new, independent `Venue`+`VenueBox` with `EventId`/`SessionId` both `null` and every seat `Status` reset — the clone is picked up automatically the next time it's assigned to any event/session (`pickBox`'s fallback to the venue's shared null/null box).

## Seating — `SeatingController` (`api/v1/seating`)
| Method | Route | Auth | Request | FE |
|---|---|---|---|---|
| POST | `` | Perm:`Seating.Assign` | `RequestSeatAssignDto` | `seatingService.assign` / `SeatingView` |
| DELETE | `/{seatId}` | Perm:`Seating.Assign` | `?venueBoxId&eventId&sessionId` | `SeatingView` |
| GET | `/box/{venueBoxId}` | Perm:`Seating.View` | `?eventId&sessionId` | `SeatingView` |
| GET | `/guest/{guestId}` **⚠ NC** | — | — | `seatingService.byGuest` |

## Meetings — `MeetingController` (`api/v1/meeting`)
| Method | Route | Auth | Request | FE |
|---|---|---|---|---|
| POST | `` | Auth | `CreateMeetingRequest` | `meetingService` / `MeetingsView` |
| GET | `/{id}` (id = **eventId**) | Auth | — | `MeetingsView` (all meetings for event) |
| PUT | `` | Auth | `EditMeetingRequest` | `MeetingsView` |

## Dashboard — `DashboardController` (`api/v1/dashboard`)
| GET `/{eventId}` | Perm:`Events.View` | `GetDashboardResponse` | `dashboardService.byEvent` / `DashboardView`. |

## Notifications — `NotificationController` (`api/v1/notifications`)
| Method | Route | Auth | FE |
|---|---|---|---|
| GET | `` | Auth (`NotificationPagedRequest`) | `notificationService` (bell) |
| GET | `/{id}` | Auth | — |
| GET | `/count` | Auth | unread badge |
| PUT | `/mark-all-read` | Auth | notifications panel |
| PUT | `/{id}/mark-read` | Auth | notifications panel |
| PUT | `/{id}/mark-unread` | Auth | notifications panel |
| DELETE | `/{id}` | Auth | notifications panel |
| POST | `/send` | Perm:`Notifications.Send` (`SendNotificationRequest`) | admin broadcast |
| GET | `/guest`, `/guest/count`, PUT `/guest/{id}/mark-read`, `/guest/mark-all-read`, POST `/guest/devices` (`RegisterDeviceRequest`) | Auth (guest-app) | VIP app |

## Support Chat — `SupportChatController` (`api/v1/support-chat`)
Guest side (`/my/*`, guest-app auth): `GET my/conversations`, `GET my/messages`, `POST my/messages` (rate-limited `chat`, `SendSupportMessageRequest`), `POST my/messages/read`.
Admin side: `GET conversations` (Perm:`SupportChat.View`, `SupportConversationPagedRequest`), `GET conversations/{id}/messages` (Perm:`SupportChat.View`), `POST conversations/{id}/messages` (Perm:`SupportChat.Manage`, rate-limited), `POST conversations/{id}/read|close|reopen` (Perm:`SupportChat.Manage`). FE: `supportChatService` / `SupportChatView` + `RichComposer`. **⚠ NC:** FE references `conversations/by-guest/{guestId}/messages` (start-by-guest) — confirm server route.

## VIP App (guest-facing) — `VipAppController` (`api/v1/vip-app`)
Auth: `POST auth/request-otp` (Anon, `RequestOtpRequest`), `POST auth/verify-otp` (Anon, `VerifyOtpRequest`), `POST auth/refresh` (Anon, `RefreshTokenRequest`), `POST auth/logout`.
Data (guest JWT): `GET events`, `GET events/{eventId}/sessions`, `GET agenda`, `GET flights`, `GET accommodation`, `GET transportation`, `GET sessions`, `GET sessions/{id}`, `GET preferences`, `PUT preferences` (`GuestPreferencesResponse`), `GET profile`, `PUT profile` (`UpdateProfileRequest`), `PUT settings` (`UpdateSettingsRequest`). (`events/{id}/selection` is commented out.) Consumed by the **separate guest mobile app**, not the admin SPA.

## Upload — `UploadController` (`api/v1/upload`)
| POST `/image` | Auth | `UploadRequest` (base64/URL) → Azure Blob | `uploadService.image` (event branding, guest photos, email images). |

## Organizations & Vehicles — **⚠ Needs confirmation (frontend-only?)**
Frontend has `organizationService` (`/v1/organizations`), `vehicleService` (`/v1/vehicles`), `OrganizationsView`, `VehiclesView`, and router permissions `Organizations.View` / `Travel.View`. **No `OrganizationsController` / `VehiclesController`, no `Organization`/`Vehicle` entity, and no `Organizations.*` in `PermissionCodes` were found in the backend.** Treat these as **pending backend** until confirmed.
