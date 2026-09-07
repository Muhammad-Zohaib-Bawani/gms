import { Icon } from "../components/Icons";
import EventSwitcher from "./EventSwitcher";
import NotificationMenu from "./NotificationMenu";
import ProfileMenu from "./ProfileMenu";
import { SHELL_I18N } from "./shellI18n";

// The topbar: mobile hamburger, the active-event display (EventSwitcher),
// language switch, notification bell, theme toggle, and the profile menu.
export default function AppHeader({
  sidebarOpen,
  setSidebarOpen,
  events,
  activeEvent,
  setActiveEventId,
  lang,
  tweaks,
  setTweak,
  gotoView,
  onOpenSettings,
}) {
  const shell = SHELL_I18N[lang] || SHELL_I18N.en;

  return (
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
            className={"lang-opt" + ((tweaks.lang || "en") === "en" ? " active" : "")}
            onClick={() => setTweak("lang", "en")}
            aria-pressed={(tweaks.lang || "en") === "en"}
          >
            EN
          </button>
          <button
            className={"lang-opt" + ((tweaks.lang || "en") === "ar" ? " active" : "")}
            onClick={() => setTweak("lang", "ar")}
            aria-pressed={(tweaks.lang || "en") === "ar"}
          >
            عربي
          </button>
        </div>

        <NotificationMenu lang={lang} />

        {/* Hidden below 768px — the same toggle lives in the profile menu there,
          so the mobile topbar can fit notifications and the avatar. */}
        <button
          className="icon-btn topbar-theme-btn"
          title={shell.switchTo((tweaks.theme || "light") === "dark" ? "light" : "dark")}
          onClick={() =>
            setTweak("theme", (tweaks.theme || "light") === "dark" ? "light" : "dark")
          }
        >
          <Icon name={(tweaks.theme || "light") === "dark" ? "sun" : "moon"} size={16} />
        </button>

        {/* Profile dropdown — replaces the old always-visible name/role block
          and the separate sign-out button. */}
        <ProfileMenu
          lang={lang}
          tweaks={tweaks}
          setTweak={setTweak}
          gotoView={gotoView}
          onOpenSettings={onOpenSettings}
        />
      </div>
    </header>
  );
}
