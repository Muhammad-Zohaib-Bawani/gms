import React from "react";
import { Icon } from "../../../components/Icons";
import ActionMenu from "../../../components/ui/ActionMenu";
import { useAccess } from "../../../auth/AccessContext";

// Page header for the Guests list: title, the "Registry Compliant with
// Hayya" sub-line, the no-event warning banner, the selection-dependent
// Message/Delete bulk buttons, Export, and the Add Guest dropdown (New /
// Existing / Import from CSV — chosen here rather than as tabs inside the
// dialog, so each one opens straight into a single-purpose modal).
export default function GuestsHeader({
  t,
  gt,
  isAr,
  fmtN,
  activeEventId,
  selCount,
  onMessage,
  onDeleteSelected,
  onExport,
  onAddGuest,
}) {
  const { canWrite } = useAccess();
  const canManage = canWrite('guests');
  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            {t.guests?.title?.[0] || "Guest"}{" "}
            <em>{t.guests?.title?.[1]}</em>
          </h1>
          <div className="page-sub">
            <span style={{ color: "var(--hayya-sub-color)" }}>
              {gt.hayyaCompliant}
            </span>
          </div>
        </div>
        <div className="page-actions">
          {selCount > 0 && (
            <>
              <button className="btn primary" onClick={onMessage}>
                <Icon name="message" size={14} />{" "}
                {t.common?.message || "Message"} ({fmtN(selCount)})
              </button>
              {canManage && (
                <button
                  className="btn"
                  style={{ color: "#e05050", borderColor: "rgba(224,80,80,0.4)" }}
                  onClick={onDeleteSelected}
                >
                  <Icon name="trash" size={14} /> {gt.deleteCount(fmtN(selCount))}
                </button>
              )}
            </>
          )}
          <button className="btn" onClick={onExport}>
            <Icon name="download" size={14} /> {gt.exportBtn}
          </button>
          {canManage && (
          <ActionMenu
            align="end"
            menuWidth={286}
            disabled={!activeEventId}
            trigger={({ open, toggle, ref }) => (
              <button
                ref={ref}
                type="button"
                className="btn primary"
                onClick={toggle}
                disabled={!activeEventId}
                aria-haspopup="menu"
                aria-expanded={open}
              >
                <Icon name="plus" size={14} /> {gt.addGuestBtn}
                <Icon name="chevronDown" size={13} style={{ marginInlineStart: 2 }} />
              </button>
            )}
            items={[
              {
                label: gt.newGuestLabel,
                hint: gt.newGuestHint,
                icon: "plus",
                onClick: () => onAddGuest("new"),
              },
              {
                label: gt.existingGuestLabel,
                hint: gt.existingGuestHint,
                icon: "guests",
                onClick: () => onAddGuest("existing"),
              },
              {
                label: gt.importCsvLabel,
                hint: gt.importCsvHint,
                icon: "upload",
                onClick: () => onAddGuest("import"),
              },
            ]}
          />
          )}
        </div>
      </div>

      {!activeEventId && (
        <div className="guests-no-event-banner">
          <Icon name="info" size={14} /> {gt.noEventWarning}
        </div>
      )}
    </>
  );
}
