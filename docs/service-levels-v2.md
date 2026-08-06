# Service Levels v2 — Global, Dynamic Services

Status: **design agreed, implementation in progress**
Supersedes the per-event Service Level feature shipped in `AddServiceLevelsAndServiceCatalog`.

---

## 1. What changed and why

v1 tied both Services and Service Levels to a single event. Every event needed its own
catalogue rebuilt from scratch, and a service created for one event could never be reused.

v2 makes both **global**. A Service is created once, a Service Level is created once,
services are assigned to a level once, and that level is then available to every event —
Fixed or Flexible alike.

The second change is that a Service now owns a **form**. "Flight" is no longer a label
with a couple of ad-hoc attributes; it carries the full field configuration a user
completes for a guest. Adding a new Service in future requires no schema change and no
deployment — it is admin configuration.

---

## 2. Data model

```
Service                     ServiceLevel
─────────                   ────────────
Id, PublicId                Id, PublicId
Code          (unique)      Code          (unique)
Name / NameAr               Name / NameAr
Description                 Description, Color
SortOrder, IsActive         SortOrder, IsActive
FormSchemaJson              RequiredGuestFieldsJson
        │                            │
        └────────┬───────────────────┘
                 │
        ServiceLevelService  (assignment)
        ─────────────────────
        ServiceLevelId, ServiceId
        SortOrder            ← the completion sequence for Fixed events
        unique (ServiceLevelId, ServiceId)

        GuestServiceEntry    (one completed instance)
        ─────────────────────
        GuestId, ServiceId
        Status               pending | completed
        ValuesJson           { fieldKey: value }
        CompletedAt, CompletedBy
        index (GuestId, ServiceId)
```

### Why these four tables and not more

- **No per-event copies.** A level is defined once. Events reference it through the guest,
  so adding an event costs zero catalogue rows.
- **No status table.** A service with no `GuestServiceEntry` *is* pending. Materialising a
  "pending" row for every guest × every assigned service would create thousands of rows
  that carry no information. Status is derived, and only real work creates a row.
- **No per-level field values.** In v1 `ServiceLevelService.FieldValuesJson` held values at
  the level ("Gold includes Lounge Access with Lounge Name = Al Mourjan"). In v2 the values
  belong to the guest, because the guest is who the form is completed for. The assignment
  row now carries configuration only.
- **Multiple instances are rows, not columns.** A guest with two flights has two
  `GuestServiceEntry` rows. Nothing needs widening.

### Why `ValuesJson` rather than a normalised value table

A fully normalised `GuestServiceEntryValue(EntryId, FieldKey, Value)` would be queryable
per field, but a 12-field form completed for 1,000 guests becomes 12,000 rows per service.
That is the database bloat we were asked to avoid, in exchange for a query nothing performs
today.

JSON in a column is already this codebase's established pattern for open-ended structures
(`InvitationTemplate.DesignConfig`, `Guest.AllowedServicesJson`, `Notification.Data`).

If filtering guests *by* a field value is ever needed, the escape hatch is a computed column
over `JSON_VALUE(ValuesJson, '$.field')` with an index on it — added per field, only where a
query justifies it. No redesign required.

---

## 3. Form configuration

`Service.FormSchemaJson` holds sections, each containing fields:

```json
{
  "sections": [
    {
      "key": "outbound",
      "label": "Outbound",
      "fields": [
        { "key": "flightNumber", "label": "Flight number", "type": "text", "required": true },
        { "key": "departsAt",    "label": "Departs",       "type": "datetime", "required": true }
      ]
    }
  ]
}
```

Field types: `text`, `textarea`, `number`, `date`, `datetime`, `time`, `select`, `checkbox`.
`select` carries `options: [{value,label}]`.

Sections are presentation only — every field key is unique across the whole form, and
`ValuesJson` stays a flat `{key: value}` map. This keeps reading a value a dictionary
lookup rather than a tree walk, and means adding sections later never migrates stored data.

Repeatable groups are **not** supported: a guest needing two flights creates two entries.

### Conditional sections

A section may carry `visibleWhen: { field, values[] }` and appears only while that field
holds one of the listed values — the Outbound leg shows for trip type `outbound` or
`return`. Section level, not field level: it covers the real cases with one control an
admin can reason about.

Required fields inside a hidden section are skipped by validation, or an inbound-only
booking could never be completed.

### Lookup-backed options

A field of type `lookup` draws its options from an existing table, named by `sourceKey`
against the whitelist in `Core.Constants.ServiceLookupSources` (airports, hotels, room
types, flight classes, locations, vehicles, vehicle types, drivers, nationalities,
organisations). Adding a source is a one-line change; there is no free-text endpoint to
mistype or point somewhere unintended.

**The stored value is the row's id, not its label.** This is what preserves referential
meaning after the move to JSON: renaming an airport cannot corrupt a completed booking.
It is the mitigation for the risk in §8.

### Constraints

A short fixed list, each one control in the builder:

| Type | Rules |
|---|---|
| number | `min`, `max` |
| text, textarea | `minLength`, `maxLength` |
| date, datetime | `afterField` (must not precede another date field), `withinEventDates` |

Constraints run on draft saves as well as completion — a wrong value is wrong even in a
half-finished form. Required-field checks remain separate and gate completion only.

---

## 4. Event behaviour

`Event.GuestModel` (`fixed` | `flexible`) no longer decides *whether* service levels apply —
they now apply to both. It decides how the assigned services must be completed.

