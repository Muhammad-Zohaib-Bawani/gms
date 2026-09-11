import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Icon } from "../../../components/Icons";
import GuestCell from "../../../components/GuestCell";
import GuestDetailView from "../../GuestDetailView";
import { useAccess } from "../../../auth/AccessContext";
import { PERM } from "../../../auth/permissions";

// Master-detail split view — a compact all-matching-guests list on the left,
// the full Guest Detail page (unchanged, same component the standalone
// /guests/:id route renders) on the right for whichever is selected.
export default function GuestsSplitView({
  gt,
  isAr,
  lang,
  fmtN,
  navigate,
  activeEventId,
  splitLoading,
  splitGuests,
  selectedEventGuestId,
  setSelectedEventGuestId,
  openEditGuest,
  onDeleteRequest,
  splitTotalCount,
  splitPageIndex,
  setSplitPageIndex,
  splitPageCount,
  detailRefreshKey,
}) {
  const { canWrite } = useAccess();
  const canManage = canWrite(PERM.GUESTS);

  return (
    <div className="card guests-split-shell">
      <div className="guests-split-list">
        <div style={{ flex: 1 }}>
          {splitLoading ? (
            <div className="guests-split-empty-state">{gt.loadingText}</div>
          ) : splitGuests.length === 0 ? (
            <div className="guests-split-empty-state">
              {activeEventId ? gt.noGuestsYet : gt.selectEventFirst}
            </div>
          ) : (
            splitGuests.map((g) => {
              const active = g.id === selectedEventGuestId;
              return (
                <div
                  key={g.id}
                  className="guests-split-row"
                  style={{
                    padding: active ? "13px 14px" : "10px 14px",
                    background: active ? "var(--surface-soft-4)" : "transparent",
                    borderInlineStart: active ? "3px solid var(--accent)" : "3px solid transparent",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedEventGuestId(g.id)}
                    className="guests-split-row-trigger"
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <GuestCell
                        name={g.fullName || `${g.firstName || ""} ${g.lastName || ""}`.trim()}
                        email={g.email}
                        photoUrl={g.photoUrl}
                        size={active ? 46 : 30}
                      />
                    </div>
                    {/* Points at the detail that opens for this row. */}
                    <Icon
                      name="chevronRight"
                      size={13}
                      className="guests-split-row-chevron"
                      style={{ color: active ? "var(--accent)" : "var(--ink-faint)" }}
                    />
                  </button>

                  {/* The selected guest expands in place into a basic-info
                      card with its own actions, so who you're looking at
                      stays anchored to the row you clicked rather than
                      only in the pane opposite. */}
                  <AnimatePresence initial={false}>
                    {active && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                        style={{ overflow: "hidden" }}
                      >
                        <div className="guests-split-row-expand">
                          {/* Organization lives on the detail pane's
                              Personal Info card — the list stays name,
                              email and the actions. */}
                          <div className="guests-split-row-actions">
                            <button
                              type="button" className="icon-btn" title={gt.actionMessage}
                              onClick={() => navigate("/support-chat", {
                                state: { personId: g.personId, guestName: g.fullName, guestOrganization: g.organization || "" },
                              })}
                            >
                              <Icon name="message" size={14} />
                            </button>
                            {/* No accreditation action here — it lives on
                                the detail pane's Personal Info card, where
                                "View Pass" opens the badge itself with
                                Issue/Revoke on it. */}
                            {/* Same gate as the table view's row menu
                                (GuestsTable) — the two are the same actions in
                                a different layout, so they must agree. */}
                            {canManage && (
                              <>
                                <button
                                  type="button" className="icon-btn" title={gt.actionEdit}
                                  onClick={() => openEditGuest(g)}
                                >
                                  <Icon name="edit" size={14} />
                                </button>
                                <button
                                  type="button" className="icon-btn" style={{ color: "var(--danger)" }}
                                  title={gt.actionDelete}
                                  onClick={() => onDeleteRequest(g)}
                                >
                                  <Icon name="trash" size={14} />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })
          )}
        </div>

        {/* Change page — navigate to another 10 guests. Always visible
            (not just once there's a second page) so it's clear this
            list is paginated rather than showing everyone. */}
        {splitTotalCount > 0 && (
          <div className="guests-split-pagination">
            <button
              type="button" className="icon-btn guests-split-page-btn guests-split-page-btn--prev"
              disabled={splitPageIndex === 0}
              onClick={() => setSplitPageIndex((p) => Math.max(0, p - 1))}
            >
              <Icon name="chevronRight" size={13} />
            </button>
            <span className="guests-split-page-text">
              {gt.pageOf(fmtN(splitPageIndex + 1), fmtN(splitPageCount))}
            </span>
            <button
              type="button" className="icon-btn guests-split-page-btn"
              disabled={splitPageIndex + 1 >= splitPageCount}
              onClick={() => setSplitPageIndex((p) => Math.min(splitPageCount - 1, p + 1))}
            >
              <Icon name="chevronRight" size={13} />
            </button>
          </div>
        )}
      </div>
      {/* No scroller of its own — the page scrolls. A pane capped at a
          guessed height meant the detail scrolled inside a box while the
          window still had room, and long content hid below the fold of
          something that didn't look scrollable. */}
      <div className="guests-split-detail-pane">
        {selectedEventGuestId ? (
          <GuestDetailView key={`${selectedEventGuestId}-${detailRefreshKey}`} eventGuestId={selectedEventGuestId} lang={lang} embedded />
        ) : (
          <div className="guests-split-empty-state">{gt.selectGuestToView}</div>
        )}
      </div>
    </div>
  );
}
