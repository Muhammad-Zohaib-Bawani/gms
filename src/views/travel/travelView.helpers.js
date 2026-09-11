import { fmtDate } from "../../lib/date.js";
import { flightTypeLabel } from "../guests/modals/TravelAccordion.jsx";

// A dynamic service with this code covers the same ground as the built-in
// Arrivals & Departures board, so the two are shown as one tab.
export const AD_SERVICE_CODE = "arrival-departure";

// Per built-in tab, in STR.tabs order: flights, hotel, transfers, arrivals &
// departures. The last is two arrows running opposite ways — in and out.
export const BUILTIN_TAB_ICONS = ["flight", "hotel", "car", "arrowsExchange"];

// One week of slack around the event's own start/end date — same rule as the
// guest wizard's Arrival/Departure fields (GuestModal.jsx).
export const DATE_MARGIN_DAYS = 7;

// Edit-modal "type" (flight/hotel/transfer, matches the tab) → the travel
// state's section key (flight/accommodation/transport, matches the backend).
export const TYPE_TO_SECTION = {
  flight: "flight",
  hotel: "accommodation",
  transfer: "transport",
};

// Guest picker page size — one screenful plus a bit, so the first page paints fast.
export const GUEST_PAGE_SIZE = 20;

// A return booking is listed under both directions on the arrivals/departures
// board, so each column reads its own leg — first for the departure, last for
// the arrival — instead of the booking-level route spanning both.
export function segment(f, inbound) {
  const legs = f.legs || [];
  if (f.flightType !== "return" || legs.length < 2) return f;
  const leg = inbound ? legs[legs.length - 1] : legs[0];
  return {
    ...f,
    flightNumber: leg.flightNumber || f.flightNumber,
    departureCode: leg.departureCode,
    arrivalCode: leg.arrivalCode,
    departureTime: leg.startTime,
    arrivalTime: leg.endTime,
  };
}

export function initialsFromName(name) {
  const parts = (name || "").trim().split(/\s+/);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "?";
}

export function guestFullName(g) {
  return g.fullName || `${g.firstName || ""} ${g.lastName || ""}`.trim() || "—";
}

// "09:15 → 14:30" under a route — duration lives in its own column (see
// `flightDuration` below), not appended here. Either end is dropped
// independently when the data can't support it, so a leg missing its arrival
// still shows the departure rather than a dash.
export function timeRange(start, end) {
  const hhmm = (v) => (v ? String(v).slice(11, 16) : null);
  const a = hhmm(start);
  const b = hhmm(end);
  return a && b ? `${a} → ${b}` : a || b || "—";
}

