import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";
import { Avatar, StatusChip, ServiceLevelChip, Drawer } from "./components/UI";
import { Icon } from "./components/Icons";
import Select from "./components/ui/Select";
import DateField from "./components/ui/DateField";
import toast from "./lib/toast";
import { onHub, REALTIME_TOPICS } from "./lib/realtimeHub";
import {
  useTweaks,
  TweaksPanel,
  TweakSection,
  TweakColor,
  TweakSlider,
  TweakRadio,
} from "./components/TweaksPanel";
import { SESSIONS } from "./data/mockData";
import { useAuth } from "./auth/AuthContext";
import { useEvents } from "./events/EventsContext";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { pathForKey } from "./nav";
import { LOOKUP_DEFS } from "./views/lookups/lookupConfig";
import { getGuestEnums } from "./api/services/lookupService";
import { getNationalities } from "./api/services/nationalityService";
import { updateGuest, deleteGuest } from "./api/services/guestService";
import { uploadImageFile, stripSasToken } from "./api/services/uploadService";
import { getMeetings, editMeeting } from "./api/services/meetingService";
import {
  getNotifications,
  getUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
} from "./api/services/notificationService";
import { addDaysIso, fmtDate } from "./lib/date";
import FlagIcon from "./components/FlagIcon";

// Vehicle types live under the Vehicles module (its own tab); Room Types and
// Hotels live under Accommodation, next to Inventory — all three left out of
// the Lookups submenu to avoid two links to the same screen.
const LOOKUP_CHILDREN = LOOKUP_DEFS.filter(
  (d) => !["vehicle-types", "room-types", "hotels"].includes(d.key),
).map((d) => ({
  key: `lookup-${d.key}`,
  lookupKey: d.key,
  label: d.label,
  permission: "Lookups.View",
}));

const NAV = [
  {
    key: "dashboard",
    icon: "dashboard",
    label: { en: "Dashboard", ar: "نظرة عامة" },
    section: "EVENT",
    permission: "Dashboard.View",
  },
  {
    key: "guests",
    icon: "guests",
    label: { en: "Guests", ar: "الضيوف" },
    section: "EVENT",
    permission: "Guests.View",
  },
  // Every service lives on this one page: the three built-in relational ones
  // (flight / accommodation / transport) get their own tabs, and each dynamic
  // service from the catalogue gets a tab after them — ServiceOpsView embedded.
  // Deliberately no second menu entry for those.
  {
    key: "travel",
    icon: "travel",
    label: { en: "Services", ar: "السفر والخدمات اللوجستية" },
    section: "EVENT",
    permission: "Travel.View",
  },
  {
    key: "supportChat",
    icon: "message",
    label: { en: "Support", ar: "الدعم الفني" },
    section: "EVENT",
    permission: "SupportChat.View",
  },
  {
    key: "accreditation",
    icon: "badge",
    label: { en: "Accreditation", ar: "الاعتماد" },
    section: "ONSITE",
    permission: "Accreditation.View",
  },
  {
    key: "seating",
    icon: "seating",
    label: { en: "Seating", ar: "الجلوس" },
    section: "ONSITE",
    permission: "Seating.View",
  },
  {
    key: "meetings",
    icon: "meetings",
    label: { en: "Meetings", ar: "الاجتماعات" },
    section: "ONSITE",
    permission: "Meetings.View",
  },
  {
    key: "venueConfig",
    icon: "venue",
    label: { en: "Venue Config", ar: "تهيئة المكان" },
    section: "ADMIN",
    permission: "Venue.View",
  },
  // { key: "protocol",       icon: "protocol",   label: { en: "Protocol",            ar: "البروتوكول"            }, section: "ONSITE",   permission: "Protocol.View"          },
  // { key: "financials",     icon: "finance",    label: { en: "Financials",          ar: "الماليات"              }, section: "INSIGHTS", permission: "Financials.View"        },
  // { key: "reports",        icon: "reports",    label: { en: "Reports",             ar: "التقارير"              }, section: "INSIGHTS", permission: "Reports.View"           },
  {
    key: "venues",
    icon: "venues",
    label: { en: "Venues", ar: "الأماكن" },
    section: "ADMIN",
    permission: "Venue.View",
  },
  {
    key: "invitations",
    icon: "invitation",
    label: { en: "Template Builder", ar: "الدعوات" },
    section: "ADMIN",
    permission: "Invitations.View",
  },

  {
    key: "events",
    icon: "meetings",
    label: { en: "Events", ar: "الفعاليات" },
    section: "ADMIN",
    permission: "Events.View",
  },
  // { key: "accountRequests",icon: "guests",     label: { en: "Account Requests",    ar: "طلبات الحسابات"        }, section: "ADMIN",    permission: "AccountRequests.View"   },
  {
    key: "userAccess",
    icon: "protocol",
    label: { en: "User Access", ar: "صلاحيات المستخدمين" },
    section: "USERMGMT",
    permission: "UserAccess.Manage",
  },
  {
    key: "users",
    icon: "guests",
    label: { en: "Users", ar: "المستخدمون" },
    section: "USERMGMT",
    permission: "Users.View",
  },
  {
    key: "guestOverview",
    icon: "reports",
    label: { en: "Guest Overview", ar: "نظرة عامة على الضيوف" },
    section: "ADMIN",
    permission: "Guests.View",
  },
  {
    key: "organizations",
    icon: "venue",
    label: { en: "Organizations", ar: "المؤسسات" },
    section: "ADMIN",
    permission: "Organizations.View",
  },
  {
    key: "serviceLevels",
    icon: "badge",
    label: { en: "Service Levels", ar: "مستويات الخدمة" },
    section: "ADMIN",
    permission: "ServiceLevels.View",
  },
  {
    key: "services",
    icon: "star",
    label: { en: "Manage Services", ar: "إدارة الخدمات" },
    section: "ADMIN",
    permission: "Services.View",
  },
  {
    key: "vehicles",
    icon: "car",
    label: { en: "Vehicles", ar: "المركبات" },
    section: "FLEET",
    permission: "Travel.View",
  },
  {
    key: "fleetProviders",
    icon: "venue",
    label: { en: "Fleet Providers", ar: "مزوّدو الأسطول" },
    section: "FLEET",
    permission: "Travel.View",
  },
  {
    key: "fleetBookings",
    icon: "meetings",
    label: { en: "Bookings", ar: "حجوزات الأسطول" },
    section: "FLEET",
    permission: "Travel.View",
  },
  {
    key: "roomInventory",
    icon: "hotel",
    label: { en: "Inventory", ar: "مخزون الإقامة" },
    section: "STAY",
    permission: "Travel.View",
  },
  {
    key: "lookup-hotels",
    lookupKey: "hotels",
    icon: "hotel",
    label: { en: "Hotels", ar: "الفنادق" },
    section: "STAY",
    permission: "Lookups.View",
  },
  {
    key: "lookup-room-types",
    lookupKey: "room-types",
    icon: "doc",
    label: { en: "Room Types", ar: "أنواع الغرف" },
    section: "STAY",
    permission: "Lookups.View",
  },
  {
    key: "lookups",
    icon: "reports",
    label: { en: "Lookups", ar: "القوائم" },
    section: "ADMIN",
    permission: "Lookups.View",
    children: LOOKUP_CHILDREN,
  },
];

// Flatten NAV into routable leaf items (parents with children aren't routable themselves).
const NAV_LEAVES = NAV.flatMap((n) => (n.children ? n.children : [n]));

const SECTION_LABELS = {
  EVENT: { en: "EVENT", ar: "الحدث" },
  ONSITE: { en: "ONSITE", ar: "في الموقع" },
  INSIGHTS: { en: "INSIGHTS", ar: "تحليلات" },
  FLEET: { en: "FLEET MANAGEMENT", ar: "إدارة الأسطول" },
  STAY: { en: "ACCOMMODATION", ar: "الإقامة" },
  USERMGMT: { en: "USER MANAGEMENT", ar: "إدارة المستخدمين" },
  ADMIN: { en: "ADMIN", ar: "الإدارة" },
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
    qef: {
      name: "Qatar Economic Forum",
      subtitle: "Powered by Bloomberg · May",
    },
    qabf: { name: "Qatar–Africa Business Forum", subtitle: "Doha · October" },
  },
  ar: {
    "doha-forum": {
      name: "منتدى الدوحة",
      subtitle: "النسخة الـ ٢٢ · ٧–٩ ديسمبر",
    },
    qef: { name: "منتدى قطر الاقتصادي", subtitle: "بدعم من بلومبرغ · مايو" },
    qabf: { name: "منتدى قطر–أفريقيا للأعمال", subtitle: "الدوحة · أكتوبر" },
  },
};

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16),
    g = parseInt(hex.slice(3, 5), 16),
    b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