| | Flexible | Fixed |
|---|---|---|
| Service levels | Yes | Yes |
| Which services | All assigned to the level | All assigned to the level |
| Mandatory | No — every service optional | Yes — all must be completed |
| Order | Any | Must follow `ServiceLevelService.SortOrder` |
| Guest creation | Never blocked | Never blocked |

**Fixed sequencing.** A service is *unlocked* when every service before it in `SortOrder`
has at least one `completed` entry. Anything not yet reached is `pending` and cannot be
opened. Guests can always be created without services; the gate applies when services are
given, whenever that happens.

**Flexible has no lock at all.** `GuestServicePlanResponse.Slots[].IsUnlocked` is
unconditionally `true` and `IsRequired` is unconditionally `false` when `GuestModel` is
`flexible` (`ServiceCatalogService.BuildPlanAsync`: `IsUnlocked = !isFixed || blockedBy ==
null`). There is no "order" to speak of on a Flexible event — every assigned service can be
opened, filled in, skipped, or left forever, in any sequence, independent of the others. This
is not a relaxed version of the Fixed gate; it is the absence of one.

The same rule governs the **New Booking** entry point, not just the guest's Services tab —
otherwise the sequence would be trivially bypassable. `BookingModal` (the New Booking dialog
in `ServiceOpsView`) adds no locking of its own; it relies entirely on the server's
`SERVICE_SEQUENCE` rejection, which only ever fires on a Fixed event.

Enforcement is server-side. The client greys out locked services for usability, but the API
re-checks on every write, exactly as the service-level rules already do.

---

## 5. What was dropped

- **`ServiceLevel.Capacity`** and the whole capacity-cap path, including
  `ServiceLevels.OverrideRules` as it applied to capacity. A global level cannot carry a
  single meaningful "max guests" number, and per-event overrides were judged not worth the
  table.
- **`Service.EventId` / `ServiceLevel.EventId`.**
- **`ServiceLevelService.FieldValuesJson`.**

`RequiredGuestFieldsJson` is **kept** — it validates the guest record itself, which is not
event-specific, so it survives the move to global levels unchanged.

---

## 6. Migration

Existing Service / ServiceLevel / ServiceLevelService rows are **dropped**, and
`Guest.ServiceLevelId` is nulled. This was agreed as the data is test-only.

`Guest.Tier` is untouched — it remains the legacy display string that chips, CSV export and
invitation targeting read.

Because `DataSeeder.SeedAsync` is still commented out at `API/Program.cs`, any permission or
data change ships as SQL inside the EF migration, following
`20260803145215_SeedServiceLevelPermissionsAndBackfillTiers`.

---

## 7. Travel & Logistics

Flight, Accommodation and Transport become Services with dynamic forms. This is the largest
part of the change: eight backend services read the relational travel tables today
(`TravelService`, `AccommodationInventoryService`, `TransportationConflictValidator`,
`TransportationScheduleService`, `TransportAppService`, `VehicleService`, `VipAppService`,
`DashboardService`), and the arrivals & departures view, VIP app itinerary and dashboard
travel analytics all depend on them.

Sequencing it as a swap would break all of that at once, so it runs as a migration:

1. **Build** — global catalogue, dynamic forms, guest entries, ordering and status. The
   travel tables are untouched and everything continues to work. **Done.**
2. **Author** — Flight / Accommodation / Transport defined as Services with their field
   configuration.
3. **Backfill and dual-read** — existing travel rows projected into `GuestServiceEntry`;
   downstream readers moved across one at a time, each verified.
4. **Retire** — the old tables and `TravelAccordion` removed once nothing reads them.

Phase 1 is what this branch delivers. Phases 2–4 are tracked separately, because each
downstream reader losing its foreign keys (airport, hotel, vehicle, driver) needs its own
decision about how that reference survives as JSON.

---

## 8. Open risk

Dropping relational travel data for JSON loses referential integrity: an airport or vehicle
referenced by a completed form becomes a stored string, so renaming or deleting one no
longer cascades and cannot be detected. Conflict detection and inventory counting currently
rely on those foreign keys. Phase 3 has to answer this per reader — most likely by keeping
`select` options bound to a lookup id and storing the id in `ValuesJson`.


---

## 9. Operational listings

`ServiceOpsView` replaces the fixed Flights / Hotel / Ground Transfers tabs at `/travel`.
The tab strip is built from the service catalogue, so a newly created service appears there
with no code change. The previous page remains at `/travel-legacy` until phase 4.

Two rules keep a generated table readable:

- **One column per section, not per field.** The Flight form has 25 fields; a column each
  was unusable. `SectionCell` collapses a section into one cell.
- **A section that looks like a journey gets the route strip** — two lookup fields and two
  datetimes are detected as from/to/depart/arrive and drawn as the boarding-pass layout the
  old table used. Anything else falls back to a compact label/value list, so an
  unanticipated service still renders tidily. Detected rather than configured, so the
  layout is automatic.

A service whose form contains date fields also gets a schedule tab, labelled **Arrivals &
Departures**. It groups by guest — one row per guest with the dated sections side by side,
several entries stacking inside a cell — rather than one row per date, matching the layout
the travel table had before.

`GET /v1/services/{serviceId}/entries?eventId=` backs both tabs.


---

## 10. New Booking eligibility

`BookingModal`'s guest picker only lists guests whose service level actually includes the
service being booked (`ServiceLevelService` joined to `Guest.ServiceLevelId`). A guest with
no level, or a level that doesn't carry this service, is not offered — picking them would
just produce a server rejection. Give the guest a level first (via the guest form or the
"Existing Guest" flow), then book their services from here.
