import { Icon } from '../../components/Icons';

// Fixed vs flexible decides whether the event runs the Service Level flow at
// all, so it gets two explained cards instead of a dropdown — a bare
// "Fixed/Flexible" select gives no clue what either does.
export default function GuestModelPicker({ value, onChange, STR }) {
  const opts = [
    { v: "fixed", label: STR.gmFixed, hint: STR.gmFixedHint, icon: "star" },
    { v: "flexible", label: STR.gmFlexible, hint: STR.gmFlexibleHint, icon: "guests" },
  ];
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {opts.map(o => {
          const active = value === o.v;
          return (
            <button
              key={o.v}
              type="button"
              onClick={() => onChange(o.v)}
              aria-pressed={active}
              style={{
                textAlign: "start", cursor: "pointer",
                padding: "11px 12px", borderRadius: 10,
                background: active ? "var(--accent-soft)" : "var(--bg-1)",
                border: `1px solid ${active ? "var(--accent)" : "var(--glass-border)"}`,
                boxShadow: active ? "var(--shadow-xs)" : "none",
                transition: "background .16s, border-color .16s",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>
                <Icon name={o.icon} size={13} style={{ color: active ? "var(--accent)" : "var(--ink-mute)" }} />
                <span style={{ fontSize: 12.5, fontWeight: 650, color: active ? "var(--accent)" : "var(--ink)" }}>
                  {o.label}
                </span>
              </div>
              <div style={{ fontSize: 11, lineHeight: 1.45, color: "var(--ink-mute)" }}>{o.hint}</div>
            </button>
          );
        })}
      </div>
      <div style={{ fontSize: 10.5, color: "var(--ink-faint)", marginTop: 6, lineHeight: 1.5 }}>
        {STR.gmLockedHint}
      </div>
    </>
  );
}