// Elapsed time between the two ends of an itinerary, as "5h 15m" / "45m".
// Returns null when either end is missing or the pair is nonsensical.
export function flightDuration(start, end) {
  if (!start || !end) return null;
  const ms = new Date(end) - new Date(start);
  if (!Number.isFinite(ms) || ms <= 0) return null;
  const mins = Math.round(ms / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h ? `${h}h${m ? ` ${m}m` : ""}` : `${m}m`;
}

// Portal-wide DD-MM-YYYY (lib/date) — was locale-dependent 'Aug 5'.
export const dateLabelFor = (dateStr) => fmtDate(dateStr, "");

// ── Export (Excel/CSV) ───────────────────────────────────────────────────────
// No spreadsheet library on the frontend — same convention GuestsView's own
// Export button already uses: a plain CSV blob, downloaded client-side from
// data already in memory (or a one-off fetch for whatever isn't paginated in).
export function csvCell(v) {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
export function toCsv(headers, rows) {
  return [headers, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");
}
export function downloadCsv(filename, csv) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  a.download = filename;
  a.click();
}
// One export "section" — a title line, its own header row, then its data
// rows. Sections are joined with a blank line so "export everything" still
// reads as one file even though each service has its own column set.
export function csvSection(title, headers, rows) {
  return `${title}\r\n${toCsv(headers, rows)}\r\n`;
}

export const FLIGHT_EXPORT_HEADERS = ["Guest", "Email", "Flight Type", "Flight No.", "Class", "Seat", "From", "To", "Departure", "Arrival", "Status"];
export const flightExportRows = (rows, isAr) => rows.map((f) => [
  f.name, f.email, flightTypeLabel(f.flightType, isAr), f.flight,
  f.flightClass, f.seat, f.from, f.to, f.departureTime, f.arrivalTime, f.flightStatus,
]);

export const HOTEL_EXPORT_HEADERS = ["Guest", "Email", "Hotel", "Room Type", "Check-in", "Check-out"];
export const hotelExportRows = (rows) => rows.map((h) => [h.name, h.email, h.hotel, h.roomType, h.checkIn, h.checkOut]);

export const TRANSFER_EXPORT_HEADERS = ["Guest", "Vehicle", "Driver", "Driver Type", "Pickup", "Dropoff", "Date", "Time", "Status"];
export const transferExportRows = (rows) => rows.map((t) => [
  t.name, t.vehicle, t.driver,
  t.driverType === 1 ? "Fixed" : t.driverType === 2 ? "On call" : "",
  t.pickup, t.dropoff, t.date, t.time, t.transferStatus,
]);

export const MOVEMENT_EXPORT_BASE_HEADERS = ["Guest", "Email", "Inbound Flight", "Inbound From", "Inbound To", "Inbound Time", "Outbound Flight", "Outbound From", "Outbound To", "Outbound Time"];
// The board's own dynamic columns (arrival lounge, meet & greet, ...) live on
// a SEPARATE service (adService) keyed by eventGuestId, not on the movement rows
// themselves — same join the on-screen table (adColumns) already does.
export const movementExportHeaders = (adFields, isAr) => [
  ...MOVEMENT_EXPORT_BASE_HEADERS,
  ...adFields.map((f) => (isAr ? f.labelAr : null) || f.label || f.key),
];
export function movementExportRows(rows, adFields, adEntriesByGuest) {
  const legFields = (legs) => {
    const leg = (legs || [])[0];
    if (!leg) return ["", "", "", ""];
    return [leg.flightNumber || "", leg.departureCode || "", leg.arrivalCode || "", timeRange(leg.startTime, leg.endTime)];
  };
  return rows.map((r) => {
    const entries = adEntriesByGuest[r.eventGuestId] || [];
    const extra = adFields.map((f) => entries
      .map((e) => e.values?.[f.key])
      .filter((v) => v != null && String(v).trim() !== "")
      .join(" | "));
    return [r.guestName, r.email, ...legFields(r.inbound), ...legFields(r.outbound), ...extra];
  });
}

// A dynamic service's own field schema decides its columns — the entry values
// are a raw {key: value} map, same as the on-screen table reads them.
export const serviceEntryExportHeaders = (fields, isAr) => [
  "Guest", "Email", "Organization", "Service Level", "Status",
  ...fields.map((f) => (isAr ? f.labelAr : null) || f.label || f.key),
];
export const serviceEntryExportRows = (entries, fields) => entries.map((e) => [
  e.guestName, e.email, e.organization, e.serviceLevelName, e.status,
  ...fields.map((f) => e.values?.[f.key] ?? ""),
]);

// One row per participation, its bookings stacked inside. Keyed by
// eventGuestId — the same id POST /travel/guest/{eventGuestId} takes, so a row
// action can go straight to the API without another lookup.
export function groupByGuest(bookings) {
  const byGuest = new Map();
  bookings.forEach((b) => {
    if (!byGuest.has(b.eventGuestId)) {
      byGuest.set(b.eventGuestId, {
        eventGuestId: b.eventGuestId,
        name: b.name,
        email: b.email,
        photoUrl: b.photoUrl,
        tier: b.tier,
        org: b.org,
        serviceLevelName: b.serviceLevelName,
        serviceLevelColor: b.serviceLevelColor,
        bookings: [],
      });
    }
    byGuest.get(b.eventGuestId).bookings.push(b);
  });
  return [...byGuest.values()];
}

// A return booking has two segments — its own flight number and its own date,
export function flightLegRows(b) {
  return b.legs.length > 0
    ? b.legs
    : [
        {
          id: "single",
          flightNumber: b.flight,
          departureCode: b.from,
          arrivalCode: b.to,
          flightClass: b.flightClass,
          seat: b.seat,
          startTime: b.departureTime,
          endTime: b.arrivalTime,
        },
      ];
}

export function mapFlight(r) {
  return {
    bookingId: bookingIdOf(r),
    eventGuestId: r.eventGuestId,
    name: r.guestName || "—",
    email: r.email || "",
    initials: initialsFromName(r.guestName),
    tier: r.tier,
    org: r.organization,
    serviceLevelName: r.serviceLevelName || "",
    serviceLevelColor: r.serviceLevelColor || "",
    flight: r.flightNumber || "—",
    flightType: r.flightType || "",
    // Every segment, so a return booking shows both halves of the trip —
    // each leg carries its own class/seat (a return can be Business outbound,
    // Economy inbound), so this is the source of truth for the Route column.
    legs: r.legs || [],
    flightClass: r.flightClass || "—",
    seat: r.seat || "",
    from: r.departureCode || "—",
    to: r.arrivalCode || "—",
    photoUrl: r.photoUrl || "",

    date: r.date ? r.date.slice(0, 10) : "",
    dateLabel: r.date ? dateLabelFor(r.date) : "—",
    // Booking-level times off the Flights row (backend falls back to the legs).
    departureTime: r.departureTime || "",
    arrivalTime: r.arrivalTime || "",
    flightStatus: (r.status || "").toLowerCase(),
  };
}

export function mapHotel(r) {
  return {
    bookingId: bookingIdOf(r),
    eventGuestId: r.eventGuestId,
    name: r.guestName || "—",
    photoUrl: r.photoUrl || "",
    email: r.email || "",
    initials: initialsFromName(r.guestName),
    tier: r.tier,
    org: r.organization,
    serviceLevelName: r.serviceLevelName || "",
    serviceLevelColor: r.serviceLevelColor || "",
    hotel: r.hotel || "—",
    hotelImage: r.hotelImageUrl || "",
    roomType: r.roomType || "—",
    checkIn: r.checkIn || "",
    checkOut: r.checkOut || "",
  };
}

export function mapTransfer(r) {
  return {
    bookingId: bookingIdOf(r),
    eventGuestId: r.eventGuestId,
    name: r.guestName || "—",
    email: r.email || "",
    initials: initialsFromName(r.guestName),
    tier: r.tier,
    serviceLevelName: r.serviceLevelName || "",
    serviceLevelColor: r.serviceLevelColor || "",
    vehicle: r.vehicle || "—",
    photoUrl: r.photoUrl || "",

    driver: r.driverName || "—",
    driverType: r.driverType ?? null, // DriverType enum: 1 = Fixed, 2 = Open
    pickup: r.pickup || "—",
    dropoff: r.dropoff || "—",
    date: r.pickupTime ? r.pickupTime.slice(0, 10) : "",
    dateLabel: r.pickupTime ? dateLabelFor(r.pickupTime) : "—",
    time: r.pickupTime ? r.pickupTime.slice(11, 16) : "—",
    transferStatus: (r.tripStatus || "").toLowerCase(),
  };
}

// DomainPersistence.Enums.DriverType — 1 = Fixed, 2 = Open (shown as "On call").
// Colors match the green/orange already used for Active/Pending elsewhere (e.g. UsersView).
export const DRIVER_TYPE_INFO = {
  1: { en: "Fixed", ar: "ثابت", color: "#5abf6e" },
  2: { en: "On call", ar: "عند الطلب", color: "#e0a24e" },
};

const EMPTY_GUID = "00000000-0000-0000-0000-000000000000";
export const bookingIdOf = (r) => (r?.id && r.id !== EMPTY_GUID ? r.id : null);

export const STATUS_COLOR = {
  approved: "var(--ok)",
  confirmed: "var(--ok)",
  scheduled: "var(--ok)",
  arrived: "var(--ok)",
  submitted: "#e0c47e",
  pending: "#e0c47e",
  assigned: "#6ea8d8",
  "in-progress": "#e0a24e",
  "in-transit": "#e0a24e",
  // Not started
  new: "#8aa4c8",
  // Terminal / negative
  rejected: "var(--danger)",
  cancelled: "var(--danger)",
  completed: "var(--ink-mute)",
};
