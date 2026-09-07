import { Icon } from "../../../components/Icons";
import { fmtDate } from "../../../lib/date";
import { SESSIONS } from "../../../data/mockData";

// The Sessions section: header + count badge, the "select all/deselect all"
// checklist when editing, the read-only list, and the empty state.
//
// Note: the "Edit"/"Cancel" toggle button for entering edit mode is itself
// commented out in the original source (so `editSessions` can never actually
// become true through the UI today) — that comment is preserved verbatim
// below rather than deleted, since unlike the Travel/Activity sections this
// one was not called out as confirmed-dead in the refactor brief.
export default function GuestSessionsPanel({
  t,
  isAr,
  guestSessions,
  setGuestSessions,
  editSessions,
  setEditSessions,
  sessionsSaved,
  toggleSession,
  saveSessions,
}) {
  return (
    <>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 10,
        }}
      >
        <div
          className="guest-drawer-section-title"
          style={{ display: "flex", alignItems: "center", gap: 8 }}
        >
          {t.sessionsTitle}
          {guestSessions.size > 0 && (
            <span
              style={{
                fontSize: 10,
                background: "var(--accent)",
                color: "#fff",
                borderRadius: 10,
                padding: "1px 7px",
                letterSpacing: 0,
                textTransform: "none",
              }}
            >
              {guestSessions.size}
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {sessionsSaved && (
            <span
              style={{
                fontSize: 11,
                color: "var(--accent)",
                display: "flex",
                alignItems: "center",
                gap: 3,
              }}
            >
              <Icon name="check" size={11} /> {t.sessionsSaved}
            </span>
          )}
          {/* <button className="btn ghost" style={{ padding: "3px 8px", fontSize: 11 }} onClick={() => setEditSessions(e => !e)}>
              <Icon name={editSessions ? "close" : "edit"} size={11}/> {editSessions ? t.cancel : t.editTravel}
            </button> */}
        </div>
      </div>
      {editSessions ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 6,
            marginBottom: 14,
          }}
        >
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              onClick={() =>
                setGuestSessions((prev) =>
                  prev.size === SESSIONS.length
                    ? new Set()
                    : new Set(SESSIONS.map((s) => s.id)),
                )
              }
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: 11,
                color: "var(--accent)",
                padding: 0,
              }}
            >
              {guestSessions.size === SESSIONS.length
                ? t.deselectAll
                : t.selectAll}
            </button>
          </div>
          {SESSIONS.map((s) => {
            const checked = guestSessions.has(s.id);
            return (
              <div
                key={s.id}
                onClick={() => toggleSession(s.id)}
                className="guest-drawer-session-item guest-drawer-session-item--checkable"
                style={{
                  border: `1px solid ${checked ? "var(--accent)" : "var(--glass-border)"}`,
                  background: checked
                    ? "rgba(141, 1, 52,0.08)"
                    : "var(--surface-soft-2)",
                }}
              >
                <div
                  className="guest-drawer-session-checkbox"
                  style={{
                    border: `2px solid ${checked ? "var(--accent)" : "var(--glass-border)"}`,
                    background: checked ? "var(--accent)" : "transparent",
                  }}
                >
                  {checked && <Icon name="check" size={9} style={{ color: "#fff" }} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    className="guest-drawer-session-title"
                    style={{ fontWeight: checked ? 500 : 400, lineHeight: 1.3 }}
                  >
                    {s.title}
                  </div>
                  <div className="guest-drawer-session-meta guest-drawer-session-meta--ellipsis">
                    <span className="guest-drawer-session-meta-mono">
                      {fmtDate(s.date)} · {s.time}
                    </span>
                    {" · "}
                    {s.venue}
                    {s.room ? ` · ${s.room}` : ""}
                  </div>
                </div>
              </div>
            );
          })}
          <button
            className="btn primary"
            style={{ alignSelf: "flex-end", marginTop: 2 }}
            onClick={saveSessions}
          >
            <Icon name="check" size={13} /> {t.saveTravel}
          </button>
        </div>
      ) : guestSessions.size === 0 ? (
        <div
          style={{
            fontSize: 12,
            color: "var(--ink-mute)",
            fontStyle: "italic",
            marginBottom: 14,
          }}
        >
          {t.noSessions}
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 6,
            marginBottom: 14,
          }}
        >
          {SESSIONS.filter((s) => guestSessions.has(s.id)).map((s) => (
            <div key={s.id} className="guest-drawer-session-item guest-drawer-session-item--readonly">
              <div className="guest-drawer-session-title" style={{ fontWeight: 500 }}>
                {s.title}
              </div>
              <div className="guest-drawer-session-meta">
                <span className="guest-drawer-session-meta-mono">
                  {fmtDate(s.date)} · {s.time}
                </span>
                {" · "}
                {s.venue}
                {s.room ? ` · ${s.room}` : ""}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
