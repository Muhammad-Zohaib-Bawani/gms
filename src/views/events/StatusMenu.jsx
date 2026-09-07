import React, { useState, useEffect } from 'react';

// Values may be CSS vars, so tints are built with color-mix (string concat like
// `${color}18` only works for hex).
const STATUS_COLORS = { active: "var(--status-active)", planning: "#e0c47e", completed: "var(--ink-mute)", cancelled: "#e07e7e" };
const tint = (pct) => `color-mix(in srgb, currentColor ${pct}%, transparent)`;

// Allowed lifecycle transitions (mirrors the backend; the server still enforces).
const STATUS_TRANSITIONS = {
  planning: ["active", "cancelled"],
  active: ["completed", "cancelled"],
  completed: [],
  cancelled: ["planning"],
};

// Status chip that doubles as the status menu: click it to pick one of the
// transitions the lifecycle allows from the current status.
export default function StatusMenu({ status, labels, onPick, canChange, isAr }) {
  const [open, setOpen] = useState(false);
  const ref = React.useRef(null);
  const nexts = STATUS_TRANSITIONS[status] || [];
  const interactive = canChange && nexts.length > 0;

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const color = STATUS_COLORS[status] || "var(--accent)";

  return (
    <div ref={ref} style={{ position: "relative", flexShrink: 0 }}>
      <button
        type="button"
        disabled={!interactive}
        onClick={() => setOpen(o => !o)}
        title={interactive ? (isAr ? "تغيير الحالة" : "Change status") : undefined}
        style={{
          display: "flex", alignItems: "center", gap: 6, fontSize: 11,
          padding: "5px 10px", borderRadius: 20, color,
          border: `1px solid ${tint(35)}`, background: tint(14),
          cursor: interactive ? "pointer" : "default",
        }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor" }}/>
        {labels[status]}
        {interactive && (
          <svg viewBox="0 0 12 12" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1.6"
            style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>
            <path d="M3 4.5L6 8 9 4.5"/>
          </svg>
        )}
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", insetInlineEnd: 0,
          minWidth: 150, padding: 4, zIndex: 200,
          background: "var(--popover-bg)", border: "1px solid var(--glass-border-strong)",
          borderRadius: 10, boxShadow: "0 18px 44px rgba(0,0,0,0.45)",
        }}>
          {nexts.map(next => (
            <button key={next} type="button"
              onClick={() => { setOpen(false); onPick(next); }}
              style={{
                display: "flex", alignItems: "center", gap: 8, width: "100%",
                padding: "7px 9px", borderRadius: 7, border: "none", cursor: "pointer",
                background: "transparent", color: "var(--ink)", fontSize: 12, textAlign: "start",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "var(--hover-tint)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: STATUS_COLORS[next], flexShrink: 0 }}/>
              {labels[next]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
