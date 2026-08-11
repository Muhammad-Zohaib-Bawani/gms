// Reusable three-dot row-actions menu. Renders the trigger inline but portals
// the dropdown to <body> (position: fixed, computed from the trigger's rect)
// so it never gets clipped by a table's `overflow-x: auto` wrapper.
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../Icons';

const MENU_WIDTH = 180;

// items: Array<{ label, icon?, hint?, onClick, danger?, disabled? } | false | null>
//
// `trigger` swaps the default three-dot button for any element — it receives
// ({ open, toggle, ref }) and must attach the ref and call toggle. That exists so
// a labelled dropdown (e.g. "Add Guest ▾") can reuse the portal + outside-click
// + Escape + scroll-close behaviour here rather than re-implementing it.
// `menuWidth` widens the panel for items that carry a hint line.
export default function ActionMenu({ items, align = 'end', trigger, menuWidth, disabled = false }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef(null);
  const menuRef = useRef(null);

  const close = useCallback(() => setOpen(false), []);

  const width = menuWidth || MENU_WIDTH;

  const openMenu = () => {
    const r = btnRef.current.getBoundingClientRect();
    // Clamped to the viewport so a right-aligned menu on a narrow screen can't
    // hang off the edge (the topbar/page-action rows sit close to it).
    const rawLeft = align === 'end' ? r.right - width : r.left;
    setPos({
      top: r.bottom + 6,
      left: Math.max(8, Math.min(rawLeft, window.innerWidth - width - 8)),
    });
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (menuRef.current?.contains(e.target) || btnRef.current?.contains(e.target)) return;
      close();
    };
    const onEscape = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onEscape);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onEscape);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open, close]);

  const visibleItems = (items || []).filter(Boolean);
  if (visibleItems.length === 0) return null;

  const toggle = (e) => {
    e?.stopPropagation();
    if (disabled) return;
    open ? close() : openMenu();
  };

  return (
    <>
      {trigger ? trigger({ open, toggle, ref: btnRef }) : (
        <button
          ref={btnRef}
          type="button"
          className="action-menu-trigger"
          title="Actions"
          disabled={disabled}
          onClick={toggle}
        >
          <Icon name="moreVertical" size={16} />
        </button>
      )}
      {open && createPortal(
        <div ref={menuRef} className="action-menu-list" style={{ top: pos.top, left: pos.left, width }}>
          {visibleItems.map((it, i) => (
            <button
              key={i}
              type="button"
              className={"action-menu-item" + (it.danger ? " danger" : "")}
              disabled={it.disabled}
              onClick={(e) => { e.stopPropagation(); close(); it.onClick(e); }}
            >
              {it.icon && <Icon name={it.icon} size={14} />}
              {/* A hint turns the row into two lines; without one the label sits
                  inline exactly as before, so existing row menus are unchanged. */}
              {it.hint ? (
                <span style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0, textAlign: 'start' }}>
                  <span>{it.label}</span>
                  <span style={{ fontSize: 10.5, color: 'var(--ink-faint)', whiteSpace: 'normal', lineHeight: 1.35 }}>
                    {it.hint}
                  </span>
                </span>
              ) : (
                <span>{it.label}</span>
              )}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </>
  );
}
