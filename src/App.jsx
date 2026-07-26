import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
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
import { INVITATION_TEMPLATES, SESSIONS } from './data/mockData';
import { useAuth } from './auth/AuthContext';
import { useEvents } from './events/EventsContext';
import DashboardView from './views/DashboardView';
import InvitationsView from './views/InvitationsView';
import GuestsView from './views/GuestsView';
import TravelView from './views/TravelView';
import MeetingsView from './views/MeetingsView';
import SeatingView from './views/SeatingView';
import VenueConfigView from './views/VenueConfigView';
import ProtocolView from './views/ProtocolView';
import FinancialsView from './views/FinancialsView';
import ReportsView from './views/ReportsView';
import EventsView from './views/EventsView';
import AccreditationView from './views/AccreditationView';
import AccountRequestsView from './views/AccountRequestsView';
import UserAccessView from './views/UserAccessView';
import UsersView from './views/UsersView';
import LookupsView from './views/lookups/LookupsView';
import { LOOKUP_DEFS } from './views/lookups/lookupConfig';

const LOOKUP_CHILDREN = LOOKUP_DEFS.map(d => ({
  key: `lookup-${d.key}`,
  lookupKey: d.key,
  label: d.label,
  permission: "Lookups.View",
}));

const NAV = [
  { key: "dashboard",      icon: "dashboard",  label: { en: "Overview",           ar: "نظرة عامة"             }, section: "EVENT",    permission: "Dashboard.View"         },
  { key: "invitations",    icon: "invitation", label: { en: "Invitations",         ar: "الدعوات"               }, section: "EVENT",    permission: "Invitations.View"       },
  { key: "guests",         icon: "guests",     label: { en: "Guests",              ar: "الضيوف"                }, section: "EVENT",    permission: "Guests.View"            },
  { key: "travel",         icon: "travel",     label: { en: "Services",            ar: "الخدمات"                }, section: "EVENT",    permission: "Travel.View"            },
  { key: "accreditation",  icon: "badge",      label: { en: "Accreditation",       ar: "الاعتماد"              }, section: "ONSITE",   permission: "Accreditation.View"     },
  { key: "seating",        icon: "seating",    label: { en: "Seating",             ar: "الجلوس"                }, section: "ONSITE",   permission: "Seating.View"           },
  { key: "meetings",       icon: "meetings",   label: { en: "Meetings",            ar: "الاجتماعات"            }, section: "ONSITE",   permission: "Meetings.View"          },
  { key: "venueConfig",    icon: "venue",      label: { en: "Venue Config",        ar: "تهيئة المكان"          }, section: "ONSITE",   permission: "Venue.View"             },
  // { key: "protocol",       icon: "protocol",   label: { en: "Protocol",            ar: "البروتوكول"            }, section: "ONSITE",   permission: "Protocol.View"          },
  // { key: "financials",     icon: "finance",    label: { en: "Financials",          ar: "الماليات"              }, section: "INSIGHTS", permission: "Financials.View"        },
  // { key: "reports",        icon: "reports",    label: { en: "Reports",             ar: "التقارير"              }, section: "INSIGHTS", permission: "Reports.View"           },
  { key: "events",         icon: "meetings",   label: { en: "Events",              ar: "الفعاليات"             }, section: "ADMIN",    permission: "Events.View"            },
  { key: "accountRequests",icon: "guests",     label: { en: "Account Requests",    ar: "طلبات الحسابات"        }, section: "ADMIN",    permission: "AccountRequests.View"   },
  { key: "userAccess",     icon: "protocol",   label: { en: "User Access",         ar: "صلاحيات المستخدمين"   }, section: "ADMIN",    permission: "UserAccess.Manage"      },
  { key: "users",          icon: "guests",     label: { en: "Users",               ar: "المستخدمون"            }, section: "ADMIN",    permission: "Users.View"             },
  { key: "lookups",        icon: "reports",    label: { en: "Lookups",             ar: "القوائم"               }, section: "ADMIN",    permission: "Lookups.View", children: LOOKUP_CHILDREN },
];

// Flatten NAV into routable leaf items (parents with children aren't routable themselves).
const NAV_LEAVES = NAV.flatMap(n => n.children ? n.children : [n]);