function lightenHex(hex, amt) {
  const r = parseInt(hex.slice(1, 3), 16),
    g = parseInt(hex.slice(3, 5), 16),
    b = parseInt(hex.slice(5, 7), 16);
  const l = (x) => Math.min(255, Math.round(x + (255 - x) * amt));
  return `#${l(r).toString(16).padStart(2, "0")}${l(g).toString(16).padStart(2, "0")}${l(b).toString(16).padStart(2, "0")}`;
}
function darkenHex(hex, amt) {
  const r = parseInt(hex.slice(1, 3), 16),
    g = parseInt(hex.slice(3, 5), 16),
    b = parseInt(hex.slice(5, 7), 16);
  const d = (x) => Math.round(x * (1 - amt));
  return `#${d(r).toString(16).padStart(2, "0")}${d(g).toString(16).padStart(2, "0")}${d(b).toString(16).padStart(2, "0")}`;
}
function blendHex(base, accent, amt) {
  const br = parseInt(base.slice(1, 3), 16),
    bg_ = parseInt(base.slice(3, 5), 16),
    bb = parseInt(base.slice(5, 7), 16);
  const ar = parseInt(accent.slice(1, 3), 16),
    ag = parseInt(accent.slice(3, 5), 16),
    ab = parseInt(accent.slice(5, 7), 16);
  const r = Math.round(br * (1 - amt) + ar * amt),
    g = Math.round(bg_ * (1 - amt) + ag * amt),
    b_ = Math.round(bb * (1 - amt) + ab * amt);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b_.toString(16).padStart(2, "0")}`;
}
function applyBgVars(root, accent, isDark) {
  // Light mode is deliberately NOT accent-tinted. The old behaviour blended the
  // accent into every background at 5–16%, which turned the QOC maroon into a
  // pink cast across all surfaces; the revamp wants neutral white/grey pages
  // with the maroon reserved for the shell and accents. Dark mode keeps the
  // original tinting, where it reads as depth rather than as a colour wash.
  if (!isDark) {
    root.style.removeProperty("--bg-0");
    root.style.removeProperty("--bg-1");
    root.style.removeProperty("--bg-2");
    root.style.removeProperty("--bg");
    return;
  }
  const base = "#121212";
  const amounts = [0.1, 0.18, 0.28];
  root.style.setProperty("--bg-0", blendHex(base, accent, amounts[0]));
  root.style.setProperty("--bg-1", blendHex(base, accent, amounts[1]));
  root.style.setProperty("--bg-2", blendHex(base, accent, amounts[2]));
  root.style.setProperty("--bg", blendHex(base, accent, amounts[1]));
}

// ── Brand theme (Qatar Olympic — maroon #8d0134 + white) ────────────────────
// One switch: set enabled=false to restore per-event theming from the backend.
// The event accent/secondary fields and applyEventTheme code are left intact,
// so reverting is a single boolean flip (no data or logic is removed).
const BRAND_THEME = { enabled: true, accent: "#8d0134", secondary: "#c21857" };

const TWEAK_DEFAULTS = {
  // Light is the QOC-revamp default (the brief calls for 80–90% light); dark
  // stays available via the topbar toggle.
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
  {
    key: "doha-forum",
    name: "Doha Forum",
    subtitle: "22nd Edition · 7–9 Dec",
    logoColor: "assets/doha-forum-logo.png",
    logoWhite: "assets/doha-forum-logo-white.png",
    accent: "#8d0134",
    secondary: "#c21857",
  },
  {
    key: "qef",
    name: "Qatar Economic Forum",
    subtitle: "Powered by Bloomberg · May",
    logoColor: "assets/qef-logo-white.png",
    logoWhite: "assets/qef-logo-white.png",
    accent: "#c9943a",
    secondary: "#e8c068",
    invertInLight: true,
  },
  {
    key: "qabf",
    name: "Qatar–Africa Business Forum",
    subtitle: "Doha · October",
    logoColor: "/assets/logo.svg",
    logoWhite: "/assets/logo.svg",
    accent: "#3d7ab5",
    secondary: "#6aabdf",
    invertInLight: true,
  },
];

function EventSwitcher({ events = [], value, onChange, lang, theme }) {
  const [open, setOpen] = useState(false);
  const ref = React.useRef(null);
  const shell = SHELL_I18N[lang] || SHELL_I18N.en;
  const ev = events.find((e) => e.key === value) || events[0] || null;

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  // Falls back to the event's cover image when no logo is set — it's a photo,
  // not a transparent mark, so it gets cover-cropped instead of letterboxed.
  const logoOf = (e) =>
    theme === "dark" ? e.logoDark || e.logoLight : e.logoLight || e.logoDark;
  const markOf = (e) => {
    const logo = logoOf(e);
    return logo
      ? { src: logo, cover: false }
      : e.image
        ? { src: e.image, cover: true }
        : null;
  };
  const LetterMark = ({ e, size }) => (
    <span
      style={{
        fontFamily: "var(--serif)",
        fontSize: size,
        fontStyle: "italic",
        color: e.accent,
      }}
    >
      {(e.title || "E").trim()[0]}
    </span>
  );

  if (!ev) {
    return (
      <div className="event-switcher" ref={ref}>
        <button className="event-trigger" disabled>
          <span className="event-text">
            <span className="event-name">{shell.switchEvent}</span>
            <span className="event-sub">—</span>
          </span>
        </button>
      </div>
    );
  }

  return (
    <div className="event-switcher" ref={ref}>
      <button
        className={"event-trigger" + (open ? " open" : "")}
        onClick={() => setOpen((o) => !o)}
      >
        <span
          className="event-logo-mark"
          data-event={ev.key}
          style={{
            background: `${ev.accent}22`,
            borderColor: `${ev.accent}50`,
          }}
        >
          {markOf(ev) ? (
            <img
              className={markOf(ev).cover ? "event-cover" : ""}
              src={markOf(ev).src}
              alt=""
              onError={(e) => {
                e.target.style.display = "none";
              }}
            />
          ) : (
            <LetterMark e={ev} size={16} />
          )}
        </span>
        <span className="event-text">
          <span className="event-name">{ev.title}</span>
          <span className="event-sub">{ev.subtitle}</span>
        </span>
        <svg
          className="event-caret"
          viewBox="0 0 12 12"
          width="12"
          height="12"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
        >
          <path d="M3 4.5L6 8 9 4.5" />
        </svg>
      </button>
      {open && (
        <div className="event-menu glass">
          <div className="event-menu-head">{shell.switchEvent}</div>
          {events.map((e) => {
            const isActive = e.key === value;
            const mark = markOf(e);
            return (
              <button
                key={e.key}
                className={"event-row" + (isActive ? " active" : "")}
                style={{
                  borderLeft: `3px solid ${e.accent}`,
                  background: isActive
                    ? "rgba(141, 1, 52, 0.10)"
                    : "transparent",
                }}
                onClick={() => {
                  onChange(e);
                  setOpen(false);
                }}
              >
                <span
                  className="event-logo-mark"
                  data-event={e.key}
                  style={{
                    background: `${e.accent}22`,
                    borderColor: `${e.accent}50`,
                    overflow: "hidden",
                  }}
                >
                  {mark ? (
                    <img
                      className={mark.cover ? "event-cover" : ""}
                      src={mark.src}
                      alt=""
                      onError={(err) => {
                        err.target.style.display = "none";
                      }}
                    />
                  ) : (
                    <LetterMark e={e} size={15} />
                  )}
                </span>
                <span className="event-text">
                  <span
                    className="event-name"
                    style={{ color: isActive ? e.accent : undefined }}
                  >
                    {e.title}
                  </span>
                  <span className="event-sub">{e.subtitle}</span>
                </span>
                {isActive && (
                  <span className="event-check" style={{ color: e.accent }}>
                    <svg
                      viewBox="0 0 14 14"
                      width="14"
                      height="14"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                    >
                      <path d="M3 7.5l3 3 5-6.5" />
                    </svg>
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

const HOTELS = [
  "Sheraton Grand",
  "Mondrian Doha",
  "Mandarin Oriental",
  "St. Regis",
  "Four Seasons",
  "InterContinental",
  "W Doha",
];
const TIER_COLOR = {
  VVIP: "#e0b864",
  VIP: "#a78bda",
  Speaker: "var(--accent)",
  Delegate: "#5abf6e",
  Press: "#e08a7e",
  Observer: "var(--ink-mute)",
  vvip: "#e0b864",
  vip: "#a78bda",
  speaker: "var(--accent)",
  delegate: "#5abf6e",
  press: "#e08a7e",
  observer: "var(--ink-mute)",
};
const GUEST_TYPES = [
  "dignitary",
  "delegate",
  "media",
  "staff",
  "vip",
  "observer",
];
// One week of slack around the event's own start/end date — same rule used
// everywhere else a guest's Arrival/Departure date is edited.
const DRAWER_DATE_MARGIN_DAYS = 7;

function guestToProfileForm(g) {
  return {
    firstName: g.firstName || "",
    lastName: g.lastName || "",
    email: g.email || "",
    guestType: g.guestType || "delegate",
    organization: g.organization || "",
    nationalityId: g.nationalityId || "",
    tier: g.tier || "delegate",
    arrivalDate: g.arrivalDate || "",
    departureDate: g.departureDate || "",
    photoUrl: g.photoUrl || "",
    accreditationRequired: !!g.accreditationRequired,
  };
}

function fmtEventDates(ev) {
  if (!ev?.startDate) return "";
  // Portal-wide DD-MM-YYYY (lib/date), not the browser locale.
  const start = fmtDate(ev.startDate, "");
  if (!ev.endDate || ev.endDate === ev.startDate) return start;
  return `${start} – ${fmtDate(ev.endDate, "")}`;
}

function GuestDrawer({
  guest,
  onClose,
  lang,
  activeEventId,
  activeEvent,
  onGuestUpdated,
  onGuestDeleted,
}) {
  const isAr = lang === "ar";
  const [editTravel, setEditTravel] = React.useState(false);
  const [flight, setFlight] = React.useState(guest.flight || "");
  const [arrival, setArrival] = React.useState(guest.arrival || "");
  const [hotel, setHotel] = React.useState(guest.hotel || "");
  const [saved, setSaved] = React.useState(false);

  const navigate = useNavigate();
  const [guestSessions, setGuestSessions] = React.useState(
    new Set(guest.sessions || []),
  );
  const [editSessions, setEditSessions] = React.useState(false);
  const [sessionsSaved, setSessionsSaved] = React.useState(false);

  const [showBadge, setShowBadge] = React.useState(false);
  const [showMore, setShowMore] = React.useState(false);
  const [drawerNotice, setDrawerNotice] = React.useState("");
  const [confirmRemove, setConfirmRemove] = React.useState(false);
  const [removing, setRemoving] = React.useState(false);
  const moreRef = React.useRef(null);

  // ── Reference data for the real "Edit profile" modal ───────────────────────
  const [enums, setEnums] = React.useState({});
  const [nationalities, setNationalities] = React.useState([]);
  React.useEffect(() => {
    getGuestEnums()
      .then(setEnums)
      .catch(() => {});
    getNationalities()
      .then(setNationalities)
      .catch(() => setNationalities([]));
  }, []);

  const eventMinDate = activeEvent?.startDate || undefined;
  const eventMaxDate = activeEvent?.endDate || undefined;
  const dateWindowMin = React.useMemo(
    () =>
      addDaysIso(activeEvent?.startDate, -DRAWER_DATE_MARGIN_DAYS) || undefined,
    [activeEvent?.startDate],
  );
  const dateWindowMax = React.useMemo(
    () =>
      addDaysIso(activeEvent?.endDate, DRAWER_DATE_MARGIN_DAYS) || undefined,
    [activeEvent?.endDate],
  );

  // ── Edit profile modal ──────────────────────────────────────────────────────
  const [editProfile, setEditProfile] = React.useState(false);
  const [profileForm, setProfileForm] = React.useState(() =>
    guestToProfileForm(guest),
  );
  const [savingProfile, setSavingProfile] = React.useState(false);
  const [photoUploading, setPhotoUploading] = React.useState(false);
  const setProfileField = (k, v) => setProfileForm((p) => ({ ...p, [k]: v }));

  function openEditProfile() {
    setProfileForm(guestToProfileForm(guest));
    setEditProfile(true);
  }

  async function handleProfilePhotoSelect(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setPhotoUploading(true);
    try {
      const url = await uploadImageFile(file);
      setProfileField("photoUrl", url);
    } catch (err) {
      toast.fromError(
        err,
        isAr ? "فشل تحميل الصورة" : "Failed to upload photo",
      );
    } finally {
      setPhotoUploading(false);
    }
  }

  async function saveProfile() {
    if (!profileForm.firstName.trim() || !profileForm.lastName.trim()) {
      toast.error(
        isAr
          ? "الاسم الأول والأخير مطلوبان"
          : "First and last name are required",
      );
      return;
    }
    setSavingProfile(true);
    try {
      const updated = await updateGuest(guest.id, {
        firstName: profileForm.firstName.trim(),
        lastName: profileForm.lastName.trim(),
        email: profileForm.email || null,
        guestType: profileForm.guestType,
        organization: profileForm.organization || null,
        nationalityId: profileForm.nationalityId || null,
        tier: profileForm.tier,
        arrivalDate: profileForm.arrivalDate || null,
        departureDate: profileForm.departureDate || null,
        photoUrl: stripSasToken(profileForm.photoUrl) || null,
        accreditationRequired: profileForm.accreditationRequired,
        invitationTemplateId: guest.invitationTemplateId || null,
        sessionIds: guest.sessionIds || [],
      });
      onGuestUpdated?.(updated);
      setEditProfile(false);
      drawerMsg(isAr ? "تم حفظ الملف الشخصي ✓" : "Profile saved ✓");
    } catch (err) {
      toast.fromError(
        err,
        isAr ? "حدث خطأ أثناء حفظ الملف الشخصي" : "Error saving the profile",
      );
    } finally {
      setSavingProfile(false);
    }
  }

  // ── Add to meeting modal ────────────────────────────────────────────────────
  const [showMeetingPicker, setShowMeetingPicker] = React.useState(false);
  const [meetings, setMeetings] = React.useState([]);
  const [loadingMeetings, setLoadingMeetings] = React.useState(false);
  const [addingMeetingId, setAddingMeetingId] = React.useState(null);

  function openMeetingPicker() {
    setShowMeetingPicker(true);
    if (!activeEventId) return;
    setLoadingMeetings(true);
    getMeetings(activeEventId)
      .then((res) => setMeetings(res || []))
      .catch(() => setMeetings([]))
      .finally(() => setLoadingMeetings(false));
  }

  async function addToMeeting(m) {
    if ((m.guests || []).some((g) => g.id === guest.id)) {
      setShowMeetingPicker(false);
      drawerMsg(
        isAr
          ? "الضيف مُضاف بالفعل إلى هذا الاجتماع"
          : "Guest is already in this meeting",
      );
      return;
    }
    setAddingMeetingId(m.id);
    try {
      const guestIds = [
        ...(m.guests || []).map((g) => g.id).filter(Boolean),
        guest.id,
      ];
      await editMeeting({ meetId: m.id, eventId: activeEventId, guestIds });
      setShowMeetingPicker(false);
      drawerMsg(isAr ? D.meetingAdded : D.meetingAdded);
    } catch (err) {
      toast.fromError(
        err,
        isAr ? "تعذّرت الإضافة إلى الاجتماع" : "Failed to add guest to meeting",
      );
    } finally {
      setAddingMeetingId(null);
    }
  }

  // ── Scoped print (Export PDF / Print Badge) ─────────────────────────────────
  function printSection(cls) {
    document.body.classList.add(cls);
    const cleanup = () => {
      document.body.classList.remove(cls);
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    window.print();
  }

  React.useEffect(() => {
    if (!showMore) return;
    const h = (e) => {
      if (moreRef.current && !moreRef.current.contains(e.target))
        setShowMore(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [showMore]);

  function saveTravel() {
    setSaved(true);
    setEditTravel(false);
    setTimeout(() => setSaved(false), 2500);
  }

  function drawerMsg(msg) {
    setDrawerNotice(msg);
    setTimeout(() => setDrawerNotice(""), 2500);
  }

  function toggleSession(id) {
    setGuestSessions((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function saveSessions() {
    setSessionsSaved(true);
    setEditSessions(false);
    setTimeout(() => setSessionsSaved(false), 2500);
  }

  async function handleRemove() {
    setRemoving(true);
    try {
      await deleteGuest(guest.id);
      setConfirmRemove(false);
      onGuestDeleted?.();
    } catch (err) {
      toast.fromError(
        err,
        isAr ? "تعذّر إزالة الضيف" : "Failed to remove guest",
      );
      setRemoving(false);
    }
  }

  const D = isAr
    ? {
        profile: "ملف الضيف",
        message: "رسالة",
        badge: "شارة",
        guestId: "معرّف الضيف",
        invited: "تاريخ الدعوة",
        arrival: "الوصول",
        hotel: "الفندق",
        table: "الطاولة",
        flight: "رقم الرحلة",
        email: "البريد الإلكتروني",
        accreditation: "الاعتماد",
        travelTitle: "السفر والإقامة",
        editTravel: "تعديل",
        saveTravel: "حفظ",
        cancel: "إلغاء",
        savedMsg: "تم الحفظ ✓",
        issued: "صادر · المناطق A·B·VIP",
        pending: "قيد الانتظار",
        secondRing: "الحلقة الثانية",
        activity: "النشاط",
        today: "اليوم ٠٩:١٤",
        yest: "أمس ١٦:٠٢",
        line1: "تحقق هيّا · مزامنة الداخلية ✓",
        line2: "تأكيد حجز الفندق ·",
        line3: "قبول الدعوة عبر البريد الإلكتروني",
        arrivalDate: "تاريخ الوصول",
        badgeTitle: "شارة الاعتماد",
        printBadge: "طباعة",
        editPro: "تعديل الملف الشخصي",
        addMeet: "إضافة إلى اجتماع",
        expPdf: "تصدير PDF",
        removeG: "إزالة الضيف",
        confirmRemoveMsg: "هل تريد إزالة هذا الضيف من النظام؟",
        removeConfirmBtn: "إزالة",
        badgeNo: "رقم الشارة",
        meetingAdded: "تمت الإضافة إلى قائمة الاجتماعات ✓",
        sessionsTitle: "الجلسات",
        noSessions: "لا جلسات مخصصة",
        sessionsSaved: "تم حفظ الجلسات ✓",
        selectAll: "تحديد الكل",
        deselectAll: "إلغاء الكل",
        badgeNotIssuedTitle: "لم يصدر الاعتماد بعد",
        badgeNotIssuedMsg: 'أصدر الاعتماد من وحدة "الاعتماد" لعرض الشارة.',
        guestType: "نوع الضيف",
        organization: "المؤسسة",
        nationality: "الجنسية",
        tier: "الفئة",
        accreditation2: "الاعتماد",
        accredRequired: "مطلوب",
        accredNotRequired: "غير مطلوب",
        saveChanges: "حفظ التغييرات",
        saving: "جارٍ الحفظ…",
        photoOptional: "صورة الوجه (اختياري)",
        removePhoto: "إزالة الصورة",
        uploading: "جارٍ التحميل…",
        pickMeeting: "اختر اجتماعًا لإضافة هذا الضيف إليه",
        noMeetings: "لا توجد اجتماعات لهذه الفعالية",
        add: "إضافة",
        added: "مُضاف",
      }
    : {
        profile: "Guest profile",
        message: "Message",
        badge: "Badge",
        guestId: "Guest ID",
        invited: "Invited",
        arrival: "Arrival date",
        hotel: "Hotel",
        table: "Table",
        flight: "Flight",
        email: "Email",
        accreditation: "Accreditation",
        travelTitle: "Travel & accommodation",
        editTravel: "Edit",
        saveTravel: "Save",
        cancel: "Cancel",
        savedMsg: "Saved ✓",
        issued: "Issued · Zone A·B·VIP",
        pending: "Pending",
        secondRing: "2nd ring",
        activity: "Activity",
        today: "Today 09:14",
        yest: "Yesterday 16:02",
        line1: "Hayya verified · MOI sync ✓",
        line2: "Hotel block confirmed ·",
        line3: "Invitation accepted via email",
        arrivalDate: "Arrival date",
        badgeTitle: "Accreditation Badge",
        printBadge: "Print Badge",
        editPro: "Edit profile",
        addMeet: "Add to meeting",
        expPdf: "Export PDF",
        removeG: "Remove guest",
        confirmRemoveMsg: "Remove this guest from the system?",
        removeConfirmBtn: "Remove",
        badgeNo: "Badge No.",
        meetingAdded: "Added to meeting list ✓",
        sessionsTitle: "Sessions",
        noSessions: "No sessions assigned",
        sessionsSaved: "Sessions saved ✓",
        selectAll: "Select all",
        deselectAll: "Deselect all",
        badgeNotIssuedTitle:
          "Accreditation not issued yet or may not require for this guest",
        badgeNotIssuedMsg:
          "Issue accreditation from the Accreditation module to view the badge.",
        guestType: "Guest Type",
        organization: "Organization",
        nationality: "Nationality",
        tier: "Tier",
        accreditation2: "Accreditation",
        accredRequired: "Required",
        accredNotRequired: "Not Required",
        saveChanges: "Save Changes",
        saving: "Saving…",
        photoOptional: " ",
        removePhoto: "Remove photo",
        uploading: "Uploading…",
        pickMeeting: "Pick a meeting to add this guest to",
        noMeetings: "No meetings for this event",
        add: "Add",
        added: "Added",
      };

  const iStyle = {
    width: "100%",
    background: "var(--surface-soft-3)",
    border: "1px solid var(--glass-border)",
    borderRadius: 8,
    padding: "8px 11px",
    color: "var(--ink)",
    fontSize: 13,
    boxSizing: "border-box",
  };
  const tierColor = TIER_COLOR[guest.tier] || "var(--accent)";

  // Real GuestResponse fields (fullName/invitationStatus/accreditationStatus)
  // — the rest of this drawer predates the API and still reads some mock names.
  const guestName =
    guest.fullName ||
    guest.name ||
    `${guest.firstName || ""} ${guest.lastName || ""}`.trim();
  const INVITE_BADGE = {
    not_sent: { label: isAr ? "لم تُرسل" : "Not sent", color: "#9CA3AF" },
    sent: { label: isAr ? "أُرسلت" : "Sent", color: "#3B82F6" },
    opened: { label: isAr ? "فُتحت" : "Opened", color: "#F59E0B" },
    accepted: { label: isAr ? "مقبولة" : "Accepted", color: "#5abf6e" },
    declined: { label: isAr ? "مرفوضة" : "Declined", color: "#e08a7e" },
  };
  const ACCRED_BADGE = {
    not_issued: { label: isAr ? "غير صادر" : "Not Required", color: "#9CA3AF" },
    issued: { label: isAr ? "صادر" : "Required", color: "#5abf6e" },
    revoked: { label: isAr ? "ملغى" : "Revoked", color: "#e05050" },
  };
  const inviteBadge =
    INVITE_BADGE[guest.invitationStatus] || INVITE_BADGE.not_sent;
  const accredBadge =
    ACCRED_BADGE[guest.accreditationStatus] || ACCRED_BADGE.not_issued;
  const Badge = ({ dotColor, children }) => (
    <span
      className="chip"
      style={{
        borderColor: `${dotColor}55`,
        color: dotColor,
        background: `${dotColor}18`,
      }}
    >
      <span className="dot" style={{ background: dotColor }} />
      {children}
    </span>
  );
  const menuBtnStyle = {
    display: "flex",
    alignItems: "center",
    gap: 10,
    width: "100%",
    padding: "8px 10px",
    borderRadius: 8,
    background: "none",
    border: "none",
    color: "var(--ink)",
    fontSize: 13,
    cursor: "pointer",
    textAlign: "start",
  };

  return (
    <>
      <div
        style={{
          padding: "20px 22px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "1px solid var(--glass-border)",
        }}
      >
        <div
          style={{
            fontSize: 11,
            letterSpacing: isAr ? "0.04em" : "0.18em",
            textTransform: "uppercase",
            color: "var(--ink-mute)",
          }}
        >
          {D.profile}
        </div>
        <button className="icon-btn" onClick={onClose}>
          <Icon name="close" size={14} />
        </button>
      </div>
      <div
        id="print-profile-root"
        style={{ padding: "20px 22px", overflowY: "auto", flex: 1 }}
      >
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <Avatar
            initials={
              (
                (guest.firstName?.[0] || "") + (guest.lastName?.[0] || "")
              ).toUpperCase() || guest.initials
            }
            size={56}
            tier={guest.tier}
            src={guest.photoUrl}
          />
          <div>
            <h2
              style={{
                fontFamily: "var(--serif)",
                fontSize: 26,
                margin: 0,
                fontWeight: 400,
              }}
            >
              {guestName}
            </h2>
            <div
              style={{ fontSize: 12, color: "var(--ink-dim)", marginTop: 2 }}
            >
              {guest.organization}
            </div>
            <div
              style={{
                display: "flex",
                gap: 6,
                marginTop: 8,
                flexWrap: "wrap",
              }}
            >
              <ServiceLevelChip
                name={guest.serviceLevelName}
                nameAr={guest.serviceLevelNameAr}
                color={guest.serviceLevelColor}
                lang={lang}
              />
              {guest.nationalityName && (
                <span className="chip">
                  <FlagIcon code={guest.nationalityCode} size={12} />
                  {guest.nationalityName}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Real-status badges */}
        <div
          style={{ display: "flex", gap: 6, marginTop: 14, flexWrap: "wrap" }}
        >
          <Badge dotColor={inviteBadge.color}>{inviteBadge.label}</Badge>
          <Badge dotColor={accredBadge.color}>
            {isAr ? "الاعتماد" : "Accred"} · {accredBadge.label}
          </Badge>
        </div>

        <div style={{ display: "flex", gap: 6, marginTop: 18 }}>
          <button
            className="btn primary"
            style={{ flex: 1 }}
            onClick={() =>
              navigate("/support-chat", {
                state: {
                  guestId: guest.id,
                  guestName,
                  guestOrganization: guest.organization || "",
                },
              })
            }
          >
            <Icon name="message" size={14} /> {D.message}
          </button>
          <button
            className="btn"
            style={{ flex: 1 }}
            onClick={() => setShowBadge(true)}
          >
            <Icon name="badge" size={14} /> {D.badge}
          </button>
          <div style={{ position: "relative" }} ref={moreRef}>
            <button className="btn" onClick={() => setShowMore((m) => !m)}>
              <Icon name="more" size={14} />
            </button>
            {showMore && (
              <div
                className="card glass"
                style={{
                  position: "absolute",
                  right: 0,
                  top: "calc(100% + 4px)",
                  width: 195,
                  padding: 6,
                  zIndex: 50,
                  boxShadow: "0 8px 32px rgba(0,0,0,0.35)",
                }}
              >
                {[
                  {
                    icon: "edit",
                    label: D.editPro,
                    action: () => {
                      setShowMore(false);
                      openEditProfile();
                    },
                  },
                  {
                    icon: "meetings",
                    label: D.addMeet,
                    action: () => {
                      setShowMore(false);
                      openMeetingPicker();
                    },
                  },
                  {
                    icon: "download",
                    label: D.expPdf,
                    action: () => {
                      setShowMore(false);
                      printSection("printing-profile");
                    },
                  },
                ].map((item) => (
                  <button
                    key={item.label}
                    onClick={item.action}
                    style={menuBtnStyle}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background =
                        "var(--surface-soft-3)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = "none")
                    }
                  >
                    <Icon name={item.icon} size={13} /> {item.label}
                  </button>
                ))}
                <div
                  style={{
                    height: 1,
                    background: "var(--glass-border)",
                    margin: "4px 0",
                  }}
                />
                <button
                  onClick={() => {
                    setShowMore(false);
                    setConfirmRemove(true);
                  }}
                  style={{ ...menuBtnStyle, color: "#e08a7e" }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background =
                      "rgba(224,138,126,0.08)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = "none")
                  }
                >
                  <Icon name="trash" size={13} /> {D.removeG}
                </button>
              </div>
            )}
          </div>
        </div>

        {drawerNotice && (
          <div
            style={{
              marginTop: 10,
              padding: "8px 12px",
              borderRadius: 8,
              background: "rgba(141, 1, 52,0.1)",
              border: "1px solid rgba(141, 1, 52,0.25)",
              fontSize: 12.5,
              color: "var(--accent)",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Icon name="check" size={13} /> {drawerNotice}
          </div>
        )}

        <div className="divider" />

        <DetailRow label={D.email} value={guest.email || "—"} mono />
        {guest.arrivalDate && (
          <DetailRow label={D.arrival} value={guest.arrivalDate} mono />
        )}
        <DetailRow label={D.accreditation} value={accredBadge.label} />

        <div className="divider" />

        {/* <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
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

        <div className="divider"/> */}

        {/* Sessions section */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 10,
          }}
        >
          <div
            style={{
              fontSize: 11,
              letterSpacing: isAr ? "0.04em" : "0.18em",
              textTransform: "uppercase",
              color: "var(--ink-mute)",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            {D.sessionsTitle}
            {guestSessions.size > 0 && (
              <span
                style={{
                  fontSize: 10,
                  background: "var(--accent)",
                  color: "#fff",
                  borderRadius: 10,
                  padding: "1px 7px",
                  letterSpacing: 0,
                  textTransform: "none",
                }}
              >
                {guestSessions.size}
              </span>
            )}
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            {sessionsSaved && (
              <span
                style={{
                  fontSize: 11,
                  color: "var(--accent)",
                  display: "flex",
                  alignItems: "center",
                  gap: 3,
                }}
              >
                <Icon name="check" size={11} /> {D.sessionsSaved}
              </span>
            )}
            {/* <button className="btn ghost" style={{ padding: "3px 8px", fontSize: 11 }} onClick={() => setEditSessions(e => !e)}>
              <Icon name={editSessions ? "close" : "edit"} size={11}/> {editSessions ? D.cancel : D.editTravel}
            </button> */}
          </div>
        </div>
        {editSessions ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 6,
              marginBottom: 14,
            }}
          >
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                onClick={() =>
                  setGuestSessions((prev) =>
                    prev.size === SESSIONS.length
                      ? new Set()
                      : new Set(SESSIONS.map((s) => s.id)),
                  )
                }
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 11,
                  color: "var(--accent)",
                  padding: 0,
                }}
              >
                {guestSessions.size === SESSIONS.length
                  ? D.deselectAll
                  : D.selectAll}
              </button>
            </div>
            {SESSIONS.map((s) => {
              const checked = guestSessions.has(s.id);
              return (
                <div
                  key={s.id}
                  onClick={() => toggleSession(s.id)}
                  style={{
                    padding: "9px 12px",
                    borderRadius: 9,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 10,
                    border: `1px solid ${checked ? "var(--accent)" : "var(--glass-border)"}`,
                    background: checked
                      ? "rgba(141, 1, 52,0.08)"
                      : "var(--surface-soft-2)",
                  }}
                >
                  <div
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: 4,
                      border: `2px solid ${checked ? "var(--accent)" : "var(--glass-border)"}`,
                      background: checked ? "var(--accent)" : "transparent",
                      display: "grid",
                      placeItems: "center",
                      flexShrink: 0,
                      marginTop: 2,
                    }}
                  >
                    {checked && (
                      <Icon name="check" size={9} style={{ color: "#fff" }} />
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 12.5,
                        fontWeight: checked ? 500 : 400,
                        lineHeight: 1.3,
                      }}
                    >
                      {s.title}
                    </div>
                    <div
                      style={{
                        fontSize: 10.5,
                        color: "var(--ink-mute)",
                        marginTop: 2,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      <span style={{ fontFamily: "var(--mono)" }}>
                        {fmtDate(s.date)} · {s.time}
                      </span>
                      {" · "}
                      {s.venue}
                      {s.room ? ` · ${s.room}` : ""}
                    </div>
                  </div>
                </div>
              );
            })}
            <button
              className="btn primary"
              style={{ alignSelf: "flex-end", marginTop: 2 }}
              onClick={saveSessions}
            >
              <Icon name="check" size={13} /> {D.saveTravel}
            </button>
          </div>
        ) : guestSessions.size === 0 ? (
          <div
            style={{
              fontSize: 12,
              color: "var(--ink-mute)",
              fontStyle: "italic",
              marginBottom: 14,
            }}
          >
            {D.noSessions}
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 6,
              marginBottom: 14,
            }}
          >
            {SESSIONS.filter((s) => guestSessions.has(s.id)).map((s) => (
              <div
                key={s.id}
                style={{
                  padding: "9px 12px",
                  borderRadius: 9,
                  background: "var(--surface-soft-2)",
                  border: "1px solid var(--glass-border)",
                }}
              >
                <div style={{ fontSize: 12.5, fontWeight: 500 }}>{s.title}</div>
                <div
                  style={{
                    fontSize: 10.5,
                    color: "var(--ink-mute)",
                    marginTop: 2,
                  }}
                >
                  <span style={{ fontFamily: "var(--mono)" }}>
                    {fmtDate(s.date)} · {s.time}
                  </span>
                  {" · "}
                  {s.venue}
                  {s.room ? ` · ${s.room}` : ""}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* <div className="divider"/>

        <div style={{ fontSize: 11, letterSpacing: isAr ? "0.04em" : "0.18em", textTransform: "uppercase", color: "var(--ink-mute)", marginBottom: 10 }}>{D.activity}</div>
        <div className="timeline">
          <div className="timeline-item"><div style={{ fontSize: 11.5, color: "var(--accent-2)", fontFamily: "var(--mono)", direction: "ltr" }}>{D.today}</div><div style={{ fontSize: 12.5 }}>{D.line1}</div></div>
          <div className="timeline-item"><div style={{ fontSize: 11.5, color: "var(--accent-2)", fontFamily: "var(--mono)", direction: "ltr" }}>{D.yest}</div><div style={{ fontSize: 12.5 }}>{D.line2} {hotel}</div></div>
          <div className="timeline-item"><div style={{ fontSize: 11.5, color: "var(--accent-2)", fontFamily: "var(--mono)", direction: "ltr" }}>{guest.invited}</div><div style={{ fontSize: 12.5 }}>{D.line3}</div></div>
        </div> */}
      </div>

      {/* ── Badge modal ── */}
      {showBadge &&
        (() => {
          const isIssued = guest.accreditationStatus === "issued";
          const badgeRef = guest.id
            ? guest.id.replace(/-/g, "").slice(0, 8).toUpperCase()
            : "";
          const eventDatesLabel = fmtEventDates(activeEvent);
          const qrPayload = JSON.stringify({
            type: "gms-accreditation",
            guestId: guest.id,
            ref: badgeRef,
            name: guestName,
            tier: guest.tier,
            organization: guest.organization || null,
            nationality: guest.nationalityName || null,
            eventId: activeEvent?.id || null,
            event: activeEvent?.title || null,
          });
          return (
            <div
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,0.55)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 1200,
              }}
            >
              <div
                className="card glass modal-solid"
                style={{ width: 360, maxWidth: "92vw", padding: 0 }}
              >
                <div
                  style={{
                    padding: "14px 18px",
                    borderBottom: "1px solid var(--glass-border)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span style={{ fontWeight: 600, fontSize: 14 }}>
                    {D.badgeTitle}
                  </span>
                  <button
                    className="icon-btn"
                    onClick={() => setShowBadge(false)}
                  >
                    <Icon name="close" size={14} />
                  </button>
                </div>
                <div style={{ padding: "20px" }} id="print-badge-root">
                  {!isIssued ? (
                    <div style={{ textAlign: "center", padding: "30px 12px" }}>
                      <Icon
                        name="badge"
                        size={32}
                        style={{ color: "var(--ink-faint)", marginBottom: 12 }}
                      />
                      <div
                        style={{
                          fontSize: 13.5,
                          fontWeight: 600,
                          marginBottom: 6,
                        }}
                      >
                        {D.badgeNotIssuedTitle}
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: "var(--ink-mute)",
                          lineHeight: 1.5,
                        }}
                      >
                        {D.badgeNotIssuedMsg}
                      </div>
                    </div>
                  ) : (
                    <div
                      style={{
                        border: "1px solid var(--glass-border)",
                        borderRadius: 12,
                        overflow: "hidden",
                        background: "var(--surface-soft-2)",
                      }}
                    >
                      <div style={{ height: 8, background: tierColor }} />
                      <div
                        style={{
                          padding: "18px 20px",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          textAlign: "center",
                        }}
                      >
                        <Avatar
                          initials={(
                            (guest.firstName?.[0] || "") +
                            (guest.lastName?.[0] || "")
                          ).toUpperCase()}
                          size={56}
                          tier={guest.tier}
                          src={guest.photoUrl}
                        />
                        <h2
                          style={{
                            fontFamily: "var(--serif)",
                            fontSize: 20,
                            margin: "10px 0 4px",
                            fontWeight: 400,
                          }}
                        >
                          {guestName}
                        </h2>
                        {guest.guestType && (
                          <div
                            style={{
                              fontSize: 12,
                              color: "var(--ink-dim)",
                              textTransform: "capitalize",
                            }}
                          >
                            {guest.guestType}
                          </div>
                        )}
                        {guest.organization && (
                          <div
                            style={{
                              fontSize: 12,
                              color: "var(--ink-mute)",
                              marginBottom: 12,
                            }}
                          >
                            {guest.organization}
                          </div>
                        )}
                        <div
                          style={{
                            display: "flex",
                            gap: 6,
                            justifyContent: "center",
                            marginBottom: 14,
                            flexWrap: "wrap",
                          }}
                        >
                          <ServiceLevelChip
                            name={guest.serviceLevelName}
                            nameAr={guest.serviceLevelNameAr}
                            color={guest.serviceLevelColor}
                            lang={lang}
                          />
                          {guest.nationalityName && (
                            <span className="chip" style={{ fontSize: 11 }}>
                              <FlagIcon
                                code={guest.nationalityCode}
                                size={12}
                              />{" "}
                              {guest.nationalityName}
                            </span>
                          )}
                        </div>
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr",
                            gap: 8,
                            textAlign: "start",
                            width: "100%",
                          }}
                        >
                          {[
                            { label: D.badgeNo, value: badgeRef, mono: true },
                            {
                              label: D.arrival,
                              value: guest.arrivalDate || "—",
                              mono: true,
                            },
                          ].map((row) => (
                            <div
                              key={row.label}
                              style={{
                                padding: "7px 10px",
                                background: "var(--surface-soft-3)",
                                borderRadius: 8,
                                border: "1px solid var(--glass-border)",
                              }}
                            >
                              <div
                                style={{
                                  fontSize: 9,
                                  color: "var(--ink-faint)",
                                  textTransform: "uppercase",
                                  letterSpacing: "0.1em",
                                  marginBottom: 2,
                                }}
                              >
                                {row.label}
                              </div>
                              <div
                                style={{
                                  fontSize: 11.5,
                                  fontFamily: row.mono
                                    ? "var(--mono)"
                                    : "inherit",
                                  fontWeight: 500,
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {row.value}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div
                        style={{
                          padding: "12px 18px",
                          borderTop: "1px solid var(--glass-border)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 12,
                        }}
                      >
                        <div>
                          <div
                            style={{
                              fontSize: 10.5,
                              color: "var(--ink-mute)",
                              marginBottom: 4,
                              fontWeight: 600,
                            }}
                          >
                            {activeEvent?.title ||
                              (isAr ? "الفعالية" : "Event")}
                          </div>
                          {eventDatesLabel && (
                            <div
                              style={{
                                fontSize: 10.5,
                                fontFamily: "var(--mono)",
                                color: "var(--ink-mute)",
                              }}
                            >
                              {eventDatesLabel}
                            </div>
                          )}
                        </div>
                        <div
                          style={{
                            background: "#fff",
                            padding: 5,
                            borderRadius: 6,
                            border: "1px solid var(--glass-border)",
                            flexShrink: 0,
                          }}
                        >
                          <QRCodeSVG
                            value={qrPayload}
                            size={72}
                            bgColor="#ffffff"
                            fgColor="#5e0022"
                            level="M"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    marginTop: isIssued ? 0 : 4,
                    padding: isIssued ? "0 20px 20px" : "0 20px 20px",
                  }}
                >
                  <button
                    className="btn"
                    style={{ flex: 1, justifyContent: "center" }}
                    onClick={() => setShowBadge(false)}
                  >
                    {D.cancel}
                  </button>
                  {isIssued && (
                    <button
                      className="btn primary"
                      style={{ flex: 1, justifyContent: "center" }}
                      onClick={() => printSection("printing-badge")}
                    >
                      <Icon name="doc" size={13} /> {D.printBadge}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

      {/* ── Remove confirm ── */}
      {confirmRemove && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1200,
          }}
        >
          <div
            className="card glass modal-solid"
            style={{ width: 340, padding: "22px 24px" }}
          >
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>
              {D.removeG}
            </div>
            <div
              style={{ fontSize: 13, color: "var(--ink-dim)", marginBottom: 4 }}
            >
              {guestName}
            </div>
            <div
              style={{
                fontSize: 12,
                color: "var(--ink-mute)",
                marginBottom: 20,
              }}
            >
              {D.confirmRemoveMsg}
            </div>
            <div
              style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}
            >
              <button
                className="btn"
                onClick={() => setConfirmRemove(false)}
                disabled={removing}
              >
                {D.cancel}
              </button>
              <button
                className="btn"
                disabled={removing}
                style={{
                  color: "#e08a7e",
                  borderColor: "rgba(224,138,126,0.3)",
                  background: "rgba(224,138,126,0.1)",
                }}
                onClick={handleRemove}
              >
                <Icon name="trash" size={13} />{" "}
                {removing ? D.saving : D.removeConfirmBtn}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit profile modal ── */}
      {editProfile && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1200,
          }}
        >
          <div
            className="card glass modal-solid"
            style={{
              width: 460,
              maxWidth: "92vw",
              padding: 0,
              maxHeight: "88vh",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                padding: "16px 20px",
                borderBottom: "1px solid var(--glass-border)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <h3 style={{ margin: 0, fontSize: 15 }}>{D.editPro}</h3>
              <button
                className="icon-btn"
                onClick={() => setEditProfile(false)}
              >
                <Icon name="close" size={14} />
              </button>
            </div>
            <div
              style={{
                padding: "18px 20px",
                display: "flex",
                flexDirection: "column",
                gap: 12,
                overflowY: "auto",
                flex: 1,
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 6,
                  marginBottom: 4,
                }}
              >
                <div style={{ position: "relative" }}>
                  <div
                    style={{
                      width: 76,
                      height: 76,
                      borderRadius: "50%",
                      overflow: "hidden",
                      background: "var(--surface-soft-3)",
                      border: "1px solid var(--glass-border)",
                      display: "grid",
                      placeItems: "center",
                    }}
                  >
                    {profileForm.photoUrl ? (
                      <img
                        src={profileForm.photoUrl}
                        alt=""
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                        }}
                      />
                    ) : (
                      <Icon
                        name="image"
                        size={24}
                        style={{ color: "var(--ink-faint)" }}
                      />
                    )}
                  </div>
                  <label
                    style={{
                      position: "absolute",
                      bottom: -2,
                      right: -2,
                      width: 24,
                      height: 24,
                      borderRadius: "50%",
                      background: "var(--accent)",
                      display: "grid",
                      placeItems: "center",
                      cursor: photoUploading ? "default" : "pointer",
                      border: "2px solid var(--bg)",
                      opacity: photoUploading ? 0.6 : 1,
                    }}
                  >
                    <Icon name="upload" size={11} style={{ color: "#fff" }} />
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleProfilePhotoSelect}
                      disabled={photoUploading}
                      style={{ display: "none" }}
                    />
                  </label>
                </div>
                <div style={{ fontSize: 11, color: "var(--ink-mute)" }}>
                  {photoUploading ? D.uploading : D.photoOptional}
                </div>
                {profileForm.photoUrl && !photoUploading && (
                  <button
                    onClick={() => setProfileField("photoUrl", "")}
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--ink-mute)",
                      fontSize: 11,
                      cursor: "pointer",
                      padding: 0,
                      textDecoration: "underline",
                    }}
                  >
                    {D.removePhoto}
                  </button>
                )}
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 12,
                }}
              >
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: 10.5,
                      color: "var(--ink-mute)",
                      textTransform: "uppercase",
                      letterSpacing: "0.1em",
                      marginBottom: 4,
                    }}
                  >
                    {isAr ? "الاسم الأول" : "First Name"} *
                  </label>
                  <input
                    style={iStyle}
                    value={profileForm.firstName}
                    onChange={(e) =>
                      setProfileField("firstName", e.target.value)
                    }
                  />
                </div>
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: 10.5,
                      color: "var(--ink-mute)",
                      textTransform: "uppercase",
                      letterSpacing: "0.1em",
                      marginBottom: 4,
                    }}
                  >
                    {isAr ? "الاسم الأخير" : "Last Name"} *
                  </label>
                  <input
                    style={iStyle}
                    value={profileForm.lastName}
                    onChange={(e) =>
                      setProfileField("lastName", e.target.value)
                    }
                  />
                </div>
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: 10.5,
                    color: "var(--ink-mute)",
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    marginBottom: 4,
                  }}
                >
                  {D.email}
                </label>
                <input
                  type="email"
                  style={iStyle}
                  value={profileForm.email}
                  onChange={(e) => setProfileField("email", e.target.value)}
                />
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 12,
                }}
              >
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: 10.5,
                      color: "var(--ink-mute)",
                      textTransform: "uppercase",
                      letterSpacing: "0.1em",
                      marginBottom: 4,
                    }}
                  >
                    {D.guestType}
                  </label>
                  <Select
                    value={profileForm.guestType}
                    onChange={(v) => setProfileField("guestType", v)}
                    options={GUEST_TYPES.map((gt) => ({
                      value: gt,
                      label: gt.charAt(0).toUpperCase() + gt.slice(1),
                    }))}
                  />
                </div>
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: 10.5,
                      color: "var(--ink-mute)",
                      textTransform: "uppercase",
                      letterSpacing: "0.1em",
                      marginBottom: 4,
                    }}
                  >
                    {D.organization}
                  </label>
                  <input
                    style={iStyle}
                    value={profileForm.organization}
                    onChange={(e) =>
                      setProfileField("organization", e.target.value)
                    }
                  />
                </div>
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: 10.5,
                    color: "var(--ink-mute)",
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    marginBottom: 4,
                  }}
                >
                  {D.nationality}
                </label>
                <Select
                  value={profileForm.nationalityId}
                  onChange={(v) => setProfileField("nationalityId", v)}
                  options={nationalities.map((n) => ({
                    value: n.id,
                    label: `${n.flag} ${isAr ? n.nameAr : n.name}`,
                  }))}
                  placeholder={isAr ? "— اختر —" : "— Select —"}
                  isClearable
                />
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: 10.5,
                    color: "var(--ink-mute)",
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    marginBottom: 8,
                  }}
                >
                  {D.tier}
                </label>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr 1fr",
                    gap: 8,
                  }}
                >
                  {enums?.GuestTier?.map((t) => (
                    <div
                      key={t.code}
                      onClick={() => setProfileField("tier", t.code)}
                      style={{
                        padding: "10px 8px",
                        borderRadius: 10,
                        cursor: "pointer",
                        textAlign: "center",
                        fontSize: 12.5,
                        fontWeight: profileForm.tier === t.code ? 600 : 400,
                        border: `1px solid ${profileForm.tier === t.code ? "var(--accent)" : "var(--glass-border)"}`,
                        background:
                          profileForm.tier === t.code
                            ? "rgba(141, 1, 52,0.12)"
                            : "var(--surface-soft-2)",
                      }}
                    >
                      {t.name}
                    </div>
                  ))}
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 12,
                }}
              >
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: 10.5,
                      color: "var(--ink-mute)",
                      textTransform: "uppercase",
                      letterSpacing: "0.1em",
                      marginBottom: 4,
                    }}
                  >
                    {D.arrivalDate}
                  </label>
                  <DateField
                    value={profileForm.arrivalDate}
                    onChange={(v) => setProfileField("arrivalDate", v || "")}
                    minDate={dateWindowMin}
                    maxDate={dateWindowMax}
                    openToDate={eventMinDate}
                    clearable
                    clearLabel={isAr ? "مسح" : "Clear"}
                  />
                </div>
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: 10.5,
                      color: "var(--ink-mute)",
                      textTransform: "uppercase",
                      letterSpacing: "0.1em",
                      marginBottom: 4,
                    }}
                  >
                    {isAr ? "تاريخ المغادرة" : "Departure Date"}
                  </label>
                  <DateField
                    value={profileForm.departureDate}
                    onChange={(v) => setProfileField("departureDate", v || "")}
                    minDate={profileForm.arrivalDate || dateWindowMin}
                    maxDate={dateWindowMax}
                    openToDate={eventMinDate}
                    clearable
                    clearLabel={isAr ? "مسح" : "Clear"}
                  />
                </div>
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: 10.5,
                    color: "var(--ink-mute)",
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    marginBottom: 8,
                  }}
                >
                  {D.accreditation2}
                </label>
                <div style={{ display: "flex", gap: 10 }}>
                  {[
                    { value: false, label: D.accredNotRequired },
                    { value: true, label: D.accredRequired },
                  ].map((opt) => (
                    <div
                      key={String(opt.value)}
                      onClick={() =>
                        setProfileField("accreditationRequired", opt.value)
                      }
                      style={{
                        flex: 1,
                        padding: "10px 12px",
                        borderRadius: 10,
                        cursor: "pointer",
                        textAlign: "center",
                        fontSize: 13,
                        fontWeight:
                          profileForm.accreditationRequired === opt.value
                            ? 600
                            : 400,
                        border: `1px solid ${profileForm.accreditationRequired === opt.value ? "var(--accent)" : "var(--glass-border)"}`,
                        background:
                          profileForm.accreditationRequired === opt.value
                            ? "rgba(141, 1, 52,0.12)"
                            : "var(--surface-soft-2)",
                      }}
                    >
                      {opt.label}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div
              style={{
                padding: "14px 20px",
                borderTop: "1px solid var(--glass-border)",
                display: "flex",
                gap: 8,
                justifyContent: "flex-end",
              }}
            >
              <button
                className="btn"
                onClick={() => setEditProfile(false)}
                disabled={savingProfile}
              >
                {D.cancel}
              </button>
              <button
                className="btn primary"
                onClick={saveProfile}
                disabled={savingProfile}
              >
                <Icon name="check" size={13} />{" "}
                {savingProfile ? D.saving : D.saveChanges}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add to meeting modal ── */}
      {showMeetingPicker && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1200,
          }}
        >
          <div
            className="card glass modal-solid"
            style={{
              width: 380,
              maxWidth: "92vw",
              padding: 0,
              maxHeight: "80vh",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                padding: "16px 20px",
                borderBottom: "1px solid var(--glass-border)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <h3 style={{ margin: 0, fontSize: 15 }}>{D.addMeet}</h3>
              <button
                className="icon-btn"
                onClick={() => setShowMeetingPicker(false)}
              >
                <Icon name="close" size={14} />
              </button>
            </div>
            <div style={{ padding: "14px 20px", overflowY: "auto", flex: 1 }}>
              <div
                style={{
                  fontSize: 12,
                  color: "var(--ink-mute)",
                  marginBottom: 10,
                }}
              >
                {D.pickMeeting}
              </div>
              {loadingMeetings ? (
                <div
                  style={{
                    textAlign: "center",
                    color: "var(--ink-mute)",
                    fontSize: 13,
                    padding: "20px 0",
                  }}
                >
                  …
                </div>
              ) : meetings.length === 0 ? (
                <div
                  style={{
                    textAlign: "center",
                    color: "var(--ink-mute)",
                    fontSize: 13,
                    padding: "20px 0",
                  }}
                >
                  {D.noMeetings}
                </div>
              ) : (
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 6 }}
                >
                  {meetings.map((m) => {
                    const already = (m.guests || []).some(
                      (g) => g.id === guest.id,
                    );
                    const busy = addingMeetingId === m.id;
                    return (
                      <div
                        key={m.id}
                        style={{
                          padding: "10px 12px",
                          borderRadius: 9,
                          border: "1px solid var(--glass-border)",
                          background: "var(--surface-soft-2)",
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 500 }}>
                            {m.name}
                          </div>
                          <div
                            style={{
                              fontSize: 11,
                              color: "var(--ink-mute)",
                              fontFamily: "var(--mono)",
                            }}
                          >
                            {fmtDate(m.date)}{" "}
                            {m.startTime ? `· ${m.startTime}` : ""}
                            {m.location ? ` · ${m.location}` : ""}
                          </div>
                        </div>
                        <button
                          className="btn"
                          disabled={busy || already}
                          style={{
                            fontSize: 11,
                            padding: "4px 10px",
                            flexShrink: 0,
                          }}
                          onClick={() => addToMeeting(m)}
                        >
                          {already ? D.added : busy ? D.saving : D.add}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function DetailRow({ label, value, mono }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        padding: "8px 0",
        fontSize: 13,
      }}
    >
      <span style={{ color: "var(--ink-mute)" }}>{label}</span>
      <span
        style={{
          fontFamily: mono ? "var(--mono)" : "inherit",
          fontSize: mono ? 12 : 13,
          color: "var(--ink)",
        }}
      >
        {value}
      </span>
    </div>
  );
}

function Tweaks({ tweaks, setTweak, open, onOpenChange }) {
  return (
    <TweaksPanel title="Theme settings" open={open} onOpenChange={onOpenChange}>
      <TweakSection label="Theme">
        <TweakRadio
          label="Mode"
          value={tweaks.theme || "dark"}
          options={["dark", "light"]}
          onChange={(v) => setTweak("theme", v)}
        />
        <TweakColor
          label="Accent"
          value={tweaks.accent}
          onChange={(v) => setTweak("accent", v)}
        />
      </TweakSection>
      <TweakSection label="Glass">
        <TweakSlider
          label="Blur"
          min={6}
          max={40}
          step={1}
          value={tweaks.blur}
          onChange={(v) => setTweak("blur", v)}
        />
        <TweakSlider
          label="Orb intensity"
          min={0}
          max={1}
          step={0.05}
          value={tweaks.orbIntensity}
          onChange={(v) => setTweak("orbIntensity", v)}
        />
      </TweakSection>
      <TweakSection label="Density">
        <TweakRadio
          label="Spacing"
          value={tweaks.density}
          options={["compact", "comfortable", "airy"]}
          onChange={(v) => setTweak("density", v)}
        />
      </TweakSection>
    </TweaksPanel>
  );
}

function notifRelativeTime(iso, isAr) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const mins = Math.floor((new Date() - d) / 60000);
  if (mins < 1) return isAr ? "الآن" : "now";
  if (mins < 60) return isAr ? `${mins} د` : `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return isAr ? `${hours} س` : `${hours}h`;
  const days = Math.floor(hours / 24);
  return isAr ? `${days} ي` : `${days}d`;
}

