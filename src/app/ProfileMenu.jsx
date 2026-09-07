import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "../components/Icons";
import { useAuth } from "../auth/AuthContext";
import { SHELL_I18N } from "./shellI18n";
import "./app-header.css";

// The avatar/profile dropdown — user identity, mobile-only language/theme
// controls (the topbar can't fit them below 768px), Users shortcut, theme
// settings, and sign out. Owns its own open/outside-click state;
// `onOpenSettings` bubbles up to App.jsx since the Tweaks panel it opens is
// rendered there.
export default function ProfileMenu({ lang, tweaks, setTweak, gotoView, onOpenSettings }) {
  const navigate = useNavigate();
  const { user, isDemo, signOut } = useAuth();
  const [showProfile, setShowProfile] = useState(false);
  const profileRef = React.useRef(null);
  const shell = SHELL_I18N[lang] || SHELL_I18N.en;

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
    <div className="notif-wrap" ref={profileRef}>
      <button
        className="avatar app-header-profile-trigger"
        onClick={() => setShowProfile((o) => !o)}
      >
        <div className="pic">{userInitials}</div>
        <div>
          <div className="name">{user && !isDemo ? user.fullName : shell.userName}</div>
          <div className="role">
            {user && !isDemo
              ? user.role || user.roleCode || shell.userRole
              : isDemo
                ? "Demo mode"
                : shell.userRole}
          </div>
        </div>
        <Icon name="chevronDown" size={13} className="app-header-profile-chevron" />
      </button>
      {showProfile && (
        <div className="notif-menu app-header-profile-menu">
          <div className="app-header-profile-menu-head">
            <div className="app-header-profile-menu-name">
              {user && !isDemo ? user.fullName : shell.userName}
            </div>
            <div className="app-header-profile-menu-email">{user?.email || "—"}</div>
          </div>
          <div className="app-header-profile-menu-body">
            {/* Mobile only: the topbar can't fit the language switcher or the
              theme toggle at phone widths, so they live here instead — the
              capability moves, it isn't lost. */}
            <div className="profile-menu-mobile-only">
              <div className="profile-menu-label">
                {lang === "ar" ? "اللغة" : "Language"}
              </div>
              <div className="profile-menu-langs">
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
              <button
                className="profile-menu-item"
                onClick={() =>
                  setTweak("theme", (tweaks.theme || "light") === "dark" ? "light" : "dark")
                }
              >
                <Icon name={(tweaks.theme || "light") === "dark" ? "sun" : "moon"} size={14} />
                {shell.switchTo((tweaks.theme || "light") === "dark" ? "light" : "dark")}
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
                onOpenSettings();
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
  );
}