const SECTION_LABELS = {
  EVENT:    { en: "EVENT",    ar: "الحدث" },
  ONSITE:   { en: "ONSITE",   ar: "في الموقع" },
  INSIGHTS: { en: "INSIGHTS", ar: "تحليلات" },
  ADMIN:    { en: "ADMIN",    ar: "الإدارة" },
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

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1,3), 16), g = parseInt(hex.slice(3,5), 16), b = parseInt(hex.slice(5,7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
function lightenHex(hex, amt) {
  const r = parseInt(hex.slice(1,3), 16), g = parseInt(hex.slice(3,5), 16), b = parseInt(hex.slice(5,7), 16);
  const l = x => Math.min(255, Math.round(x + (255-x)*amt));
  return `#${l(r).toString(16).padStart(2,'0')}${l(g).toString(16).padStart(2,'0')}${l(b).toString(16).padStart(2,'0')}`;
}
function darkenHex(hex, amt) {
  const r = parseInt(hex.slice(1,3), 16), g = parseInt(hex.slice(3,5), 16), b = parseInt(hex.slice(5,7), 16);
  const d = x => Math.round(x*(1-amt));
  return `#${d(r).toString(16).padStart(2,'0')}${d(g).toString(16).padStart(2,'0')}${d(b).toString(16).padStart(2,'0')}`;
}
function blendHex(base, accent, amt) {
  const br = parseInt(base.slice(1,3), 16),   bg_ = parseInt(base.slice(3,5), 16),   bb = parseInt(base.slice(5,7), 16);
  const ar = parseInt(accent.slice(1,3), 16), ag  = parseInt(accent.slice(3,5), 16), ab = parseInt(accent.slice(5,7), 16);
  const r = Math.round(br*(1-amt) + ar*amt), g = Math.round(bg_*(1-amt) + ag*amt), b_ = Math.round(bb*(1-amt) + ab*amt);
  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b_.toString(16).padStart(2,'0')}`;
}
function applyBgVars(root, accent, isDark) {
  const base = isDark ? '#121212' : '#f8f8f8';
  const amounts = isDark ? [0.10, 0.18, 0.28] : [0.05, 0.10, 0.16];
  root.style.setProperty('--bg-0', blendHex(base, accent, amounts[0]));
  root.style.setProperty('--bg-1', blendHex(base, accent, amounts[1]));
  root.style.setProperty('--bg-2', blendHex(base, accent, amounts[2]));
  root.style.setProperty('--bg',   blendHex(base, accent, amounts[1]));
}

// ── Brand theme (Qatar Olympic — maroon #8d0134 + white) ────────────────────
// One switch: set enabled=false to restore per-event theming from the backend.
// The event accent/secondary fields and applyEventTheme code are left intact,
// so reverting is a single boolean flip (no data or logic is removed).
const BRAND_THEME = { enabled: true, accent: "#8d0134", secondary: "#c21857" };

const TWEAK_DEFAULTS = {
  theme: "light",
  accent: BRAND_THEME.accent,
  secondary: BRAND_THEME.secondary,
  blur: 22,
  density: "comfortable",
  orbIntensity: 0.1,
  lang: "en",
  event: "doha-forum",
};

const EVENTS = [
  { key: "doha-forum", name: "Doha Forum", subtitle: "22nd Edition · 7–9 Dec", logoColor: "assets/doha-forum-logo.png", logoWhite: "assets/doha-forum-logo-white.png", accent: "#8d0134", secondary: "#c21857" },
  { key: "qef", name: "Qatar Economic Forum", subtitle: "Powered by Bloomberg · May", logoColor: "assets/qef-logo-white.png", logoWhite: "assets/qef-logo-white.png", accent: "#c9943a", secondary: "#e8c068", invertInLight: true },
  { key: "qabf", name: "Qatar–Africa Business Forum", subtitle: "Doha · October", logoColor: "/assets/logo.svg", logoWhite: "/assets/logo.svg", accent: "#3d7ab5", secondary: "#6aabdf", invertInLight: true },
];

function EventSwitcher({ events = [], value, onChange, lang, theme }) {
  const [open, setOpen] = useState(false);
  const ref = React.useRef(null);
  const shell = SHELL_I18N[lang] || SHELL_I18N.en;
  const ev = events.find(e => e.key === value) || events[0] || null;

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const logoOf = (e) => (theme === 'dark' ? (e.logoDark || e.logoLight) : (e.logoLight || e.logoDark));
  const LetterMark = ({ e, size }) => (
    <span style={{ fontFamily: 'var(--serif)', fontSize: size, fontStyle: 'italic', color: e.accent }}>
      {(e.title || 'E').trim()[0]}
    </span>
  );

  if (!ev) {
    return (
      <div className="event-switcher" ref={ref}>
        <button className="event-trigger" disabled>
          <span className="event-text"><span className="event-name">{shell.switchEvent}</span>
          <span className="event-sub">—</span></span>
        </button>
      </div>
    );
  }

  return (
    <div className="event-switcher" ref={ref}>
      <button className={"event-trigger" + (open ? " open" : "")} onClick={() => setOpen(o => !o)}>
        <span className="event-logo-mark" data-event={ev.key} style={{ background: `${ev.accent}22`, borderColor: `${ev.accent}50` }}>
          {logoOf(ev)
            ? <img src={logoOf(ev)} alt="" onError={e => { e.target.style.display = 'none'; }}/>
            : <LetterMark e={ev} size={16}/>}
        </span>
        <span className="event-text">
          <span className="event-name">{ev.title}</span>
          <span className="event-sub">{ev.subtitle}</span>
        </span>
        <svg className="event-caret" viewBox="0 0 12 12" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M3 4.5L6 8 9 4.5"/></svg>
      </button>
      {open && (
        <div className="event-menu glass">
          <div className="event-menu-head">{shell.switchEvent}</div>
          {events.map(e => {
            const isActive = e.key === value;
            const logo = logoOf(e);
            return (
              <button key={e.key}
                className={"event-row" + (isActive ? " active" : "")}
                style={{ borderLeft: `3px solid ${e.accent}`, background: isActive ? `${e.accent}18` : undefined }}
                onClick={() => { onChange(e); setOpen(false); }}>
                <span className="event-logo-mark" data-event={e.key}
                  style={{ background: `${e.accent}22`, borderColor: `${e.accent}50`, overflow: 'hidden' }}>
                  {logo
                    ? <img src={logo} alt="" onError={err => { err.target.style.display = 'none'; }}/>
                    : <LetterMark e={e} size={15}/>}
                </span>
                <span className="event-text">
                  <span className="event-name" style={{ color: isActive ? e.accent : undefined }}>{e.title}</span>
                  <span className="event-sub">{e.subtitle}</span>
                </span>
                {isActive && <span className="event-check" style={{ color: e.accent }}><svg viewBox="0 0 14 14" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 7.5l3 3 5-6.5"/></svg></span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

const HOTELS = ["Sheraton Grand","Mondrian Doha","Mandarin Oriental","St. Regis","Four Seasons","InterContinental","W Doha"];
const TIER_COLOR = { VVIP:'#e0b864', VIP:'#a78bda', Speaker:'var(--accent)', Delegate:'#5abf6e', Press:'#e08a7e', Observer:'var(--ink-mute)' };

function GuestDrawer({ guest, onClose, lang }) {
  const isAr = lang === "ar";
  const [editTravel, setEditTravel] = React.useState(false);
  const [flight, setFlight] = React.useState(guest.flight || "");
  const [arrival, setArrival] = React.useState(guest.arrival || "");
  const [hotel, setHotel] = React.useState(guest.hotel || "");
  const [saved, setSaved] = React.useState(false);

  const [showMessage, setShowMessage] = React.useState(false);
  const [msgSubject, setMsgSubject] = React.useState(`Invitation — ${guest.fullName || guest.name || ''}`);
  const [msgBody, setMsgBody] = React.useState("");
  const [msgSent, setMsgSent] = React.useState(false);
  const [inviteTemplateId, setInviteTemplateId] = React.useState(null);
  const [guestSessions, setGuestSessions] = React.useState(new Set(guest.sessions || []));
  const [editSessions, setEditSessions] = React.useState(false);
  const [sessionsSaved, setSessionsSaved] = React.useState(false);

  const [showBadge, setShowBadge] = React.useState(false);
  const [showMore, setShowMore] = React.useState(false);
  const [drawerNotice, setDrawerNotice] = React.useState("");
  const [confirmRemove, setConfirmRemove] = React.useState(false);
  const moreRef = React.useRef(null);

  React.useEffect(() => {
    if (!showMore) return;
    const h = (e) => { if (moreRef.current && !moreRef.current.contains(e.target)) setShowMore(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [showMore]);

  function sendMessage() {
    setMsgSent(true);
    setTimeout(() => {
      setShowMessage(false); setMsgSent(false); setMsgBody("");
      setDrawerNotice(isAr ? "تم إرسال الرسالة ✓" : "Message sent ✓");
      setTimeout(() => setDrawerNotice(""), 2500);
    }, 900);
  }

  function saveTravel() {
    setSaved(true); setEditTravel(false);
    setTimeout(() => setSaved(false), 2500);
  }

  function drawerMsg(msg) { setDrawerNotice(msg); setTimeout(() => setDrawerNotice(""), 2500); }

  function toggleSession(id) {
    setGuestSessions(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }

  function saveSessions() {
    setSessionsSaved(true);
    setEditSessions(false);
    setTimeout(() => setSessionsSaved(false), 2500);
  }

  const D = isAr ? {
    profile: "ملف الضيف",
    message: "رسالة", badge: "شارة",
    guestId: "معرّف الضيف", invited: "تاريخ الدعوة",
    arrival: "الوصول", hotel: "الفندق", table: "الطاولة",
    flight: "رقم الرحلة", email: "البريد الإلكتروني",
    accreditation: "الاعتماد",
    travelTitle: "السفر والإقامة", editTravel: "تعديل", saveTravel: "حفظ",
    cancel: "إلغاء", savedMsg: "تم الحفظ ✓",
    issued: "صادر · المناطق A·B·VIP", pending: "قيد الانتظار",
    secondRing: "الحلقة الثانية", activity: "النشاط",
    today: "اليوم ٠٩:١٤", yest: "أمس ١٦:٠٢",
    line1: "تحقق هيّا · مزامنة الداخلية ✓",
    line2: "تأكيد حجز الفندق ·",
    line3: "قبول الدعوة عبر البريد الإلكتروني",
    arrivalDate: "تاريخ الوصول",
    compose: "كتابة رسالة", send: "إرسال", msgPh: "اكتب رسالتك…",
    subj: "الموضوع", to: "إلى", sentMsg: "تم الإرسال ✓",
    templateLabel: "قالب الدعوة (اختياري)", noTemplate: "رسالة مخصصة",
    badgeTitle: "شارة الاعتماد", printBadge: "طباعة",
    editPro: "تعديل الملف الشخصي", addMeet: "إضافة إلى اجتماع",
    expPdf: "تصدير PDF", removeG: "إزالة الضيف",
    confirmRemoveMsg: "هل تريد إزالة هذا الضيف من النظام؟",
    removeConfirmBtn: "إزالة", badgeNo: "رقم الشارة",
    meetingAdded: "تمت الإضافة إلى قائمة الاجتماعات ✓",
    sessionsTitle: "الجلسات", noSessions: "لا جلسات مخصصة", sessionsSaved: "تم حفظ الجلسات ✓",
    selectAll: "تحديد الكل", deselectAll: "إلغاء الكل",
  } : {
    profile: "Guest profile",
    message: "Message", badge: "Badge",
    guestId: "Guest ID", invited: "Invited",
    arrival: "Arrival date", hotel: "Hotel", table: "Table",
    flight: "Flight", email: "Email",
    accreditation: "Accreditation",
    travelTitle: "Travel & accommodation", editTravel: "Edit", saveTravel: "Save",
    cancel: "Cancel", savedMsg: "Saved ✓",
    issued: "Issued · Zone A·B·VIP", pending: "Pending",
    secondRing: "2nd ring", activity: "Activity",
    today: "Today 09:14", yest: "Yesterday 16:02",
    line1: "Hayya verified · MOI sync ✓",
    line2: "Hotel block confirmed ·",
    line3: "Invitation accepted via email",
    arrivalDate: "Arrival date",
    compose: "Compose message", send: "Send", msgPh: "Write your message…",
    subj: "Subject", to: "To", sentMsg: "Sent ✓",
    templateLabel: "Invitation template (optional)", noTemplate: "Custom message",
    badgeTitle: "Accreditation Badge", printBadge: "Print Badge",
    editPro: "Edit profile", addMeet: "Add to meeting",
    expPdf: "Export PDF", removeG: "Remove guest",
    confirmRemoveMsg: "Remove this guest from the system?",
    removeConfirmBtn: "Remove", badgeNo: "Badge No.",
    meetingAdded: "Added to meeting list ✓",
    sessionsTitle: "Sessions", noSessions: "No sessions assigned", sessionsSaved: "Sessions saved ✓",
    selectAll: "Select all", deselectAll: "Deselect all",
  };

  const iStyle = { width: "100%", background: "var(--surface-soft-3)", border: "1px solid var(--glass-border)", borderRadius: 8, padding: "8px 11px", color: "var(--ink)", fontSize: 13, boxSizing: "border-box" };
  const tierColor = TIER_COLOR[guest.tier] || "var(--accent)";

  // Real GuestResponse fields (fullName/invitationStatus/accreditationStatus)
  // — the rest of this drawer predates the API and still reads some mock names.
  const guestName = guest.fullName || guest.name || `${guest.firstName || ""} ${guest.lastName || ""}`.trim();
  const INVITE_BADGE = {
    not_sent: { label: isAr ? "لم تُرسل" : "Not sent",  color: "#9CA3AF" },
    sent:     { label: isAr ? "أُرسلت"   : "Sent",      color: "#3B82F6" },
    opened:   { label: isAr ? "فُتحت"    : "Opened",    color: "#F59E0B" },
    accepted: { label: isAr ? "مقبولة"   : "Accepted",  color: "#5abf6e" },
    declined: { label: isAr ? "مرفوضة"   : "Declined",  color: "#e08a7e" },
  };
  const ACCRED_BADGE = {
    not_issued: { label: isAr ? "غير صادر" : "Not Required", color: "#9CA3AF" },
    issued:     { label: isAr ? "صادر"     : "Required",     color: "#5abf6e" },
    revoked:    { label: isAr ? "ملغى"     : "Revoked",    color: "#e05050" },
  };
  const inviteBadge = INVITE_BADGE[guest.invitationStatus] || INVITE_BADGE.not_sent;
  const accredBadge = ACCRED_BADGE[guest.accreditationStatus] || ACCRED_BADGE.not_issued;
  const Badge = ({ dotColor, children }) => (
    <span className="chip" style={{ borderColor: `${dotColor}55`, color: dotColor, background: `${dotColor}18` }}>
      <span className="dot" style={{ background: dotColor }}/>{children}
    </span>
  );
  const menuBtnStyle = { display:"flex", alignItems:"center", gap:10, width:"100%", padding:"8px 10px", borderRadius:8, background:"none", border:"none", color:"var(--ink)", fontSize:13, cursor:"pointer", textAlign:"start" };

  return (
    <>
      <div style={{ padding: "20px 22px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--glass-border)" }}>
        <div style={{ fontSize: 11, letterSpacing: isAr ? "0.04em" : "0.18em", textTransform: "uppercase", color: "var(--ink-mute)" }}>{D.profile}</div>
        <button className="icon-btn" onClick={onClose}><Icon name="close" size={14}/></button>
      </div>
      <div style={{ padding: "20px 22px", overflowY: "auto", flex: 1 }}>
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <div>
            <h2 style={{ fontFamily: "var(--serif)", fontSize: 26, margin: 0, fontWeight: 400 }}>{guestName}</h2>
            <div style={{ fontSize: 12, color: "var(--ink-dim)", marginTop: 2 }}>{guest.organization}</div>
            <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
              <TierChip tier={guest.tier} lang={lang}/>
              {guest.nationalityName && <span className="chip"><span className="dot"/>{guest.nationalityName}</span>}
            </div>
          </div>
        </div>

        {/* Real-status badges */}
        <div style={{ display: "flex", gap: 6, marginTop: 14, flexWrap: "wrap" }}>
          <Badge dotColor={inviteBadge.color}>{inviteBadge.label}</Badge>
          <Badge dotColor={accredBadge.color}>{isAr ? "الاعتماد" : "Accred"} · {accredBadge.label}</Badge>
        </div>

        <div style={{ display: "flex", gap: 6, marginTop: 18 }}>
          <button className="btn primary" style={{ flex: 1 }} onClick={() => { setShowMessage(true); setInviteTemplateId(null); setMsgSubject(`Invitation — ${guestName}`); }}>
            <Icon name="message" size={14}/> {D.message}
          </button>
          <button className="btn" style={{ flex: 1 }} onClick={() => setShowBadge(true)}>
            <Icon name="badge" size={14}/> {D.badge}
          </button>
          <div style={{ position: "relative" }} ref={moreRef}>
            <button className="btn" onClick={() => setShowMore(m => !m)}><Icon name="more" size={14}/></button>
            {showMore && (
              <div className="card glass" style={{ position:"absolute", right:0, top:"calc(100% + 4px)", width:195, padding:6, zIndex:50, boxShadow:"0 8px 32px rgba(0,0,0,0.35)" }}>
                {[
                  { icon:"edit",     label:D.editPro,  action:() => { setShowMore(false); setEditTravel(true); } },
                  { icon:"meetings", label:D.addMeet,  action:() => { setShowMore(false); setEditSessions(true); } },
                  { icon:"download", label:D.expPdf,   action:() => { setShowMore(false); window.print(); } },
                ].map(item => (
                  <button key={item.label} onClick={item.action} style={menuBtnStyle}
                    onMouseEnter={e => e.currentTarget.style.background="var(--surface-soft-3)"}
                    onMouseLeave={e => e.currentTarget.style.background="none"}>
                    <Icon name={item.icon} size={13}/> {item.label}
                  </button>
                ))}
                <div style={{ height:1, background:"var(--glass-border)", margin:"4px 0" }}/>
                <button onClick={() => { setShowMore(false); setConfirmRemove(true); }}
                  style={{ ...menuBtnStyle, color:"#e08a7e" }}
                  onMouseEnter={e => e.currentTarget.style.background="rgba(224,138,126,0.08)"}
                  onMouseLeave={e => e.currentTarget.style.background="none"}>
                  <Icon name="trash" size={13}/> {D.removeG}
                </button>
              </div>
            )}
          </div>
        </div>

        {drawerNotice && (
          <div style={{ marginTop:10, padding:"8px 12px", borderRadius:8, background:"rgba(141, 1, 52,0.1)", border:"1px solid rgba(141, 1, 52,0.25)", fontSize:12.5, color:"var(--accent)", display:"flex", alignItems:"center", gap:8 }}>
            <Icon name="check" size={13}/> {drawerNotice}
          </div>
        )}

        <div className="divider"/>

        <DetailRow label={D.email} value={guest.email || "—"} mono/>
        {guest.arrivalDate && <DetailRow label={D.arrival} value={guest.arrivalDate} mono/>}
        <DetailRow label={D.accreditation} value={accredBadge.label}/>

        <div className="divider"/>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontSize: 11, letterSpacing: isAr ? "0.04em" : "0.18em", textTransform: "uppercase", color: "var(--ink-mute)" }}>
            {D.travelTitle}
          </div>
          {saved ? (
            <span style={{ fontSize: 11.5, color: "var(--accent)", display: "flex", alignItems: "center", gap: 4 }}>
              <Icon name="check" size={11}/> {D.savedMsg}
            </span>
          ) : (
            <button className="btn ghost" style={{ padding: "3px 8px", fontSize: 11 }} onClick={() => setEditTravel(e => !e)}>
              <Icon name={editTravel ? "close" : "edit"} size={11}/> {editTravel ? D.cancel : D.editTravel}
            </button>
          )}
        </div>

        {editTravel ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "14px", borderRadius: 10, background: "var(--surface-soft-2)", border: "1px solid var(--glass-border)", marginBottom: 14 }}>
            <div>
              <label style={{ display: "block", fontSize: 10.5, color: "var(--ink-mute)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>{D.arrivalDate || "-"}</label>
              <input style={iStyle} value={arrival} onChange={e => setArrival(e.target.value)} placeholder="Dec 7"/>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 10.5, color: "var(--ink-mute)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>{D.flightNumber || "-"}</label>
              <input style={iStyle} value={flight} onChange={e => setFlight(e.target.value)} placeholder="QR 512"/>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 10.5, color: "var(--ink-mute)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>{D.hotel || "-"}</label>
              <select style={{ ...iStyle, appearance: "none", backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12' fill='none' stroke='%23718fa3' stroke-width='1.6'%3E%3Cpath d='M2 4l4 4 4-4'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 10px center", paddingRight: 28 }}
                value={hotel} onChange={e => setHotel(e.target.value)}>
                {HOTELS.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
            <button className="btn primary" style={{ alignSelf: "flex-end" }} onClick={saveTravel}>
              <Icon name="check" size={13}/> {D.saveTravel}
            </button>
          </div>
        ) : (
          <>
            <DetailRow label={D.arrival} value={`${arrival} · ${flight}`} mono/>
            <DetailRow label={D.hotel} value={hotel}/>
          </>
        )}

        <div className="divider"/>

        {/* Sessions section */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontSize: 11, letterSpacing: isAr ? "0.04em" : "0.18em", textTransform: "uppercase", color: "var(--ink-mute)", display: "flex", alignItems: "center", gap: 8 }}>
            {D.sessionsTitle}
            {guestSessions.size > 0 && <span style={{ fontSize: 10, background: "var(--accent)", color: "#fff", borderRadius: 10, padding: "1px 7px", letterSpacing: 0, textTransform: "none" }}>{guestSessions.size}</span>}
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            {sessionsSaved && <span style={{ fontSize: 11, color: "var(--accent)", display: "flex", alignItems: "center", gap: 3 }}><Icon name="check" size={11}/> {D.sessionsSaved}</span>}
            {/* <button className="btn ghost" style={{ padding: "3px 8px", fontSize: 11 }} onClick={() => setEditSessions(e => !e)}>
              <Icon name={editSessions ? "close" : "edit"} size={11}/> {editSessions ? D.cancel : D.editTravel}
            </button> */}
          </div>
        </div>
        {editSessions ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button onClick={() => setGuestSessions(prev => prev.size === SESSIONS.length ? new Set() : new Set(SESSIONS.map(s => s.id)))}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: "var(--accent)", padding: 0 }}>
                {guestSessions.size === SESSIONS.length ? D.deselectAll : D.selectAll}
              </button>
            </div>
            {SESSIONS.map(s => {
              const checked = guestSessions.has(s.id);
              return (
                <div key={s.id} onClick={() => toggleSession(s.id)}
                  style={{ padding: "9px 12px", borderRadius: 9, cursor: "pointer", display: "flex", alignItems: "flex-start", gap: 10,
                    border: `1px solid ${checked ? "var(--accent)" : "var(--glass-border)"}`,
                    background: checked ? "rgba(141, 1, 52,0.08)" : "var(--surface-soft-2)" }}>
                  <div style={{ width: 16, height: 16, borderRadius: 4, border: `2px solid ${checked ? "var(--accent)" : "var(--glass-border)"}`, background: checked ? "var(--accent)" : "transparent", display: "grid", placeItems: "center", flexShrink: 0, marginTop: 2 }}>
                    {checked && <Icon name="check" size={9} style={{ color: "#fff" }}/>}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: checked ? 500 : 400, lineHeight: 1.3 }}>{s.title}</div>
                    <div style={{ fontSize: 10.5, color: "var(--ink-mute)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      <span style={{ fontFamily: "var(--mono)" }}>{s.date} · {s.time}</span>
                      {" · "}{s.venue}{s.room ? ` · ${s.room}` : ""}
                    </div>
                  </div>
                </div>
              );
            })}
            <button className="btn primary" style={{ alignSelf: "flex-end", marginTop: 2 }} onClick={saveSessions}>
              <Icon name="check" size={13}/> {D.saveTravel}
            </button>
          </div>
        ) : (
          guestSessions.size === 0 ? (
            <div style={{ fontSize: 12, color: "var(--ink-mute)", fontStyle: "italic", marginBottom: 14 }}>{D.noSessions}</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
              {SESSIONS.filter(s => guestSessions.has(s.id)).map(s => (
                <div key={s.id} style={{ padding: "9px 12px", borderRadius: 9, background: "var(--surface-soft-2)", border: "1px solid var(--glass-border)" }}>
                  <div style={{ fontSize: 12.5, fontWeight: 500 }}>{s.title}</div>
                  <div style={{ fontSize: 10.5, color: "var(--ink-mute)", marginTop: 2 }}>
                    <span style={{ fontFamily: "var(--mono)" }}>{s.date} · {s.time}</span>
                    {" · "}{s.venue}{s.room ? ` · ${s.room}` : ""}
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {/* <div className="divider"/>

        <div style={{ fontSize: 11, letterSpacing: isAr ? "0.04em" : "0.18em", textTransform: "uppercase", color: "var(--ink-mute)", marginBottom: 10 }}>{D.activity}</div>
        <div className="timeline">
          <div className="timeline-item"><div style={{ fontSize: 11.5, color: "var(--accent-2)", fontFamily: "var(--mono)", direction: "ltr" }}>{D.today}</div><div style={{ fontSize: 12.5 }}>{D.line1}</div></div>
          <div className="timeline-item"><div style={{ fontSize: 11.5, color: "var(--accent-2)", fontFamily: "var(--mono)", direction: "ltr" }}>{D.yest}</div><div style={{ fontSize: 12.5 }}>{D.line2} {hotel}</div></div>
          <div className="timeline-item"><div style={{ fontSize: 11.5, color: "var(--accent-2)", fontFamily: "var(--mono)", direction: "ltr" }}>{guest.invited}</div><div style={{ fontSize: 12.5 }}>{D.line3}</div></div>
        </div> */}
      </div>

      {/* ── Message modal ── */}
      {showMessage && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.55)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1200 }}>
          <div className="card glass" style={{ width:480, maxWidth:"92vw", padding:0, maxHeight:"88vh", display:"flex", flexDirection:"column" }}>
            <div style={{ padding:"16px 20px", borderBottom:"1px solid var(--glass-border)", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div>
                <h3 style={{ margin:0, fontSize:15 }}>{D.compose}</h3>
                <div style={{ fontSize:11.5, color:"var(--ink-mute)", marginTop:3 }}>{D.to}: <span style={{ fontFamily:"var(--mono)", fontSize:11 }}>{guest.name} &lt;{guest.email}&gt;</span></div>
              </div>
              <button className="icon-btn" onClick={() => { setShowMessage(false); setMsgSent(false); }}><Icon name="close" size={14}/></button>
            </div>
            <div style={{ padding:"16px 20px", display:"flex", flexDirection:"column", gap:12, overflowY:"auto", flex:1 }}>
              <div>
                <label style={{ display:"block", fontSize:10.5, color:"var(--ink-mute)", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:6 }}>{D.templateLabel}</label>
                <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                  <div onClick={() => setInviteTemplateId(null)}
                    style={{ padding:"5px 11px", borderRadius:8, cursor:"pointer", fontSize:11.5, whiteSpace:"nowrap",
                      border:`1px solid ${!inviteTemplateId ? "var(--accent)" : "var(--glass-border)"}`,
                      background:!inviteTemplateId ? "rgba(141, 1, 52,0.1)" : "var(--surface-soft-3)" }}>
                    {D.noTemplate}
                  </div>
                  {INVITATION_TEMPLATES.map(t => (
                    <div key={t.id}
                      onClick={() => { setInviteTemplateId(t.id); setMsgSubject(isAr ? t.subjectAr : t.subject); setMsgBody(isAr ? t.bodyAr : t.body); }}
                      style={{ padding:"5px 11px", borderRadius:8, cursor:"pointer", fontSize:11.5, display:"flex", alignItems:"center", gap:5, whiteSpace:"nowrap",
                        border:`1px solid ${inviteTemplateId === t.id ? t.color : "var(--glass-border)"}`,
                        background:inviteTemplateId === t.id ? t.color+"18" : "var(--surface-soft-3)" }}>
                      <span style={{ width:7, height:7, borderRadius:"50%", background:t.color, flexShrink:0 }}/>
                      {isAr ? t.nameAr : t.name}
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ display:"block", fontSize:10.5, color:"var(--ink-mute)", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:5 }}>{D.subj}</label>
                <input style={iStyle} value={msgSubject} onChange={e => setMsgSubject(e.target.value)}/>
              </div>
              <div>
                <label style={{ display:"block", fontSize:10.5, color:"var(--ink-mute)", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:5 }}>{isAr ? "الرسالة" : "Message"}</label>
                <textarea style={{ ...iStyle, resize:"vertical", minHeight:130, lineHeight:1.6 }}
                  value={msgBody} onChange={e => setMsgBody(e.target.value)} placeholder={D.msgPh}/>
              </div>
              {msgSent ? (
                <div style={{ padding:"10px 14px", borderRadius:8, background:"rgba(141, 1, 52,0.1)", border:"1px solid rgba(141, 1, 52,0.25)", fontSize:13, color:"var(--accent)", display:"flex", alignItems:"center", gap:8 }}>
                  <Icon name="check" size={14}/> {D.sentMsg}
                </div>
              ) : (
                <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
                  <button className="btn" onClick={() => setShowMessage(false)}>{D.cancel}</button>
                  <button className="btn primary" onClick={sendMessage} disabled={!msgBody.trim()}>
                    <Icon name="message" size={13}/> {D.send}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Badge modal ── */}
      {showBadge && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.55)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1200 }}>
          <div className="card glass" style={{ width:340, maxWidth:"92vw", padding:0 }}>
            <div style={{ padding:"14px 18px", borderBottom:"1px solid var(--glass-border)", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <span style={{ fontWeight:600, fontSize:14 }}>{D.badgeTitle}</span>
              <button className="icon-btn" onClick={() => setShowBadge(false)}><Icon name="close" size={14}/></button>
            </div>
            <div style={{ padding:"20px" }}>
              <div style={{ border:"1px solid var(--glass-border)", borderRadius:12, overflow:"hidden", background:"var(--surface-soft-2)" }}>
                <div style={{ height:8, background:tierColor }}/>
                <div style={{ padding:"18px 20px", display:"flex", flexDirection:"column", alignItems:"center", textAlign:"center" }}>
                  <Avatar initials={guest.initials} size={56} tier={guest.tier}/>
                  <h2 style={{ fontFamily:"var(--serif)", fontSize:20, margin:"10px 0 4px", fontWeight:400 }}>{guest.name}</h2>
                  <div style={{ fontSize:12, color:"var(--ink-dim)" }}>{guest.role}</div>
                  <div style={{ fontSize:12, color:"var(--ink-mute)", marginBottom:12 }}>{guest.org}</div>
                  <div style={{ display:"flex", gap:6, justifyContent:"center", marginBottom:14 }}>
                    <span className="chip" style={{ fontSize:11, background:tierColor+"20", borderColor:tierColor+"50", color:tierColor }}>{guest.tier}</span>
                    <span className="chip" style={{ fontSize:11 }}><span className="dot"/> {guest.country}</span>
                  </div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, textAlign:"start" }}>
                    {[
                      { label:D.badgeNo, value:guest.id, mono:true },
                      { label:D.flight,  value:flight || guest.flight || "—", mono:true },
                      { label:D.arrival, value:arrival || guest.arrival || "—" },
                      { label:D.hotel,   value:hotel || guest.hotel || "—" },
                    ].map(row => (
                      <div key={row.label} style={{ padding:"7px 10px", background:"var(--surface-soft-3)", borderRadius:8, border:"1px solid var(--glass-border)" }}>
                        <div style={{ fontSize:9, color:"var(--ink-faint)", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:2 }}>{row.label}</div>
                        <div style={{ fontSize:11.5, fontFamily:row.mono ? "var(--mono)" : "inherit", fontWeight:500, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{row.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ padding:"12px 18px", borderTop:"1px solid var(--glass-border)", display:"flex", alignItems:"center", justifyContent:"space-between", gap:12 }}>
                  <div>
                    <div style={{ fontSize:10.5, color:"var(--ink-mute)", marginBottom:4 }}>23rd Doha Forum</div>
                    <div style={{ fontSize:10.5, fontFamily:"var(--mono)", color:"var(--ink-mute)" }}>7–9 Dec 2025</div>
                  </div>
                  <div style={{ background:"#fff", padding:5, borderRadius:6, border:"1px solid var(--glass-border)", flexShrink:0 }}>
                    <QRCodeSVG
                      value={`https://doha-forum.qa/verify/${guest.id}`}
                      size={64}
                      bgColor="#ffffff"
                      fgColor="#5e0022"
                      level="M"
                    />
                  </div>
                </div>
              </div>
              <div style={{ display:"flex", gap:8, marginTop:14 }}>
                <button className="btn" style={{ flex:1, justifyContent:"center" }} onClick={() => setShowBadge(false)}>{D.cancel}</button>
                <button className="btn primary" style={{ flex:1, justifyContent:"center" }} onClick={() => window.print()}>
                  <Icon name="doc" size={13}/> {D.printBadge}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Remove confirm ── */}
      {confirmRemove && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.55)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1200 }}>
          <div className="card glass" style={{ width:340, padding:"22px 24px" }}>
            <div style={{ fontWeight:600, fontSize:14, marginBottom:6 }}>{D.removeG}</div>
            <div style={{ fontSize:13, color:"var(--ink-dim)", marginBottom:4 }}>{guest.name}</div>
            <div style={{ fontSize:12, color:"var(--ink-mute)", marginBottom:20 }}>{D.confirmRemoveMsg}</div>
            <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
              <button className="btn" onClick={() => setConfirmRemove(false)}>{D.cancel}</button>
              <button className="btn" style={{ color:"#e08a7e", borderColor:"rgba(224,138,126,0.3)", background:"rgba(224,138,126,0.1)" }}
                onClick={() => { setConfirmRemove(false); onClose(); }}>
                <Icon name="trash" size={13}/> {D.removeConfirmBtn}
              </button>
            </div>
          </div>
        </div>
      )}
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
  events: EventsView,
  invitations: InvitationsView,
  guests: GuestsView,
  travel: TravelView,
  meetings: MeetingsView,
  seating: SeatingView,
  venueConfig: VenueConfigView,
  protocol: ProtocolView,
  financials: FinancialsView,
  reports: ReportsView,
  accreditation: AccreditationView,
  accountRequests: AccountRequestsView,
  userAccess: UserAccessView,
  users: UsersView,
};