export default function App() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [openGuest, setOpenGuest] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Desktop rail collapse, persisted so it survives a reload.
  const [sideCollapsed, setSideCollapsed] = useState(
    () => localStorage.getItem("gms-side-collapsed") === "1",
  );
  const [openMenus, setOpenMenus] = useState({});
  // Sidebar section accordion — persisted the same way as the rail's own
  // collapse, so a section stays collapsed across a reload. Absent from the
  // map means expanded (the default for every section).
  const [collapsedSections, setCollapsedSections] = useState(() => {
    try {
      return JSON.parse(
        localStorage.getItem("gms-nav-collapsed-sections") || "{}",
      );
    } catch {
      return {};
    }
  });
  useEffect(() => {
    localStorage.setItem(
      "gms-nav-collapsed-sections",
      JSON.stringify(collapsedSections),
    );
  }, [collapsedSections]);
  const [showProfile, setShowProfile] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const profileRef = React.useRef(null);
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const notifRef = React.useRef(null);

  // New screen starts at the top. Desktop scrolls the window; on mobile .main is
  // its own scroller, so both need resetting.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    document.querySelector(".main")?.scrollTo({ top: 0, behavior: "smooth" });
  }, [pathname]);

  // Minimal generic push: any Notification/GuestNotification row pushes here
  // regardless of feature (see NotificationManagerService) — surfaced as a
  // toast for now. The bell UI itself is still a static stub, unwired.
  useEffect(
    () =>
      onHub(REALTIME_TOPICS.NOTIFICATION_NEW, (title, message) => {
        toast.message(title || message, {
          description: title ? message : undefined,
        });
        // A toast on a hidden tab is a toast nobody sees. The native Notification
        // API covers the "portal open in a background tab" case without a service
        // worker or an FCM web-push registration — the tab still has to be open.
        if (document.hidden && window.Notification?.permission === "granted") {
          new Notification(title || "Notification", {
            body: title ? message : undefined,
          });
        }
      }),
    [],
  );

  // Ask once, ever. 'default' means untouched; 'denied' must not be re-prompted
  // (browsers block repeat asks anyway, and the handler above just no-ops).
  useEffect(() => {
    if (window.Notification?.permission === "default")
      Notification.requestPermission().catch(() => {});
  }, []);

  useEffect(() => {
    if (!showNotifications) return;
    const onDoc = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target))
        setShowNotifications(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setShowNotifications(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [showNotifications]);
  const [activeLogo, setActiveLogo] = useState({ dark: "", light: "" });
  const { user, isDemo, signOut, can } = useAuth();
  const { events, activeEvent, setActiveEventId } = useEvents();

  const refreshUnreadCount = React.useCallback(() => {
    if (isDemo) return;
    getUnreadCount()
      .then((n) => setUnreadCount(n || 0))
      .catch(() => {});
  }, [isDemo]);

  useEffect(() => {
    refreshUnreadCount();
  }, [refreshUnreadCount]);

  useEffect(
    () => onHub(REALTIME_TOPICS.NOTIFICATION_COUNT_CHANGED, refreshUnreadCount),
    [refreshUnreadCount],
  );

  // Prepend the just-pushed notification so an open dropdown updates live too.
  useEffect(
    () =>
      onHub(REALTIME_TOPICS.NOTIFICATION_NEW, (title, message, data) => {
        setUnreadCount((c) => c + 1);
        setNotifications((list) =>
          [
            {
              id: data?.id || `live-${Date.now()}`,
              title,
              message,
              redirectUrl: data?.redirectUrl,
              createdAt: new Date().toISOString(),
              read: false,
            },
            ...list,
          ].slice(0, 20),
        );
      }),
    [],
  );

  useEffect(() => {
    if (!showNotifications || isDemo) return;
    getNotifications({ pageNumber: 1, pageSize: 20 })
      .then((r) => setNotifications(r?.items || r || []))
      .catch(() => {});
  }, [showNotifications, isDemo]);

  const openNotification = (n) => {
    if (!n.read) {
      markNotificationRead(n.id).catch(() => {});
      setNotifications((list) =>
        list.map((x) => (x.id === n.id ? { ...x, read: true } : x)),
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    }
    setShowNotifications(false);
    if (n.redirectUrl) navigate(n.redirectUrl);
  };

  const markAllRead = () => {
    markAllNotificationsRead().catch(() => {});
    setNotifications((list) => list.map((x) => ({ ...x, read: true })));
    setUnreadCount(0);
  };

  // Navigate by NAV key (URL comes from the shared path map) and close the
  // mobile sidebar. Passed to views as `gotoView` for backward compatibility.
  const gotoView = (key) => {
    navigate(pathForKey(key));
    setSidebarOpen(false);
  };
  const isActiveKey = (key) => {
    const p = pathForKey(key);
    return pathname === p || pathname.startsWith(p + "/");
  };

  function applyEventTheme(ev) {
    // Brand theme overrides per-event colors. Flip BRAND_THEME.enabled to false
    // (top of this file) to restore event-based accent/secondary from the backend.
    if (!ev && !BRAND_THEME.enabled) return;
    const root = document.documentElement;
    const accent = BRAND_THEME.enabled
      ? BRAND_THEME.accent
      : ev?.accent || "#8d0134";
    const secondary = BRAND_THEME.enabled
      ? BRAND_THEME.secondary
      : ev?.secondary || "#e0c47e";

    setTweak("accent", accent);
    setTweak("secondary", secondary);
    if (ev)
      setActiveLogo({ dark: ev.logoDark || "", light: ev.logoLight || "" });

    const orb1 = accent;
    const orb2 = darkenHex(accent, 0.62);
    const orb3 = lightenHex(accent, 0.42);
    root.style.setProperty("--orb-1", orb1);
    root.style.setProperty("--orb-2", orb2);
    root.style.setProperty("--orb-3", orb3);
    root.style.setProperty("--bg-glow-a", hexToRgba(orb1, 0.3));
    root.style.setProperty("--bg-glow-b", hexToRgba(orb3, 0.16));
    root.style.setProperty("--bg-glow-c", hexToRgba(orb2, 0.35));
    root.style.setProperty("--bg-glow-a-lt", hexToRgba(orb1, 0.22));
    root.style.setProperty("--bg-glow-b-lt", hexToRgba(orb3, 0.2));
    root.style.setProperty("--bg-glow-c-lt", hexToRgba(orb2, 0.18));
    applyBgVars(
      root,
      accent,
      (root.getAttribute("data-theme") || "dark") === "dark",
    );
  }

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-theme", tweaks.theme || "dark");
    root.setAttribute("data-density", tweaks.density || "comfortable");
    root.style.setProperty("--accent", tweaks.accent);
    root.style.setProperty("--accent-2", tweaks.secondary || "#e0c47e");
    root.style.setProperty("--glass-blur", `${tweaks.blur}px`);
    root.style.setProperty("--orb-opacity", String(tweaks.orbIntensity));
    applyBgVars(
      root,
      tweaks.accent || "#8d0134",
      (tweaks.theme || "dark") === "dark",
    );
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
  const logoColorSrc =
    activeLogo.light || activeEv?.logoLight || "/assets/logo.svg";
  const logoWhiteSrc = activeLogo.dark || activeEv?.logoDark || "";
  const triggerLogo =
    (tweaks.theme || "dark") === "dark"
      ? activeLogo.dark || activeEv?.logoDark || activeEv?.logoLight
      : activeLogo.light || activeEv?.logoLight || activeEv?.logoDark;

  const sections = [
    "EVENT",
    "ONSITE",
    "INSIGHTS",
    "FLEET",
    "STAY",
    "ADMIN",
    "USERMGMT",
  ];
  const shell = SHELL_I18N[lang] || SHELL_I18N.en;
  const navLabelOf = (n) =>
    n.label && typeof n.label === "object"
      ? n.label[lang] || n.label.en
      : n.label;

  // ── Topbar chrome, all derived from the active route ──────────────────────
  useEffect(() => {
    localStorage.setItem("gms-side-collapsed", sideCollapsed ? "1" : "0");
  }, [sideCollapsed]);

  // Close the profile menu on outside click / Escape (same pattern as notifs).
  useEffect(() => {
    if (!showProfile) return;
    const onDoc = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target))
        setShowProfile(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setShowProfile(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [showProfile]);

  // (The route -> title + breadcrumb memo that used to live here went with the
  // topbar title/crumb row it fed — see the .topbar-lead comment below. The
  // sidebar's own active highlight is the remaining "where am I" signal, and
  // navLabelOf is still used to render it.)

  const userInitials = useMemo(() => {
    if (isDemo || !user?.fullName) return lang === "ar" ? "ض" : "GM";
    return user.fullName
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0])
      .join("")
      .toUpperCase();
  }, [user, isDemo, lang]);

  return (
    <>
      {/* Decorative gradient + glow layer behind the whole shell — fixed, z-index 0,
          purely visual (see .bg-scene/.bg-orb/.bg-grain in style.css). */}
      {/* <div className="bg-scene">
        <div className="bg-orb bg-orb--1" />
        <div className="bg-orb bg-orb--2" />
        <div className="bg-orb bg-orb--3" />
        <div className="bg-grain" />
      </div> */}
      <div className="app" data-side={sideCollapsed ? "collapsed" : "expanded"}>
        <div
          className={`sidebar-overlay${sidebarOpen ? " open" : ""}`}
          onClick={() => setSidebarOpen(false)}
        />
        <aside className={`sidebar${sidebarOpen ? " open" : ""}`}>
          <div className="side-brand">
            <img src="/assets/side-logo.png" alt="Qatar Olympic Committee" />
            <div className="side-brand-text">
              <div className="side-brand-title">
                {lang === "ar" ? "اللجنة الأولمبية القطرية" : "Qatar Olympic"}
              </div>
              <div className="side-brand-sub">
                {lang === "ar" ? "إدارة الضيوف" : "Guest Management"}
              </div>
            </div>
          </div>

          <div className="sidebar-nav-scroll">
            {sections.map((section) => {
              const visibleItems = NAV.filter(
                (n) =>
                  n.section === section && (!n.permission || can(n.permission)),
              );
              if (visibleItems.length === 0) return null;
              const isSectionOpen = !collapsedSections[section];
              return (
                <React.Fragment key={section}>
                  <button
                    type="button"
                    className="nav-section nav-section-toggle"
                    style={{ background: "transparent" }}
                    onClick={() =>
                      setCollapsedSections((m) => ({
                        ...m,
                        [section]: isSectionOpen,
                      }))
                    }
                  >
                    <span>
                      {(SECTION_LABELS[section] &&
                        SECTION_LABELS[section][lang]) ||
                        section}
                    </span>
                    <Icon
                      name={isSectionOpen ? "chevronDown" : "chevronRight"}
                      size={11}
                      className="nav-chevron"
                    />
                  </button>
                  {/* Height-animated, same as the submenu below — collapsing a
                    section shouldn't snap the list shorter. */}
                  <AnimatePresence initial={false}>
                    {isSectionOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                        style={{ overflow: "hidden" }}
                      >
                        {visibleItems.map((n) => {
                          if (n.children) {
                            const kids = n.children.filter(
                              (c) => !c.permission || can(c.permission),
                            );
                            if (kids.length === 0) return null;
                            const hasActiveKid = kids.some((c) =>
                              isActiveKey(c.key),
                            );
                            const isOpen = openMenus[n.key] ?? hasActiveKid;
                            return (
                              <React.Fragment key={n.key}>
                                <button
                                  type="button"
                                  className={`nav-item ${hasActiveKid ? "active" : ""}`}
                                  title={
                                    sideCollapsed ? navLabelOf(n) : undefined
                                  }
                                  onClick={() =>
                                    setOpenMenus((m) => ({
                                      ...m,
                                      [n.key]: !isOpen,
                                    }))
                                  }
                                >
                                  <Icon name={n.icon} size={17} />
                                  <span className="nav-item-label">
                                    {navLabelOf(n)}
                                  </span>
                                  <Icon
                                    name={
                                      isOpen ? "chevronDown" : "chevronRight"
                                    }
                                    size={13}
                                    className="nav-chevron"
                                    style={{ marginInlineStart: "auto" }}
                                  />
                                </button>
                                {/* Height-animated so the submenu doesn't snap open. */}
                                <AnimatePresence initial={false}>
                                  {isOpen && !sideCollapsed && (
                                    <motion.div
                                      initial={{ height: 0, opacity: 0 }}
                                      animate={{ height: "auto", opacity: 1 }}
                                      exit={{ height: 0, opacity: 0 }}
                                      transition={{
                                        duration: 0.2,
                                        ease: [0.4, 0, 0.2, 1],
                                      }}
                                      style={{ overflow: "hidden" }}
                                    >
                                      {kids.map((c) => (
                                        <button
                                          type="button"
                                          key={c.key}
                                          className={`nav-item ${isActiveKey(c.key) ? "active" : ""}`}
                                          style={{
                                            paddingInlineStart: 40,
                                            fontSize: 12.5,
                                          }}
                                          onClick={() => gotoView(c.key)}
                                        >
                                          <span className="nav-item-label">
                                            {navLabelOf(c)}
                                          </span>
                                        </button>
                                      ))}
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </React.Fragment>
                            );
                          }
                          return (
                            <button
                              type="button"
                              key={n.key}
                              className={`nav-item ${isActiveKey(n.key) ? "active" : ""}`}
                              title={sideCollapsed ? navLabelOf(n) : undefined}
                              onClick={() => gotoView(n.key)}
                            >
                              <Icon name={n.icon} size={17} />
                              <span className="nav-item-label">
                                {navLabelOf(n)}
                              </span>
                              {n.badge && (
                                <span className="badge">{n.badge}</span>
                              )}
                            </button>
                          );
                        })}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </React.Fragment>
              );
            })}
          </div>

          {/* Desktop-only collapse control; on mobile the sidebar is an overlay
            driven by the topbar hamburger instead. */}
          <div className="side-foot">
            <button
              type="button"
              className="side-collapse-btn"
              onClick={() => setSideCollapsed((v) => !v)}
              title={
                sideCollapsed
                  ? lang === "ar"
                    ? "توسيع"
                    : "Expand"
                  : lang === "ar"
                    ? "تصغير"
                    : "Collapse"
              }
            >
              <Icon
                name={sideCollapsed ? "chevronRight" : "arrowLeft"}
                size={14}
              />
              <span className="side-foot-text">
                {lang === "ar" ? "تصغير القائمة" : "Collapse menu"}
              </span>
            </button>
          </div>
        </aside>

        <header className="topbar">
          <button
            className="mobile-menu-btn icon-btn"
            onClick={() => setSidebarOpen((o) => !o)}
          >
            <Icon name="menu" size={20} />
          </button>

          {/* The event switcher sits where the page title and breadcrumb used to.
              Both were removed: the title only ever repeated the highlighted
              sidebar entry, and the breadcrumb was one level deep on almost
              every route, so the pair cost a whole row to restate what was
              already on screen. Which EVENT you are working in is the piece of
              context that genuinely isn't visible anywhere else, so it takes the
              prime left-hand slot instead of being buried in the right cluster. */}
          <div className="topbar-lead">
            <EventSwitcher
              events={events}
              value={activeEvent?.key}
              onChange={(e) => setActiveEventId(e.id)}
              lang={lang}
              theme={tweaks.theme || "light"}
            />
          </div>

          <div className="right">
            <div className="lang-switch" role="group" aria-label="Language">
              <button
                className={
                  "lang-opt" + ((tweaks.lang || "en") === "en" ? " active" : "")
                }
                onClick={() => setTweak("lang", "en")}
                aria-pressed={(tweaks.lang || "en") === "en"}
              >
                EN
              </button>
              <button
                className={
                  "lang-opt" + ((tweaks.lang || "en") === "ar" ? " active" : "")
                }
                onClick={() => setTweak("lang", "ar")}
                aria-pressed={(tweaks.lang || "en") === "ar"}
              >
                عربي
              </button>
            </div>
            <div className="notif-wrap" ref={notifRef}>
              <button
                className="icon-btn"
                title={lang === "ar" ? "الإشعارات" : "Notifications"}
                onClick={() => setShowNotifications((o) => !o)}
              >
                <Icon name="bell" size={16} />
                {unreadCount > 0 && <span className="dot notif-dot-blink" />}
              </button>
              {showNotifications && (
                <div className="notif-menu">
                  <div className="notif-head">
                    <span>{lang === "ar" ? "الإشعارات" : "Notifications"}</span>
                    {unreadCount > 0 && (
                      <button className="notif-mark-all" onClick={markAllRead}>
                        {lang === "ar" ? "تعليم الكل كمقروء" : "Mark all read"}
                      </button>
                    )}
                  </div>
                  {notifications.length === 0 ? (
                    <div className="notif-empty">
                      <Icon name="bell" size={22} />
                      <span>
                        {lang === "ar" ? "لا توجد إشعارات" : "No notifications"}
                      </span>
                    </div>
                  ) : (
                    <div className="notif-list">
                      {notifications.map((n) => (
                        <div
                          key={n.id}
                          className={"notif-item" + (n.read ? "" : " unread")}
                          onClick={() => openNotification(n)}
                        >
                          <div className="notif-item-title">
                            {n.title || n.message}
                          </div>
                          {n.title && n.message && (
                            <div className="notif-item-body">{n.message}</div>
                          )}
                          <div className="notif-item-time">
                            {notifRelativeTime(n.createdAt, lang === "ar")}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            {/* Hidden below 768px — the same toggle lives in the profile menu there,
              so the mobile topbar can fit notifications and the avatar. */}
            <button
              className="icon-btn topbar-theme-btn"
              title={shell.switchTo(
                (tweaks.theme || "light") === "dark" ? "light" : "dark",
              )}
              onClick={() =>
                setTweak(
                  "theme",
                  (tweaks.theme || "light") === "dark" ? "light" : "dark",
                )
              }
            >
              <Icon
                name={(tweaks.theme || "light") === "dark" ? "sun" : "moon"}
                size={16}
              />
            </button>

            {/* Profile dropdown — replaces the old always-visible name/role block
              and the separate sign-out button. */}
            <div className="notif-wrap" ref={profileRef}>
              <button
                className="avatar"
                style={{
                  cursor: "pointer",
                  border: "none",
                  background: "none",
                }}
                onClick={() => setShowProfile((o) => !o)}
              >
                <div className="pic">{userInitials}</div>
                <div>
                  <div className="name">
                    {user && !isDemo ? user.fullName : shell.userName}
                  </div>
                  <div className="role">
                    {user && !isDemo
                      ? user.role || user.roleCode || shell.userRole
                      : isDemo
                        ? "Demo mode"
                        : shell.userRole}
                  </div>
                </div>
                <Icon
                  name="chevronDown"
                  size={13}
                  style={{ color: "var(--ink-mute)", marginInlineStart: 2 }}
                />
              </button>
              {showProfile && (
                <div className="notif-menu" style={{ width: 232 }}>
                  <div
                    style={{
                      padding: "11px 13px",
                      borderBottom: "1px solid var(--glass-border)",
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 600 }}>
                      {user && !isDemo ? user.fullName : shell.userName}
                    </div>
                    <div
                      style={{
                        fontSize: 11.5,
                        color: "var(--ink-mute)",
                        marginTop: 2,
                      }}
                    >
                      {user?.email || "—"}
                    </div>
                  </div>
                  <div style={{ padding: 5 }}>
                    {/* Mobile only: the topbar can't fit the language switcher or the
                      theme toggle at phone widths, so they live here instead — the
                      capability moves, it isn't lost. */}
                    <div className="profile-menu-mobile-only">
                      <div className="profile-menu-label">
                        {lang === "ar" ? "اللغة" : "Language"}
                      </div>
                      <div className="profile-menu-langs">
                        <button
                          className={
                            "lang-opt" +
                            ((tweaks.lang || "en") === "en" ? " active" : "")
                          }
                          onClick={() => setTweak("lang", "en")}
                          aria-pressed={(tweaks.lang || "en") === "en"}
                        >
                          EN
                        </button>
                        <button
                          className={
                            "lang-opt" +
                            ((tweaks.lang || "en") === "ar" ? " active" : "")
                          }
                          onClick={() => setTweak("lang", "ar")}
                          aria-pressed={(tweaks.lang || "en") === "ar"}
                        >
                          عربي
                        </button>
                      </div>
                      <button
                        className="profile-menu-item"
                        onClick={() =>
                          setTweak(
                            "theme",
                            (tweaks.theme || "light") === "dark"
                              ? "light"
                              : "dark",
                          )
                        }
                      >
                        <Icon
                          name={
                            (tweaks.theme || "light") === "dark"
                              ? "sun"
                              : "moon"
                          }
                          size={14}
                        />
                        {shell.switchTo(
                          (tweaks.theme || "light") === "dark"
                            ? "light"
                            : "dark",
                        )}
                      </button>
                      <div className="profile-menu-sep" />
                    </div>

                    <button
                      className="profile-menu-item"
                      onClick={() => {
                        setShowProfile(false);
                        gotoView("users");
                      }}
                    >
                      <Icon name="guests" size={14} />
                      {lang === "ar" ? "المستخدمون" : "Users"}
                    </button>
                    <button
                      className="profile-menu-item"
                      onClick={() => {
                        setShowProfile(false);
                        setShowSettings(true);
                      }}
                    >
                      <Icon name="settings" size={14} />
                      {lang === "ar" ? "إعدادات المظهر" : "Theme settings"}
                    </button>
                    <button
                      className="profile-menu-item danger"
                      onClick={async () => {
                        setShowProfile(false);
                        await signOut();
                        navigate("/login");
                      }}
                    >
                      <Icon name="power" size={14} />
                      {lang === "ar" ? "تسجيل الخروج" : "Sign out"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="main">
          <Outlet
            context={{
              lang,
              activeEventId: activeEvent?.id || null,
              onOpenGuest: setOpenGuest,
              gotoView,
            }}
          />
        </main>

        {/* The phone bottom nav bar was removed: it only ever surfaced 4 of 22
          modules, so it duplicated the hamburger drawer (which reaches all of
          them) while permanently costing 64px of vertical space. The drawer is
          now the single way to navigate on mobile. */}

        <Drawer open={!!openGuest} onClose={() => setOpenGuest(null)}>
          {openGuest && (
            <GuestDrawer
              guest={openGuest}
              onClose={() => setOpenGuest(null)}
              lang={lang}
              activeEventId={activeEvent?.id || null}
              activeEvent={activeEvent}
              onGuestUpdated={(g) => setOpenGuest(g)}
              onGuestDeleted={() => setOpenGuest(null)}
            />
          )}
        </Drawer>

        <Tweaks
          tweaks={tweaks}
          setTweak={setTweak}
          open={showSettings}
          onOpenChange={setShowSettings}
        />
      </div>
    </>
  );
}
