import { Icon } from '../../components/Icons';
import { fmtDate } from '../../lib/date';
import { EVENT_TYPE_COLORS } from './eventsView.helpers';
import EventCover from './EventCover';

export default function EventsSidebar({
  isAr, STR, ad,
  events, visibleEvents, classifyEvent,
  eventSearch, setEventSearch, eventTab, setEventTab,
  loading, loadError, reload,
  selectedId, onSelectEvent,
}) {
  return (
    <div className="events-sidebar" style={{ width: 280, flexShrink: 0, display: "flex", flexDirection: "column", gap: 8 }}>
      {/* Search */}
      <div className="search" style={{ width: "100%" }}>
        <Icon name="search" size={13}/>
        <input placeholder={STR.searchPh} value={eventSearch} onChange={e => setEventSearch(e.target.value)}/>
        {eventSearch && (
          <button onClick={() => setEventSearch("")} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-mute)", padding: 0, display: "flex" }}>
            <Icon name="close" size={11}/>
          </button>
        )}
      </div>
      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, background: "var(--surface-soft-2)", borderRadius: 10, padding: 3, border: "1px solid var(--glass-border)" }}>
        {["all","ongoing","upcoming","past"].map(tab => (
          <button key={tab} onClick={() => setEventTab(tab)}
            style={{ flex: 1, padding: "5px 4px", borderRadius: 7, fontSize: 11, fontWeight: eventTab === tab ? 600 : 400, cursor: "pointer", border: "none",
              background: eventTab === tab ? "var(--accent)" : "transparent",
              color: eventTab === tab ? "#fff" : "var(--ink-mute)", transition: "all 0.15s" }}>
            {STR.tabs[tab]}
            {tab !== "all" && (
              <span style={{ marginLeft: 3, opacity: 0.75 }}>
                ({events.filter(e => classifyEvent(e) === tab).length})
              </span>
            )}
          </button>
        ))}
      </div>
      {/* List */}
      {loading ? (
        <div style={{ padding: "24px 12px", textAlign: "center", color: "var(--ink-mute)", fontSize: 12 }}>
          {isAr ? "جارٍ التحميل…" : "Loading…"}
        </div>
      ) : loadError ? (
        <div style={{ padding: "16px 12px", textAlign: "center", color: "var(--danger)", fontSize: 12, border: "1px solid var(--danger-border)", borderRadius: 10 }}>
          {loadError}
          <button className="btn" style={{ display: "block", margin: "10px auto 0", fontSize: 11 }} onClick={reload}>
            {isAr ? "إعادة المحاولة" : "Retry"}
          </button>
        </div>
      ) : visibleEvents.length === 0 ? (
        <div style={{ padding: "24px 12px", textAlign: "center", color: "var(--ink-mute)", fontSize: 12, border: "1px dashed var(--glass-border)", borderRadius: 10 }}>
          {eventSearch ? (isAr ? "لا نتائج" : "No results") : (isAr ? "لا توجد فعاليات" : "No events")}
        </div>
      ) : (
        visibleEvents.map(ev => {
          const evColor = EVENT_TYPE_COLORS[ev.type] || EVENT_TYPE_COLORS.default;
          const evClass = classifyEvent(ev);
          return (
          <div key={ev.id} onClick={() => onSelectEvent(ev)}
            className="card dsd"
            style={{ padding: 0, cursor: "pointer", border: `1px solid ${selectedId === ev.id ? "var(--accent)" : "var(--glass-border)"}`, background: selectedId === ev.id ? "rgba(0, 98, 123,0.06)" : undefined, overflow: "hidden" }}>
            <div style={{ height: 3, background: evColor, opacity: selectedId === ev.id ? 1 : 0.55 }}/>
            <div style={{ padding: "12px 14px", display: "flex", alignItems: "center", gap: 12 }}>
              <EventCover type={ev.type} image={ev.image} width={44} height={44} radius={8}/>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ev.title}</div>
                <div style={{ fontSize: 11, color: "var(--ink-mute)", marginBottom: 5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ev.venue || (ev.type + " · " + fmtDate(ev.startDate))}</div>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: evClass === "ongoing" ? "var(--accent)" : evClass === "upcoming" ? "#e0c47e" : "var(--ink-mute)", flexShrink: 0 }}/>
                  <span style={{ fontSize: 11, color: "var(--ink-mute)" }}>{STR.tabs[evClass]}</span>
                  <span style={{ fontSize: 11, color: "var(--ink-faint)", marginLeft: "auto" }}>{ad(ev.sessions.length)} {STR.sessions}</span>
                </div>
              </div>
            </div>
          </div>
          );
        })
      )}
    </div>
  );
}