const ComingSoon = () => (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--ink-mute)", fontSize: 14 }}>
    Coming soon
  </div>
);

export default function App() {
  const [view, setView] = useState("dashboard");
  const [openGuest, setOpenGuest] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [openMenus, setOpenMenus] = useState({});
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [activeLogo, setActiveLogo] = useState({ dark: '', light: '' });
  const { user, isDemo, signOut, can } = useAuth();
  const { events, activeEvent, setActiveEventId } = useEvents();

  function applyEventTheme(ev) {
    // Brand theme overrides per-event colors. Flip BRAND_THEME.enabled to false
    // (top of this file) to restore event-based accent/secondary from the backend.
    if (!ev && !BRAND_THEME.enabled) return;
    const root = document.documentElement;
    const accent = BRAND_THEME.enabled ? BRAND_THEME.accent : (ev?.accent || '#8d0134');
    const secondary = BRAND_THEME.enabled ? BRAND_THEME.secondary : (ev?.secondary || '#e0c47e');

    setTweak('accent', accent);
    setTweak('secondary', secondary);
    if (ev) setActiveLogo({ dark: ev.logoDark || '', light: ev.logoLight || '' });

    const orb1 = accent;
    const orb2 = darkenHex(accent, 0.62);
    const orb3 = lightenHex(accent, 0.42);
    root.style.setProperty('--orb-1', orb1);
    root.style.setProperty('--orb-2', orb2);
    root.style.setProperty('--orb-3', orb3);
    root.style.setProperty('--bg-glow-a',    hexToRgba(orb1, 0.30));
    root.style.setProperty('--bg-glow-b',    hexToRgba(orb3, 0.16));
    root.style.setProperty('--bg-glow-c',    hexToRgba(orb2, 0.35));
    root.style.setProperty('--bg-glow-a-lt', hexToRgba(orb1, 0.22));
    root.style.setProperty('--bg-glow-b-lt', hexToRgba(orb3, 0.20));
    root.style.setProperty('--bg-glow-c-lt', hexToRgba(orb2, 0.18));
    applyBgVars(root, accent, (root.getAttribute('data-theme') || 'dark') === 'dark');
  }

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-theme", tweaks.theme || "dark");
    root.setAttribute("data-density", tweaks.density || "comfortable");
    root.style.setProperty("--accent", tweaks.accent);
    root.style.setProperty("--accent-2", tweaks.secondary || "#e0c47e");
    root.style.setProperty("--glass-blur", `${tweaks.blur}px`);
    root.style.setProperty("--orb-opacity", String(tweaks.orbIntensity));
    applyBgVars(root, tweaks.accent || '#8d0134', (tweaks.theme || 'dark') === 'dark');
  }, [tweaks]);

  const lang = tweaks.lang || "en";
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("lang", lang);
    root.setAttribute("dir", lang === "ar" ? "rtl" : "ltr");
  }, [lang]);

  useEffect(() => {
    applyEventTheme(activeEvent);
  }, [activeEvent]);

  const activeEv = activeEvent;
  const logoColorSrc = activeLogo.light || activeEv?.logoLight || '/assets/logo.svg';
  const logoWhiteSrc = activeLogo.dark || activeEv?.logoDark || '';
  const triggerLogo = (tweaks.theme || 'dark') === 'dark'
    ? (activeLogo.dark || activeEv?.logoDark || activeEv?.logoLight)
    : (activeLogo.light || activeEv?.logoLight || activeEv?.logoDark);

  const sections = ["EVENT", "ONSITE", "INSIGHTS", "ADMIN"];
  const shell = SHELL_I18N[lang] || SHELL_I18N.en;
  const navLabelOf = (n) => (n.label && typeof n.label === "object" ? (n.label[lang] || n.label.en) : n.label);

  // If the current view is no longer accessible (permission revoked), redirect to the first visible item.
  const visibleLeaves = NAV_LEAVES.filter(n => !n.permission || can(n.permission));
  const activeView = visibleLeaves.find(n => n.key === view) ? view : (visibleLeaves[0]?.key || 'dashboard');
  const activeLeaf = NAV_LEAVES.find(n => n.key === activeView);
  const Current = VIEWS[activeView] || ComingSoon;
  const navItem = activeLeaf;

  return (
    <div className="app">
      <div className={`sidebar-overlay${sidebarOpen ? ' open' : ''}`} onClick={() => setSidebarOpen(false)}/>
      <aside className={`sidebar glass${sidebarOpen ? ' open' : ''}`}>
        <div className="brand-logo" key={activeEvent?.id || 'none'}>
          <img className="logo-color" src={logoColorSrc} alt={activeEv?.title || ''}
            onError={e => { e.target.style.display = "none"; }}/>
          <img className="logo-white" src={logoWhiteSrc} alt={activeEv?.title || ''}
            onError={e => { e.target.replaceWith(Object.assign(document.createElement("div"), { className: "brand-logo-fallback", innerHTML: `<span style="font-family:var(--serif);font-size:22px;font-style:italic;color:var(--accent)">${(activeEv?.title || 'GMS').split(' ')[0]}</span>`, style: "display:flex;flex-direction:column;align-items:center;line-height:1.2;padding:4px 0" })); }}/>
        </div>
        <div className="sidebar-brand-text" style={{ padding: "14px 12px 6px", display: "flex", alignItems: "baseline", gap: 8 }}>
          <div style={{ fontFamily: "var(--serif)", fontSize: 22, fontStyle: "italic", letterSpacing: "0.01em" }}>GMS</div>
          <div style={{ fontSize: 10.5, color: "var(--ink-mute)", letterSpacing: lang === "ar" ? "0.04em" : "0.18em", textTransform: "uppercase" }}>{shell.guestMgmt}</div>
        </div>

        <div className="sidebar-nav-scroll">
          {sections.map(section => {
            const visibleItems = NAV.filter(n => n.section === section && (!n.permission || can(n.permission)));
            if (visibleItems.length === 0) return null;
            return (
              <React.Fragment key={section}>
                <div className="nav-section">{(SECTION_LABELS[section] && SECTION_LABELS[section][lang]) || section}</div>
                {visibleItems.map(n => {
                  if (n.children) {
                    const kids = n.children.filter(c => !c.permission || can(c.permission));
                    if (kids.length === 0) return null;
                    const hasActiveKid = kids.some(c => c.key === view);
                    const isOpen = openMenus[n.key] ?? hasActiveKid;
                    return (
                      <React.Fragment key={n.key}>
                        <div className={`nav-item ${hasActiveKid ? "active" : ""}`}
                          onClick={() => setOpenMenus(m => ({ ...m, [n.key]: !isOpen }))}>
                          <Icon name={n.icon} size={16}/>
                          <span>{navLabelOf(n)}</span>
                          <Icon name={isOpen ? "chevronDown" : "chevronRight"} size={14} style={{ marginInlineStart: "auto" }}/>
                        </div>
                        {isOpen && kids.map(c => (
                          <div key={c.key}
                            className={`nav-item ${view === c.key ? "active" : ""}`}
                            style={{ paddingInlineStart: 38, fontSize: 13 }}
                            onClick={() => { setView(c.key); setSidebarOpen(false); }}>
                            <span>{navLabelOf(c)}</span>
                          </div>
                        ))}
                      </React.Fragment>
                    );
                  }
                  return (
                    <div key={n.key}
                      className={`nav-item ${view === n.key ? "active" : ""}`}
                      onClick={() => { setView(n.key); setSidebarOpen(false); }}>
                      <Icon name={n.icon} size={16}/>
                      <span>{navLabelOf(n)}</span>
                      {n.badge && <span className="badge">{n.badge}</span>}
                    </div>
                  );
                })}
              </React.Fragment>
            );
          })}
        </div>

        {/* <div className="event-card">
          <div className="kicker">{shell.inSession}</div>
          <h4>{activeEvent?.title || shell.eventName}</h4>
          <div className="meta">{activeEvent?.subtitle || shell.eventMeta}</div>
          <div className="progress"><i/></div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "rgba(234,246,249,0.55)", marginTop: 8 }}>
            <span style={{ direction: "ltr" }}>{lang === "ar" ? "١٬٢٨٤ / ١٬٦٥٠" : "1,284 / 1,650"}</span>
            <span>{shell.daysOut}</span>
          </div>
        </div> */}
      </aside>

      <header className="topbar glass">
        <button className="mobile-menu-btn icon-btn" onClick={() => setSidebarOpen(o => !o)}>
          <Icon name="menu" size={20}/>
        </button>
        <EventSwitcher events={events} value={activeEvent?.key} onChange={(e) => setActiveEventId(e.id)} lang={lang} theme={tweaks.theme || 'dark'} />
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
              <div className="name">{user && !isDemo ? user.fullName : shell.userName}</div>
              <div className="role">{user && !isDemo ? (user.role || user.roleCode || shell.userRole) : (isDemo ? "Demo mode" : shell.userRole)}</div>
            </div>
          </div>
          <button className="icon-btn" title="Sign out" onClick={signOut}>
            <Icon name="power" size={16}/>
          </button>
        </div>
      </header>

      <main className="main">
        {activeLeaf?.lookupKey
          ? <LookupsView lookupKey={activeLeaf.lookupKey} lang={lang} />
          : <Current onOpenGuest={setOpenGuest} gotoView={setView} lang={lang} activeEventId={activeEvent?.id || null} />}
      </main>

      <nav className="mobile-bottom-nav">
        {[
          { key:'dashboard', icon:'dashboard', label:{en:'Home',     ar:'الرئيسية'} },
          { key:'guests',    icon:'guests',    label:{en:'Guests',   ar:'الضيوف'} },
          { key:'seating',   icon:'seating',   label:{en:'Seating',  ar:'الجلوس'} },
          { key:'meetings',  icon:'meetings',  label:{en:'Meetings', ar:'اجتماعات'} },
          { key:'__menu',    icon:'menu',      label:{en:'More',     ar:'المزيد'} },
        ].map(n => (
          <button key={n.key}
            className={`mob-nav-item${view === n.key ? ' active' : ''}`}
            onClick={() => n.key === '__menu' ? setSidebarOpen(o => !o) : (setView(n.key), setSidebarOpen(false))}>
            <Icon name={n.icon} size={22}/>
            <span>{n.label[lang] || n.label.en}</span>
          </button>
        ))}
      </nav>

      <Drawer open={!!openGuest} onClose={() => setOpenGuest(null)}>
        {openGuest && <GuestDrawer guest={openGuest} onClose={() => setOpenGuest(null)} lang={lang}/>}
      </Drawer>

      <Tweaks tweaks={tweaks} setTweak={setTweak}/>
    </div>
  );
}
