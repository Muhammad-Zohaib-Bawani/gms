import React, { useState, useMemo } from 'react';
import { fmtNum, toArDigits } from '../i18n/translations';
import { Icon } from '../components/Icons';

const EVENT_TYPES = ["Conference","Forum","Summit","Gala","Workshop","Exhibition","Bilateral","Ceremony"];
const EVENT_TYPE_ICONS = {
  Conference: "meetings", Forum: "globe", Summit: "protocol", Gala: "star",
  Workshop: "edit", Exhibition: "image", Bilateral: "guests", Ceremony: "badge", default: "meetings",
};
const EVENT_TYPE_COLORS = {
  Conference: "#1aaec4", Forum: "#3aa3b5", Summit: "#9d80c3", Gala: "#e0c47e",
  Workshop: "#5fd1e0", Exhibition: "#e07e7e", Bilateral: "#a3b53a", Ceremony: "#e0a47e", default: "#1aaec4",
};

const INITIAL_EVENTS = [
  {
    id: "EV-001", appKey: "doha-forum", title: "23rd Doha Forum", type: "Forum",
    theme: "Governance & Sustainability", venue: "Sheraton Grand, Doha",
    startDate: "2025-12-07", endDate: "2025-12-09", image: "",
    status: "active",
    sessions: [
      { id: "S-001", title: "Opening Plenary — The Innovation Imperative", date: "2025-12-07", time: "09:00", venue: "Sheraton Grand, Doha", room: "Al Mayassa Hall", speaker: "FM Qatar", capacity: 800 },
      { id: "S-002", title: "Reimagining Multilateralism", date: "2025-12-07", time: "11:30", venue: "Sheraton Grand, Doha", room: "Pearl Auditorium", speaker: "Panel", capacity: 400 },
      { id: "S-003", title: "AI and the Public Square", date: "2025-12-08", time: "14:00", venue: "Sheraton Grand, Doha", room: "Studio 4", speaker: "Panel", capacity: 200 },
      { id: "S-004", title: "Climate & Capital", date: "2025-12-08", time: "16:30", venue: "Sheraton Grand, Doha", room: "Pearl Auditorium", speaker: "Keynote", capacity: 400 },
      { id: "S-005", title: "Closing Reception · Protocol Dinner", date: "2025-12-09", time: "19:30", venue: "Sheraton Grand, Doha", room: "Sheraton Grand Ballroom", speaker: "", capacity: 600 },
    ],
  },
  {
    id: "EV-002", appKey: "qef", title: "Qatar Economic Forum", type: "Forum",
    theme: "Powered by Bloomberg", venue: "Marsa Arabella, Lusail", startDate: "2025-05-20", endDate: "2025-05-22", image: "",
    status: "planning",
    sessions: [
      { id: "S-010", title: "Global Markets Outlook", date: "2025-05-20", time: "09:00", venue: "Marsa Arabella, Lusail", room: "Main Stage", speaker: "Bloomberg Editor", capacity: 1200 },
      { id: "S-011", title: "Energy Transition Panel", date: "2025-05-21", time: "11:00", venue: "Marsa Arabella, Lusail", room: "Side Stage", speaker: "Panel", capacity: 400 },
    ],
  },
  {
    id: "EV-003", appKey: "qabf", title: "Qatar–Africa Business Forum", type: "Conference",
    theme: "Trade Corridors of the Future", venue: "QICCA, Doha", startDate: "2025-10-14", endDate: "2025-10-15", image: "",
    status: "planning",
    sessions: [],
  },
];

const DEFAULT_UI_THEME = { preset: 'default', accent: '#1aaec4', secondary: '#e0c47e', logoDark: '', logoLight: '' };
function getStoredThemes() {
  try { return JSON.parse(localStorage.getItem('gms-event-themes') || '{}'); } catch(e) { return {}; }
}
function saveStoredTheme(appKey, theme) {
  const all = getStoredThemes();
  all[appKey] = theme;
  localStorage.setItem('gms-event-themes', JSON.stringify(all));
}

