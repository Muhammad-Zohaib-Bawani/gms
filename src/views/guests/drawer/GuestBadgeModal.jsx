import { QRCodeSVG } from "qrcode.react";
import { Avatar, ServiceLevelChip } from "../../../components/UI";
import { Icon } from "../../../components/Icons";
import FlagIcon from "../../../components/FlagIcon";
import { fmtEventDates } from "./guestDrawer.helpers";

// The entire "Badge" modal from the old GuestDrawer — QR payload construction,
// issued/not-issued states, and the badge card visual. Moved verbatim.
export default function GuestBadgeModal({
  open,
  onClose,
  guest,
  activeEvent,
  lang,
  isAr,
  tierColor,
  guestName,
  t,
  onPrint,
}) {
  if (!open) return null;

  const isIssued = guest.accreditationStatus === "issued";
  const badgeRef = guest.id
    ? guest.id.replace(/-/g, "").slice(0, 8).toUpperCase()
    : "";
  const eventDatesLabel = fmtEventDates(activeEvent);
  const qrPayload = JSON.stringify({
    type: "gms-accreditation",
    // Accreditation is issued against the event participation, so the
    // badge identifies an eventGuestId, not the person.
    eventGuestId: guest.id,
    ref: badgeRef,
    name: guestName,
    tier: guest.tier,
    organization: guest.organization || null,
    nationality: guest.nationalityName || null,
    eventId: activeEvent?.id || null,
    event: activeEvent?.title || null,
  });

  return (
    <div className="guest-drawer-modal-overlay">
      <div
        className="card glass modal-solid guest-drawer-modal-card"
        style={{ width: 360 }}
      >
        <div className="guest-drawer-modal-head guest-drawer-modal-head--compact">
          <span style={{ fontWeight: 600, fontSize: 14 }}>{t.badgeTitle}</span>
          <button className="icon-btn" onClick={onClose}>
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
              <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 6 }}>
                {t.badgeNotIssuedTitle}
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "var(--ink-mute)",
                  lineHeight: 1.5,
                }}
              >
                {t.badgeNotIssuedMsg}
              </div>
            </div>
          ) : (
            <div className="guest-drawer-badge-card">
              <div
                className="guest-drawer-badge-card-stripe"
                style={{ background: tierColor }}
              />
              <div className="guest-drawer-badge-card-body">
                <Avatar
                  initials={(
                    (guest.firstName?.[0] || "") + (guest.lastName?.[0] || "")
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
                      <FlagIcon code={guest.nationalityCode} size={12} />{" "}
                      {guest.nationalityName}
                    </span>
                  )}
                </div>
                <div className="guest-drawer-badge-info-grid">
                  {[
                    { label: t.badgeNo, value: badgeRef, mono: true },
                    {
                      label: t.arrival,
                      value: guest.arrivalDate || "—",
                      mono: true,
                    },
                  ].map((row) => (
                    <div key={row.label} className="guest-drawer-badge-info-cell">
                      <div className="guest-drawer-badge-info-label">
                        {row.label}
                      </div>
                      <div
                        className={
                          "guest-drawer-badge-info-value" +
                          (row.mono ? " guest-drawer-badge-info-value--mono" : "")
                        }
                      >
                        {row.value}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="guest-drawer-badge-card-foot">
                <div>
                  <div
                    style={{
                      fontSize: 10.5,
                      color: "var(--ink-mute)",
                      marginBottom: 4,
                      fontWeight: 600,
                    }}
                  >
                    {activeEvent?.title || (isAr ? "الفعالية" : "Event")}
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
                <div className="guest-drawer-badge-qr-wrap">
                  <QRCodeSVG
                    value={qrPayload}
                    size={72}
                    bgColor="#ffffff"
                    fgColor="#004151"
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
            onClick={onClose}
          >
            {t.cancel}
          </button>
          {isIssued && (
            <button
              className="btn primary"
              style={{ flex: 1, justifyContent: "center" }}
              onClick={onPrint}
            >
              <Icon name="doc" size={13} /> {t.printBadge}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
