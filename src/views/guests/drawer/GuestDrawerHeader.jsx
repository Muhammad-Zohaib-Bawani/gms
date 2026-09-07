import React from "react";
import { Avatar, ServiceLevelChip } from "../../../components/UI";
import { Icon } from "../../../components/Icons";
import FlagIcon from "../../../components/FlagIcon";

function Badge({ dotColor, children }) {
  return (
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
}

// Top identity block of the drawer: avatar/name/org/chips, invite +
// accreditation status badges, the Message/Badge/More action row (with its
// own dropdown), and the notice banner.
//
// This renders INSIDE the parent's #print-profile-root wrapper (see
// GuestDrawer.jsx) alongside GuestProfilePanel/GuestSessionsPanel, so the
// "Export PDF" scoped print captures all of it as one block. The drawer's
// outer close-button bar sits outside that wrapper in the original markup,
// so it is rendered by GuestDrawer.jsx itself rather than here.
export default function GuestDrawerHeader({
  guest,
  guestName,
  lang,
  isAr,
  t,
  onMessage,
  openingChat,
  onShowBadge,
  onEditProfile,
  onAddMeeting,
  onExportPdf,
  onRemove,
  drawerNotice,
  inviteBadge,
  accredBadge,
}) {
  const [showMore, setShowMore] = React.useState(false);
  const moreRef = React.useRef(null);

  React.useEffect(() => {
    if (!showMore) return;
    const h = (e) => {
      if (moreRef.current && !moreRef.current.contains(e.target))
        setShowMore(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [showMore]);

  const menuItems = [
    {
      icon: "edit",
      label: t.editPro,
      action: () => {
        setShowMore(false);
        onEditProfile();
      },
    },
    {
      icon: "meetings",
      label: t.addMeet,
      action: () => {
        setShowMore(false);
        onAddMeeting();
      },
    },
    {
      icon: "download",
      label: t.expPdf,
      action: () => {
        setShowMore(false);
        onExportPdf();
      },
    },
  ];

  return (
    <>
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
          <div style={{ fontSize: 12, color: "var(--ink-dim)", marginTop: 2 }}>
            {guest.organization}
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
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
      <div style={{ display: "flex", gap: 6, marginTop: 14, flexWrap: "wrap" }}>
        <Badge dotColor={inviteBadge.color}>{inviteBadge.label}</Badge>
        <Badge dotColor={accredBadge.color}>
          {isAr ? "الاعتماد" : "Accred"} · {accredBadge.label}
        </Badge>
      </div>

      <div style={{ display: "flex", gap: 6, marginTop: 18 }}>
        <button
          className="btn primary"
          style={{ flex: 1 }}
          onClick={onMessage}
          disabled={openingChat}
        >
          <Icon name="message" size={14} /> {t.message}
        </button>
        <button className="btn" style={{ flex: 1 }} onClick={onShowBadge}>
          <Icon name="badge" size={14} /> {t.badge}
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
              {menuItems.map((item) => (
                <button
                  key={item.label}
                  onClick={item.action}
                  className="guest-drawer-menu-btn"
                >
                  <Icon name={item.icon} size={13} /> {item.label}
                </button>
              ))}
              <div className="guest-drawer-menu-sep" />
              <button
                onClick={() => {
                  setShowMore(false);
                  onRemove();
                }}
                className="guest-drawer-menu-btn guest-drawer-menu-btn--danger"
              >
                <Icon name="trash" size={13} /> {t.removeG}
              </button>
            </div>
          )}
        </div>
      </div>

      {drawerNotice && (
        <div className="guest-drawer-notice">
          <Icon name="check" size={13} /> {drawerNotice}
        </div>
      )}

      <div className="divider" />
    </>
  );
}
