# Frontend Architecture (React) — `gms-frontend`

> React 18 + Vite 6 SPA, react-router-dom v6, axios. See [CLAUDE.md](../CLAUDE.md) for setup/config, [apis.md](apis.md) for endpoints.

## Folder structure (`src/`)
```
src/
├── main.jsx            # bootstrap; ?screen= public pages; RouterProvider
├── router.jsx          # createBrowserRouter: /login + protected module routes
├── nav.js              # KEY_PATH map + pathForKey() (sidebar/routes single source)
├── App.jsx             # authenticated LAYOUT shell (sidebar+topbar+theme+guest drawer+<Outlet/>)
├── style.css           # global CSS (maroon theme, embedded base64 fonts, brand overrides)
├── config/env.js       # VITE_API_URL, API_TIMEOUT, AUTH_STORAGE_KEY
├── api/
│   ├── apiClient.js    # axios instance: token inject, envelope unwrap, 401 refresh
│   ├── endpoints.js    # all API path constants
│   ├── adapters/eventAdapters.js
│   └── services/*.js   # one per domain (see below)
├── auth/               # AuthContext.jsx, jwt.js (decode), tokenStore.js (localStorage)
├── events/EventsContext.jsx   # active-event selector
├── components/         # Icons, UI, TweaksPanel, FlagIcon, ui/{DataTable,Select,Modal,ActionMenu,DateField,LocationPickerModal}
├── views/              # one folder/file per page (+ subfolders: guests/modals, venue, lookups, invitations, supportChat)
├── i18n/translations.js
├── lib/                # date.js, toast.js, realtimeHub.js (SignalR client)
├── enums/locationType.js
├── data/mockData.js    # demo fallback data
└── assets/fonts/       # Loew Next Arabic .ttf (7 weights)
```

## Routing (`router.jsx` + `nav.js`)
- **`createBrowserRouter`** (BrowserRouter). `vercel.json` rewrites all paths to `index.html` for deep-link refresh.
- `/login` → `LoginRoute` (redirects to `/` if authenticated) → `AuthView`.
- `/` → `RequireAuth` (redirects to `/login` if not authed) → renders **`App`** (layout) with a nested `<Outlet/>`.
  - `index` → `IndexRedirect` (first module the user `can()` access).
  - One route per module (from `MODULE_ROUTES`), each wrapped in `Guard permission=…`.
  - Dynamic: `lookups/:lookupKey` (→ `LookupsView`), `guests/:id` (→ `GuestDetailView`).
  - `*` → redirect to `/`.
- **Module → path** in `nav.js KEY_PATH`: dashboard, invitations, guests, travel, accreditation, seating, meetings, venue-config, events, account-requests, user-access, users, **organizations**, **vehicles**, **support-chat**. `pathForKey('lookup-<x>')` → `/lookups/<x>`.
- Views receive `{ lang, activeEventId, onOpenGuest, gotoView }` via **`useOutletContext()`** (adapters in `router.jsx`); their prop signatures stay unchanged.

## Layout system (`App.jsx`)
Persistent shell for authenticated routes: maroon **sidebar** (nav grouped by section, gated by `can(permission)`), maroon **topbar** (event switcher, search, EN/عربي toggle, theme toggle, notifications bell, avatar, sign-out), mobile bottom nav, **guest drawer** (`onOpenGuest`), and the **TweaksPanel**. Applies theme via CSS variables + `data-theme`/`data-density`/`lang`/`dir` on `<html>`. `BRAND_THEME` (maroon) forces the QOC palette; event-based theming is disabled but preserved.

## Public (no-login) screens — `main.jsx`
Selected by `?screen=` query param **before** the router mounts (so email/venue links keep working):
- `?screen=invitation&token=…` → `InvitationResponseView` (guest RSVP accept/decline).
- `?screen=userInvite&token=…` → `UserInviteAcceptView` (admin-invited user sets password).
- `?screen=venueView&venueId=…` → `VenueFullScreenView` (fullscreen floor plan, opened via `window.open`).
Otherwise: `AuthProvider` → `EventsProvider` → `RouterProvider`.

## State management
- **Context:** `AuthContext` (session, user, `isAuthenticated`, `isDemo`, `can(permission)`, `signIn/out`, `enterDemo`), `EventsContext` (events list, `activeEvent`, `setActiveEventId`, persisted in `localStorage: gms-active-event`).
- **Local state** per view (`useState`/`useMemo`/`useCallback`). No Redux. TipTap editor state inside `EmailTemplateBuilder`. Venue editor state in the `useVenueEditor` hook.

