import React from "react";
import { Icon } from "../../components/Icons.jsx";
import SharedGuestCell from "../../components/GuestCell.jsx";
import ServiceAccordion from "../guests/ServiceAccordion.jsx";
import { guestFullName } from "./travelView.helpers.js";
import "./travel-view.css";

// Two-step dialog: pick a guest, then tick/fill whichever services their
// service level entitles them to (built-in travel + dynamic services share
// one accordion here — see ServiceAccordion).
export default function NewBookingModal({
  show,
  isAr,
  lang,
  STR,
  bookStep,
  setBookStep,
  bookGuest,
  bookEventGuestId,
  setBookEventGuestId,
  setBookGuest,
  guestSearch,
  setGuestSearch,
  guests,
  guestLoading,
  onGuestListScroll,
  bookPlanLoading,
  bookPlan,
  bookSlots,
  bookPending,
  setBookPending,
  travel,
  setTravel,
  travelLookups,
  activeEventId,
  eventMinDate,
  eventMaxDate,
  dateWindowMin,
  dateWindowMax,
  onClose,
  saveBooking,
  savingBooking,
}) {
  if (!show) return null;

  return (
    <div className="travel-modal-overlay">
      <div
        className="card glass modal-solid"
        style={{
          width: 720,
          maxWidth: "92vw",
          padding: 0,
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            padding: "18px 22px",
            borderBottom: "1px solid var(--glass-border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <h3 style={{ margin: 0 }}>{STR.newBookingTitle}</h3>
            <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
              {[STR.selectGuest, STR.bookingDetails].map((l, i) => (
                <span
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    fontSize: 11,
                    color:
                      bookStep === i + 1
                        ? "var(--accent)"
                        : bookStep > i + 1
                          ? "var(--ink-dim)"
                          : "var(--ink-mute)",
                  }}
                >
                  <span
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: "50%",
                      display: "grid",
                      placeItems: "center",
                      fontSize: 10,
                      fontWeight: 700,
                      background:
                        bookStep === i + 1
                          ? "var(--accent)"
                          : bookStep > i + 1
                            ? "var(--accent-deep)"
                            : "var(--surface-soft-4)",
                      color: bookStep >= i + 1 ? "#fff" : "var(--ink-mute)",
                    }}
                  >
                    {i + 1}
                  </span>
                  {l}
                  {i < 1 && (
                    <span style={{ color: "var(--ink-faint)" }}>›</span>
                  )}
                </span>
              ))}
            </div>
          </div>
          <button
            className="icon-btn"
            onClick={onClose}
          >
            <Icon name="close" size={14} />
          </button>
        </div>

        <div
          style={{
            padding: "20px 22px",
            overflowY: "auto",
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          {bookStep === 1 && (
            <div>
              <label className="travel-field-label">{isAr ? "الضيف" : "Guest"}</label>
              <input
                placeholder={STR.guestSearch}
                value={guestSearch}
                onChange={(e) => setGuestSearch(e.target.value)}
                className="travel-field-input"
              />
              <div
                onScroll={onGuestListScroll}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                  maxHeight: 280,
                  overflowY: "auto",
                  marginTop: 8,
                }}
              >
                {guests.map((g) => {
                  const fullName = g.fullName || guestFullName(g);
                  const selected = bookEventGuestId === g.id;
                  return (
                    <div
                      key={g.id}
                      onClick={() => {
                        setBookEventGuestId(g.id);
                        setBookGuest(fullName);
                      }}
                      style={{
                        padding: "8px 12px",
                        borderRadius: 8,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        border: `1px solid ${selected ? "var(--accent)" : "var(--glass-border)"}`,
                        background: selected
                          ? "rgba(0, 98, 123,0.12)"
                          : "var(--surface-soft-2)",
                      }}
                    >
                      <SharedGuestCell
                        name={fullName}
                        email={g.email}
                        photoUrl={g.photoUrl}
                        tier={g.tier}
                        size={28}
                      />
                      {selected && (
                        <Icon
                          name="check"
                          size={13}
                          style={{
                            marginLeft: "auto",
                            color: "var(--accent)",
                          }}
                        />
                      )}
                    </div>
                  );
                })}
                {guestLoading && (
                  <div
                    style={{
                      padding: "10px",
                      textAlign: "center",
                      color: "var(--ink-mute)",
                      fontSize: 12,
                    }}
                  >
                    {isAr ? "جارٍ التحميل…" : "Loading…"}
                  </div>
                )}
                {!guestLoading && guests.length === 0 && (
                  <div
                    style={{
                      padding: "12px",
                      textAlign: "center",
                      color: "var(--ink-mute)",
                      fontSize: 12,
                    }}
                  >
                    {isAr
                      ? "لا يوجد ضيوف لهذه الفعالية"
                      : "No guests found for this event"}
                  </div>
                )}
              </div>
            </div>
          )}

          {bookStep === 2 &&
            (bookPlanLoading ? (
              <div
                style={{
                  padding: "14px",
                  textAlign: "center",
                  fontSize: 12.5,
                  color: "var(--ink-mute)",
                }}
              >
                {isAr ? "جارٍ التحميل…" : "Loading…"}
              </div>
            ) : !bookPlan?.serviceLevelId ? (
              <div className="alert alert-warn" style={{ fontSize: 12.5 }}>
                <Icon name="alert" size={14} />
                <div>
                  {isAr
                    ? `${bookGuest} ليس لديه مستوى خدمة — عيّن مستوى أولاً من صفحة الضيوف.`
                    : `${bookGuest} has no service level yet — assign one on the Guests page first.`}
                </div>
              </div>
            ) : bookSlots.length === 0 ? (
              <div className="alert alert-warn" style={{ fontSize: 12.5 }}>
                <Icon name="alert" size={14} />
                <div>
                  {isAr
                    ? `مستوى "${bookPlan.serviceLevelName}" لا يحتوي على أي خدمة — أضِف خدمات إليه من صفحة مستويات الخدمة.`
                    : `"${bookPlan.serviceLevelName}" has no services assigned to it — add some on the Service Levels page.`}
                </div>
              </div>
            ) : (
              <>
                {/* <div style={{ fontSize: 11.5, color: "var(--ink-mute)" }}>
                  {isAr
                    ? `ضع علامة على ما تريد إضافته — حسب مستوى "${bookPlan.serviceLevelName}"`
                    : `Tick whatever you want to add - from "${bookPlan.serviceLevelName}"`}
                </div> */}
                {/* Fixed events complete services in order. The travel endpoints
                    don't enforce that (only the service-entry API does), so this
                    is a warning rather than a lock. */}
                {bookSlots.some((s) => !s.isUnlocked) && (
                  <div
                    className="alert alert-info"
                    style={{ fontSize: 12 }}
                  >
                    <Icon name="alert" size={13} />
                    <div>
                      {[
                        ...new Set(
                          bookSlots
                            .filter((s) => !s.isUnlocked)
                            .map((s) => s.lockedReason)
                            .filter(Boolean),
                        ),
                      ].join(" ")}
                    </div>
                  </div>
                )}
                {/* Same tick-list as the guest wizard's step 3: one collapsible
                    row per service with a checkbox, rather than every section
                    pinned open at once. */}
                <ServiceAccordion
                  slots={bookSlots}
                  pending={bookPending}
                  onPendingChange={setBookPending}
                  travel={travel}
                  onTravelChange={setTravel}
                  travelLookups={travelLookups}
                  isFixed={bookPlan.guestModel === "fixed"}
                  lang={lang}
                  eventId={activeEventId}
                  eventStart={eventMinDate}
                  eventEnd={eventMaxDate}
                  dateMinDate={dateWindowMin}
                  dateMaxDate={dateWindowMax}
                />
              </>
            ))}
        </div>

        <div
          style={{
            padding: "14px 22px",
            borderTop: "1px solid var(--glass-border)",
            display: "flex",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <button
            className="btn"
            onClick={() =>
              bookStep > 1 ? setBookStep(1) : onClose()
            }
          >
            {bookStep > 1 ? (
              <>
                <Icon name="arrowLeft" size={13} /> {STR.back}
              </>
            ) : (
              STR.cancel2
            )}
          </button>
          {bookStep < 2 ? (
            <button
              className="btn primary"
              onClick={() => setBookStep(2)}
              disabled={!bookEventGuestId}
            >
              {STR.next} <Icon name="arrow" size={13} />
            </button>
          ) : (
            <button
              className="btn primary"
              onClick={saveBooking}
              disabled={savingBooking}
            >
              <Icon name="check" size={13} />{" "}
              {savingBooking
                ? isAr
                  ? "جارٍ الحفظ…"
                  : "Saving…"
                : STR.save}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
