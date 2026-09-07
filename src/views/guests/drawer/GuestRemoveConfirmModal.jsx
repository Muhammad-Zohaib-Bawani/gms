import { Icon } from "../../../components/Icons";

export default function GuestRemoveConfirmModal({
  open,
  onClose,
  guestName,
  t,
  removing,
  onConfirm,
}) {
  if (!open) return null;
  return (
    <div className="guest-drawer-modal-overlay">
      <div
        className="card glass modal-solid guest-drawer-modal-card"
        style={{ width: 340, padding: "22px 24px" }}
      >
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>
          {t.removeG}
        </div>
        <div style={{ fontSize: 13, color: "var(--ink-dim)", marginBottom: 4 }}>
          {guestName}
        </div>
        <div style={{ fontSize: 12, color: "var(--ink-mute)", marginBottom: 20 }}>
          {t.confirmRemoveMsg}
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button className="btn" onClick={onClose} disabled={removing}>
            {t.cancel}
          </button>
          <button
            className="btn"
            disabled={removing}
            style={{
              color: "#e08a7e",
              borderColor: "rgba(224,138,126,0.3)",
              background: "rgba(224,138,126,0.1)",
            }}
            onClick={onConfirm}
          >
            <Icon name="trash" size={13} /> {removing ? t.saving : t.removeConfirmBtn}
          </button>
        </div>
      </div>
    </div>
  );
}
