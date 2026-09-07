import React from "react";
import { Icon } from "../../../../components/Icons";
import { fmtDate } from "../../../../lib/date";
import { SectionLabel } from "./guestModal.helpers";

// STEP 2 — Sessions, Tier (Service Level) & Accreditation. Moved verbatim out
// of GuestModal.jsx's inline JSX.
export default function GuestModalStep2ServiceLevel({
  sessions,
  guestSessions,
  setGuestSessions,
  serviceLevels,
  form,
  setF,
  selectedLevel,
  ruleViolations,
  canOverrideRules,
  isAr,
  t,
}) {
  return (
    <>
      <div>
        <div className="guest-modal-row-header">
          <label className="guest-modal-field-label" style={{ margin: 0 }}>
            {t.step2.sessionsOptional}
          </label>
          {sessions.length > 0 && (
            <button
              className="guest-modal-link-btn"
              onClick={() =>
                setGuestSessions((prev) =>
                  prev.size === sessions.length
                    ? new Set()
                    : new Set(sessions.map((s) => s.id)),
                )
              }
            >
              {guestSessions.size === sessions.length
                ? t.step2.deselectAll
                : t.step2.selectAll}
            </button>
          )}
        </div>
        <div className="guest-modal-session-list">
          {sessions.map((s) => {
            const checked = guestSessions.has(s.id);
            return (
              <div
                key={s.id}
                onClick={() =>
                  setGuestSessions((prev) => {
                    const n = new Set(prev);
                    n.has(s.id) ? n.delete(s.id) : n.add(s.id);
                    return n;
                  })
                }
                className={
                  "guest-modal-session-row" + (checked ? " checked" : "")
                }
              >
                <div
                  className={
                    "guest-modal-session-checkbox" +
                    (checked ? " checked" : "")
                  }
                >
                  {checked && (
                    <Icon name="check" size={9} style={{ color: "#fff" }} />
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="guest-modal-session-title">{s.title}</div>
                  <div className="guest-modal-session-meta">
                    <span style={{ fontFamily: "var(--mono)" }}>
                      {fmtDate(s.date)} · {s.time}
                    </span>
                    {s.venueName || s.room
                      ? ` · ${[s.venueName, s.room].filter(Boolean).join(" · ")}`
                      : ""}
                  </div>
                </div>
              </div>
            );
          })}
          {sessions.length === 0 && (
            <div className="guest-modal-empty-sessions">
              {t.step2.noSessions}
            </div>
          )}
        </div>
      </div>
      <div>
        <SectionLabel>{t.step2.serviceLevel}</SectionLabel>
        {(serviceLevels || []).length === 0 ? (
          <div className="guest-modal-warn-box guest-modal-warn-box--levels">
            <Icon name="alert" size={13} /> {t.step2.noLevels}
          </div>
        ) : (
          <>
            <div className="guest-modal-tier-grid">
              {serviceLevels.map((lvl) => {
                const selected = form.serviceLevelId === lvl.id;
                const full =
                  lvl.capacity != null && lvl.guestCount >= lvl.capacity;
                return (
                  <div
                    key={lvl.id}
                    onClick={() => setF("serviceLevelId", lvl.id)}
                    title={full ? t.step2.atCapacityTitle : undefined}
                    className="guest-modal-tier-tile"
                    style={{
                      border: `1px solid ${selected ? lvl.color || "var(--accent)" : "var(--glass-border)"}`,
                      background: selected
                        ? `${lvl.color || "#00627b"}1f`
                        : "var(--surface-soft-2)",
                      fontWeight: selected ? 600 : 400,
                    }}
                  >
                    <div className="guest-modal-tier-tile-row">
                      <span
                        className="guest-modal-tier-dot"
                        style={{ background: lvl.color || "var(--ink-mute)" }}
                      />
                      {(isAr ? lvl.nameAr : null) || lvl.name}
                    </div>
                    {lvl.capacity != null && (
                      <div
                        className="guest-modal-tier-capacity"
                        style={{ color: full ? "#e0c47e" : "var(--ink-faint)" }}
                      >
                        {lvl.guestCount} / {lvl.capacity}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* What this level includes — read-only, inherited by the guest. */}
            {selectedLevel && (selectedLevel.services || []).length > 0 && (
              <div className="guest-modal-includes-box">
                <div className="guest-modal-includes-label">
                  {t.step2.includes}
                </div>
                <div className="guest-modal-includes-chips">
                  {selectedLevel.services.map((s, i) => (
                    <React.Fragment key={s.serviceId}>
                      {i > 0 && (
                        <Icon
                          name="chevronRight"
                          size={10}
                          style={{ color: "var(--ink-faint)" }}
                        />
                      )}
                      <span className="chip" style={{ fontSize: 10.5 }}>
                        {(isAr ? s.nameAr : null) || s.name}
                      </span>
                    </React.Fragment>
                  ))}
                </div>
              </div>
            )}

            {/* Rule violations — blocking unless the user may override. */}
            {ruleViolations.length > 0 && (
              <div className="guest-modal-warn-box guest-modal-warn-box--rules">
                <div className="guest-modal-warn-heading">
                  <Icon name="alert" size={13} />
                  {t.step2.levelRules}
                </div>
                <ul className="guest-modal-warn-list">
                  {ruleViolations.map((v, i) => (
                    <li key={i}>{v}</li>
                  ))}
                </ul>

                {canOverrideRules ? (
                  <>
                    <label className="guest-modal-override-label">
                      <input
                        type="checkbox"
                        checked={form.overrideServiceLevelRules}
                        onChange={(e) =>
                          setF("overrideServiceLevelRules", e.target.checked)
                        }
                        style={{ accentColor: "var(--accent)", cursor: "pointer" }}
                      />
                      {t.step2.overrideCheckbox}
                    </label>
                    {form.overrideServiceLevelRules && (
                      <input
                        className="guest-modal-input"
                        style={{ marginTop: 8 }}
                        value={form.serviceLevelOverrideReason}
                        placeholder={t.step2.overrideReasonPh}
                        onChange={(e) =>
                          setF("serviceLevelOverrideReason", e.target.value)
                        }
                      />
                    )}
                  </>
                ) : (
                  <div className="guest-modal-override-permission-note">
                    {t.step2.needOverridePermission}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
      <div>
        <label
          className="guest-modal-field-label"
          style={{ marginBottom: 8 }}
        >
          {t.step2.accreditation}
        </label>
        <div className="guest-modal-accred-row">
          {[
            { value: false, label: t.step2.accredNotRequired },
            { value: true, label: t.step2.accredRequired },
          ].map((opt) => (
            <div
              key={String(opt.value)}
              onClick={() => setF("accreditationRequired", opt.value)}
              className={
                "guest-modal-accred-tile" +
                (form.accreditationRequired === opt.value ? " selected" : "")
              }
            >
              {opt.label}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
