import React from "react";
import SharedGuestCell from "../../components/GuestCell.jsx";
import { Icon } from "../../components/Icons.jsx";
import Select from "../../components/ui/Select.jsx";
import { DRIVER_TYPE_INFO, STATUS_COLOR } from "./travelView.helpers.js";

export function DriverTypeChip({ driverType, isAr }) {
  const info = DRIVER_TYPE_INFO[driverType];
  if (!info) return <span style={{ color: "var(--ink-faint)" }}>—</span>;
  return (
    <span
      className="chip"
      style={{
        color: info.color,
        background: `${info.color}1f`,
        borderColor: `${info.color}55`,
      }}
    >
      <span className="dot" style={{ background: info.color }} />
      {isAr ? info.ar : info.en}
    </span>
  );
}

export function StatusChip({ status, label }) {
  if (!status) return <span style={{ color: "var(--ink-faint)" }}>—</span>;
  const color = STATUS_COLOR[status] || "var(--ink-mute)";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "3px 9px",
        borderRadius: 20,
        fontSize: 11,
        fontWeight: 600,
        color,
        // Tints via color-mix on currentColor, same as StatusMenu: half of
        // STATUS_COLOR is a CSS variable (var(--ok), var(--danger)), and
        // `${color}18` on one of those yields `var(--ok)18` — invalid, silently
        // dropped, which is why confirmed/approved/rejected chips came out with
        // no fill and no border while the hex-valued ones looked right.
        background: "color-mix(in srgb, currentColor 12%, transparent)",
        border: "1px solid color-mix(in srgb, currentColor 32%, transparent)",
      }}
    >
      <span
        style={{
          width: 5,
          height: 5,
          borderRadius: "50%",
          background: color,
          flexShrink: 0,
        }}
      />
      {label || status}
    </span>
  );
}

// Search + one dropdown + a result count, laid out exactly like the Guests
// filter bar so the two modules read the same.
export function FilterBar({
  search,
  onSearch,
  searchPlaceholder,
  filter,
  onFilter,
  filterOptions,
  filterPlaceholder,
  shown,
  total,
  countLabel,
  extra,
}) {
  return (
    <div className="filter-bar">
      <div className="search" style={{ flex: 1, maxWidth: 320 }}>
        <Icon name="search" size={14} />
        <input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder={searchPlaceholder}
        />
      </div>
      <div style={{ minWidth: 170 }}>
        <Select
          value={filter}
          onChange={onFilter}
          options={filterOptions}
          placeholder={filterPlaceholder}
        />
      </div>
      {/* Slot for tab-specific controls (e.g. the arrivals date range). */}
      {extra}
      <span
        style={{ fontSize: 12, color: "var(--ink-mute)", whiteSpace: "nowrap" }}
      >
        {shown} {countLabel} {total}
      </span>
    </div>
  );
}

export function GuestCell({ g, withOrg, onOpen }) {
  return (
    <SharedGuestCell
      name={g.name}
      email={g.email}
      photoUrl={g.photoUrl}
      tier={g.tier}
      size={28}
      onOpen={onOpen}
    />
  );
}
