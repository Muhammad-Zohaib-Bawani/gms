import { Icon } from '../../components/Icons';
import { fmtDate } from '../../lib/date';
import { EVENT_TYPE_COLORS } from './eventsView.helpers';
import EventCover from './EventCover';
import EventForm from './EventForm';
import StatusMenu from './StatusMenu';

export default function EventDetailHeader({
  selectedEvent, editEventId, setEditEventId,
  isAr, STR, canManage,
  saveEditEvent, venues, venuesLoading, eventTypes, eventTypesLoading,
  changeStatus, setConfirmDelete,
}) {
  return (
    <div className="card" style={{ padding: "20px 22px" }}>
      {editEventId === selectedEvent.id ? (
        <>
          <div style={{ fontSize: 11, color: "var(--ink-mute)", textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 14 }}>{STR.editEvent}</div>
          <EventForm ev={selectedEvent} onSave={saveEditEvent} onCancel={() => setEditEventId(null)}
            isAr={isAr} STR={STR} venues={venues} venuesLoading={venuesLoading}
            eventTypes={eventTypes} eventTypesLoading={eventTypesLoading}/>
        </>
      ) : (
        <div style={{ display: "flex", alignItems: "flex-start", gap: 18, flexWrap: "wrap" }}>
          <EventCover type={selectedEvent.type} image={selectedEvent.image} width={80} height={80} radius={12}/>
          {/* minWidth:0 lets this actually shrink — a flex item won't go
              below its content's min-content width without it, which is
              what pushed the long event title past the card on mobile. */}
          <div style={{ flex: "1 1 240px", minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <div style={{ minWidth: 0 }}>
                <h2 style={{ fontFamily: "var(--serif)", fontSize: 28, margin: "0 0 4px", fontWeight: 400 }}>{selectedEvent.title}</h2>
                <div style={{ fontSize: 13, color: "var(--ink-dim)", marginBottom: 8 }}>
                  {selectedEvent.theme && <span>{selectedEvent.theme} · </span>}
                  {selectedEvent.venue}
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <span className="chip"><span className="dot" style={{ background: EVENT_TYPE_COLORS[selectedEvent.type] || "var(--accent)" }}/>{selectedEvent.type}</span>
                  <span className="chip" style={{ fontFamily: "var(--mono)", fontSize: 11 }}>{fmtDate(selectedEvent.startDate)} → {fmtDate(selectedEvent.endDate)}</span>
                  {/* Fixed vs Flexible decides whether the event's services must
                      be completed in the level's configured order, so it belongs
                      next to the event's own identity rather than buried in the
                      edit form. Anything not explicitly fixed is flexible. */}
                  {(() => {
                    const fixed = selectedEvent.guestModel === "fixed";
                    const color = fixed ? "var(--accent)" : "var(--ok)";
                    return (
                      <span
                        className="chip"
                        title={fixed ? STR.guestModel.fixedHint : STR.guestModel.flexibleHint}
                        // Tints via color-mix on currentColor, same as StatusMenu:
                        // these values are CSS vars, and `${color}1f` would be
                        // invalid and silently drop the fill and border.
                        style={{
                          color,
                          background: "color-mix(in srgb, currentColor 12%, transparent)",
                          borderColor: "color-mix(in srgb, currentColor 34%, transparent)",
                        }}
                      >
                        <span className="dot" style={{ background: color }} />
                        {fixed ? STR.guestModel.fixed : STR.guestModel.flexible}
                      </span>
                    );
                  })()}
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0, alignItems: "center" }}>
                <StatusMenu
                  status={selectedEvent.status}
                  labels={STR.status}
                  canChange={canManage}
                  isAr={isAr}
                  onPick={next => changeStatus(selectedEvent, next)}
                />
                {canManage && (
                  <button className="btn ghost" style={{ padding: "5px 10px", fontSize: 11 }} onClick={() => setEditEventId(selectedEvent.id)}>
                    <Icon name="edit" size={12}/> {isAr ? "تعديل" : "Edit"}
                  </button>
                )}
                {canManage && (
                  <button className="btn ghost" style={{ padding: "5px 10px", fontSize: 11, color: "var(--danger)" }} onClick={() => setConfirmDelete({ type: "event", id: selectedEvent.id, name: selectedEvent.title })}>
                    <Icon name="trash" size={12}/>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
