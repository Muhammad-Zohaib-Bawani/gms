import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { getTranslations, fmtNum, toArDigits } from '../i18n/translations';
import { Avatar, StatusChip, TierChip, Donut, Spark, Drawer } from '../components/UI';
import { GUESTS, SESSIONS, COUNTRIES } from '../data/mockData';
import { Icon } from '../components/Icons';

// Enhanced Dashboard with event creation
export default function DashboardView({ onOpenGuest, gotoView, lang }) {
  const isAr = lang === "ar";
  const fmtN = (n) => fmtNum(n, lang);
  const ad = (s) => isAr ? toArDigits(String(s)) : String(s);
  const G = GUESTS;

  const [showNewEvent, setShowNewEvent] = useState(false);
  const [eventStep, setEventStep] = useState(1);
  const [newEvent, setNewEvent] = useState({ title: "", theme: "", venue: "", image: "", startDate: "", endDate: "", sessions: [{ title: "", date: "", time: "" }] });
  const [events, setEvents] = useState([
    {
      title: isAr ? "منتدى الدوحة الـ ٢٣" : "23rd Doha Forum",
      theme: isAr ? "الحوكمة والاستدامة" : "Governance & Sustainability",
      venue: isAr ? "شيراتون الكبرى، الدوحة" : "Sheraton Grand, Doha",
      startDate: "Dec 7", endDate: "Dec 9",
      sessions: [
        { title: isAr ? "الجلسة الافتتاحية — ضرورة الابتكار" : "Opening Plenary — Innovation Imperative", date: "Dec 7", time: "09:00" },
        { title: isAr ? "إعادة تصور التعددية" : "Reimagining Multilateralism", date: "Dec 7", time: "11:30" },
        { title: isAr ? "الذكاء الاصطناعي والفضاء العام" : "AI and the Public Square", date: "Dec 8", time: "14:00" },
        { title: isAr ? "حفل الاستقبال الختامي" : "Closing Reception · Protocol Dinner", date: "Dec 9", time: "19:30" },
      ],
    },
  ]);
  const [expandedEvent, setExpandedEvent] = useState(0);

  const STR = isAr ? {
    greeting: "صباح الخير،",
    name: "أميرة",
    sub: `منتدى الدوحة · النسخة الثانية والعشرون · ٧–٩ ديسمبر · ${fmtN(1284)} من ${fmtN(1650)} ضيفاً مؤكداً`,
    export: "تصدير",
    newInvite: "دعوة جديدة",
    newEvent: "حدث جديد",
    confirmed: "الضيوف المؤكدون",
    awaiting: "في انتظار الرد",
    travel: "حجوزات السفر",
    accred: "اعتمادات صادرة",
    weekDelta: `+٨٤ هذا الأسبوع`,
    awaitingDelta: "−٣١ منذ الاثنين",
    travelDelta: "٧٤٪ من المؤكدين",
    accredDelta: "٨٦٪ على المسار",
    arrivalsTitle: "الوصول حسب اليوم",
    arrivalsSub: "دخول هيّا · مطار حمد الدولي",
    funnelTitle: "قمع التأكيد",
    viewAll: "عرض الكل",
    funnelDonutSub: "مؤكد",
    funnel: { invited: "مدعو", opened: "فتح", confirmed: "مؤكد", travel: "مرتب سفر", accredited: "معتمد" },
    recentTitle: "آخر نشاط الضيوف",
    recentSub: "عبر الدعوات والسفر والاعتماد",
    openGuestList: "فتح قائمة الضيوف ←",
    cols: { guest: "الضيف", tier: "الفئة", country: "الدولة", status: "الحالة", arrival: "الوصول" },
    todayTitle: "برنامج اليوم",
    live: "مباشر",
    days: ["٣ ديس","٤ ديس","٥ ديس","٦ ديس","٧ ديس","٨ ديس","٩ ديس","١٠ ديس"],
    events: "الأحداث",
    sessions: "الجلسات",
    addSession: "إضافة جلسة",
    removeSession: "حذف",
    eventTitle: "عنوان الحدث",
    eventTheme: "الموضوع",
    eventVenue: "المكان",
    eventImage: "رابط صورة الغلاف",
    startDate: "تاريخ البداية",
    endDate: "تاريخ النهاية",
    sessionTitle: "عنوان الجلسة",
    sessionDate: "التاريخ",
    sessionTime: "الوقت",
    cancel: "إلغاء",
    save: "حفظ الحدث",
    newEventTitle: "حدث جديد",
    stepLabels: ["معلومات الحدث", "الجلسات"],
  } : {
    greeting: "Good morning,",
    name: "Amira",
    sub: `Doha Forum · 22nd Edition · 7–9 December · ${fmtN(1284)} of ${fmtN(1650)} guests confirmed`,
    export: "Export",
    newInvite: "New Invitation",
    newEvent: "New Event",
    confirmed: "Confirmed Guests",
    awaiting: "Awaiting Response",
    travel: "Travel Booked",
    accred: "Accreditation Issued",
    weekDelta: "+84 this week",
    awaitingDelta: "−31 since Mon",
    travelDelta: "74% of confirmed",
    accredDelta: "86% on-track",
    arrivalsTitle: "Arrivals by day",
    arrivalsSub: "Hayya entry · Hamad International",
    funnelTitle: "Confirmation funnel",
    viewAll: "View all",
    funnelDonutSub: "Confirmed",
    funnel: { invited: "Invited", opened: "Opened", confirmed: "Confirmed", travel: "Travel set", accredited: "Accredited" },
    recentTitle: "Recent guest activity",
    recentSub: "Across invitations, travel, accreditation",
    openGuestList: "Open guest list →",
    cols: { guest: "Guest", tier: "Tier", country: "Country", status: "Status", arrival: "Arrival" },
    todayTitle: "Today's program",
    live: "Live",
    days: ["Dec 3","Dec 4","Dec 5","Dec 6","Dec 7","Dec 8","Dec 9","Dec 10"],
    events: "Events",
    sessions: "Sessions",
    addSession: "Add session",
    removeSession: "Remove",
    eventTitle: "Event Title",
    eventTheme: "Theme",
    eventVenue: "Venue",
    eventImage: "Cover Image URL",
    startDate: "Start Date",
    endDate: "End Date",
    sessionTitle: "Session Title",
    sessionDate: "Date",
    sessionTime: "Time",
    cancel: "Cancel",
    save: "Save Event",
    newEventTitle: "New Event",
    stepLabels: ["Event Info", "Sessions"],
  };

  const sessions = isAr ? [
    { time: "٠٩:٠٠", title: "الجلسة الافتتاحية — ضرورة الابتكار", room: "قاعة الميسرا" },
    { time: "١١:٣٠", title: "إعادة تصور التعددية", room: "مسرح اللؤلؤة" },
    { time: "١٤:٠٠", title: "الذكاء الاصطناعي والفضاء العام", room: "استوديو ٤" },
    { time: "١٩:٣٠", title: "حفل الاستقبال الختامي · عشاء البروتوكول", room: "قاعة شيراتون الكبرى" },
  ] : [
    { time: "09:00", title: "Opening Plenary — The Innovation Imperative", room: "Al Mayassa Hall" },
    { time: "11:30", title: "Reimagining Multilateralism", room: "Pearl Auditorium" },
    { time: "14:00", title: "AI and the Public Square", room: "Studio 4" },
    { time: "19:30", title: "Closing Reception · Protocol Dinner", room: "Sheraton Grand Ballroom" },
  ];

  const arrivals = [18,42,67,124,198,234,188,90];
  const funnelData = isAr
    ? [["مدعو","١٬٦٥٠",100],["مفتوح","١٬٢٠١",72.8],["مؤكد","١٬٢٨٤",77.8],["مرتب سفر","٩٤٨",57.4],["معتمد","١٬١٠٦",67.0]]
    : [["Invited","1,650",100],["Opened","1,201",72.8],["Confirmed","1,284",77.8],["Travel set","948",57.4],["Accredited","1,106",67.0]];

  function addSession() {
    setNewEvent(e => ({ ...e, sessions: [...e.sessions, { title: "", date: "", time: "" }] }));
  }
  function removeSession(i) {
    setNewEvent(e => ({ ...e, sessions: e.sessions.filter((_, j) => j !== i) }));
  }
  function updateSession(i, field, val) {
    setNewEvent(e => ({ ...e, sessions: e.sessions.map((s, j) => j === i ? { ...s, [field]: val } : s) }));
  }
  function saveEvent() {
    if (!newEvent.title) return;
    setEvents(prev => [...prev, { ...newEvent }]);
    setShowNewEvent(false);
    setEventStep(1);
    setNewEvent({ title: "", theme: "", venue: "", image: "", startDate: "", endDate: "", sessions: [{ title: "", date: "", time: "" }] });
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{STR.greeting} <em>{STR.name}</em></h1>
          <div className="page-sub">{STR.sub}</div>
        </div>
        <div className="page-actions">
          <button className="btn" onClick={() => {
            const csv = "Event,Sessions,Venue,Date\n" + events.map(e => `"${e.title}","${e.sessions.length}","${e.venue}","${e.startDate}–${e.endDate}"`).join("\n");
            const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv],{type:"text/csv"})); a.download="events.csv"; a.click();
          }}><Icon name="download" size={14}/> {STR.export}</button>
          <button className="btn" onClick={() => gotoView && gotoView("invitations")}>
            <Icon name="invitation" size={14}/> {STR.newInvite}
          </button>
          <button className="btn primary" onClick={() => { setShowNewEvent(true); setEventStep(1); }}>
            <Icon name="plus" size={14}/> {STR.newEvent}
          </button>
        </div>
      </div>

      {/* Events listing */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, color: "var(--ink-mute)", textTransform: "uppercase", letterSpacing: isAr ? "0.04em" : "0.14em", marginBottom: 10 }}>{STR.events}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {events.map((ev, i) => (
            <div key={i} className="card" style={{ overflow: "hidden" }}>
              <div onClick={() => setExpandedEvent(expandedEvent === i ? -1 : i)}
                style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 20px", cursor: "pointer" }}>
                {ev.image ? (
                  <img src={ev.image} alt="" style={{ width: 40, height: 40, borderRadius: 10, objectFit: "cover", flexShrink: 0 }}/>
                ) : (
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(26,174,196,0.15)", border: "1px solid rgba(26,174,196,0.3)", display: "grid", placeItems: "center", flexShrink: 0 }}>
                    <Icon name="meetings" size={16} style={{ color: "var(--accent)" }}/>
                  </div>
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{ev.title}</div>
                  <div style={{ fontSize: 11, color: "var(--ink-mute)", marginTop: 2 }}>
                    {ev.theme && <span>{ev.theme} · </span>}
                    {ev.venue && <span>{ev.venue} · </span>}
                    <span style={{ fontFamily: "var(--mono)" }}>{ev.startDate}{ev.endDate && ev.endDate !== ev.startDate ? ` → ${ev.endDate}` : ""}</span>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span className="chip"><span className="dot" style={{ background: "var(--accent)" }}/>{ev.sessions.length} {STR.sessions}</span>
                  <Icon name={expandedEvent === i ? "close" : "arrow"} size={14} style={{ color: "var(--ink-mute)" }}/>
                </div>
              </div>
              {expandedEvent === i && (
                <div style={{ borderTop: "1px solid var(--glass-border)", padding: "12px 20px 16px" }}>
                  <div style={{ fontSize: 11, color: "var(--ink-mute)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>{STR.sessions}</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {ev.sessions.map((s, j) => (
                      <div key={j} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 12px", borderRadius: 8, background: "var(--surface-soft-2)", border: "1px solid var(--glass-border)" }}>
                        <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--accent-2)", direction: "ltr", width: 40 }}>{s.time || "—"}</span>
                        <span style={{ flex: 1, fontSize: 13 }}>{s.title}</span>
                        {s.date && <span style={{ fontSize: 11, color: "var(--ink-mute)", fontFamily: "var(--mono)" }}>{s.date}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* KPI row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
        {[
          { label: STR.confirmed, val: fmtN(1284), delta: STR.weekDelta, color: "var(--accent)" },
          { label: STR.awaiting, val: fmtN(221), delta: STR.awaitingDelta, color: "#e0c47e" },
          { label: STR.travel, val: fmtN(948), delta: STR.travelDelta, color: "var(--accent-2)" },
          { label: STR.accred, val: fmtN(1106), delta: STR.accredDelta, color: "#5fd1e0" },
        ].map((k, i) => (
          <div key={i} className="card" style={{ padding: "16px 20px" }}>
            <div style={{ fontSize: 11, color: "var(--ink-mute)", textTransform: "uppercase", letterSpacing: isAr ? "0.04em" : "0.12em", marginBottom: 6 }}>{k.label}</div>
            <div style={{ fontFamily: "var(--serif)", fontSize: 32, fontStyle: "italic", color: k.color, lineHeight: 1 }}>{k.val}</div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: 8 }}>
              <div style={{ fontSize: 11, color: "var(--ink-mute)" }}>{k.delta}</div>
              <Spark data={[40,55,48,72,68,84,91,87].slice(i, i+5).concat([40,55,48,72,68,84,91,87].slice(0, 3-i))} color={k.color}/>
            </div>
          </div>
        ))}
      </div>

      <div className="cols-2-narrow">
        {/* Arrivals chart */}
        <div className="card">
          <div className="card-head">
            <div>
              <h3>{STR.arrivalsTitle}</h3>
              <div className="sub">{STR.arrivalsSub}</div>
            </div>
            <span className="chip confirmed"><span className="dot"/>{STR.live}</span>
          </div>
          <div className="card-body">
            <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 100 }}>
              {arrivals.map((v, i) => {
                const h = (v / Math.max(...arrivals)) * 80;
                const isToday = i === 4;
                return (
                  <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                    <div style={{ height: h, width: "100%", borderRadius: "4px 4px 0 0", background: isToday ? "var(--accent)" : "rgba(26,174,196,0.25)" }}/>
                    <div style={{ fontSize: 9, color: isToday ? "var(--accent)" : "var(--ink-mute)", fontFamily: "var(--mono)" }}>{STR.days[i]}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Funnel */}
        <div className="card">
          <div className="card-head"><h3>{STR.funnelTitle}</h3></div>
          <div className="card-body" style={{ display: "flex", gap: 20, alignItems: "center" }}>
            <Donut value={77.8} max={100} size={110} label="77.8%" sub={STR.funnelDonutSub}/>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
              {funnelData.map(([label, val, pct], i) => (
                <div key={i}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
                    <span style={{ color: "var(--ink-dim)" }}>{label}</span>
                    <span style={{ fontFamily: "var(--mono)" }}>{val}</span>
                  </div>
                  <div style={{ height: 4, borderRadius: 2, background: "var(--surface-soft-4)", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: `hsl(${187 + i * 5} 60% ${50 - i * 4}%)`, borderRadius: 2 }}/>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Recent guests + today's program */}
      <div className="cols-2-narrow" style={{ marginTop: 14 }}>
        <div className="card">
          <div className="card-head">
            <div><h3>{STR.recentTitle}</h3><div className="sub">{STR.recentSub}</div></div>
          </div>
          <table className="table">
            <thead><tr>
              <th>{STR.cols.guest}</th>
              <th>{STR.cols.tier}</th>
              <th>{STR.cols.country}</th>
              <th>{STR.cols.status}</th>
              <th>{STR.cols.arrival}</th>
            </tr></thead>
            <tbody>
              {G.slice(0, 6).map(g => (
                <tr key={g.id} style={{ cursor: "pointer" }} onClick={() => onOpenGuest && onOpenGuest(g)}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <Avatar initials={g.initials} size={28} tier={g.tier}/>
                      <div>
                        <div style={{ fontSize: 12.5, fontWeight: 500 }}>{g.name}</div>
                        <div style={{ fontSize: 11, color: "var(--ink-mute)" }}>{g.org}</div>
                      </div>
                    </div>
                  </td>
                  <td><TierChip tier={g.tier} lang={lang}/></td>
                  <td style={{ fontSize: 12 }}>{g.country}</td>
                  <td><StatusChip status={g.status} lang={lang}/></td>
                  <td style={{ fontFamily: "var(--mono)", fontSize: 11 }}>{g.arrival}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="card-foot">
            <button className="btn" onClick={() => gotoView && gotoView("guests")} style={{ fontSize: 12 }}>
              {STR.openGuestList}
            </button>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h3>{STR.todayTitle}</h3>
            <span className="chip confirmed"><span className="dot"/>{STR.live}</span>
          </div>
          <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {sessions.map((s, i) => (
              <div key={i} style={{ display: "flex", gap: 14, padding: "10px 12px", borderRadius: 10,
                background: i === 0 ? "rgba(26,174,196,0.08)" : "var(--surface-soft-2)",
                border: `1px solid ${i === 0 ? "rgba(26,174,196,0.3)" : "var(--glass-border)"}` }}>
                <div style={{ fontFamily: "var(--mono)", fontSize: 12, color: i === 0 ? "var(--accent)" : "var(--accent-2)", flexShrink: 0, direction: "ltr", paddingTop: 1 }}>{s.time}</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: i === 0 ? 600 : 400 }}>{s.title}</div>
                  <div style={{ fontSize: 11, color: "var(--ink-mute)", marginTop: 2 }}>{s.room}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* NEW EVENT MODAL */}
      {showNewEvent && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div className="card glass" style={{ width: 560, maxWidth: "92vw", padding: 0, maxHeight: "88vh", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "18px 22px", borderBottom: "1px solid var(--glass-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h3 style={{ margin: 0 }}>{STR.newEventTitle}</h3>
                <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                  {STR.stepLabels.map((l, i) => (
                    <span key={i} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: eventStep === i+1 ? "var(--accent)" : eventStep > i+1 ? "var(--ink-dim)" : "var(--ink-mute)" }}>
                      <span style={{ width: 16, height: 16, borderRadius: "50%", display: "grid", placeItems: "center", fontSize: 10, fontWeight: 700,
                        background: eventStep === i+1 ? "var(--accent)" : eventStep > i+1 ? "var(--accent-deep)" : "var(--surface-soft-4)",
                        color: eventStep >= i+1 ? "#fff" : "var(--ink-mute)" }}>{i+1}</span>
                      {l}{i < 1 && <span style={{ color: "var(--ink-faint)" }}>›</span>}
                    </span>
                  ))}
                </div>
              </div>
              <button className="icon-btn" onClick={() => setShowNewEvent(false)}><Icon name="close" size={14}/></button>
            </div>

            <div style={{ padding: "20px 22px", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 14 }}>
              {eventStep === 1 && (
                <>
                  {[
                    { label: STR.eventTitle, key: "title", ph: isAr ? "مثال: منتدى الدوحة الـ ٢٤" : "e.g. 24th Doha Forum" },
                    { label: STR.eventTheme, key: "theme", ph: isAr ? "مثال: الحوكمة والاستدامة" : "e.g. Governance & Sustainability" },
                    { label: STR.eventVenue, key: "venue", ph: isAr ? "مثال: شيراتون الكبرى، الدوحة" : "e.g. Sheraton Grand, Doha" },
                  ].map(f => (
                    <div key={f.key}>
                      <label style={{ display: "block", fontSize: 11, color: "var(--ink-mute)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 5 }}>{f.label}</label>
                      <input placeholder={f.ph} value={newEvent[f.key]} onChange={e => setNewEvent({ ...newEvent, [f.key]: e.target.value })}
                        style={{ width: "100%", background: "var(--surface-soft-3)", border: "1px solid var(--glass-border)", borderRadius: 8, padding: "9px 12px", color: "var(--ink)", fontSize: 13 }}/>
                    </div>
                  ))}
                  <div>
                    <label style={{ display: "block", fontSize: 11, color: "var(--ink-mute)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 5 }}>{STR.eventImage}</label>
                    <input placeholder="https://example.com/cover.jpg" value={newEvent.image} onChange={e => setNewEvent({ ...newEvent, image: e.target.value })}
                      style={{ width: "100%", background: "var(--surface-soft-3)", border: "1px solid var(--glass-border)", borderRadius: 8, padding: "9px 12px", color: "var(--ink)", fontSize: 13 }}/>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    {[[STR.startDate, "startDate", "Dec 7"],[STR.endDate, "endDate", "Dec 9"]].map(([label, key, ph]) => (
                      <div key={key}>
                        <label style={{ display: "block", fontSize: 11, color: "var(--ink-mute)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 5 }}>{label}</label>
                        <input placeholder={ph} value={newEvent[key]} onChange={e => setNewEvent({ ...newEvent, [key]: e.target.value })}
                          style={{ width: "100%", background: "var(--surface-soft-3)", border: "1px solid var(--glass-border)", borderRadius: 8, padding: "9px 12px", color: "var(--ink)", fontSize: 13 }}/>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {eventStep === 2 && (
                <>
                  <div style={{ fontSize: 11, color: "var(--ink-mute)", marginBottom: 4 }}>
                    {isAr ? "أضف جلسات الحدث (يمكنك إضافة أكثر من يوم)" : "Add event sessions (multi-day supported)"}
                  </div>
                  {newEvent.sessions.map((s, i) => (
                    <div key={i} style={{ padding: "12px", borderRadius: 10, background: "var(--surface-soft-2)", border: "1px solid var(--glass-border)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-dim)" }}>{isAr ? `الجلسة ${i+1}` : `Session ${i+1}`}</span>
                        {newEvent.sessions.length > 1 && (
                          <button onClick={() => removeSession(i)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-mute)", fontSize: 11 }}>
                            <Icon name="x" size={12}/> {STR.removeSession}
                          </button>
                        )}
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        <input placeholder={isAr ? "عنوان الجلسة" : "Session title"} value={s.title} onChange={e => updateSession(i, "title", e.target.value)}
                          style={{ width: "100%", background: "var(--surface-soft-3)", border: "1px solid var(--glass-border)", borderRadius: 8, padding: "8px 12px", color: "var(--ink)", fontSize: 13 }}/>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                          <input placeholder="Dec 7" value={s.date} onChange={e => updateSession(i, "date", e.target.value)}
                            style={{ background: "var(--surface-soft-3)", border: "1px solid var(--glass-border)", borderRadius: 8, padding: "8px 12px", color: "var(--ink)", fontSize: 13 }}/>
                          <input placeholder="09:00" value={s.time} onChange={e => updateSession(i, "time", e.target.value)}
                            style={{ background: "var(--surface-soft-3)", border: "1px solid var(--glass-border)", borderRadius: 8, padding: "8px 12px", color: "var(--ink)", fontSize: 13 }}/>
                        </div>
                      </div>
                    </div>
                  ))}
                  <button className="btn" onClick={addSession} style={{ alignSelf: "flex-start" }}>
                    <Icon name="plus" size={12}/> {STR.addSession}
                  </button>
                </>
              )}
            </div>

            <div style={{ padding: "14px 22px", borderTop: "1px solid var(--glass-border)", display: "flex", justifyContent: "space-between", gap: 8 }}>
              <button className="btn" onClick={() => eventStep > 1 ? setEventStep(1) : setShowNewEvent(false)}>
                {eventStep > 1 ? <><Icon name="arrowLeft" size={13}/> {isAr ? "السابق" : "Back"}</> : STR.cancel}
              </button>
              {eventStep < 2 ? (
                <button className="btn primary" onClick={() => setEventStep(2)} disabled={!newEvent.title}>
                  {isAr ? "التالي" : "Next"} <Icon name="arrow" size={13}/>
                </button>
              ) : (
                <button className="btn primary" onClick={saveEvent} disabled={!newEvent.title}>
                  <Icon name="check" size={13}/> {STR.save}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
