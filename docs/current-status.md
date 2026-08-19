# Current Status, Pending Work, Bugs & Tech Debt

> Estimates are inferred from code (routes present, views present, endpoints referenced). Percentages are rough. Verify against the live app before relying on them.

## Completed features (functional both sides)
- Authentication: login, JWT + rotating refresh, OTP, forgot/reset password, logout.
- Access control: users, roles, permissions, per-user cross-module read grants (User Access), account requests (approve/reject), user invite accept.
- Events + sessions CRUD; Dashboard per event.
- Guests: list/grid, create/edit, CSV import, bulk delete, detail view.
- Invitations: template CRUD + **WYSIWYG email builder** (TipTap) with background/fonts/size/images/variables/placeable invite button; public RSVP page; variable + `{{InviteLink}}` interpolation on send.
- Accreditation: issue/revoke + QR badge.
- Travel & logistics: flights/accommodation/transport per guest & per event; reference lookups.
- Venue floor-plan editor + seating assignment; fullscreen venue view.
- Meetings; Notifications (realtime + push + Hangfire cleanup); Support chat (guest↔admin).
- Guest VIP app API surface.

## Partially completed
- **Vehicles** — frontend `VehiclesView` + `vehicleService` + `/v1/vehicles` endpoints exist; backend `Vehicle` entity/controller **not found** (only `VehicleType` lookup + `DriverProfile`). **⚠ Needs confirmation.**
- **Users invite flow** — frontend references `/v1/users/invite|pending|resend-invite|set-password`; not seen in `UsersController` grep. **⚠ Needs confirmation** (public accept side exists via `UserInviteController`).
- **Travel arrivals/departures board**, **guest picker** (`/v1/guest/picker`), **seating by guest** (`/v1/seating/guest/{id}`), **support chat start-by-guest** — referenced in frontend `endpoints.js`, not seen in controller route grep. **⚠ Needs confirmation.**
- **Invitations "queue"/scheduled sending** — tab is a "coming soon" placeholder in `InvitationsView`.
- **Arabic body** in invitation templates uses a plain textarea (the rich builder is English-body only).

## ⚠ Undocumented architecture change (found, not authored, this session)
- **Guest grades are now the dynamic Service/ServiceLevel catalogue ("v2") — `Guest.Tier` is gone from the UI.** `/travel` now routes to `ServiceOpsView` (`views/ServiceOpsView.jsx`), which replaces the old fixed Flights/Hotel/Ground-Transfers tabs with one tab per row in the `Service` catalogue (admin-managed via `ServicesView`/`ServiceLevelsView`), each with columns generated from that service's `FormSchemaJson` (`components/ui/DynamicFields.jsx`). Booking is `views/serviceOps/BookingModal.jsx`. The old `TravelView.jsx`/`TravelAccordion.jsx` (fixed Flight/Accommodation/Transport sections) still exist and build, mounted at `/travel-legacy` (see `router.jsx`), but are no longer the primary guest-services surface.
- **`docs/service-levels-v2.md`**, referenced by comments in `ServiceOpsView.jsx`/`Service.cs`/`DynamicFields.jsx`, **does not exist** — this whole module (entities, DTOs, endpoints, the lookup-field mechanism in `components/ui/lookupSources.js`) needs a first-pass writeup in `docs/frontend.md`/`docs/backend.md`/`docs/apis.md` plus a CLAUDE.md architectural-decision entry. Not done here — flagging so it isn't lost.
- Two bugs fixed in this layer (2026-08-06): (1) `ServiceOpsView`'s per-service "Arrivals & Departures" schedule tab was appearing for *every* dated service (Transport's pickup/dropoff, any custom service with a date field), not just Flight — scoped to `service.code === 'flight'`. (2) `lookupSources.js`'s `locations` and `vehicles` sources read wrong field names (`r.name`/`r.plateNumber`/`r.model`) that don't exist on `LocationDto`/`VehicleResponse`, so a lookup-type field's dropdown fell through to showing the raw id — fixed to `r.address` and `r.vehicleNumber`/`r.vehicleModel`.

## Not started / disabled
- **Organizations** module — frontend view/service/endpoints + router permission `Organizations.View`, but **no backend controller/entity/permission**. **⚠ Needs confirmation / pending backend.**
- **Financials**, **Reports**, **Protocol** — views exist but are **commented out of `App.jsx` nav**; backend has `PermissionCodes` for them (Financials/Reports/Protocol) but no dedicated controllers.
- `Travel.SyncHayya` permission exists (Hayya travel sync) — integration **Needs confirmation**.

