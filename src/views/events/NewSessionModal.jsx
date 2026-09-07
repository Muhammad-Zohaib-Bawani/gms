import { Icon } from '../../components/Icons';
import SessionForm from './SessionForm';

export default function NewSessionModal({
  show, selectedEvent, onClose, newSession, saveNewSession,
  isAr, STR, venues, venuesLoading,
}) {
  if (!show || !selectedEvent) return null;
  return (
    <div className="ev-modal-overlay">
      <div className="card glass modal-solid ev-modal-card" style={{ width: 480 }}>
        <div className="ev-modal-header">
          <div>
            <h3 style={{ margin: 0 }}>{STR.newSession}</h3>
            <div style={{ fontSize: 12, color: "var(--ink-mute)", marginTop: 2 }}>{selectedEvent.title}</div>
          </div>
          <button className="icon-btn" onClick={onClose}><Icon name="close" size={14}/></button>
        </div>
        <div className="ev-modal-body">
          <SessionForm session={newSession} evId={selectedEvent.id} event={selectedEvent} onSave={(evId, s) => saveNewSession(s)} onCancel={onClose}
            isAr={isAr} STR={STR} venues={venues} venuesLoading={venuesLoading}/>
        </div>
      </div>
    </div>
  );
}