## API layer
- **`apiClient.js`** — axios instance; base URL from `VITE_API_URL`; request interceptor attaches `Bearer` from `tokenStore`; response interceptor unwraps the `{success,message,data,errors}` envelope to `data`; on 401 (non-auth calls) it de-dupes a **single refresh + retry**; throws a normalized `ApiError { message, status, errors }`.
- **`endpoints.js`** — all path constants (see [apis.md](apis.md)).
- **Services** (`src/api/services/`): `authService`, `accountRequestService`, `userInviteService`, `dashboardService`, `eventService`, `guestService`, `invitationService`, `invitationTemplateService`, `travelService`, `locationService`, `lookupService`, `meetingService`, `nationalityService`, `notificationService`, `organizationService`, `roleService`, `seatingService`, `supportChatService`, `uploadService`, `userAccessService`, `vehicleService`, `venueService`. Each is thin: build params → `apiClient.<verb>(ENDPOINTS.…)`.

## Auth (frontend)
- `tokenStore.js` persists only `{ accessToken, refreshToken }` in `localStorage` (`gms-auth`).
- `jwt.js` decodes the JWT client-side (no signature check) → user object + `permissions` (from `permission` claim(s)).
- `AuthContext.can(permission)` gates nav items and action buttons. "Explore demo" = in-memory pseudo-user with `permissions: ['*']` (not persisted across reload).
- Protected routing via `RequireAuth` + per-route `Guard` (see Routing).

## Components (reusable)
| Component | Purpose |
|---|---|
| `components/ui/DataTable.jsx` | TanStack-table data grid (sort/paginate/search) — used by most list views |
| `components/ui/Select.jsx` | react-select wrapper (single/multi/clearable) |
| `components/ui/Modal.jsx` | Radix dialog modal shell |
| `components/ui/ActionMenu.jsx` | row action dropdown |
| `components/ui/DateField.jsx` | date input (react-datepicker) + `datefield.css` |
| `components/ui/LocationPickerModal.jsx` | Leaflet map location picker |
| `components/UI.jsx` | shared primitives (Avatar, StatusChip, TierChip, Drawer, …) |
| `components/Icons.jsx` | SVG icon set (`<Icon name=…/>`) |
| `components/FlagIcon.jsx` | nationality flags |
| `components/TweaksPanel.jsx` | theme/density/lang tweak panel + `useTweaks` hook |
| `views/invitations/EmailTemplateBuilder.jsx` | **TipTap** WYSIWYG email builder + `EmailPreview` (design bar, variables, invite-button node) |
| `views/supportChat/RichComposer.jsx` | TipTap chat composer |
| `views/guests/modals/*` | GuestModal (tabbed: New Guest wizard / Import Guest / Existing Guest), ImportGuestsPanel, ExistingGuestPicker (table, multi-select, session-batched bulk add), AccreditationModal, MessageModal, DeleteGuestsModal, TravelAccordion |
| `views/venue/*` | AddVenueModal, CloneVenueModal, ConfigPanel, ElementPalette, VenueToolbar, VenueFullScreenView, canvas/{VenueCanvas,CanvasElement,ElementShapes} |
| `components/ui/ImageField.jsx` | shared optional-image field (blob upload) — used by `AddVenueModal`, `VenuesView` |
| `components/ui/LocationPickerModal.jsx` | shared Qatar-bounded map picker (persisting or `pickOnly` mode) — used by `AddVenueModal`, `CloneVenueModal`, `VenuesView`, `OrganizationsView`, `LookupsView` |

## Custom hooks
- `useAuth()` (`auth/AuthContext`), `useEvents()` (`events/EventsContext`), `useTweaks()` (`components/TweaksPanel`), **`useVenueEditor()`** (`views/venue/useVenueEditor.js` — all venue floor-plan editor state/handlers, incl. `viewingBoxId`/`cloneCurrentVenue` for the Clone Venue flow; VenueConfig views are presentational).

