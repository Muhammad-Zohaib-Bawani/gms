import { Icon } from '../../components/Icons';
import EventForm from './EventForm';

export default function NewEventModal({
  show, onClose, newEvent, saveNewEvent,
  isAr, STR, venues, venuesLoading, eventTypes, eventTypesLoading,
}) {
  if (!show) return null;
  return (
    <div className="ev-modal-overlay">
      <div className="card glass modal-solid ev-modal-card" style={{ width: 540 }}>
        <div className="ev-modal-header">
          <h3 style={{ margin: 0 }}>{STR.newEvent}</h3>
          <button className="icon-btn" onClick={onClose}><Icon name="close" size={14}/></button>
        </div>
        <div className="ev-modal-body">
          <EventForm ev={newEvent} onSave={saveNewEvent} onCancel={onClose} isNew
            isAr={isAr} STR={STR} venues={venues} venuesLoading={venuesLoading}
            eventTypes={eventTypes} eventTypesLoading={eventTypesLoading}/>
        </div>
      </div>
    </div>
  );
}
