import React from "react";
import SharedGuestCell from "../../components/GuestCell.jsx";
import { ServiceLevelChip } from "../../components/UI.jsx";
import { Icon } from "../../components/Icons.jsx";
import ActionMenu from "../../components/ui/ActionMenu.jsx";
import { fmtDate, fmtDateTime } from "../../lib/date.js";
import { flightTypeLabel } from "../guests/modals/TravelAccordion.jsx";
import { allFormFields } from "../../components/ui/DynamicFields.jsx";
import FlightLegCell from "./FlightLegCell.jsx";
import { DriverTypeChip, StatusChip, GuestCell } from "./parts.jsx";
import {
  segment,
  timeRange,
  flightDuration,
  dateLabelFor,
  flightLegRows,
} from "./travelView.helpers.js";

// One booking per row, so Edit always knows which record it means.
function actionsCellFor({ STR, isAr, removingId, openEdit, openAdd, removeBooking }) {
  return (type, b) => (
    <ActionMenu
      items={
        // A row for a guest who only OWES this service has no booking behind it,
        // so there is nothing to edit or remove — the menu offers the one way in,
        // which opens the same single-service modal rather than sending the user
        // to New Booking to re-pick the guest they are already looking at.
        !b.bookingId
          ? [{
              label: isAr ? "إضافة" : "Add",
              icon: "plus",
              onClick: () => openAdd?.(type, b),
            }]
          : [
              { label: STR.edit, icon: "edit", onClick: () => openEdit(type, b) },
              {
                label: isAr ? "إزالة" : "Remove",
                icon: "trash",
                danger: true,
                disabled: removingId === b.bookingId,
                onClick: () => removeBooking(type, b.bookingId),
              },
            ]
      }
    />
  );
}

function nightsFor(ad) {
  return (r) => {
    try {
      const a = new Date(r.checkIn),
        b = new Date(r.checkOut);
      const d = Math.round((b - a) / 86400000);
      return isNaN(d) ? "—" : ad(d);
    } catch {
      return "—";
    }
  };
}

