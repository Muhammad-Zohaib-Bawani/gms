import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { fmtNum, toArDigits } from '../i18n/translations';
import { Icon } from '../components/Icons';
import ActionMenu from '../components/ui/ActionMenu';
import { useAuth } from '../auth/AuthContext';
import * as eventsApi from '../api/services/eventService';
import { getVenues } from '../api/services/venueService';
import { uploadImageFile } from '../api/services/uploadService';
import { toViewEvent, toEventRequest, toSessionRequest } from '../api/adapters/eventAdapters';
import { toast } from '../lib/toast';
import ImportEventsModal from './ImportEventsModal';
import Select from '../components/ui/Select';
import DateField from '../components/ui/DateField';
import { startOfToday, isPastDate, toDate, toIsoDate, fmtDate } from '../lib/date';
import { brandHex } from '../lib/brandColor';

const EVENT_TYPE_ICONS = {
  Conference: "meetings", Forum: "globe", Summit: "protocol", Gala: "star",
  Workshop: "edit", Exhibition: "image", Bilateral: "guests", Ceremony: "badge", default: "meetings",
};
const EVENT_TYPE_COLORS = {
  Conference: brandHex(), Forum: "#3aa3b5", Summit: "#9d80c3", Gala: "#e0c47e",
  Workshop: brandHex("--brand-2-hsl"), Exhibition: "#e07e7e", Bilateral: "#a3b53a", Ceremony: "#e0a47e", default: brandHex(),
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

const DEFAULT_UI_THEME = { preset: 'default', accent: brandHex(), secondary: '#e0c47e', logoDark: '', logoLight: '' };
function getStoredThemes() {
  try { return JSON.parse(localStorage.getItem('gms-event-themes') || '{}'); } catch(e) { return {}; }
}
function saveStoredTheme(appKey, theme) {
  const all = getStoredThemes();
  all[appKey] = theme;
  localStorage.setItem('gms-event-themes', JSON.stringify(all));
}

// Values may be CSS vars, so tints are built with color-mix (string concat like
// `${color}18` only works for hex).
const STATUS_COLORS = { active: "var(--status-active)", planning: "#e0c47e", completed: "var(--ink-mute)", cancelled: "#e07e7e" };
const tint = (pct) => `color-mix(in srgb, currentColor ${pct}%, transparent)`;

// Allowed lifecycle transitions (mirrors the backend; the server still enforces).
const STATUS_TRANSITIONS = {
  planning: ["active", "cancelled"],
  active: ["completed", "cancelled"],
  completed: [],
  cancelled: ["planning"],
};

const iStyle = { width: "100%", background: "var(--surface-soft-3)", border: "1px solid var(--glass-border)", borderRadius: 8, padding: "8px 11px", color: "var(--ink)", fontSize: 13, boxSizing: "border-box" };
const lStyle = { display: "block", fontSize: 10.5, color: "var(--ink-mute)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 };

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
  const [mode, setMode] = useState('url');
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);

  // Uploads straight to blob storage and stores the returned URL — the form
  // never carries base64. The SAS token stays on for the preview and is
  // stripped in toEventRequest before the URL is persisted.
  async function handleFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      onChange(await uploadImageFile(file));
      setUploaded(true);
      setMode('upload');
    } catch (err) {
      toast.fromError(err, isAr ? 'فشل تحميل الصورة' : 'Failed to upload image');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <label style={{ display: "block", fontSize: 10.5, color: "var(--ink-mute)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>{label}</label>
      <div style={{ display: "flex", gap: 6, marginBottom: 6, alignItems: "center" }}>
        {['upload', 'url'].map(m => (
          <button key={m} type="button" onClick={() => setMode(m)}
            style={{ padding: '3px 10px', borderRadius: 6, fontSize: 11, border: `1px solid ${mode === m ? 'var(--accent)' : 'var(--glass-border)'}`, background: mode === m ? 'hsl(var(--brand-hsl) / 0.12)' : 'var(--surface-soft-3)', color: mode === m ? 'var(--accent)' : 'var(--ink-mute)', cursor: 'pointer' }}>
            {m === 'upload' ? (isAr ? 'رفع ملف' : 'Upload') : 'URL'}
          </button>
        ))}
        {value && (
          <button type="button" onClick={() => { onChange(''); setUploaded(false); }}
            style={{ marginInlineStart: 'auto', background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--ink-mute)', padding: '3px 6px' }}>
            {isAr ? 'إزالة' : 'Remove'}
          </button>
        )}
      </div>
      {mode === 'upload' ? (
        <div style={{ position: 'relative' }}>
          <input type="file" accept="image/*" onChange={handleFile} disabled={uploading}
            style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%', zIndex: 1 }}/>
          <div style={{ ...iStyle, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none', height: 38 }}>
            <Icon name="upload" size={13} style={{ color: 'var(--ink-mute)', flexShrink: 0 }}/>
            <span style={{ fontSize: 12, color: uploaded ? 'var(--accent)' : 'var(--ink-mute)' }}>
              {uploading ? (isAr ? 'جارٍ الرفع…' : 'Uploading…')
                : uploaded ? (isAr ? 'تم الرفع ✓' : 'File uploaded ✓')
                : (isAr ? 'اختر ملفاً…' : 'Choose image file…')}
            </span>
          </div>
        </div>
      ) : (
        <input type="url" style={iStyle} value={value || ''}
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

// Status chip that doubles as the status menu: click it to pick one of the
// transitions the lifecycle allows from the current status.
function StatusMenu({ status, labels, onPick, canChange, isAr }) {
  const [open, setOpen] = useState(false);
  const ref = React.useRef(null);
  const nexts = STATUS_TRANSITIONS[status] || [];
  const interactive = canChange && nexts.length > 0;

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const color = STATUS_COLORS[status] || "var(--accent)";

  return (
    <div ref={ref} style={{ position: "relative", flexShrink: 0 }}>
      <button
        type="button"
        disabled={!interactive}
        onClick={() => setOpen(o => !o)}
        title={interactive ? (isAr ? "تغيير الحالة" : "Change status") : undefined}
        style={{
          display: "flex", alignItems: "center", gap: 6, fontSize: 11,
          padding: "5px 10px", borderRadius: 20, color,
          border: `1px solid ${tint(35)}`, background: tint(14),
          cursor: interactive ? "pointer" : "default",
        }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor" }}/>
        {labels[status]}
        {interactive && (
          <svg viewBox="0 0 12 12" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1.6"
            style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>
            <path d="M3 4.5L6 8 9 4.5"/>
          </svg>
        )}
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", insetInlineEnd: 0,
          minWidth: 150, padding: 4, zIndex: 200,
          background: "var(--popover-bg)", border: "1px solid var(--glass-border-strong)",
          borderRadius: 10, boxShadow: "0 18px 44px rgba(0,0,0,0.45)",
        }}>
          {nexts.map(next => (
            <button key={next} type="button"
              onClick={() => { setOpen(false); onPick(next); }}
              style={{
                display: "flex", alignItems: "center", gap: 8, width: "100%",
                padding: "7px 9px", borderRadius: 7, border: "none", cursor: "pointer",
                background: "transparent", color: "var(--ink)", fontSize: 12, textAlign: "start",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "var(--hover-tint)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: STATUS_COLORS[next], flexShrink: 0 }}/>
              {labels[next]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
} 

// Fixed vs flexible decides whether the event runs the Service Level flow at
// all, so it gets two explained cards instead of a dropdown — a bare
// "Fixed/Flexible" select gives no clue what either does.
function GuestModelPicker({ value, onChange, STR }) {
  const opts = [
    { v: "fixed", label: STR.gmFixed, hint: STR.gmFixedHint, icon: "star" },
    { v: "flexible", label: STR.gmFlexible, hint: STR.gmFlexibleHint, icon: "guests" },
  ];
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {opts.map(o => {
          const active = value === o.v;
          return (
            <button
              key={o.v}
              type="button"
              onClick={() => onChange(o.v)}
              aria-pressed={active}
              style={{
                textAlign: "start", cursor: "pointer",
                padding: "11px 12px", borderRadius: 10,
                background: active ? "var(--accent-soft)" : "var(--bg-1)",
                border: `1px solid ${active ? "var(--accent)" : "var(--glass-border)"}`,
                boxShadow: active ? "var(--shadow-xs)" : "none",
                transition: "background .16s, border-color .16s",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>
                <Icon name={o.icon} size={13} style={{ color: active ? "var(--accent)" : "var(--ink-mute)" }} />
                <span style={{ fontSize: 12.5, fontWeight: 650, color: active ? "var(--accent)" : "var(--ink)" }}>
                  {o.label}
                </span>
              </div>
              <div style={{ fontSize: 11, lineHeight: 1.45, color: "var(--ink-mute)" }}>{o.hint}</div>
            </button>
          );
        })}
      </div>
      <div style={{ fontSize: 10.5, color: "var(--ink-faint)", marginTop: 6, lineHeight: 1.5 }}>
        {STR.gmLockedHint}
      </div>
    </>
  );
}

// Hoisted to module scope (not redefined per EventsView render) so typed-but-
// unsaved form state survives unrelated parent re-renders — e.g. reload()
// after a session edit no longer resets whatever the user is mid-typing here.
function EventForm({ ev, onSave, onCancel, isNew = false, isAr, STR, venues, venuesLoading, eventTypes, eventTypesLoading }) {
  const [form, setForm] = useState(() => {
    // Older events saved before VenueId was tracked only have a venue name —
    // match it against the current venues list so the dropdown doesn't open
    // empty for them.
    if (!ev.venueId && ev.venue) {
      const matched = venues.find(v => v.name === ev.venue);
      if (matched) return { ...ev, venueId: matched.id };
    }
    return { ...ev };
  });
  const [uiTheme, setUiTheme] = useState(() => {
    if (ev.appKey) {
      const stored = getStoredThemes()[ev.appKey];
      return stored ? { ...DEFAULT_UI_THEME, ...stored } : { ...DEFAULT_UI_THEME };
    }
    return ev.uiTheme ? { ...DEFAULT_UI_THEME, ...ev.uiTheme } : { ...DEFAULT_UI_THEME };
  });

  function trySave() {
    if (!form.title?.trim()) {
      toast.warning(isAr ? "اسم الفعالية مطلوب" : "Event title is required"); return;
    }
    if (isNew && isPastDate(form.startDate)) {
      toast.warning(isAr ? "لا يمكن أن يكون تاريخ البداية في الماضي" : "Start date can't be in the past"); return;
    }
    if (form.startDate && form.endDate && toDate(form.endDate) < toDate(form.startDate)) {
      toast.warning(isAr ? "تاريخ النهاية لا يمكن أن يسبق تاريخ البداية" : "End date can't be before the start date"); return;
    }
    onSave({ ...form, uiTheme });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div>
        <label style={lStyle}>{STR.fTitle}</label>
        <input type="text" style={iStyle} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}/>
      </div>
      <div>
        <label style={lStyle}>{STR.fVenue}</label>
        {venuesLoading ? (
          <div style={{ fontSize: 12, color: "var(--ink-mute)" }}>{isAr ? "جارٍ التحميل…" : "Loading…"}</div>
        ) : venues.length === 0 ? (
          <div style={{ fontSize: 12, color: "#e0a04e", padding: "8px 11px", background: "rgba(224,160,78,0.08)", border: "1px solid rgba(224,160,78,0.25)", borderRadius: 8 }}>
            {isAr ? "يرجى إضافة مكان أولاً" : "Please add a venue first"}
          </div>
        ) : (
          <Select
            value={form.venueId || ""}
            onChange={v => {
              const picked = venues.find(x => x.id === v);
              setForm(f => ({ ...f, venueId: v || "", venue: picked?.name || "" }));
            }}
            placeholder={isAr ? "— اختر مكاناً —" : "— Select venue —"}
            options={venues.map(v => ({ value: v.id, label: v.name }))}
            isClearable
          />
        )}
      </div>
      <div>
        <label style={lStyle}>{STR.fGuestModel}</label>
        <GuestModelPicker
          value={form.guestModel || "flexible"}
          onChange={v => setForm(f => ({ ...f, guestModel: v }))}
          STR={STR}
        />
      </div>
      <div>
        <label style={lStyle}>{STR.fType}</label>
        {eventTypesLoading ? (
          <div style={{ fontSize: 12, color: "var(--ink-mute)" }}>{isAr ? "جارٍ التحميل…" : "Loading…"}</div>
        ) : (
          <Select value={form.type} onChange={v => setForm(f => ({ ...f, type: v }))}
            options={eventTypes.map(t => ({ value: t.name, label: t.name }))} />
        )}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div>
          <label style={lStyle}>{STR.fStart}</label>
          <DateField value={form.startDate} onChange={v => setForm(f => ({ ...f, startDate: v }))}
            minDate={isNew ? startOfToday() : undefined} placeholder={STR.fStart} />
        </div>
        <div>
          <label style={lStyle}>{STR.fEnd}</label>
          <DateField value={form.endDate} onChange={v => setForm(f => ({ ...f, endDate: v }))}
            minDate={form.startDate || (isNew ? startOfToday() : undefined)} placeholder={STR.fEnd} />
        </div>
      </div>
      <LogoInput label={STR.fImage}
        value={form.image} onChange={v => setForm(f => ({ ...f, image: v }))} isAr={isAr}/>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
        <button className="btn" onClick={onCancel}>{STR.cancel}</button>
        <button className="btn primary" onClick={trySave} disabled={!form.title}>
          <Icon name="check" size={13}/> {STR.save}
        </button>
      </div>
    </div>
  );
}

// Hoisted to module scope — see EventForm's comment above for why.
function SessionForm({ session, evId, event, onSave, onCancel, isAr, STR, venues, venuesLoading }) {
  const [form, setForm] = useState({ ...session });

  function trySave() {
    if (!form.title?.trim()) { toast.warning(isAr ? "عنوان الجلسة مطلوب" : "Session title is required"); return; }
    if (!form.date) { toast.warning(isAr ? "تاريخ الجلسة مطلوب" : "Session date is required"); return; }
    if (!form.time) { toast.warning(isAr ? "وقت الجلسة مطلوب" : "Session time is required"); return; }
    if (event?.startDate && toDate(form.date) < toDate(event.startDate)) {
      toast.warning(isAr ? "تاريخ الجلسة قبل بداية الفعالية" : "Session date is before the event start date"); return;
    }
    if (event?.endDate && toDate(form.date) > toDate(event.endDate)) {
      toast.warning(isAr ? "تاريخ الجلسة بعد نهاية الفعالية" : "Session date is after the event end date"); return;
    }
    if (!(Number(form.capacity) > 0)) { toast.warning(isAr ? "السعة يجب أن تكون أكبر من صفر" : "Capacity must be greater than zero"); return; }
    onSave(evId, { ...form, capacity: +form.capacity });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div>
        <label style={lStyle}>{STR.sTitle}</label>
        <input style={iStyle} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}/>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div>
          <label style={lStyle}>{STR.sDate}</label>
          <DateField value={form.date} onChange={v => setForm(f => ({ ...f, date: v }))}
            minDate={event?.startDate || startOfToday()} maxDate={event?.endDate || undefined} placeholder={STR.sDate} />
        </div>
        <div>
          <label style={lStyle}>{STR.sTime}</label>
          <input type="time" style={iStyle} value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))}/>
        </div>
        <div>
          <label style={lStyle}>{STR.sVenue}</label>
          {venuesLoading ? (
            <div style={{ fontSize: 12, color: "var(--ink-mute)" }}>{isAr ? "جارٍ التحميل…" : "Loading…"}</div>
          ) : (
            <Select
              value={form.venueId || ""}
              onChange={v => setForm(f => ({ ...f, venueId: v || "" }))}
              placeholder={isAr ? "— اختر مكاناً —" : "— Select venue —"}
              options={(venues || []).map(v => ({ value: v.id, label: v.name }))}
              isClearable
            />
          )}
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
      <LogoInput label={STR.sImage }
        value={form.image || ""} onChange={v => setForm(f => ({ ...f, image: v }))} isAr={isAr}/>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button className="btn" onClick={onCancel}>{STR.cancel}</button>
        <button className="btn primary" onClick={trySave} disabled={!form.title}>
          <Icon name="check" size={13}/> {STR.save}
        </button>
      </div>
    </div>
  );
}

export default function EventsView({ lang }) {
  const isAr = lang === "ar";
  const ad = (s) => isAr ? toArDigits(String(s)) : String(s);
  const fmtN = (n) => fmtNum(n, lang);

  const { can, isDemo } = useAuth();
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

  React.useEffect(() => {
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

  const STR = isAr ? {
    title: "الفعاليات", sub: "إدارة الفعاليات والجلسات",
    newEvent: "فعالية جديدة", newSession: "جلسة جديدة",
    sessions: "الجلسات", noSessions: "لا توجد جلسات",
    addSession: "إضافة جلسة", editEvent: "تعديل الفعالية",
    save: "حفظ", cancel: "إلغاء", delete: "حذف",
    confirmDeleteEvent: "حذف الفعالية؟", confirmDeleteMsg: "لا يمكن التراجع عن هذا الإجراء.",
    confirm: "تأكيد الحذف",
    fTitle: "اسم الفعالية", fType: "النوع", fTheme: "الموضوع", fVenue: "المكان",
    fStart: "تاريخ البداية", fEnd: "تاريخ النهاية", fImage: "صورة الغلاف", fStatus: "الحالة",
    fGuestModel: "نموذج المندوبين",
    gmFixed: "ثابت", gmFlexible: "مرن",
    gmFixedHint: "يُصنَّف كل مندوب على مستوى خدمة يحدّد خدماته وقواعده (السعة والحقول المطلوبة).",
    gmFlexibleHint: "بدون مستويات خدمة أو قيود — التصنيف نص حر كما في السابق.",
    gmLockedHint: "يمكن تغيير النموذج لاحقاً. التبديل إلى «مرن» يوقف تطبيق القواعد لكنه لا يحذف تصنيفات المندوبين.",
    sTitle: "عنوان الجلسة", sDate: "التاريخ", sTime: "الوقت", sVenue: "المكان", sRoom: "القاعة", sSpeaker: "المتحدث", sCapacity: "السعة", sImage: "صورة الجلسة",
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
    fStart: "Start date", fEnd: "End date", fImage: "Cover image", fStatus: "Status",
    fGuestModel: "Delegate model",
    gmFixed: "Fixed", gmFlexible: "Flexible",
    gmFixedHint: "Every delegate sits on a service level that defines their services and rules (capacity, required fields).",
    gmFlexibleHint: "No service levels and no restrictions — the tier is a free form.",
    gmLockedHint: "You can change this later. Switching to Flexible stops enforcing the rules but never deletes existing level assignments.",
    sTitle: "Session title", sDate: "Date", sTime: "Time", sVenue: "Venue", sRoom: "Room / Hall", sSpeaker: "Speaker", sCapacity: "Capacity", sImage: "Session image",
    status: { active: "Active", planning: "Planning", completed: "Completed", cancelled: "Cancelled" },
    tabs: { all: "All", ongoing: "Ongoing", upcoming: "Upcoming", past: "Past" },
    searchPh: "Search events…",
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{STR.title}</h1>
          <div className="page-sub">{STR.sub}</div>
        </div>
        <div className="page-actions">
          {can('Events.Create') && (
            <button className="btn" onClick={() => setShowImportEvents(true)}>
              <Icon name="upload" size={14}/> {isAr ? 'استيراد فعاليات' : 'Import Events'}
            </button>
          )}
          {can('Events.Create') && (
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
              <div key={ev.id} onClick={() => { setSelectedId(ev.id); setEditEventId(null); }}
                className="card dsd"
                style={{ padding: 0, cursor: "pointer", border: `1px solid ${selectedId === ev.id ? "var(--accent)" : "var(--glass-border)"}`, background: selectedId === ev.id ? "hsl(var(--brand-hsl) / 0.06)" : undefined, overflow: "hidden" }}>
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

        {/* Event detail */}
        {selectedEvent && (
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 14 }}>

            {/* Event header card */}
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
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 6, flexShrink: 0, alignItems: "center" }}>
                        <StatusMenu
                          status={selectedEvent.status}
                          labels={STR.status}
                          canChange={can('Events.ManageStatus')}
                          isAr={isAr}
                          onPick={next => changeStatus(selectedEvent, next)}
                        />
                        {can('Events.Update') && (
                          <button className="btn ghost" style={{ padding: "5px 10px", fontSize: 11 }} onClick={() => setEditEventId(selectedEvent.id)}>
                            <Icon name="edit" size={12}/> {isAr ? "تعديل" : "Edit"}
                          </button>
                        )}
                        {can('Events.Delete') && (
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

            {/* Sessions */}
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--glass-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <span style={{ fontWeight: 500, fontSize: 13 }}>{STR.sessions}</span>
                  <span style={{ fontSize: 11, color: "var(--ink-mute)", marginInlineStart: 8 }}>{ad(selectedEvent.sessions.length)}</span>
                </div>
                {can('Events.ManageSessions') && (
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
                          {can('Events.ManageSessions') && (
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
          </div>
        )}
      </div>

      {/* New Event Modal */}
      {showNewEvent && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div className="card glass modal-solid" style={{ width: 540, maxWidth: "92vw", padding: 0, maxHeight: "88vh", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "18px 22px", borderBottom: "1px solid var(--glass-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0 }}>{STR.newEvent}</h3>
              <button className="icon-btn" onClick={() => setShowNewEvent(false)}><Icon name="close" size={14}/></button>
            </div>
            <div style={{ padding: "20px 22px", overflowY: "auto", flex: 1 }}>
              <EventForm ev={newEvent} onSave={saveNewEvent} onCancel={() => setShowNewEvent(false)} isNew
                isAr={isAr} STR={STR} venues={venues} venuesLoading={venuesLoading}
                eventTypes={eventTypes} eventTypesLoading={eventTypesLoading}/>
            </div>
          </div>
        </div>
      )}

      {/* New Session Modal */}
      {showNewSession && selectedEvent && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div className="card glass modal-solid" style={{ width: 480, maxWidth: "92vw", padding: 0, maxHeight: "88vh", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "18px 22px", borderBottom: "1px solid var(--glass-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h3 style={{ margin: 0 }}>{STR.newSession}</h3>
                <div style={{ fontSize: 12, color: "var(--ink-mute)", marginTop: 2 }}>{selectedEvent.title}</div>
              </div>
              <button className="icon-btn" onClick={() => setShowNewSession(false)}><Icon name="close" size={14}/></button>
            </div>
            <div style={{ padding: "20px 22px", overflowY: "auto", flex: 1 }}>
              <SessionForm session={newSession} evId={selectedEvent.id} event={selectedEvent} onSave={(evId, s) => saveNewSession(s)} onCancel={() => setShowNewSession(false)}
                isAr={isAr} STR={STR} venues={venues} venuesLoading={venuesLoading}/>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete Modal */}
      {confirmDelete && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100 }}>
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
      )}
    </div>
  );
}
