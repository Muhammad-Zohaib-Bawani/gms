import { Icon } from "../../../components/Icons";
import { fmtDate } from "../../../lib/date";

export default function GuestMeetingPickerModal({
  open,
  onClose,
  t,
  loadingMeetings,
  meetings,
  guestId,
  addingMeetingId,
  onAdd,
}) {
  if (!open) return null;
  return (
    <div className="guest-drawer-modal-overlay">
      <div
        className="card glass modal-solid guest-drawer-modal-card"
        style={{ width: 380, maxHeight: "80vh", display: "flex", flexDirection: "column" }}
      >
        <div className="guest-drawer-modal-head">
          <h3 style={{ margin: 0, fontSize: 15 }}>{t.addMeet}</h3>
          <button className="icon-btn" onClick={onClose}>
            <Icon name="close" size={14} />
          </button>
        </div>
        <div style={{ padding: "14px 20px", overflowY: "auto", flex: 1 }}>
          <div style={{ fontSize: 12, color: "var(--ink-mute)", marginBottom: 10 }}>
            {t.pickMeeting}
          </div>
          {loadingMeetings ? (
            <div
              style={{
                textAlign: "center",
                color: "var(--ink-mute)",
                fontSize: 13,
                padding: "20px 0",
              }}
            >
              …
            </div>
          ) : meetings.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                color: "var(--ink-mute)",
                fontSize: 13,
                padding: "20px 0",
              }}
            >
              {t.noMeetings}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {meetings.map((m) => {
                const already = (m.guests || []).some((g) => g.id === guestId);
                const busy = addingMeetingId === m.id;
                return (
                  <div
                    key={m.id}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 9,
                      border: "1px solid var(--glass-border)",
                      background: "var(--surface-soft-2)",
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{m.name}</div>
                      <div
                        style={{
                          fontSize: 11,
                          color: "var(--ink-mute)",
                          fontFamily: "var(--mono)",
                        }}
                      >
                        {fmtDate(m.date)} {m.startTime ? `· ${m.startTime}` : ""}
                        {m.location ? ` · ${m.location}` : ""}
                      </div>
                    </div>
                    <button
                      className="btn"
                      disabled={busy || already}
                      style={{ fontSize: 11, padding: "4px 10px", flexShrink: 0 }}
                      onClick={() => onAdd(m)}
                    >
                      {already ? t.added : busy ? t.saving : t.add}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
