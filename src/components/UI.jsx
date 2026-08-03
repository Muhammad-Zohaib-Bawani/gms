import React from 'react';

const CHIP_I18N = {
  status: {
    en: { confirmed: "Confirmed", pending: "Awaiting", declined: "Declined", draft: "Draft", issued: "Issued", VIP: "VIP", VVIP: "VVIP" },
    ar: { confirmed: "مؤكد", pending: "في الانتظار", declined: "اعتذر", draft: "مسودة", issued: "صدرت", VIP: "VIP", VVIP: "VVIP" },
  },
  tier: {
    en: { VVIP: "VVIP", VIP: "VIP", Delegate: "Delegate", Observer: "Observer", Press: "Press", Speaker: "Speaker", Host: "Host", Staff: "Staff" },
    ar: { VVIP: "VVIP", VIP: "VIP", Delegate: "مندوب", Observer: "مراقب", Press: "صحافة", Speaker: "متحدث", Host: "مضيف", Staff: "طاقم" },
  },
};
function getLang() { return document.documentElement.getAttribute("lang") === "ar" ? "ar" : "en"; }

// Transport lifecycle statuses have no chip style of their own — they borrow the
// closest one so a "new" or "in-transit" job doesn't render unstyled.
const CHIP_CLASS_ALIAS = {
  completed: "confirmed",
  cancelled: "declined",
  new: "pending",
  assigned: "pending",
  "in-progress": "pending",
  arrived: "pending",
  "in-transit": "pending",
};

// `label` wins when the caller already localised the text (e.g. TravelView's
// STR.statuses); otherwise fall back to this component's own map.
export function StatusChip({ status, lang, label }) {
  const l = lang || getLang();
  const labels = CHIP_I18N.status[l] || CHIP_I18N.status.en;
  const cls = ["confirmed","pending","declined","draft","VIP","VVIP"].includes(status)
    ? status
    : (CHIP_CLASS_ALIAS[status] || "draft");
  return (
    <span className={`chip ${cls}`}>
      <span className="dot" />
      {label || labels[status] || status}
    </span>
  );
}

// Legacy grade chip, still used by views that only have the mirrored
// `guest.tier` string (Dashboard, Protocol). Prefer <ServiceLevelChip/> wherever
// the real ServiceLevel fields are available — it carries the admin-set colour.
//
// Tier values are now normalised to lowercase level codes ("vvip", "delegate"),
// so the lookups are case-insensitive and anything unrecognised is title-cased
// rather than rendered as a raw slug.
export function TierChip({ tier, lang }) {
  const l = lang || getLang();
  const labels = CHIP_I18N.tier[l] || CHIP_I18N.tier.en;
  if (!tier) return null;

  const key = Object.keys(labels).find((k) => k.toLowerCase() === String(tier).toLowerCase());
  const lower = String(tier).toLowerCase();
  const cls = lower === "vvip" ? "vvip" : lower === "vip" ? "vip" : "draft";
  const label = key
    ? labels[key]
    : String(tier).replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <span className={`chip ${cls}`}>
      <span className="dot" />
      {label}
    </span>
  );
}

// Service-level badge. Unlike TierChip above (whose colours came from a
// hardcoded VVIP/VIP map), this is driven entirely by the level's own configured
// `color`, because levels are admin-created per event and can be named anything.
// Falls back to the neutral "draft" chip when a guest has no level yet.
export function ServiceLevelChip({ name, nameAr, color, lang, size = 11 }) {
  const l = lang || getLang();
  const label = (l === 'ar' ? nameAr : null) || name;

  if (!label) {
    return (
      <span className="chip draft" style={{ fontSize: size }}>
        <span className="dot" />
        {l === 'ar' ? 'بدون مستوى' : 'No level'}
      </span>
    );
  }

  // No configured colour — use the neutral chip rather than inventing one.
  if (!color) {
    return (
      <span className="chip draft" style={{ fontSize: size }}>
        <span className="dot" />{label}
      </span>
    );
  }

  return (
    <span
      className="chip"
      style={{
        fontSize: size,
        color,
        background: `${color}1f`,
        borderColor: `${color}59`,
      }}
    >
      <span className="dot" style={{ background: color }} />
      {label}
    </span>
  );
}

export function Avatar({ initials, size = 32, tier, src }) {
  const ring = tier === "VVIP" ? "0 0 0 2px rgba(194, 24, 87,0.7)"
    : tier === "VIP" ? "0 0 0 2px rgba(141, 1, 52,0.4)" : "none";
  if (src) {
    return (
      <img src={src} alt="" style={{
        width: size, height: size, borderRadius: "50%", objectFit: "cover",
        boxShadow: ring, flexShrink: 0,
      }}/>
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: `linear-gradient(135deg, hsl(${(initials?.charCodeAt(0) * 13) % 360} 35% 55%) 0%, hsl(${(initials?.charCodeAt(1) * 17) % 360} 30% 35%) 100%)`,
      display: "grid", placeItems: "center",
      fontSize: size * 0.36, fontWeight: 600, color: "#fff",
      boxShadow: ring,
      flexShrink: 0,
    }}>{initials}</div>
  );
}

export function Donut({ value, max = 100, size = 140, color = "var(--accent)", label, sub }) {
  const r = (size - 24) / 2;
  const c = 2 * Math.PI * r;
  const off = c * (1 - value / max);
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg className="donut" width={size} height={size}>
        <circle cx={size/2} cy={size/2} r={r} className="track" />
        <circle cx={size/2} cy={size/2} r={r} className="seg"
          style={{ stroke: color, strokeDasharray: c, strokeDashoffset: off }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", textAlign: "center" }}>
        <div>
          <div style={{ fontFamily: "var(--serif)", fontSize: size * 0.18, lineHeight: 1 }}>{label}</div>
          {sub && <div style={{ fontSize: 11, color: "var(--ink-mute)", marginTop: 4 }}>{sub}</div>}
        </div>
      </div>
    </div>
  );
}

export function Spark({ data, color = "var(--accent)" }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const w = 90, h = 30;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / (max - min || 1)) * (h - 4) - 2;
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg className="spark" width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
      <polyline points={`0,${h} ${pts} ${w},${h}`} fill={color} opacity="0.12" stroke="none" />
    </svg>
  );
}

export function Drawer({ open, onClose, children }) {
  if (!open) return null;
  return (
    <>
      <div className="drawer-mask" onClick={onClose} />
      <div className="drawer">{children}</div>
    </>
  );
}