const STATUS_COLORS = { active: "var(--accent)", planning: "#e0c47e", completed: "var(--ink-mute)", cancelled: "#e07e7e" };

function EventCover({ type, image, width = 56, height = 56, radius = 10 }) {
  const color = EVENT_TYPE_COLORS[type] || EVENT_TYPE_COLORS.default;
  const icon = EVENT_TYPE_ICONS[type] || EVENT_TYPE_ICONS.default;
  const iconSize = Math.round(height * 0.42);
  return (
    <div style={{
      width, height, borderRadius: radius, flexShrink: 0, overflow: "hidden", position: "relative",
      background: `linear-gradient(135deg, ${color}28 0%, ${color}0a 100%)`,
      border: `1px solid ${color}35`,
      display: "grid", placeItems: "center",
    }}>
      {image ? (
        <img src={image} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
          onError={e => { e.target.style.display = "none"; }}/>
      ) : (
        <Icon name={icon} size={iconSize} style={{ color, opacity: 0.85 }}/>
      )}
    </div>
  );
}

function LogoInput({ label, value, onChange, isAr }) {
  const iStyle = { width: "100%", background: "var(--surface-soft-3)", border: "1px solid var(--glass-border)", borderRadius: 8, padding: "8px 11px", color: "var(--ink)", fontSize: 13, boxSizing: "border-box" };
  const [mode, setMode] = useState(value && value.startsWith('data:') ? 'upload' : 'url');

  function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { onChange(ev.target.result); setMode('upload'); };
    reader.readAsDataURL(file);
  }

  return (
    <div>
      <label style={{ display: "block", fontSize: 10.5, color: "var(--ink-mute)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>{label}</label>
      <div style={{ display: "flex", gap: 6, marginBottom: 6, alignItems: "center" }}>
        {['upload', 'url'].map(m => (
          <button key={m} type="button" onClick={() => setMode(m)}
            style={{ padding: '3px 10px', borderRadius: 6, fontSize: 11, border: `1px solid ${mode === m ? 'var(--accent)' : 'var(--glass-border)'}`, background: mode === m ? 'rgba(26,174,196,0.12)' : 'var(--surface-soft-3)', color: mode === m ? 'var(--accent)' : 'var(--ink-mute)', cursor: 'pointer' }}>
            {m === 'upload' ? (isAr ? 'رفع ملف' : 'Upload') : 'URL'}
          </button>
        ))}
        {value && (
          <button type="button" onClick={() => onChange('')}
            style={{ marginInlineStart: 'auto', background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--ink-mute)', padding: '3px 6px' }}>
            {isAr ? 'إزالة' : 'Remove'}
          </button>
        )}
      </div>
      {mode === 'upload' ? (
        <div style={{ position: 'relative' }}>
          <input type="file" accept="image/*" onChange={handleFile}
            style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%', zIndex: 1 }}/>
          <div style={{ ...iStyle, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none', height: 38 }}>
            <Icon name="upload" size={13} style={{ color: 'var(--ink-mute)', flexShrink: 0 }}/>
            <span style={{ fontSize: 12, color: value && value.startsWith('data:') ? 'var(--accent)' : 'var(--ink-mute)' }}>
              {value && value.startsWith('data:') ? (isAr ? 'تم الرفع ✓' : 'File uploaded ✓') : (isAr ? 'اختر ملفاً…' : 'Choose image file…')}
            </span>
          </div>
        </div>
      ) : (
        <input type="url" style={iStyle} value={value && !value.startsWith('data:') ? value : ''}
          onChange={e => onChange(e.target.value)} placeholder="https://…"/>
      )}
      {value && (
        <div style={{ marginTop: 6, height: 36, width: 80, borderRadius: 6, border: '1px solid var(--glass-border)', background: 'var(--surface-soft-3)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 4 }}>
          <img src={value} alt="" style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }}
            onError={e => { e.target.style.display = 'none'; }}/>
        </div>
      )}
    </div>
  );
}

export default function EventsView({ lang }) {
  const isAr = lang === "ar";
  const ad = (s) => isAr ? toArDigits(String(s)) : String(s);
  const fmtN = (n) => fmtNum(n, lang);

  const [events, setEvents] = useState(INITIAL_EVENTS);
  const [selectedId, setSelectedId] = useState("EV-001");
  const [showNewEvent, setShowNewEvent] = useState(false);
  const [showNewSession, setShowNewSession] = useState(false);
  const [editEventId, setEditEventId] = useState(null);
  const [editSessionId, setEditSessionId] = useState(null);
  const [notice, setNotice] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [eventSearch, setEventSearch] = useState("");
  const [eventTab, setEventTab] = useState("all");

  const today = "2025-12-08";
  function classifyEvent(ev) {
    if (ev.endDate < today) return "past";
    if (ev.startDate > today) return "upcoming";
    return "ongoing";
  }

  const visibleEvents = events.filter(ev => {
    if (eventTab !== "all" && classifyEvent(ev) !== eventTab) return false;
    if (eventSearch && !ev.title.toLowerCase().includes(eventSearch.toLowerCase()) && !ev.venue?.toLowerCase().includes(eventSearch.toLowerCase())) return false;
    return true;
  });

  const [newEvent, setNewEvent] = useState({ title: "", type: "Forum", theme: "", venue: "", startDate: "", endDate: "", image: "", status: "planning" });
  const [newSession, setNewSession] = useState({ title: "", date: "", time: "09:00", venue: "", room: "", speaker: "", capacity: 200 });

  const selectedEvent = events.find(e => e.id === selectedId) || events[0];

  React.useEffect(() => {
    const registry = events.map(({ id, appKey, title, type, image }) => ({ id, appKey: appKey || '', title, type, image: image || '' }));
    localStorage.setItem('gms-events-registry', JSON.stringify(registry));
  }, [events]);

  function showMsg(msg) { setNotice(msg); setTimeout(() => setNotice(""), 3000); }

  function saveNewEvent(ev) {
    if (!ev.title) return;
    const id = `EV-${String(events.length + 100).padStart(3, "0")}`;
    const appKey = ev.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const fullEv = { ...ev, id, appKey, sessions: [] };
    setEvents(prev => [...prev, fullEv]);
    setShowNewEvent(false);
    setNewEvent({ title: "", type: "Forum", theme: "", venue: "", startDate: "", endDate: "", image: "", status: "planning" });
    if (ev.uiTheme) saveStoredTheme(appKey, ev.uiTheme);
    showMsg(isAr ? "تم إنشاء الفعالية" : "Event created");
  }

  function saveEditEvent(ev) {
    setEvents(prev => prev.map(e => e.id === ev.id ? ev : e));
    setEditEventId(null);
    if (ev.appKey && ev.uiTheme) {
      saveStoredTheme(ev.appKey, ev.uiTheme);
      window.dispatchEvent(new CustomEvent('gms-theme-updated', { detail: { eventKey: ev.appKey } }));
    }
    showMsg(isAr ? "تم حفظ التغييرات" : "Changes saved");
  }

  function deleteEvent(id) {
    setEvents(prev => prev.filter(e => e.id !== id));
    if (selectedId === id) setSelectedId(events.find(e => e.id !== id)?.id || null);
    setConfirmDelete(null);
    showMsg(isAr ? "تم حذف الفعالية" : "Event deleted");
  }

  function saveNewSession() {
    if (!newSession.title || !selectedEvent) return;
    const id = `S-${Date.now()}`;
    setEvents(prev => prev.map(e => e.id === selectedEvent.id
      ? { ...e, sessions: [...e.sessions, { ...newSession, id, capacity: +newSession.capacity }] }
      : e));
    setNewSession({ title: "", date: "", time: "09:00", venue: "", room: "", speaker: "", capacity: 200 });
    setShowNewSession(false);
    showMsg(isAr ? "تمت إضافة الجلسة" : "Session added");
  }

  function saveEditSession(evId, session) {
    setEvents(prev => prev.map(e => e.id === evId
      ? { ...e, sessions: e.sessions.map(s => s.id === session.id ? session : s) }
      : e));
    setEditSessionId(null);
    showMsg(isAr ? "تم حفظ الجلسة" : "Session saved");
  }

  function deleteSession(evId, sId) {
    setEvents(prev => prev.map(e => e.id === evId
      ? { ...e, sessions: e.sessions.filter(s => s.id !== sId) }
      : e));
    showMsg(isAr ? "تم حذف الجلسة" : "Session deleted");
  }

  const STR = isAr ? {
    title: "الفعاليات", sub: "إدارة الفعاليات والجلسات",
    newEvent: "فعالية جديدة", newSession: "جلسة جديدة",
    sessions: "الجلسات", noSessions: "لا توجد جلسات",
    addSession: "إضافة جلسة", editEvent: "تعديل الفعالية",
    save: "حفظ", cancel: "إلغاء", delete: "حذف",
    confirmDeleteEvent: "حذف الفعالية؟", confirmDeleteMsg: "لا يمكن التراجع عن هذا الإجراء.",
    confirm: "تأكيد الحذف",
    fTitle: "اسم الفعالية", fType: "النوع", fTheme: "الموضوع", fVenue: "المكان",
    fStart: "تاريخ البداية", fEnd: "تاريخ النهاية", fImage: "رابط صورة الغلاف", fStatus: "الحالة",
    sTitle: "عنوان الجلسة", sDate: "التاريخ", sTime: "الوقت", sVenue: "المكان", sRoom: "القاعة", sSpeaker: "المتحدث", sCapacity: "السعة",
    status: { active: "نشط", planning: "تخطيط", completed: "مكتمل", cancelled: "ملغى" },
    tabs: { all: "الكل", ongoing: "جارٍ", upcoming: "قادم", past: "منتهٍ" },
    searchPh: "بحث في الفعاليات…",
  } : {
    title: "Events", sub: "Manage events and their sessions",
    newEvent: "New Event", newSession: "New Session",
    sessions: "Sessions", noSessions: "No sessions yet",
    addSession: "Add session", editEvent: "Edit event",
    save: "Save", cancel: "Cancel", delete: "Delete",
    confirmDeleteEvent: "Delete event?", confirmDeleteMsg: "This action cannot be undone.",
    confirm: "Confirm delete",
    fTitle: "Event title", fType: "Type", fTheme: "Theme", fVenue: "Venue",
    fStart: "Start date", fEnd: "End date", fImage: "Cover image URL", fStatus: "Status",
    sTitle: "Session title", sDate: "Date", sTime: "Time", sVenue: "Venue", sRoom: "Room / Hall", sSpeaker: "Speaker", sCapacity: "Capacity",
    status: { active: "Active", planning: "Planning", completed: "Completed", cancelled: "Cancelled" },
    tabs: { all: "All", ongoing: "Ongoing", upcoming: "Upcoming", past: "Past" },
    searchPh: "Search events…",
  };

  const iStyle = { width: "100%", background: "var(--surface-soft-3)", border: "1px solid var(--glass-border)", borderRadius: 8, padding: "8px 11px", color: "var(--ink)", fontSize: 13, boxSizing: "border-box" };
  const lStyle = { display: "block", fontSize: 10.5, color: "var(--ink-mute)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 };
  const selStyle = { ...iStyle, appearance: "none", backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12' fill='none' stroke='%23718fa3' stroke-width='1.6'%3E%3Cpath d='M2 4l4 4 4-4'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 10px center", paddingRight: 28 };

  const venueOptions = useMemo(() => {
    const fallback = ["Sheraton Grand Ballroom","Pearl Auditorium","Al Mayassa Hall","Executive Suite A","Media Center"];
    try {
      const stored = localStorage.getItem("gms-venues");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed.map(v => v.name);
      }
    } catch(e) {}
    return fallback;
  }, []);

  function EventForm({ ev, onSave, onCancel }) {
    const [form, setForm] = useState({ ...ev });
    const venueIsCustom = form.venue && !venueOptions.includes(form.venue);
    const [customVenue, setCustomVenue] = useState(venueIsCustom ? form.venue : "");
    const [showCustom, setShowCustom] = useState(venueIsCustom);
    const [uiTheme, setUiTheme] = useState(() => {
      if (ev.appKey) {
        const stored = getStoredThemes()[ev.appKey];
        return stored ? { ...DEFAULT_UI_THEME, ...stored } : { ...DEFAULT_UI_THEME };
      }
      return ev.uiTheme ? { ...DEFAULT_UI_THEME, ...ev.uiTheme } : { ...DEFAULT_UI_THEME };
    });

    function handleVenueChange(val) {
      if (val === "__custom__") {
        setShowCustom(true);
        setForm(f => ({ ...f, venue: customVenue }));
      } else {
        setShowCustom(false);
        setForm(f => ({ ...f, venue: val }));
      }
    }

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <label style={lStyle}>{STR.fTitle}</label>
          <input type="text" style={iStyle} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}/>
        </div>
        <div>
          <label style={lStyle}>{STR.fVenue}</label>
          <select style={selStyle} value={showCustom ? "__custom__" : (form.venue || "")}
            onChange={e => handleVenueChange(e.target.value)}>
            <option value="">{isAr ? "— اختر مكاناً —" : "— Select venue —"}</option>
            {venueOptions.map(v => <option key={v} value={v}>{v}</option>)}
            <option value="__custom__">{isAr ? "مكان آخر…" : "Other / custom…"}</option>
          </select>
          {showCustom && (
            <input type="text" style={{ ...iStyle, marginTop: 6 }}
              value={customVenue}
              placeholder={isAr ? "أدخل اسم المكان" : "Enter venue name"}
              onChange={e => { setCustomVenue(e.target.value); setForm(f => ({ ...f, venue: e.target.value })); }}/>
          )}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label style={lStyle}>{STR.fType}</label>
            <select style={selStyle} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
              {EVENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label style={lStyle}>{STR.fStatus}</label>
            <select style={selStyle} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
              {Object.entries(STR.status).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label style={lStyle}>{STR.fStart}</label>
            <input type="date" style={iStyle} value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}/>
          </div>
          <div>
            <label style={lStyle}>{STR.fEnd}</label>
            <input type="date" style={iStyle} value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}/>
          </div>
        </div>
        {/* Visual Theme */}
        <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: 14, marginTop: 2 }}>
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--ink-mute)', marginBottom: 10 }}>
            {isAr ? 'السمة المرئية' : 'Visual Theme'}
          </div>
          <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
            {['default', 'custom'].map(p => (
              <button key={p} type="button" onClick={() => setUiTheme(t => ({ ...t, preset: p }))}
                style={{ flex: 1, padding: '7px 0', borderRadius: 8, fontSize: 12, fontWeight: uiTheme.preset === p ? 600 : 400,
                  border: `1px solid ${uiTheme.preset === p ? 'var(--accent)' : 'var(--glass-border)'}`,
                  background: uiTheme.preset === p ? 'rgba(26,174,196,0.1)' : 'var(--surface-soft-3)',
                  color: uiTheme.preset === p ? 'var(--accent)' : 'var(--ink-mute)', cursor: 'pointer', transition: 'all 0.15s' }}>
                {p === 'default' ? (isAr ? 'الافتراضي' : 'Default') : (isAr ? 'مخصص' : 'Custom')}
              </button>
            ))}
          </div>
          {uiTheme.preset === 'custom' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={lStyle}>{isAr ? 'اللون الأساسي' : 'Primary Color'}</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input type="color" value={uiTheme.accent} onChange={e => setUiTheme(t => ({ ...t, accent: e.target.value }))}
                      style={{ width: 36, height: 36, borderRadius: 8, border: '1px solid var(--glass-border)', padding: 3, cursor: 'pointer', background: 'var(--surface-soft-3)', flexShrink: 0 }}/>
                    <input type="text" value={uiTheme.accent} onChange={e => setUiTheme(t => ({ ...t, accent: e.target.value }))}
                      style={{ ...iStyle, fontFamily: 'var(--mono)', fontSize: 12 }}/>
                  </div>
                </div>
                <div>
                  <label style={lStyle}>{isAr ? 'اللون الثانوي' : 'Secondary Color'}</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input type="color" value={uiTheme.secondary} onChange={e => setUiTheme(t => ({ ...t, secondary: e.target.value }))}
                      style={{ width: 36, height: 36, borderRadius: 8, border: '1px solid var(--glass-border)', padding: 3, cursor: 'pointer', background: 'var(--surface-soft-3)', flexShrink: 0 }}/>
                    <input type="text" value={uiTheme.secondary} onChange={e => setUiTheme(t => ({ ...t, secondary: e.target.value }))}
                      style={{ ...iStyle, fontFamily: 'var(--mono)', fontSize: 12 }}/>
                  </div>
                </div>
              </div>
              <LogoInput label={isAr ? 'شعار (خلفية داكنة)' : 'Logo — Dark background'}
                value={uiTheme.logoDark} onChange={v => setUiTheme(t => ({ ...t, logoDark: v }))} isAr={isAr}/>
              <LogoInput label={isAr ? 'شعار (خلفية فاتحة)' : 'Logo — Light background'}
                value={uiTheme.logoLight} onChange={v => setUiTheme(t => ({ ...t, logoLight: v }))} isAr={isAr}/>
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
          <button className="btn" onClick={onCancel}>{STR.cancel}</button>
          <button className="btn primary" onClick={() => onSave({ ...form, uiTheme })} disabled={!form.title}>
            <Icon name="check" size={13}/> {STR.save}
          </button>
        </div>
      </div>
    );
  }

  function SessionForm({ session, evId, onSave, onCancel }) {
    const [form, setForm] = useState({ ...session });
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div>
          <label style={lStyle}>{STR.sTitle}</label>
          <input style={iStyle} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}/>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label style={lStyle}>{STR.sDate}</label>
            <input type="date" style={iStyle} value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}/>
          </div>
          <div>
            <label style={lStyle}>{STR.sTime}</label>
            <input type="time" style={iStyle} value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))}/>
          </div>
          <div>
            <label style={lStyle}>{STR.sVenue}</label>
            <input style={iStyle} value={form.venue || ""} onChange={e => setForm(f => ({ ...f, venue: e.target.value }))} placeholder={isAr ? "مثال: شيراتون الكبرى" : "e.g. Sheraton Grand, Doha"}/>
          </div>
          <div>
            <label style={lStyle}>{STR.sRoom}</label>
            <input style={iStyle} value={form.room} onChange={e => setForm(f => ({ ...f, room: e.target.value }))} placeholder={isAr ? "مثال: قاعة المياسة" : "e.g. Al Mayassa Hall"}/>
          </div>
          <div>
            <label style={lStyle}>{STR.sCapacity}</label>
            <input type="number" style={iStyle} value={form.capacity} onChange={e => setForm(f => ({ ...f, capacity: e.target.value }))}/>
          </div>
        </div>
        <div>
          <label style={lStyle}>{STR.sSpeaker}</label>
          <input style={iStyle} value={form.speaker} onChange={e => setForm(f => ({ ...f, speaker: e.target.value }))}/>
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button className="btn" onClick={onCancel}>{STR.cancel}</button>
          <button className="btn primary" onClick={() => onSave(evId, { ...form, capacity: +form.capacity })} disabled={!form.title}>
            <Icon name="check" size={13}/> {STR.save}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{STR.title}</h1>
          <div className="page-sub">{STR.sub}</div>
        </div>
        <div className="page-actions">
          <button className="btn primary" onClick={() => setShowNewEvent(true)}>
            <Icon name="plus" size={14}/> {STR.newEvent}
          </button>
        </div>
      </div>

      {notice && (
        <div style={{ marginBottom: 14, padding: "10px 16px", borderRadius: 10, background: "rgba(26,174,196,0.1)", border: "1px solid rgba(26,174,196,0.3)", fontSize: 13, display: "flex", gap: 10, alignItems: "center" }}>
          <Icon name="check" size={14} style={{ color: "var(--accent)" }}/> <span>{notice}</span>
        </div>
      )}

      <div className="events-layout" style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
        {/* Events list */}
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
          {visibleEvents.length === 0 ? (
            <div style={{ padding: "24px 12px", textAlign: "center", color: "var(--ink-mute)", fontSize: 12, border: "1px dashed var(--glass-border)", borderRadius: 10 }}>
              {eventSearch ? (isAr ? "لا نتائج" : "No results") : (isAr ? "لا توجد فعاليات" : "No events")}
            </div>
          ) : (
            visibleEvents.map(ev => {
              const evColor = EVENT_TYPE_COLORS[ev.type] || EVENT_TYPE_COLORS.default;
              const evClass = classifyEvent(ev);
              return (
              <div key={ev.id} onClick={() => { setSelectedId(ev.id); setEditEventId(null); }}
                className="card"
                style={{ padding: 0, cursor: "pointer", border: `1px solid ${selectedId === ev.id ? "var(--accent)" : "var(--glass-border)"}`, background: selectedId === ev.id ? "rgba(26,174,196,0.06)" : undefined, overflow: "hidden" }}>
                <div style={{ height: 3, background: evColor, opacity: selectedId === ev.id ? 1 : 0.55 }}/>
                <div style={{ padding: "12px 14px", display: "flex", alignItems: "center", gap: 12 }}>
                  <EventCover type={ev.type} image={ev.image} width={44} height={44} radius={8}/>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ev.title}</div>
                    <div style={{ fontSize: 11, color: "var(--ink-mute)", marginBottom: 5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ev.venue || (ev.type + " · " + ev.startDate)}</div>
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

        {/* Event detail */}
        {selectedEvent && (
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 14 }}>

            {/* Event header card */}
            <div className="card" style={{ padding: "20px 22px" }}>
              {editEventId === selectedEvent.id ? (
                <>
                  <div style={{ fontSize: 11, color: "var(--ink-mute)", textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 14 }}>{STR.editEvent}</div>
                  <EventForm ev={selectedEvent} onSave={saveEditEvent} onCancel={() => setEditEventId(null)}/>
                </>
              ) : (
                <div style={{ display: "flex", alignItems: "flex-start", gap: 18 }}>
                  <EventCover type={selectedEvent.type} image={selectedEvent.image} width={80} height={80} radius={12}/>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                      <div>
                        <h2 style={{ fontFamily: "var(--serif)", fontSize: 28, margin: "0 0 4px", fontWeight: 400 }}>{selectedEvent.title}</h2>
                        <div style={{ fontSize: 13, color: "var(--ink-dim)", marginBottom: 8 }}>
                          {selectedEvent.theme && <span>{selectedEvent.theme} · </span>}
                          {selectedEvent.venue}
                        </div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <span className="chip"><span className="dot" style={{ background: EVENT_TYPE_COLORS[selectedEvent.type] || "var(--accent)" }}/>{selectedEvent.type}</span>
                          <span className="chip" style={{ fontFamily: "var(--mono)", fontSize: 11 }}>{selectedEvent.startDate} → {selectedEvent.endDate}</span>
                          <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, padding: "3px 10px", borderRadius: 20, border: `1px solid ${STATUS_COLORS[selectedEvent.status]}40`, background: STATUS_COLORS[selectedEvent.status] + "18", color: STATUS_COLORS[selectedEvent.status] }}>
                            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor" }}/>{STR.status[selectedEvent.status]}
                          </span>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                        <button className="btn ghost" style={{ padding: "5px 10px", fontSize: 11 }} onClick={() => setEditEventId(selectedEvent.id)}>
                          <Icon name="edit" size={12}/> {isAr ? "تعديل" : "Edit"}
                        </button>
                        <button className="btn ghost" style={{ padding: "5px 10px", fontSize: 11, color: "#e08a7e" }} onClick={() => setConfirmDelete({ type: "event", id: selectedEvent.id, name: selectedEvent.title })}>
                          <Icon name="trash" size={12}/>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Sessions */}
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--glass-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <span style={{ fontWeight: 500, fontSize: 13 }}>{STR.sessions}</span>
                  <span style={{ fontSize: 11, color: "var(--ink-mute)", marginInlineStart: 8 }}>{ad(selectedEvent.sessions.length)}</span>
                </div>
                <button className="btn primary" style={{ padding: "5px 12px", fontSize: 11 }} onClick={() => setShowNewSession(true)}>
                  <Icon name="plus" size={12}/> {STR.addSession}
                </button>
              </div>

              {selectedEvent.sessions.length === 0 ? (
                <div style={{ padding: "32px", textAlign: "center", color: "var(--ink-mute)", fontSize: 13 }}>
                  {STR.noSessions}
                </div>
              ) : (
                <div>
                  {selectedEvent.sessions.map(s => (
                    <div key={s.id} style={{ padding: "12px 18px", borderBottom: "1px solid var(--glass-border)" }}>
                      {editSessionId === s.id ? (
                        <div style={{ padding: "4px 0" }}>
                          <SessionForm session={s} evId={selectedEvent.id} onSave={saveEditSession} onCancel={() => setEditSessionId(null)}/>
                        </div>
                      ) : (
                        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
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
                          <span style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--ink-mute)", marginInlineEnd: 8 }}>{s.date}</span>
                          <div style={{ display: "flex", gap: 4 }}>
                            <button className="icon-btn" style={{ width: 26, height: 26 }} onClick={() => setEditSessionId(s.id)}><Icon name="edit" size={11}/></button>
                            <button className="icon-btn" style={{ width: 26, height: 26, color: "#e08a7e" }} onClick={() => deleteSession(selectedEvent.id, s.id)}><Icon name="trash" size={11}/></button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* New Event Modal */}
      {showNewEvent && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div className="card glass" style={{ width: 540, maxWidth: "92vw", padding: 0, maxHeight: "88vh", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "18px 22px", borderBottom: "1px solid var(--glass-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0 }}>{STR.newEvent}</h3>
              <button className="icon-btn" onClick={() => setShowNewEvent(false)}><Icon name="close" size={14}/></button>
            </div>
            <div style={{ padding: "20px 22px", overflowY: "auto", flex: 1 }}>
              <EventForm ev={newEvent} onSave={saveNewEvent} onCancel={() => setShowNewEvent(false)}/>
            </div>
          </div>
        </div>
      )}

      {/* New Session Modal */}
      {showNewSession && selectedEvent && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div className="card glass" style={{ width: 480, maxWidth: "92vw", padding: 0, maxHeight: "88vh", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "18px 22px", borderBottom: "1px solid var(--glass-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h3 style={{ margin: 0 }}>{STR.newSession}</h3>
                <div style={{ fontSize: 12, color: "var(--ink-mute)", marginTop: 2 }}>{selectedEvent.title}</div>
              </div>
              <button className="icon-btn" onClick={() => setShowNewSession(false)}><Icon name="close" size={14}/></button>
            </div>
            <div style={{ padding: "20px 22px", overflowY: "auto", flex: 1 }}>
              <SessionForm session={newSession} evId={selectedEvent.id} onSave={(evId, s) => { saveNewSession(); }} onCancel={() => setShowNewSession(false)}/>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete Modal */}
      {confirmDelete && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100 }}>
          <div className="card glass" style={{ width: 360, padding: "22px 24px" }}>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>{STR.confirmDeleteEvent}</div>
            <div style={{ fontSize: 13, color: "var(--ink-dim)", marginBottom: 6 }}>{confirmDelete.name}</div>
            <div style={{ fontSize: 12, color: "var(--ink-mute)", marginBottom: 20 }}>{STR.confirmDeleteMsg}</div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button className="btn" onClick={() => setConfirmDelete(null)}>{STR.cancel}</button>
              <button className="btn" style={{ color: "#e08a7e", borderColor: "rgba(224,138,126,0.3)", background: "rgba(224,138,126,0.1)" }}
                onClick={() => deleteEvent(confirmDelete.id)}>
                <Icon name="trash" size={13}/> {STR.confirm}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
