// Small shared pieces for the Add/Edit Guest modal, pulled out of GuestModal.jsx
// verbatim (no behavior or style changes).

// Module scope on purpose: defining this inside the component gives it a
// fresh identity every render, remounting the label DOM on every keystroke.
export function FieldLabel({ children }) {
  return <label className="guest-modal-field-label">{children}</label>;
}

export function SectionLabel({ children }) {
  return (
    <label className="guest-modal-field-label guest-modal-section-label">
      {children}
    </label>
  );
}

export const EMPTY_GUEST = {
  firstName: "",
  lastName: "",
  email: "",
  guestType: "delegate",
  organizationId: "",
  nationalityId: "",
  serviceLevelId: "",
  invitationStatus: "not_sent",
  arrivalDate: "",
  departureDate: "",
  photoUrl: "",
  accreditationRequired: false,
  // Set when the user chooses to push past a failing level rule. The backend
  // re-checks the permission, so ticking this without it changes nothing.
  overrideServiceLevelRules: false,
  serviceLevelOverrideReason: "",
};

export function guestToForm(g) {
  if (!g) return { ...EMPTY_GUEST };
  return {
    firstName: g.firstName || "",
    lastName: g.lastName || "",
    email: g.email || "",
    guestType: g.guestType || "delegate",
    organizationId: g.organizationId || "",
    nationalityId: g.nationalityId || "",
    serviceLevelId: g.serviceLevelId || "",
    invitationStatus: g.invitationStatus || "not_sent",
    arrivalDate: g.arrivalDate || "",
    departureDate: g.departureDate || "",
    photoUrl: g.photoUrl || "",
    accreditationRequired: !!g.accreditationRequired,
    overrideServiceLevelRules: false,
    serviceLevelOverrideReason: "",
  };
}

// Colour per tier code. Only the colours live here — the codes and their
// bilingual labels come from GET /v1/lookups/enums/guest (GuestEnumCatalog on
// the server), so the vocabulary has one source of truth.
export const TIER_COLORS = {
  vvip: "#e0b864",
  vip: "#a78bda",
  speaker: "var(--accent)",
  delegate: "#5abf6e",
  press: "var(--danger)",
  observer: "var(--ink-mute)",
};

// Not currently rendered anywhere in the modal (the step-2 tier grid inlines
// its own picker) — kept as-is from the original file rather than removed,
// since deleting unused-but-exported code isn't in scope for this move.
export function LegacyTierPicker({ value, onChange, isAr, options }) {
  const current = (value || "").toLowerCase();
  if (!options?.length) {
    return (
      <div style={{ fontSize: 12, color: "var(--ink-mute)" }}>
        {isAr ? "جارٍ التحميل…" : "Loading…"}
      </div>
    );
  }
  return (
    <div
      style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}
    >
      {options.map((opt) => {
        const t = {
          code: opt.code,
          label: (isAr ? opt.nameAr : null) || opt.name,
          color: TIER_COLORS[opt.code] || "var(--ink-mute)",
        };
        const selected = current === String(t.code).toLowerCase();
        return (
          <div
            key={t.code}
            onClick={() => onChange(t.code)}
            style={{
              padding: "10px",
              borderRadius: 10,
              cursor: "pointer",
              textAlign: "center",
              border: `1px solid ${selected ? t.color : "var(--glass-border)"}`,
              background: selected
                ? "var(--accent-soft)"
                : "var(--surface-soft-2)",
              fontSize: 13,
              fontWeight: selected ? 600 : 400,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  flexShrink: 0,
                  background: t.color,
                }}
              />
              {t.label}
            </div>
          </div>
        );
      })}
    </div>
  );
}
