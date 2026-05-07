import React, { useState, useEffect } from 'react';
import { Avatar, StatusChip, TierChip, Drawer } from './components/UI';
import { Icon } from './components/Icons';
import {
  useTweaks,
  TweaksPanel,
  TweakSection,
  TweakColor,
  TweakSlider,
  TweakRadio,
} from './components/TweaksPanel';
import DashboardView from './views/DashboardView';
import InvitationsView from './views/InvitationsView';
import GuestsView from './views/GuestsView';
import TravelView from './views/TravelView';
import MeetingsView from './views/MeetingsView';
import SeatingView from './views/SeatingView';
import VenueConfigView from './views/VenueConfigView';

const NAV = [
  { key: "dashboard", icon: "dashboard", label: { en: "Overview", ar: "نظرة عامة" }, section: "EVENT" },
  { key: "invitations", icon: "invitation", label: { en: "Invitations", ar: "الدعوات" }, section: "EVENT", badge: "4" },
  { key: "guests", icon: "guests", label: { en: "Guests", ar: "الضيوف" }, section: "EVENT" },
  { key: "travel", icon: "travel", label: { en: "Travel & logistics", ar: "السفر واللوجستيات" }, section: "EVENT" },
  { key: "accreditation", icon: "badge", label: { en: "Accreditation", ar: "الاعتماد" }, section: "ONSITE" },
  { key: "seating", icon: "seating", label: { en: "Seating", ar: "الجلوس" }, section: "ONSITE" },
  { key: "meetings", icon: "meetings", label: { en: "Meetings", ar: "الاجتماعات" }, section: "ONSITE" },
  { key: "venueConfig", icon: "venue", label: { en: "Venue Config", ar: "تهيئة المكان" }, section: "ONSITE" },
  { key: "protocol", icon: "protocol", label: { en: "Protocol", ar: "البروتوكول" }, section: "ONSITE" },
  { key: "financials", icon: "finance", label: { en: "Financials", ar: "الماليات" }, section: "INSIGHTS" },
  { key: "reports", icon: "reports", label: { en: "Reports", ar: "التقارير" }, section: "INSIGHTS" },
];

const SECTION_LABELS = {
  EVENT:    { en: "EVENT",    ar: "الحدث" },
  ONSITE:   { en: "ONSITE",   ar: "في الموقع" },
  INSIGHTS: { en: "INSIGHTS", ar: "تحليلات" },
};

const SHELL_I18N = {
  en: {
    gms: "GMS",
    guestMgmt: "Guest Management",
    switchEvent: "Switch event",
    inSession: "In session",
    eventName: "23rd Doha Forum",
    eventMeta: "7–9 December · Sheraton Grand",
    daysOut: "D-2",
    searchPlaceholder: "Search guests, sessions, bookings…",
    userName: "Amira Hassan",
    userRole: "Protocol Lead · MOFA",
    switchTo: (m) => `Switch to ${m} mode`,
  },
  ar: {
    gms: "GMS",
    guestMgmt: "إدارة الضيوف",
    switchEvent: "تبديل الحدث",
    inSession: "قيد الانعقاد",
    eventName: "منتدى الدوحة الـ ٢٣",
    eventMeta: "٧–٩ ديسمبر · شيراتون الكبرى",
    daysOut: "−٢ يوم",
    searchPlaceholder: "بحث في الضيوف والجلسات والحجوزات…",
    userName: "أميرة حسن",
    userRole: "رئيسة البروتوكول · وزارة الخارجية",
    switchTo: (m) => `التبديل إلى الوضع ${m === "dark" ? "الداكن" : "الفاتح"}`,
  },
};

const EVENT_I18N = {
  en: {
    "doha-forum": { name: "Doha Forum", subtitle: "22nd Edition · 7–9 Dec" },
    "qef":        { name: "Qatar Economic Forum", subtitle: "Powered by Bloomberg · May" },
    "qabf":       { name: "Qatar–Africa Business Forum", subtitle: "Doha · October" },
  },
  ar: {
    "doha-forum": { name: "منتدى الدوحة", subtitle: "النسخة الـ ٢٢ · ٧–٩ ديسمبر" },
    "qef":        { name: "منتدى قطر الاقتصادي", subtitle: "بدعم من بلومبرغ · مايو" },
    "qabf":       { name: "منتدى قطر–أفريقيا للأعمال", subtitle: "الدوحة · أكتوبر" },
  },
};

const TWEAK_DEFAULTS = {
  theme: "dark",
  accent: "#1aaec4",
  blur: 22,
  density: "comfortable",
  orbIntensity: 0.1,
  lang: "en",
  event: "doha-forum",
};