## Utilities
- `lib/date.js` (formatting), `lib/toast.js` (sonner wrapper — `toast.success/error/…`), `lib/realtimeHub.js` (`@microsoft/signalr` client for `/realtimehub`), `lib/useImportBatchPoll.js` (polls a background import job's status until terminal — shared by Events/Guests import), `api/adapters/eventAdapters.js` (event DTO ↔ UI shape), `views/venue/venueHelpers.js`, `views/lookups/lookupConfig.js`, `enums/locationType.js`.

## Styling
Single `src/style.css` (large — embedded base64 fonts + theme). CSS variables (`--accent #8d0134`, `--bg-*`, `--ink*`, fonts `--serif/--sans/--mono` leading with `Loew Next Arabic`). Light theme default (white), maroon sidebar/topbar. Brand overrides appended at the end of the file. Bilingual RTL via `dir="rtl"` when `lang==='ar'`.

## Forms / validation / error handling / i18n
- **Forms:** controlled inputs + local state; multi-selects via `Select`; validation is per-view (e.g. `InvitationsView.validate()` checks required name/subject). No form library.
- **Validation:** client-side inline (required fields, error borders); server-side via FluentValidation → surfaced through `ApiError.errors` + toast.
- **Error handling:** `apiClient` normalizes errors to `ApiError`; views `catch` and `toast.error(err.message)`.
- **i18n:** no i18n library — each view defines `const STR = isAr ? {…arabic…} : {…english…}`; global bits in `i18n/translations.js` and `App.jsx SHELL_I18N`. `lang` comes from the tweak/topbar toggle.

## Pages (views)
| Page | Route | Purpose | Key APIs/services | Notes |
|---|---|---|---|---|
| `DashboardView` | `/dashboard` | Event KPIs/overview | `dashboardService.byEvent` | — |
| `InvitationsView` | `/invitations` | Templates + **email builder** (TipTap) + live preview | `invitationTemplateService` | body HTML + `designConfig`; queue tab placeholder |
| `GuestsView` | `/guests` | Guest list/grid, modals | `guestService`, `nationalityService`, `lookupService` | opens `GuestModal` (Add Guest has 3 tabs — New Guest / Import Guest / Existing Guest — Edit Guest is always the New Guest wizard on the existing row), delete; CSV import lives in the modal's Import Guest tab (`ImportGuestsPanel`), kicks off a background job (same pattern as `ImportEventsModal`) and supports the `?importBatch=` deep-link (opens `GuestModal` straight into that tab) |
| `GuestDetailView` | `/guests/:id` | Single guest detail + travel | `guestService`, `travelService`, `seatingService` | — |
| `TravelView` | `/travel` | Flights/accommodation/transport per event | `travelService`, `lookupService` | arrivals-departures board **⚠ NC** |
| `AccreditationView` | `/accreditation` | Issue/revoke badges (QR) | `guestService` issue/revoke | badge print |
| `SeatingView` | `/seating` | Assign guests to seats on floor plan | `seatingService`, `venueService`, `eventService` | — |
| `MeetingsView` | `/meetings` | Meetings per event (calendar) | `meetingService` | FullCalendar |
| `VenueConfigView` | `/venue-config` | Floor-plan editor | `venueService` via `useVenueEditor` | fullscreen view via `?screen=venueView`; toolbar "Clone Venue" deep-copies the open layout into a new event/session-agnostic venue (`CloneVenueModal`) |
| `VenuesView` | `/venues` | **Admin-only.** Venues table (image/name/type/location) + Edit modal (name/location/image only) | `venueService.getVenues/updateVenue` | creating a venue + editing its floor plan still happens in `VenueConfigView`; gated by `Venue.View`/`Venue.Manage` |
| `EventsView` | `/events` | Event CRUD + sessions | `eventService` | dispatches `gms-events-changed`; "Import Events" button (`Events.Import`) opens `ImportEventsModal` — template download (.xlsx with Venue/Type dropdowns) + bulk upload that **kicks off a Hangfire background job and returns immediately** (per-row results poll in via `components/ui/ImportBatchResults` + `lib/useImportBatchPoll`), a dedicated "outdated template" popup for stale Venue/Type values, and a `?importBatch=` deep-link (read on mount) that reopens the modal straight into a finished batch's results when the user clicks the completion notification; Type dropdown is now the `event-types` lookup (`getEventTypes`), not a hardcoded array |
| `AccountRequestsView` | `/account-requests` | Approve/reject sign-ups | `accountRequestService` | — |
| `UserAccessView` | `/user-access` | Per-user cross-module read grants | `userAccessService` | view-only grants |
| `UsersView` | `/users` | User CRUD + invite | `roleService`, users endpoints | invite/pending **⚠ NC** |
| `OrganizationsView` | `/organizations` | Organizations CRUD | `organizationService` | **backend ⚠ NC** |
| `VehiclesView` | `/vehicles` | Fleet vehicles | `vehicleService`, `lookupService` | **backend ⚠ NC** |
| `SupportChatView` | `/support-chat` | Guest↔admin chat | `supportChatService`, `realtimeHub` | RichComposer |
| `LookupsView` | `/lookups/:lookupKey` | Manage reference lookups | `lookupService` | config in `lookupConfig.js` |
| `AuthView` | `/login` | Login/forgot | `authService` | password eye toggle, maroon focus |
| `InvitationResponseView` | `?screen=invitation` | Public guest RSVP | `invitationService` | no login |
| `UserInviteAcceptView` | `?screen=userInvite` | Public set-password | `userInviteService` | no login |
| `FinancialsView`, `ReportsView`, `ProtocolView` | — | Present but **commented out of nav** | — | placeholder/disabled |
