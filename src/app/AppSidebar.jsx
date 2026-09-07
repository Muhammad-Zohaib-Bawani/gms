import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation, useNavigate } from "react-router-dom";
import { Icon } from "../components/Icons";
import { useAccess } from "../auth/AccessContext";
import { useAuth } from "../auth/AuthContext";
import "./app-sidebar.css";

// The nav rail + mobile overlay.
//
// Every item here comes from the database (the Permissions table), via
// GET /role-access/me: labels,
// icons, order, parent/child nesting and which rows exist at all. Nothing is
// hardcoded, and the response is already pruned to what the role may reach — a
// top-level row arrives because the role can read it OR because one of its
// submenus is readable, and in that second case it arrives carrying only the
// submenus the role is actually allowed.
//
// Owns its own accordion/collapse UI state; `sidebarOpen`/`setSidebarOpen` and
// `sideCollapsed`/`setSideCollapsed` are lifted to App.jsx because other chrome
// (the topbar hamburger, the outer `.app` wrapper's data-side attr) needs them.
export default function AppSidebar({
  sidebarOpen,
  setSidebarOpen,
  sideCollapsed,
  setSideCollapsed,
  lang,
}) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { menus, loading } = useAccess();
  const { isDemo } = useAuth();
  const [openMenus, setOpenMenus] = useState({});
  // Top-level accordion — one section open at a time, persisted the same way as
  // the rail's own collapse. Whichever top-level row comes first is open by
  // default; clicking another closes whichever was open.
  const [openTop, setOpenTop] = useState(
    () => localStorage.getItem("gms-nav-open-section") || null,
  );

  useEffect(() => {
    localStorage.setItem("gms-nav-open-section", openTop || "");
  }, [openTop]);

  useEffect(() => {
    localStorage.setItem("gms-side-collapsed", sideCollapsed ? "1" : "0");
  }, [sideCollapsed]);

  // First load: open whichever top-level row holds the current page, else the
  // first one. Only when nothing is remembered, so a user's choice survives.
  useEffect(() => {
    if (openTop || menus.length === 0) return;
    const holding = menus.find((m) => containsPath(m, pathname));
    setOpenTop((holding || menus[0]).code);
  }, [menus, pathname, openTop]);

  const go = (path) => {
    if (!path) return;
    navigate(path);
    setSidebarOpen(false);
  };

  const labelOf = (m) => (lang === "ar" && m.nameAr) || m.name;
  const isActive = (m) =>
    !!m.path && (pathname === m.path || pathname.startsWith(m.path + "/"));

  // A leaf row: an entry with a page of its own and nothing under it.
  const renderLeaf = (m, depth) => (
    <button
      type="button"
      key={m.permissionId}
      className={`nav-item ${depth > 1 ? "app-sidebar-nav-item-child" : ""} ${isActive(m) ? "active" : ""}`}
      title={sideCollapsed ? labelOf(m) : undefined}
      onClick={() => go(m.path)}
    >
      {depth === 1 && m.icon && <Icon name={m.icon} size={17} />}
      <span className="nav-item-label">{labelOf(m)}</span>
    </button>
  );

  // A row with submenus. Clicking it expands rather than navigates — even when
  // it has a path of its own, because its children are the reason it is here.
  const renderBranch = (m, depth) => {
    const hasActiveKid = m.children.some((c) => containsPath(c, pathname));
    const isOpen = openMenus[m.code] ?? hasActiveKid;
    return (
      <React.Fragment key={m.permissionId}>
        <button
          type="button"
          className={`nav-item ${hasActiveKid || isActive(m) ? "active" : ""} ${depth > 1 ? "app-sidebar-nav-item-child" : ""}`}
          title={sideCollapsed ? labelOf(m) : undefined}
          onClick={() => setOpenMenus((s) => ({ ...s, [m.code]: !isOpen }))}
        >
          {depth === 1 && m.icon && <Icon name={m.icon} size={17} />}
          <span className="nav-item-label">{labelOf(m)}</span>
          <Icon
            name={isOpen ? "chevronDown" : "chevronRight"}
            size={13}
            className="nav-chevron app-sidebar-chevron-end"
          />
        </button>
        {/* Height-animated so the submenu doesn't snap open. */}
        <AnimatePresence initial={false}>
          {isOpen && !sideCollapsed && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
              style={{ overflow: "hidden" }}
            >
              {m.children.map((c) => renderNode(c, depth + 1))}
            </motion.div>
          )}
        </AnimatePresence>
      </React.Fragment>
    );
  };

  const renderNode = (m, depth) =>
    m.children?.length ? renderBranch(m, depth) : renderLeaf(m, depth);

  return (
    <>
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
          {menus.length === 0 ? (
            loading ? (
              <NavSkeleton />
            ) : (
              <div className="app-sidebar-empty">
                {isDemo
                  // ponytail: the menu tree is database-owned, and demo mode has
                  // no backend to read it from. Sign-in is the only way to get a
                  // nav now; a hardcoded demo tree would be the exact thing this
                  // refactor removed.
                  ? lang === "ar" ? "سجّل الدخول لعرض القائمة" : "Sign in to load the menu"
                  : lang === "ar" ? "لا توجد صلاحيات" : "No menus available"}
              </div>
            )
          ) : (
            menus.map((top) => {
              // A top-level row with children renders as a section header, the
              // same shape the old hardcoded sections had. One with a page of its
              // own and no children is just a link at the top level.
              if (!top.children?.length) return renderLeaf(top, 1);

              const isOpen = openTop === top.code;
              return (
                <React.Fragment key={top.permissionId}>
                  <button
                    type="button"
                    className="nav-section nav-section-toggle app-sidebar-section-toggle"
                    onClick={() => setOpenTop((s) => (s === top.code ? null : top.code))}
                  >
                    <span>{labelOf(top)}</span>
                    <Icon
                      name={isOpen ? "chevronDown" : "chevronRight"}
                      size={11}
                      className="nav-chevron"
                    />
                  </button>
                  {/* Height-animated, same as the submenu — collapsing a section
                      shouldn't snap the list shorter. */}
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                        style={{ overflow: "hidden" }}
                      >
                        {top.children.map((c) => renderNode(c, 1))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </React.Fragment>
              );
            })
          )}
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
            <Icon name={sideCollapsed ? "chevronRight" : "arrowLeft"} size={14} />
            <span className="side-foot-text">
              {lang === "ar" ? "تصغير القائمة" : "Collapse menu"}
            </span>
          </button>
        </div>
      </aside>
    </>
  );
}

// Stand-in for the nav while the tree is in flight. Shaped like the real thing —
// a section heading with items under it — so the rail does not jump when the
// response lands. Counts are arbitrary; the point is the silhouette.
function NavSkeleton() {
  return (
    <div className="app-sidebar-skeleton" aria-hidden="true">
      {[3, 2, 4].map((items, section) => (
        <React.Fragment key={section}>
          <div className="skeleton nav-skel-section" />
          {Array.from({ length: items }).map((_, i) => (
            <div key={i} className="nav-skel-item">
              <div className="skeleton nav-skel-icon" />
              <div className="skeleton nav-skel-label" style={{ width: `${58 + ((i * 13) % 30)}%` }} />
            </div>
          ))}
        </React.Fragment>
      ))}
    </div>
  );
}

// Does this node, or anything under it, own the current URL? Used for both the
// "which section is open" default and the active-parent highlight.
function containsPath(node, pathname) {
  if (node.path && (pathname === node.path || pathname.startsWith(node.path + "/"))) return true;
  return (node.children || []).some((c) => containsPath(c, pathname));
}
