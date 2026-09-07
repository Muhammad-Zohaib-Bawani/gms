import { useState, useEffect } from "react";
import { Drawer } from "./components/UI";
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
import { useEvents } from "./events/EventsContext";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { pathForKey } from "./nav";
import GuestDrawer from "./views/guests/drawer/GuestDrawer";
import AppSidebar from "./app/AppSidebar";
import AppHeader from "./app/AppHeader";

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
  // Light mode is deliberately NOT accent-tinted.

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

export default function App() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [openGuest, setOpenGuest] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Desktop rail collapse, persisted so it survives a reload.
  const [sideCollapsed, setSideCollapsed] = useState(
    () => localStorage.getItem("gms-side-collapsed") === "1",
  );
  const [showSettings, setShowSettings] = useState(false);
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);

  // New screen starts at the top. Desktop scrolls the window; on mobile .main is
  // its own scroller, so both need resetting.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    document.querySelector(".main")?.scrollTo({ top: 0, behavior: "smooth" });
  }, [pathname]);

  useEffect(
    () =>
      onHub(REALTIME_TOPICS.NOTIFICATION_NEW, (title, message) => {
        toast.message(title || message, {
          description: title ? message : undefined,
        });

        if (document.hidden && window.Notification?.permission === "granted") {
          new Notification(title || "Notification", {
            body: title ? message : undefined,
          });
        }
      }),
    [],
  );
  useEffect(() => {
    if (window.Notification?.permission === "default")
      Notification.requestPermission().catch(() => {});
  }, []);

  const [activeLogo, setActiveLogo] = useState({ dark: "", light: "" });
  const { events, activeEvent, setActiveEventId } = useEvents();

  const gotoView = (key) => {
    navigate(pathForKey(key));
    setSidebarOpen(false);
  };

  function applyEventTheme(ev) {
    // Brand theme overrides per-event colors. Flip BRAND_THEME.enabled to false
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

  return (
    <>

      <div className="app" data-side={sideCollapsed ? "collapsed" : "expanded"}>
        <AppSidebar
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          sideCollapsed={sideCollapsed}
          setSideCollapsed={setSideCollapsed}
          lang={lang}
        />

        <AppHeader
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          events={events}
          activeEvent={activeEvent}
          setActiveEventId={setActiveEventId}
          lang={lang}
          tweaks={tweaks}
          setTweak={setTweak}
          gotoView={gotoView}
          onOpenSettings={() => setShowSettings(true)}
        />

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
