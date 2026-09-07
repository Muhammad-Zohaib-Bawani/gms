import { Icon } from '../../components/Icons';

export default function ConfirmDeleteModal({ confirmDelete, setConfirmDelete, isAr, STR, deleteSession, deleteEvent }) {
  if (!confirmDelete) return null;
  return (
    <div className="ev-modal-overlay" style={{ zIndex: 1100 }}>
      <div className="card glass modal-solid" style={{ width: 360, maxWidth: "92vw", padding: "22px 24px" }}>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>
          {confirmDelete.type === "session" ? (isAr ? "حذف الجلسة؟" : "Delete session?") : STR.confirmDeleteEvent}
        </div>
        <div style={{ fontSize: 13, color: "var(--ink-dim)", marginBottom: 6 }}>{confirmDelete.name}</div>
        <div style={{ fontSize: 12, color: "var(--ink-mute)", marginBottom: 20 }}>{STR.confirmDeleteMsg}</div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button className="btn" onClick={() => setConfirmDelete(null)}>{STR.cancel}</button>
          <button className="btn" style={{ color: "var(--danger)", borderColor: "var(--danger-border)", background: "var(--danger-bg)" }}
            onClick={() => {
              const cd = confirmDelete;
              setConfirmDelete(null);
              if (cd.type === "session") deleteSession(cd.evId, cd.id);
              else deleteEvent(cd.id);
            }}>
            <Icon name="trash" size={13}/> {STR.confirm}
          </button>
        </div>
      </div>
    </div>
  );
}