## Placeholder / mock code
- `src/data/mockData.js` — demo fallback (events, sessions, invitation templates) used by "Explore demo".
- `App.jsx` retains some demo/i18n constants (`SHELL_I18N` sample user, `EVENT_I18N`).
- Invitations queue tab; possibly other "coming soon" panels.

---

## Pending Work (categorized TODO)

### High priority
- **Backend (confirm/implement):** Organizations controller+entity; Vehicles CRUD controller+entity; verify/implement Users invite endpoints; verify guest-picker, seating-by-guest, arrivals-departures, support chat start-by-guest routes. (API)
- **Backend:** confirm Firebase push config key(s) the `FirebaseNotificationProvider` reads. (Backend/Config)
- **Deployment:** ensure each environment sets `FrontendUrl` to the real frontend origin (invitation links). Restart API process after publish (migrations auto-apply). (Backend/Config)
- **Frontend:** the frontend `origin` remote belongs to a **different GitHub account** — arrange push access or a fork before pushing the accumulated UI work (theme, routing, email builder, auth polish). (Frontend)

### Medium priority
- **Accreditation permissions:** issue/revoke are gated by `Guests.Update` rather than `Accreditation.Issue/Revoke` — decide intended model. (API)
- **Invitations:** implement scheduled send/queue; add rich Arabic body support. (Frontend/Backend)
- **Financials/Reports/Protocol:** decide to build or remove the disabled views. (Frontend/Backend)
- **Testing:** no test projects/specs were found in either repo — add backend unit/integration tests and frontend component tests. (Testing)

### Low priority
- **UI:** finish placeholder panels; consolidate demo/mock constants; audit RTL polish across new views (Organizations/Vehicles/SupportChat/GuestDetail). (UI)
- **DB:** document exact FK optionality/cascade rules in an ER appendix. (Database)

---

## Known bugs / risks
- **Deploy staleness (recurring):** backend code changes require rebuild **+ process restart**; the running process, not the repo, generates emails/behavior. (Seen with invitation variable interpolation.)
- **`FrontendUrl` misconfig** → invitation links resolve to `http://localhost:5173` (or become relative → email clients URL-encode braces). Set the config per environment.
- **Migration chain rewrite** → local DBs built from the old chain fail with SQL 2714; must drop & recreate. (Deployed DB is on the new chain.)
- **`net9.0` runtime absent on some machines** → `API.exe` exits `0x80008096`; mitigated by `<RollForward>Major</RollForward>` (runs on .NET 10). Prefer installing .NET 9.
- **Frontend/backend endpoint drift** (the ⚠ NC items) — calls may 404 until backend catches up.
- **Commented-out `[HasPermission]`** on some GET endpoints (Guests, Events, Venue) is intentional (cross-module reads) — don't "fix" blindly; it also means those reads are broader than their module's view permission.

## Technical debt / refactoring opportunities
- **`src/style.css`** is very large (embedded base64 fonts). Consider moving fonts to `@font-face` files and splitting theme tokens.
- **`src/App.jsx`** is a large multi-responsibility file (layout + theme engine + guest drawer + i18n constants) — candidate for extraction.
- **`Infrastructure/Services/Guest.cs`** (`GuestService`) is large (CRUD + import + accreditation + invitation email) — could split invitation/email concerns.
- **Duplicated lookup path constants** in `endpoints.js` (`lookups` vs `locations` blocks reference the same routes).
- **Per-view `STR` i18n objects** are repetitive — a shared i18n utility could reduce duplication (without adding a heavy library).
- **Missing abstractions:** no automated tests; no shared form/validation abstraction on the frontend.

## Future improvements (within current architecture)
- Add automated tests (xUnit backend, Vitest/RTL frontend).
- Add a lightweight OpenAPI-typed client generation for the frontend services to prevent endpoint drift.
- Add a per-route document `<title>` and breadcrumbs now that routing exists.
- Add a one-command deploy script (pull + publish + restart) to the backend repo.
- Consider server-driven feature flags for the disabled modules (Financials/Reports/Protocol) instead of commented nav.

---

## Maintenance note
When you change modules/endpoints/entities/flows, **update the matching `docs/*.md` and the pointers in [`CLAUDE.md`](../CLAUDE.md)**. Keep the ⚠ Needs-confirmation list shrinking as items are verified.
