import React from "react";
import { Icon } from "../../components/Icons.jsx";
import ActionMenu from "../../components/ui/ActionMenu.jsx";
import { BUILTIN_TAB_ICONS } from "./travelView.helpers.js";

// The built-in tab strip (Flights/Hotel/Transfers/Arrivals & Departures) plus
// every dynamic service's own tab, and — on the right — the export dropdown
// and (when no dynamic service tab is open) the New Booking button.
// `allowedTabs` is the built-in tab indexes this role may read — each tab is a
// permission row of its own, so a role can hold Transfers without Flights. The
// indexes are preserved (not re-numbered) because every caller, and the panels
// below, still address tabs by their original position.
export default function TravelTabsBar({
  STR,
  isAr,
  builtinTab,
  svcId,
  dynServices,
  allowedTabs,
  onSelectBuiltinTab,
  onSelectServiceTab,
  exportAllServices,
  exportCurrentService,
  exportFilteredService,
  activeFilterCount = 0,
  canManage = true,
  onOpenNewBooking,
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        marginBottom: 16,
        justifyContent: "space-between",
        flexWrap: "wrap",
      }}
    >
      <div
        className="tabs"
        style={{ marginBottom: 0, minWidth: 0, overflowX: "auto" }}
      >
        {allowedTabs.map((i) => (
          <button
            key={i}
            className={`tab${builtinTab === i ? " active" : ""}`}
            onClick={() => onSelectBuiltinTab(i)}
          >
            <Icon name={BUILTIN_TAB_ICONS[i]} size={13} /> {STR.tabs[i]}
          </button>
        ))}
        {dynServices.map((s) => (
          <button
            key={s.id}
            className={`tab${svcId === s.id ? " active" : ""}`}
            onClick={() => onSelectServiceTab(s.id)}
          >
            {s.icon && <Icon name={s.icon} size={13} />}
            {(isAr ? s.nameAr : null) || s.name}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
        <ActionMenu
          align="end"
          menuWidth={260}
          trigger={({ toggle, ref }) => (
            <button ref={ref} type="button" className="btn" onClick={toggle}>
              <Icon name="excel" size={14} /> {STR.exportExcel}
              <Icon name="chevronDown" size={12} style={{ marginInlineStart: 2 }} />
            </button>
          )}
          items={[
            { label: STR.exportAll, hint: STR.exportAllHint, icon: "excel", onClick: exportAllServices },
            { label: STR.exportCurrent, hint: STR.exportCurrentHint, icon: "excel", onClick: exportCurrentService },
            // Only offered once something is actually filtered: with nothing
            // applied it would export the same rows as "current service" under
            // a name saying otherwise. Covers the dynamic-service tabs too —
            // their filters live inside ServiceOpsView, so the count is 0 and
            // the option stays hidden. ActionMenu drops falsy items.
            activeFilterCount > 0 && {
              label: `${STR.exportFiltered} (${activeFilterCount})`,
              hint: STR.exportFilteredHint,
              icon: "filter",
              onClick: exportFilteredService,
            },
          ]}
        />
        {!svcId && canManage && (
          <button
            className="btn primary"
            onClick={onOpenNewBooking}
          >
            <Icon name="plus" size={14} /> {STR.newBooking}
          </button>
        )}
      </div>
    </div>
  );
}
