import { Icon } from '../../components/Icons';
import ActionMenu from '../../components/ui/ActionMenu';
import { fmtDate } from '../../lib/date';
import SessionForm from './SessionForm';

export default function SessionsPanel({
  selectedEvent, canManage, STR, isAr, ad,
  setShowNewSession, editSessionId, setEditSessionId, saveEditSession,
  venues, venuesLoading, setConfirmDelete,
}) {
  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--glass-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <span style={{ fontWeight: 500, fontSize: 13 }}>{STR.sessions}</span>
          <span style={{ fontSize: 11, color: "var(--ink-mute)", marginInlineStart: 8 }}>{ad(selectedEvent.sessions.length)}</span>
        </div>
        {canManage && (
          <button className="btn primary" style={{ padding: "5px 12px", fontSize: 11 }} onClick={() => setShowNewSession(true)}>
            <Icon name="plus" size={12}/> {STR.addSession}
          </button>
        )}
      </div>

      {selectedEvent.sessions.length === 0 ? (
        <div style={{ padding: "32px", textAlign: "center", color: "var(--ink-mute)", fontSize: 13 }}>
          {STR.noSessions}
        </div>
      ) : (
        <div>
          {[...selectedEvent.sessions]
            .sort((a, b) => (a.date || "").localeCompare(b.date || "") || (a.time || "").localeCompare(b.time || ""))
            .map(s => (
            <div key={s.id} style={{ padding: "12px 18px", borderBottom: "1px solid var(--glass-border)" }}>
              {editSessionId === s.id ? (
                <div style={{ padding: "4px 0" }}>
                  <SessionForm session={s} evId={selectedEvent.id} event={selectedEvent} onSave={saveEditSession} onCancel={() => setEditSessionId(null)}
                    isAr={isAr} STR={STR} venues={venues} venuesLoading={venuesLoading}/>
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  {s.image ? (
                    <img src={s.image} alt="" style={{ width: 40, height: 40, borderRadius: 8, objectFit: "cover", flexShrink: 0 }}/>
                  ) : (
                    <div style={{ width: 40, height: 40, borderRadius: 8, flexShrink: 0, background: "var(--surface-soft-3)", display: "grid", placeItems: "center" }}>
                      <Icon name="calendar" size={15} style={{ color: "var(--ink-faint)" }}/>
                    </div>
                  )}
                  <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--accent)", direction: "ltr", width: 36, flexShrink: 0 }}>{s.time}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{s.title}</div>
                    <div style={{ fontSize: 11, color: "var(--ink-mute)", marginTop: 2, display: "flex", gap: 10, flexWrap: "wrap" }}>
                      {s.venue && <span><Icon name="venue" size={10}/> {s.venue}</span>}
                      {s.room && <span style={{ color: "var(--ink-faint)" }}>· {s.room}</span>}
                      {s.speaker && <span><Icon name="guests" size={10}/> {s.speaker}</span>}
                      {s.capacity && <span><Icon name="seating" size={10}/> {ad(s.capacity)}</span>}
                    </div>
                  </div>
                  <span style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--ink-mute)", marginInlineEnd: 8 }}>{fmtDate(s.date)}</span>
                  {canManage && (
                    <ActionMenu items={[
                      { label: STR.edit || (isAr ? 'تعديل' : 'Edit'), icon: 'edit', onClick: () => setEditSessionId(s.id) },
                      { label: isAr ? 'حذف' : 'Delete', icon: 'trash', danger: true,
                        onClick: () => setConfirmDelete({ type: "session", id: s.id, evId: selectedEvent.id, name: s.title }) },
                    ]}/>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
