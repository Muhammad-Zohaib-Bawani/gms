import React, { useEffect, useRef, useState } from "react";
import { Icon } from "../../components/Icons.jsx";
import Select from "../../components/ui/Select.jsx";

// Search + a Filters button that opens a panel of dropdowns, replacing the one
// inline dropdown each travel tab used to get. Every tab declares its own
// `fields`, so Flights can filter by class and direction while Transfers
// filters by driver type — and Service Level, which they all share, is just
// another field rather than a special case.
//
// Same shape as the Guests page's filter panel (badge count on the button,
// "Clear all" inside, closes on outside click or Escape) so the two modules
// still read as one product.
export default function TravelFilters({
  search,
  onSearch,
  searchPlaceholder,
  // [{ key, label, options, placeholder }] — `options[0]` is the "any" row.
  fields = [],
  values = {},
  onChange,
  onClear,
  shown,
  total,
  countLabel,
  extra,
  filtersLabel = "Filters",
  clearLabel = "Clear all",
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  // A field counts as active when it isn't sitting on its "any" value, which is
  // whatever its first option is — so a tab can use "All hotels" or "All"
  // without this needing to know.
  const activeCount = fields.filter((f) => {
    const anyValue = f.options?.[0]?.value;
    return values[f.key] !== undefined && values[f.key] !== anyValue;
  }).length;

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      const t = e.target;
      // Select portals its dropdown to <body> (menuPortalTarget in
      // components/ui/Select), so a click on an option is NOT inside this
      // panel. Closing on it tore the panel down before react-select saw the
      // click, which made every dropdown in here look broken.
      if (t instanceof Element
        && t.closest(".gms-select__menu, .gms-select__menu-portal")) return;
      if (!wrapRef.current?.contains(t)) setOpen(false);
    };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

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

      <div style={{ position: "relative" }} ref={wrapRef}>
        <button
          type="button"
          className={`btn${open ? " primary" : ""}`}
          onClick={() => setOpen((o) => !o)}
          style={{ position: "relative" }}
          title={filtersLabel}
        >
          <Icon name="filter" size={14} />
          {filtersLabel}
          {activeCount > 0 && (
            <span style={{
              position: "absolute", top: -6, insetInlineEnd: -6,
              minWidth: 16, height: 16, borderRadius: 8, padding: "0 4px",
              background: "var(--accent)", color: "#fff",
              fontSize: 10, fontWeight: 700,
              display: "grid", placeItems: "center", lineHeight: 1,
            }}>
              {activeCount}
            </span>
          )}
        </button>

        {open && (
          <div style={{
            position: "absolute", top: "calc(100% + 8px)", insetInlineStart: 0,
            width: 320, zIndex: 200, padding: 14, borderRadius: 12,
            background: "var(--popover-bg)",
            border: "1px solid var(--glass-border-strong)",
            boxShadow: "0 24px 50px -16px rgba(0,0,0,0.7), 0 6px 16px -6px rgba(0,0,0,0.45)",
            display: "flex", flexDirection: "column", gap: 12,
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)" }}>
                {filtersLabel}
              </span>
              {activeCount > 0 && (
                <button
                  type="button"
                  onClick={onClear}
                  style={{
                    background: "none", border: "none", color: "var(--accent-ink)",
                    fontSize: 11.5, cursor: "pointer", padding: 0,
                  }}
                >
                  {clearLabel}
                </button>
              )}
            </div>

            {fields.map((f) => (
              <div key={f.key}>
                <label style={{
                  display: "block", fontSize: 10.5, color: "var(--ink-mute)",
                  textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 5,
                }}>
                  {f.label}
                </label>
                <Select
                  value={values[f.key]}
                  onChange={(v) => onChange(f.key, v || f.options?.[0]?.value)}
                  options={f.options}
                  placeholder={f.placeholder || f.label}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Slot for tab-specific inline controls (e.g. the arrivals date range). */}
      {extra}

      <span style={{ fontSize: 12, color: "var(--ink-mute)", whiteSpace: "nowrap" }}>
        {shown} {countLabel} {total}
      </span>
    </div>
  );
}