// Column sets for the Flights / Hotel / Ground Transfers tables. Extracted
// from TravelView's `columns` useMemo — same shape, same closures, just
// parameterized instead of reading component-scope variables directly.
export function buildBookingColumns({ STR, isAr, ad, navigate, removingId, openEdit, openAdd, removeBooking, canManage = true }) {
  const actionsCell = actionsCellFor({ STR, isAr, removingId, openEdit, openAdd, removeBooking });
  const nights = nightsFor(ad);

  const guest = (withOrg = true) => ({
    id: "guest",
    header: STR.cols.guest,
    enableSorting: false,
    cell: ({ row }) => (
      <GuestCell
        g={row.original}
        withOrg={withOrg}
        onOpen={() => navigate(`/guests/${row.original.eventGuestId}`)}
      />
    ),
  });

  // Right after Guest in every tab here — one guest, one service level,
  // so this reads off the grouped row itself rather than being stacked
  // per-booking like the columns below it.
  const serviceLevelCol = {
    id: "serviceLevel",
    header: isAr ? "مستوى الخدمة" : "Service Level",
    enableSorting: false,
    cell: ({ row }) => (
      <ServiceLevelChip name={row.original.serviceLevelName} color={row.original.serviceLevelColor} lang={isAr ? "ar" : "en"} size={10.5} />
    ),
  };

  const stacked = (renderOne) => (bookings) =>
    bookings.length === 1 ? (
      renderOne(bookings[0])
    ) : (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {bookings.map((b, i) => (
          <div
            key={b.bookingId || i}
            style={
              i > 0
                ? {
                    paddingTop: 10,
                    borderTop: "1px dotted #14161a45",
                  }
                : undefined
            }
          >
            {renderOne(b)}
          </div>
        ))}
      </div>
    );
  const col = (id, header, render, size) => ({
    id,
    header,
    enableSorting: false,
    ...(size ? { size } : null),
    cell: ({ row }) => stacked(render)(row.original.bookings),
  });
  // Read-only role: no row menu at all — every item behind it writes.
  const actions = (type) => (canManage ? [{
    id: "actions",
    header: "",
    size: 40,
    enableSorting: false,
    cell: ({ row }) =>
      stacked((b) => actionsCell(type, b))(row.original.bookings),
  }] : []);

  // nowrap: a DD-MM-YYYY date was wrapping onto two lines in the narrower date
  // columns, which made every row in the table taller than it needed to be.
  const mono = { fontFamily: "var(--mono)", fontSize: 12, whiteSpace: "nowrap" };
  const muted = { fontSize: 11, color: "var(--ink-mute)" };
  const ellipsis = {
    ...muted,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    maxWidth: 130,
  };
  const text = { fontSize: 12 };

  return {
    flights: [
      guest(),
      serviceLevelCol,

      col("flight", STR.cols.flight, (b) => (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {flightLegRows(b).map((l, idx) => (
            <span key={l.id || idx} style={{ ...mono, fontWeight: 600 }}>
              {l.flightNumber || "—"}
            </span>
          ))}
        </div>
      )),
      col("flightType", STR.cols.flightType, (b) => (
        <span style={text}>{flightTypeLabel(b.flightType, isAr)}</span>
      )),
      col("route", STR.cols.route, (b) => (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {flightLegRows(b).map((l, idx) => {
            const meta = [l.flightClass, l.seat]
              .filter((v) => v && v !== "—")
              .join(" · ");
            return (
              <div key={l.id || idx}>
                <div
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize: 12,
                    color: "var(--ink)",
                  }}
                >
                  {l.departureCode} → {l.arrivalCode}
                </div>
                {meta && (
                  <div style={{ ...muted, fontFamily: "var(--mono)" }}>
                    {meta}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )),
      col("date", STR.cols.date, (b) => (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {flightLegRows(b).map((l, idx) => (
            <div key={l.id || idx}>
              <div style={mono}>{dateLabelFor(l.startTime) || "—"}</div>
              <div style={{ ...muted, fontFamily: "var(--mono)" }}>
                {ad(timeRange(l.startTime, l.endTime))}
              </div>
            </div>
          ))}
        </div>
      )),
      // No booking behind the row = the guest still owes a flight; without the
      // fallback the chip would look up STR.statuses[undefined].
      col("status", STR.cols.status, (b) => {
        const status = b.bookingId ? b.flightStatus : "pending";
        return <StatusChip status={status} label={STR.statuses[status]} />;
      }),
      ...actions("flight"),
    ],
    hotels: [
      guest(),
      serviceLevelCol,
      col("hotel", STR.cols.hotel, (b) => (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {b.hotelImage && (
            <img
              src={b.hotelImage}
              alt=""
              style={{
                width: 30,
                height: 24,
                objectFit: "cover",
                borderRadius: 4,
                flexShrink: 0,
              }}
              onError={(e) => {
                e.target.style.display = "none";
              }}
            />
          )}
          <span style={{ ...text, fontWeight: 500 }}>{b.hotel}</span>
        </div>
      )),
      col("room", STR.cols.room, (b) => (
        <span style={text}>{b.roomType}</span>
      )),
      col("checkIn", STR.cols.checkIn, (b) => (
        <span style={mono}>{fmtDateTime(b.checkIn)}</span>
      ), 150),
      col("checkOut", STR.cols.checkOut, (b) => (
        <span style={mono}>{fmtDateTime(b.checkOut)}</span>
      ), 150),
      col("nights", STR.cols.nights, (b) => (
        <span style={{ ...mono, color: "var(--ink-mute)" }}>{nights(b)}</span>
      )),
      // A stay has no status column of its own on the row — an accommodation
      // booking either exists or it doesn't — so it's derived: no booking behind
      // the row means the guest still owes the service.
      col("status", STR.cols.status, (b) => {
        const status = b.bookingId ? "confirmed" : "pending";
        return <StatusChip status={status} label={STR.statuses[status]} />;
      }),
      ...actions("hotel"),
    ],
    transfers: [
      guest(false),
      serviceLevelCol,
      col("vehicle", STR.cols.vehicle, (b) => (
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Icon
            name="car"
            size={13}
            style={{ color: "var(--accent)", flexShrink: 0 }}
          />
          <span style={text}>{b.vehicle}</span>
        </div>
      )),
      col("driver", STR.cols.driver, (b) => (
        <span style={text}>{b.driver}</span>
      )),
      col("driverType", STR.cols.driverType, (b) => (
        <DriverTypeChip driverType={b.driverType} isAr={isAr} />
      )),
      col("pickup", STR.cols.pickup, (b) => (
        <div style={ellipsis}>{b.pickup}</div>
      )),
      col("dropoff", STR.cols.dropoff, (b) => (
        <div style={ellipsis}>{b.dropoff}</div>
      )),
      col("date", STR.cols.date, (b) => (
        <div>
          <div style={{ fontFamily: "var(--mono)", fontSize: 11, whiteSpace: "nowrap" }}>
            {b.dateLabel || "—"}
          </div>
          <div style={{ ...muted, fontFamily: "var(--mono)", whiteSpace: "nowrap" }}>
            {ad(b.time)}
          </div>
        </div>
      ), 120),
      col("status", STR.cols.status, (b) => {
        const status = b.bookingId ? b.transferStatus : "pending";
        return <StatusChip status={status} label={STR.statuses[status]} />;
      }),
      ...actions("transfer"),
    ],
  };
}

// Arrivals & Departures board columns — guest, service level, one column per
// direction (each a stack of FlightLegCell cards), then one column per field
// on the "arrivals-departures" dynamic service.
export function buildAdColumns({ STR, isAr, adDirection, adService, adEntries, adDisplay, onEditEntry }) {
  const showInbound = adDirection !== "outbound";
  const showOutbound = adDirection !== "inbound";

  const directionFits = (f) => {
    const t = `${f.key || ""} ${f.label || ""}`.toLowerCase();
    if (/arriv|inbound/.test(t)) return showInbound;
    if (/depart|outbound/.test(t)) return showOutbound;
    return true;
  };

  // One column per direction, each holding the whole leg. The flight number
  // used to live in its own column away from the route it belonged to, and
  // duration had a column per direction; both now sit inside the leg card.
  const routeColumn = (id, header, pick, inbound) => ({
    id,
    header,
    enableSorting: false,
    cell: ({ row }) => (
      <FlightLegCell
        flights={(pick(row.original) || []).map((f0) => ({
          ...segment(f0, inbound),
          id: f0.id,
        }))}
        inbound={inbound}
        dateLabelFor={dateLabelFor}
        flightDuration={flightDuration}
      />
    ),
  });

  return [
    {
      id: "guest",
      header: STR.cols.guest,
      enableSorting: false,
      cell: ({ row }) => {
        const g = row.original;
        return (
          <SharedGuestCell
            name={g.guestName}
            email={g.email}
            photoUrl={g.photoUrl}
            tier={g.tier}
            size={28}
          />
        );
      },
    },
    {
      id: "serviceLevel",
      header: isAr ? "مستوى الخدمة" : "Service Level",
      enableSorting: false,
      cell: ({ row }) => (
        <ServiceLevelChip name={row.original.serviceLevelName} color={row.original.serviceLevelColor} lang={isAr ? "ar" : "en"} size={10.5} />
      ),
    },
    ...(showInbound
      ? [
          routeColumn(
            "inbound",
            STR.cols.inboundRoute,
            (r) => r.inbound,
            true,
          ),
        ]
      : []),
    ...(showOutbound
      ? [
          routeColumn(
            "outbound",
            STR.cols.outboundRoute,
            (r) => r.outbound,
            false,
          ),
        ]
      : []),
    // The "arrivals-departures" service's own data: ONE COLUMN PER FIELD, its
    // value in the row — not one column per section. A section cell packed
    // several labelled values into one box, which reads fine as a summary but
    // can't be scanned down a column or lined up between guests.
    ...allFormFields(adService?.form)
      .filter(directionFits)
      .map((f) => ({
        id: `svc-${f.key}`,
        header: (isAr ? f.labelAr : null) || f.label || f.key,
        enableSorting: false,
        cell: ({ row }) => {
          const entries = adEntries[row.original.eventGuestId] || [];
          if (entries.length === 0) {
            return (
              <span style={{ fontSize: 11.5, color: "var(--ink-faint)" }}>
                —
              </span>
            );
          }
          // Several entries for one guest stack in the cell rather than splitting
          // the guest across rows — the board is one line per traveller.
          return (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {entries.map((e) => (
                <span
                  key={e.entryId}
                  style={{ fontSize: 12, whiteSpace: "nowrap" }}
                >
                  {adDisplay(f, e.values?.[f.key])}
                </span>
              ))}
            </div>
          );
        },
      })),
    // The dynamic "arrivals-departures" service's own entries had no way to
    // edit them from this board at all — the flight legs above are edited from
    // the Flights tab, but this service's own field values (arrival lounge,
    // meet & greet, ...) were read-only here, full stop. One Edit per entry,
    // same booking modal every other dynamic service uses.
    ...(onEditEntry ? [{
      id: "svc-actions",
      header: "",
      size: 44,
      enableSorting: false,
      cell: ({ row }) => {
        const entries = adEntries[row.original.eventGuestId] || [];
        if (entries.length === 0) return null;
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {entries.map((e) => (
              <ActionMenu
                key={e.entryId}
                items={[
                  { label: STR.edit, icon: "edit", onClick: () => onEditEntry(e) },
                ]}
              />
            ))}
          </div>
        );
      },
    }] : []),
  ];
}
