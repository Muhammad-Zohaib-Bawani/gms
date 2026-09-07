import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toArDigits } from '../i18n/translations';
import { Icon } from '../components/Icons';
import { useAuth } from '../auth/AuthContext';
import { useAccess } from '../auth/AccessContext';
import * as eventsApi from '../api/services/eventService';
import { getVenues } from '../api/services/venueService';
import { toViewEvent, toEventRequest, toSessionRequest } from '../api/adapters/eventAdapters';
import { toast } from '../lib/toast';
import ImportEventsModal from './ImportEventsModal';
import { startOfToday, toIsoDate } from '../lib/date';
import { eventsView } from '../i18n/modules/eventsView';
import { INITIAL_EVENTS, saveStoredTheme } from './events/eventsView.helpers';
import EventsSidebar from './events/EventsSidebar';
import EventDetailHeader from './events/EventDetailHeader';
import SessionsPanel from './events/SessionsPanel';
import NewEventModal from './events/NewEventModal';
import NewSessionModal from './events/NewSessionModal';
import ConfirmDeleteModal from './events/ConfirmDeleteModal';
import './events/events-view.css';

export default function EventsView({ lang }) {
  const isAr = lang === "ar";
  const ad = (s) => isAr ? toArDigits(String(s)) : String(s);

  const { isDemo } = useAuth();
  const { canWrite } = useAccess();
  // Events has one Write flag; the old Create/Update/Delete/ManageStatus split
  // is gone, and the API gates every event mutation on the same flag.
  const canManageEvents = canWrite('events');
  const [events, setEvents] = useState(isDemo ? INITIAL_EVENTS : []);
  const [loading, setLoading] = useState(!isDemo);
  const [loadError, setLoadError] = useState("");
  const [selectedId, setSelectedId] = useState(isDemo ? "EV-001" : null);

  // Load events from the API (demo mode keeps the static sample data).
  const reload = useCallback(async () => {
    if (isDemo) return;
    setLoading(true); setLoadError("");
    try {
      const page = await eventsApi.listEvents({ pageSize: 100 });
      const mapped = (page?.items || []).map(toViewEvent);
      setEvents(mapped);
      setSelectedId(prev => (mapped.some(e => e.id === prev) ? prev : (mapped[0]?.id || null)));
    } catch (err) {
      setLoadError(err.message || "Failed to load events");
    } finally {
      setLoading(false);
    }
  }, [isDemo]);

  useEffect(() => { reload(); }, [reload]);

  // Venues for the event/session venue dropdowns — the real Venue Config
  // registry, not the old ad-hoc localStorage list.
  const [venues, setVenues] = useState([]);
  const [venuesLoading, setVenuesLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    getVenues()
      .then(list => { if (!cancelled) setVenues((list || []).map(v => ({ id: v.id, name: v.venueName }))); })
      .catch(() => { if (!cancelled) setVenues([]); })
      .finally(() => { if (!cancelled) setVenuesLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // Event types — admin-managed lookup (Lookups > Event Types), replacing the
  // old hardcoded EVENT_TYPES list.
  const [eventTypes, setEventTypes] = useState([]);
  const [eventTypesLoading, setEventTypesLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    eventsApi.getEventTypes()
      .then(list => { if (!cancelled) setEventTypes(list || []); })
      .catch(() => { if (!cancelled) setEventTypes([]); })
      .finally(() => { if (!cancelled) setEventTypesLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const [showNewEvent, setShowNewEvent] = useState(false);
  const [showImportEvents, setShowImportEvents] = useState(false);
  const [importBatchId, setImportBatchId] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();

  // Deep-link from an "import finished" notification (?importBatch=<id>) —
  // reopen the modal straight into its results view.
  useEffect(() => {
    const batchId = searchParams.get('importBatch');
    if (!batchId) return;
    setImportBatchId(batchId);
    setShowImportEvents(true);
    const next = new URLSearchParams(searchParams);
    next.delete('importBatch');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const [showNewSession, setShowNewSession] = useState(false);
  const [editEventId, setEditEventId] = useState(null);
  const [editSessionId, setEditSessionId] = useState(null);
  const [notice, setNotice] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [eventSearch, setEventSearch] = useState("");
  const [eventTab, setEventTab] = useState("all");

  function classifyEvent(ev) {
    const today = toIsoDate(startOfToday());
    if (ev.endDate < today) return "past";
    if (ev.startDate > today) return "upcoming";
    return "ongoing";
  }

  const visibleEvents = events.filter(ev => {
    if (eventTab !== "all" && classifyEvent(ev) !== eventTab) return false;
    if (eventSearch && !ev.title.toLowerCase().includes(eventSearch.toLowerCase()) && !ev.venue?.toLowerCase().includes(eventSearch.toLowerCase())) return false;
    return true;
  });

  const [newEvent, setNewEvent] = useState({ title: "", type: "", theme: "", venue: "", venueId: "", startDate: "", endDate: "", image: "", status: "planning", guestModel: "flexible" });
  const [newSession, setNewSession] = useState({ title: "", date: "", time: "09:00", venue: "", venueId: "", room: "", speaker: "", capacity: 200, image: "" });

  const selectedEvent = events.find(e => e.id === selectedId) || events[0];

  useEffect(() => {
    const registry = events.map(({ id, appKey, title, type, image }) => ({ id, appKey: appKey || '', title, type, image: image || '' }));
    localStorage.setItem('gms-events-registry', JSON.stringify(registry));
  }, [events]);

  function showMsg(msg) { toast.success(msg); }

  const blankEvent = { title: "", type: "", theme: "", venue: "", venueId: "", startDate: "", endDate: "", image: "", status: "planning", guestModel: "flexible" };
  const blankSession = { title: "", date: "", time: "09:00", venue: "", venueId: "", room: "", speaker: "", capacity: 200, image: "" };

  async function saveNewEvent(ev) {
    if (!ev.title) return;
    if (isDemo) {
      const id = `EV-${String(events.length + 100).padStart(3, "0")}`;
      const appKey = ev.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      setEvents(prev => [...prev, { ...ev, id, appKey, sessions: [] }]);
      if (ev.uiTheme) saveStoredTheme(appKey, ev.uiTheme);
      setShowNewEvent(false); setNewEvent(blankEvent);
      showMsg(isAr ? "تم إنشاء الفعالية" : "Event created");
      return;
    }
    try {
      const created = await eventsApi.createEvent(toEventRequest(ev));
      if (ev.uiTheme && created?.appKey) saveStoredTheme(created.appKey, ev.uiTheme);
      setShowNewEvent(false); setNewEvent(blankEvent);
      await reload();
      if (created?.id) setSelectedId(created.id);
      window.dispatchEvent(new Event('gms-events-changed'));
      showMsg(isAr ? "تم إنشاء الفعالية" : "Event created");
    } catch (err) { toast.error(err.message || "Create failed"); }
  }

  async function saveEditEvent(ev) {
    if (isDemo) {
      setEvents(prev => prev.map(e => e.id === ev.id ? ev : e));
      setEditEventId(null);
    } else {
      try {
        await eventsApi.updateEvent(ev.id, toEventRequest(ev));
        setEditEventId(null);
        await reload();
      } catch (err) { toast.error(err.message || "Update failed"); return; }
    }
    if (ev.appKey && ev.uiTheme) {
      saveStoredTheme(ev.appKey, ev.uiTheme);
      window.dispatchEvent(new CustomEvent('gms-theme-updated', { detail: { eventKey: ev.appKey } }));
    }
    window.dispatchEvent(new Event('gms-events-changed'));
    showMsg(isAr ? "تم حفظ التغييرات" : "Changes saved");
  }

  async function deleteEvent(id) {
    if (!isDemo) {
      try { await eventsApi.deleteEvent(id); }
      catch (err) { toast.error(err.message || "Delete failed"); return; }
    }
    setConfirmDelete(null);
    if (isDemo) {
      setEvents(prev => prev.filter(e => e.id !== id));
      if (selectedId === id) setSelectedId(events.find(e => e.id !== id)?.id || null);
    } else {
      await reload();
    }
    window.dispatchEvent(new Event('gms-events-changed'));
    showMsg(isAr ? "تم حذف الفعالية" : "Event deleted");
  }

  async function changeStatus(ev, status) {
    if (isDemo) {
      setEvents(prev => prev.map(e => e.id === ev.id ? { ...e, status } : e));
    } else {
      try { await eventsApi.updateEventStatus(ev.id, status); }
      catch (err) { toast.error(err.message || "Status change failed"); return; }
      await reload();
    }
    window.dispatchEvent(new Event('gms-events-changed'));
    showMsg(isAr ? "تم تحديث الحالة" : "Status updated");
  }

  async function saveNewSession(session) {
    if (!session?.title || !selectedEvent) return;
    if (isDemo) {
      const id = `S-${Date.now()}`;
      setEvents(prev => prev.map(e => e.id === selectedEvent.id
        ? { ...e, sessions: [...e.sessions, { ...session, id, capacity: +session.capacity }] } : e));
    } else {
      try { await eventsApi.addSession(selectedEvent.id, toSessionRequest(session)); }
      catch (err) { toast.error(err.message || "Add session failed"); return; }
      await reload();
    }
    setNewSession(blankSession);
    setShowNewSession(false);
    showMsg(isAr ? "تمت إضافة الجلسة" : "Session added");
  }

  async function saveEditSession(evId, session) {
    if (isDemo) {
      setEvents(prev => prev.map(e => e.id === evId
        ? { ...e, sessions: e.sessions.map(s => s.id === session.id ? session : s) } : e));
    } else {
      try { await eventsApi.updateSession(evId, session.id, toSessionRequest(session)); }
      catch (err) { toast.error(err.message || "Save session failed"); return; }
      await reload();
    }
    setEditSessionId(null);
    showMsg(isAr ? "تم حفظ الجلسة" : "Session saved");
  }

  async function deleteSession(evId, sId) {
    if (isDemo) {
      setEvents(prev => prev.map(e => e.id === evId
        ? { ...e, sessions: e.sessions.filter(s => s.id !== sId) } : e));
    } else {
      try { await eventsApi.deleteSession(evId, sId); }
      catch (err) { toast.error(err.message || "Delete session failed"); return; }
      await reload();
    }
    showMsg(isAr ? "تم حذف الجلسة" : "Session deleted");
  }

  const STR = eventsView[isAr ? "ar" : "en"];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{STR.title}</h1>
          <div className="page-sub">{STR.sub}</div>
        </div>
        <div className="page-actions">
          {canManageEvents && (
            <button className="btn" onClick={() => setShowImportEvents(true)}>
              <Icon name="upload" size={14}/> {isAr ? 'استيراد فعاليات' : 'Import Events'}
            </button>
          )}
          {canManageEvents && (
            <button className="btn primary" onClick={() => setShowNewEvent(true)}>
              <Icon name="plus" size={14}/> {STR.newEvent}
            </button>
          )}
        </div>
      </div>

      <ImportEventsModal
        open={showImportEvents}
        onClose={() => { setShowImportEvents(false); setImportBatchId(null); }}
        lang={lang}
        onImported={reload}
        initialBatchId={importBatchId}
      />


      <div className="events-layout" style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
        {/* Events list */}
        <EventsSidebar
          isAr={isAr} STR={STR} ad={ad}
          events={events} visibleEvents={visibleEvents} classifyEvent={classifyEvent}
          eventSearch={eventSearch} setEventSearch={setEventSearch}
          eventTab={eventTab} setEventTab={setEventTab}
          loading={loading} loadError={loadError} reload={reload}
          selectedId={selectedId}
          onSelectEvent={ev => { setSelectedId(ev.id); setEditEventId(null); }}
        />

        {/* Event detail */}
        {selectedEvent && (
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 14 }}>

            {/* Event header card */}
            <EventDetailHeader
              selectedEvent={selectedEvent} editEventId={editEventId} setEditEventId={setEditEventId}
              isAr={isAr} STR={STR} canManage={canManageEvents}
              saveEditEvent={saveEditEvent} venues={venues} venuesLoading={venuesLoading}
              eventTypes={eventTypes} eventTypesLoading={eventTypesLoading}
              changeStatus={changeStatus} setConfirmDelete={setConfirmDelete}
            />

            {/* Sessions */}
            <SessionsPanel
              selectedEvent={selectedEvent} canManage={canManageEvents} STR={STR} isAr={isAr} ad={ad}
              setShowNewSession={setShowNewSession} editSessionId={editSessionId} setEditSessionId={setEditSessionId}
              saveEditSession={saveEditSession}
              venues={venues} venuesLoading={venuesLoading} setConfirmDelete={setConfirmDelete}
            />
          </div>
        )}
      </div>

      <NewEventModal
        show={showNewEvent} onClose={() => setShowNewEvent(false)}
        newEvent={newEvent} saveNewEvent={saveNewEvent}
        isAr={isAr} STR={STR} venues={venues} venuesLoading={venuesLoading}
        eventTypes={eventTypes} eventTypesLoading={eventTypesLoading}
      />

      <NewSessionModal
        show={showNewSession} selectedEvent={selectedEvent} onClose={() => setShowNewSession(false)}
        newSession={newSession} saveNewSession={saveNewSession}
        isAr={isAr} STR={STR} venues={venues} venuesLoading={venuesLoading}
      />

      <ConfirmDeleteModal
        confirmDelete={confirmDelete} setConfirmDelete={setConfirmDelete}
        isAr={isAr} STR={STR} deleteSession={deleteSession} deleteEvent={deleteEvent}
      />
    </div>
  );
}