const EVENTS = [
  { key: "doha-forum", name: "Doha Forum", subtitle: "22nd Edition · 7–9 Dec", logoColor: "assets/doha-forum-logo.png", logoWhite: "assets/doha-forum-logo-white.png", accent: "#1aaec4" },
  { key: "qef", name: "Qatar Economic Forum", subtitle: "Powered by Bloomberg · May", logoColor: "assets/qef-logo-white.png", logoWhite: "assets/qef-logo-white.png", accent: "#8b6f3a", invertInLight: true },
  { key: "qabf", name: "Qatar–Africa Business Forum", subtitle: "Doha · October", logoColor: "assets/qabf-logo.png", logoWhite: "assets/qabf-logo.png", accent: "#9aa0a4", invertInLight: true },
];

function EventSwitcher({ value, onChange, navLabel, lang }) {
  const [open, setOpen] = useState(false);
  const ref = React.useRef(null);
  const ev = EVENTS.find(e => e.key === value) || EVENTS[0];
  const evI18n = EVENT_I18N[lang] || EVENT_I18N.en;
  const shell = SHELL_I18N[lang] || SHELL_I18N.en;
  const evCopy = (k) => evI18n[k] || EVENT_I18N.en[k];
  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);
  return (
    <div className="event-switcher" ref={ref}>
      <button className={"event-trigger" + (open ? " open" : "")} onClick={() => setOpen(o => !o)}>
        <span className="event-logo-mark" data-event={ev.key}>
          <img src={ev.logoWhite} alt="" />
        </span>
        <span className="event-text">
          <span className="event-name">{evCopy(ev.key).name}</span>
          <span className="event-sub">{evCopy(ev.key).subtitle}</span>
        </span>
        <svg className="event-caret" viewBox="0 0 12 12" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M3 4.5L6 8 9 4.5"/></svg>
      </button>
      <span className="sep">/</span>
      <span>{shell.gms}</span>
      <span className="sep">/</span>
      <strong>{navLabel}</strong>
      {open && (
        <div className="event-menu glass">
          <div className="event-menu-head">{shell.switchEvent}</div>
          {EVENTS.map(e => (
            <button key={e.key} className={"event-row" + (e.key === value ? " active" : "")} onClick={() => { onChange(e.key); setOpen(false); }}>
              <span className="event-logo-mark" data-event={e.key}><img src={e.logoWhite} alt="" /></span>
              <span className="event-text">
                <span className="event-name">{evCopy(e.key).name}</span>
                <span className="event-sub">{evCopy(e.key).subtitle}</span>
              </span>
              {e.key === value && <span className="event-check"><svg viewBox="0 0 14 14" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 7.5l3 3 5-6.5"/></svg></span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function GuestDrawer({ guest, onClose, lang }) {
  const isAr = lang === "ar";
  const D = isAr ? {
    profile: "ملف الضيف",
    message: "رسالة", badge: "شارة",
    guestId: "معرّف الضيف", invited: "تاريخ الدعوة",
    arrival: "الوصول", hotel: "الفندق", table: "الطاولة",
    accreditation: "الاعتماد",
    issued: "صادر · المناطق A·B·VIP", pending: "قيد الانتظار",
    secondRing: "الحلقة الثانية",
    activity: "النشاط",
    today: "اليوم ٠٩:١٤", yest: "أمس ١٦:٠٢",
    line1: "تحقق هيّا · مزامنة الداخلية ✓",
    line2: "تأكيد حجز الفندق ·",
    line3: "قبول الدعوة عبر البريد الإلكتروني",
  } : {
    profile: "Guest profile",
    message: "Message", badge: "Badge",
    guestId: "Guest ID", invited: "Invited",
    arrival: "Arrival", hotel: "Hotel", table: "Table",
    accreditation: "Accreditation",
    issued: "Issued · Zone A·B·VIP", pending: "Pending",
    secondRing: "2nd ring",
    activity: "Activity",
    today: "Today 09:14", yest: "Yesterday 16:02",
    line1: "Hayya verified · MOI sync ✓",
    line2: "Hotel block confirmed ·",
    line3: "Invitation accepted via email",
  };
  return (
    <>
      <div style={{ padding: "20px 22px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--glass-border)" }}>
        <div style={{ fontSize: 11, letterSpacing: isAr ? "0.04em" : "0.18em", textTransform: "uppercase", color: "var(--ink-mute)" }}>{D.profile}</div>
        <button className="icon-btn" onClick={onClose}><Icon name="close" size={14}/></button>
      </div>
      <div style={{ padding: "20px 22px", overflowY: "auto", flex: 1 }}>
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <Avatar initials={guest.initials} size={64} tier={guest.tier}/>
          <div>
            <h2 style={{ fontFamily: "var(--serif)", fontSize: 26, margin: 0, fontWeight: 400 }}>{guest.name}</h2>
            <div style={{ fontSize: 12, color: "var(--ink-dim)", marginTop: 2 }}>{guest.role} · {guest.org}</div>
            <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
              <TierChip tier={guest.tier} lang={lang}/>
              <StatusChip status={guest.status} lang={lang}/>
              <span className="chip"><span className="dot"/>{guest.country}</span>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 6, marginTop: 18 }}>
          <button className="btn primary" style={{ flex: 1 }}><Icon name="message" size={14}/> {D.message}</button>
          <button className="btn" style={{ flex: 1 }}><Icon name="badge" size={14}/> {D.badge}</button>
          <button className="btn"><Icon name="more" size={14}/></button>
        </div>

        <div className="divider"/>

        <DetailRow label={D.guestId} value={guest.id} mono/>
        <DetailRow label={D.invited} value={guest.invited}/>
        <DetailRow label={D.arrival} value={`${guest.arrival} · ${guest.flight}`} mono/>
        <DetailRow label={D.hotel} value={guest.hotel}/>
        <DetailRow label={D.table} value={`T${guest.table} · ${D.secondRing}`} mono/>
        <DetailRow label={D.accreditation} value={guest.accreditation === "issued" ? D.issued : D.pending}/>

        <div className="divider"/>

        <div style={{ fontSize: 11, letterSpacing: isAr ? "0.04em" : "0.18em", textTransform: "uppercase", color: "var(--ink-mute)", marginBottom: 10 }}>{D.activity}</div>
        <div className="timeline">
          <div className="timeline-item"><div style={{ fontSize: 11.5, color: "var(--accent-2)", fontFamily: "var(--mono)", direction: "ltr" }}>{D.today}</div><div style={{ fontSize: 12.5 }}>{D.line1}</div></div>
          <div className="timeline-item"><div style={{ fontSize: 11.5, color: "var(--accent-2)", fontFamily: "var(--mono)", direction: "ltr" }}>{D.yest}</div><div style={{ fontSize: 12.5 }}>{D.line2} {guest.hotel}</div></div>
          <div className="timeline-item"><div style={{ fontSize: 11.5, color: "var(--accent-2)", fontFamily: "var(--mono)", direction: "ltr" }}>{guest.invited}</div><div style={{ fontSize: 12.5 }}>{D.line3}</div></div>
        </div>
      </div>
    </>
  );
}

function DetailRow({ label, value, mono }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", fontSize: 13 }}>
      <span style={{ color: "var(--ink-mute)" }}>{label}</span>
      <span style={{ fontFamily: mono ? "var(--mono)" : "inherit", fontSize: mono ? 12 : 13, color: "var(--ink)" }}>{value}</span>
    </div>
  );
}

function Tweaks({ tweaks, setTweak }) {
  return (
    <TweaksPanel title="Tweaks">
      <TweakSection label="Theme">
        <TweakRadio label="Mode" value={tweaks.theme || "dark"} options={["dark","light"]} onChange={v => setTweak("theme", v)}/>
        <TweakColor label="Accent" value={tweaks.accent} onChange={v => setTweak("accent", v)}/>
      </TweakSection>
      <TweakSection label="Glass">
        <TweakSlider label="Blur" min={6} max={40} step={1} value={tweaks.blur} onChange={v => setTweak("blur", v)}/>
        <TweakSlider label="Orb intensity" min={0} max={1} step={0.05} value={tweaks.orbIntensity} onChange={v => setTweak("orbIntensity", v)}/>
      </TweakSection>
      <TweakSection label="Density">
        <TweakRadio label="Spacing" value={tweaks.density} options={["compact","comfortable","airy"]} onChange={v => setTweak("density", v)}/>
      </TweakSection>
    </TweaksPanel>
  );
}

const VIEWS = {
  dashboard: DashboardView,
  invitations: InvitationsView,
  guests: GuestsView,
  travel: TravelView,
  meetings: MeetingsView,
  seating: SeatingView,
  venueConfig: VenueConfigView,
};

const ComingSoon = () => (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--ink-mute)", fontSize: 14 }}>
    Coming soon
  </div>
);

export default function App() {
  const [view, setView] = useState("dashboard");
  const [openGuest, setOpenGuest] = useState(null);
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-theme", tweaks.theme || "dark");
    root.setAttribute("data-density", tweaks.density || "comfortable");
    root.style.setProperty("--accent", tweaks.accent);
    root.style.setProperty("--glass-blur", `${tweaks.blur}px`);
    root.style.setProperty("--orb-opacity", String(tweaks.orbIntensity));
  }, [tweaks]);

  const lang = tweaks.lang || "en";
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("lang", lang);
    root.setAttribute("dir", lang === "ar" ? "rtl" : "ltr");
  }, [lang]);

  const sections = ["EVENT", "ONSITE", "INSIGHTS"];
  const Current = VIEWS[view] || ComingSoon;
  const navItem = NAV.find(n => n.key === view);
  const shell = SHELL_I18N[lang] || SHELL_I18N.en;
  const navLabelOf = (n) => (n.label && typeof n.label === "object" ? (n.label[lang] || n.label.en) : n.label);

  return (
    <div className="app">
      <aside className="sidebar glass">
        <div className="brand-logo">
          <img className="logo-color" src="assets/doha-forum-logo.png" alt="Doha Forum"/>
          <img className="logo-white" src="assets/doha-forum-logo-white.png" alt="Doha Forum"/>
        </div>
        <div style={{ padding: "14px 12px 6px", display: "flex", alignItems: "baseline", gap: 8 }}>
          <div style={{ fontFamily: "var(--serif)", fontSize: 22, fontStyle: "italic", letterSpacing: "0.01em" }}>GMS</div>
          <div style={{ fontSize: 10.5, color: "var(--ink-mute)", letterSpacing: lang === "ar" ? "0.04em" : "0.18em", textTransform: "uppercase" }}>{shell.guestMgmt}</div>
        </div>

        {sections.map(section => (
          <React.Fragment key={section}>
            <div className="nav-section">{(SECTION_LABELS[section] && SECTION_LABELS[section][lang]) || section}</div>
            {NAV.filter(n => n.section === section).map(n => (
              <div key={n.key}
                className={`nav-item ${view === n.key ? "active" : ""}`}
                onClick={() => setView(n.key)}>
                <Icon name={n.icon} size={16}/>
                <span>{navLabelOf(n)}</span>
                {n.badge && <span className="badge">{n.badge}</span>}
              </div>
            ))}
          </React.Fragment>
        ))}

        <div className="event-card">
          <div className="kicker">{shell.inSession}</div>
          <h4>{shell.eventName}</h4>
          <div className="meta">{shell.eventMeta}</div>
          <div className="progress"><i/></div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "rgba(234,246,249,0.55)", marginTop: 8 }}>
            <span style={{ direction: "ltr" }}>{lang === "ar" ? "١٬٢٨٤ / ١٬٦٥٠" : "1,284 / 1,650"}</span>
            <span>{shell.daysOut}</span>
          </div>
        </div>
      </aside>

      <header className="topbar glass">
        <EventSwitcher value={tweaks.event || "doha-forum"} onChange={(v) => setTweak("event", v)} navLabel={navItem ? navLabelOf(navItem) : view} lang={lang} />
        <div className="right">
          <div className="search">
            <Icon name="search" size={14}/>
            <input placeholder={shell.searchPlaceholder}/>
            <kbd>⌘K</kbd>
          </div>
          <div className="lang-switch" role="group" aria-label="Language">
            <button className={"lang-opt" + ((tweaks.lang||"en")==="en" ? " active" : "")} onClick={() => setTweak("lang", "en")} aria-pressed={(tweaks.lang||"en")==="en"}>EN</button>
            <button className={"lang-opt" + ((tweaks.lang||"en")==="ar" ? " active" : "")} onClick={() => setTweak("lang", "ar")} aria-pressed={(tweaks.lang||"en")==="ar"}>عربي</button>
          </div>
          <button className="icon-btn"><Icon name="bell" size={16}/><span className="dot"/></button>
          <button className="icon-btn" title={shell.switchTo((tweaks.theme || "dark") === "dark" ? "light" : "dark")}
            onClick={() => setTweak("theme", (tweaks.theme || "dark") === "dark" ? "light" : "dark")}>
            <Icon name={(tweaks.theme || "dark") === "dark" ? "sun" : "moon"} size={16}/>
          </button>
          <div className="avatar">
            <div className="pic">{lang === "ar" ? "أ.ح" : "AH"}</div>
            <div>
              <div className="name">{shell.userName}</div>
              <div className="role">{shell.userRole}</div>
            </div>
          </div>
        </div>
      </header>

      <main className="main">
        <Current onOpenGuest={setOpenGuest} gotoView={setView} lang={lang} />
      </main>

      <Drawer open={!!openGuest} onClose={() => setOpenGuest(null)}>
        {openGuest && <GuestDrawer guest={openGuest} onClose={() => setOpenGuest(null)} lang={lang}/>}
      </Drawer>

      <Tweaks tweaks={tweaks} setTweak={setTweak}/>
    </div>
  );
}
