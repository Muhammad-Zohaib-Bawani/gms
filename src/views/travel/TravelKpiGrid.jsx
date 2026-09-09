import React from "react";
import { Icon } from "../../components/Icons.jsx";

// Four clickable KPI cards above the tab strip — Flight bookings / Hotel
// rooms blocked / Ground transfers / Arrivals & departures. Clicking one
// switches to its tab, same as clicking the tab button itself.
//
// Each card counts every row on its tab, whatever the booking's status. Flights
// used to count only `confirmed`, which made the card disagree with both its own
// tab's "N of M" line and the other two cards.
export default function TravelKpiGrid({
  flightRows,
  hotelRows,
  transferRows,
  travellingGuests,
  builtinTab,
  allowedTabs,
  onSelectTab,
  STR,
  fmtN,
}) {
  const all = [
    {
      icon: "flight",
      val: flightRows.length,
      label: STR.kpi.flights,
      help: STR.kpi.flightsH,
      tab: 0,
    },
    {
      icon: "hotel",
      val: hotelRows.length,
      label: STR.kpi.rooms,
      help: STR.kpi.roomsH,
      tab: 1,
    },
    {
      icon: "car",
      val: transferRows.length,
      label: STR.kpi.transfers,
      help: STR.kpi.transfersH,
      tab: 2,
    },
    {
      icon: "arrowsExchange",
      val: travellingGuests,
      label: STR.kpi.movements,
      tab: 3,
    },
  ];

  // A card for a tab this role cannot open would be a number it is not allowed
  // to see, on a button that goes nowhere.
  const cards = all.filter((k) => allowedTabs.includes(k.tab));
  if (cards.length === 0) return null;

  // Floor of three columns: with one card left, stretching it across the whole
  // row turns a KPI tile into a banner. It keeps a tile's proportions and the
  // rest of the row stays empty.
  const columns = Math.max(cards.length, 3);

  return (
    <div
      className="kpi-grid"
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${columns},minmax(0,1fr))`,
        gap: 10,
        marginBottom: 14,
      }}
    >
      {cards.map((k) => {
        const on = builtinTab === k.tab;
        return (
          <div
            key={k.tab}
            className="card"
            style={{
              padding: "10px 12px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 10,
              borderColor: on ? "var(--accent)" : undefined,
              background: on ? "var(--accent-soft)" : undefined,
              transition: "background 120ms, border-color 120ms",
            }}
            onClick={() => onSelectTab(k.tab)}
          >
            <span
              style={{
                width: 30,
                height: 30,
                borderRadius: 8,
                flexShrink: 0,
                display: "grid",
                placeItems: "center",
                background: on ? "var(--accent)" : "var(--surface-soft-3)",
              }}
            >
              <Icon
                name={k.icon}
                size={14}
                style={{ color: on ? "#fff" : "var(--accent)" }}
              />
            </span>
            <div style={{ minWidth: 0 }}>
              <div
                style={{ display: "flex", alignItems: "baseline", gap: 6 }}
              >
                <span
                  style={{
                    fontFamily: "var(--serif)",
                    fontSize: 19,
                    lineHeight: 1,
                    direction: "ltr",
                  }}
                >
                  {fmtN(k.val)}
                </span>
                <span
                  style={{
                    fontSize: 10.5,
                    color: "var(--ink-mute)",
                    textTransform: "uppercase",
                    letterSpacing: "0.09em",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {k.label}
                </span>
              </div>
              {/* Several of these have no sub-line; an empty div would still
                  take up height and make the cards uneven. */}
              {k.help && (
                <div
                  style={{
                    fontSize: 10.5,
                    color: "var(--ink-faint)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {k.help}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
