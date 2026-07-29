// Reusable three-dot row-actions menu. Renders the trigger inline but portals
// the dropdown to <body> (position: fixed, computed from the trigger's rect)
// so it never gets clipped by a table's `overflow-x: auto` wrapper.
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../Icons';

const MENU_WIDTH = 180;

// items: Array<{ label, icon?, onClick, danger?, disabled? } | false | null>
export default function ActionMenu({ items, align = 'end' }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef(null);
  const menuRef = useRef(null);

  const close = useCallback(() => setOpen(false), []);

  const openMenu = () => {
    const r = btnRef.current.getBoundingClientRect();
    setPos({
      top: r.bottom + 6,
      left: align === 'end' ? r.right - MENU_WIDTH : r.left,
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

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className="action-menu-trigger"
        title="Actions"
        onClick={(e) => { e.stopPropagation(); open ? close() : openMenu(); }}
      >
        <Icon name="moreVertical" size={16} />
      </button>
      {open && createPortal(
        <div ref={menuRef} className="action-menu-list" style={{ top: pos.top, left: pos.left, width: MENU_WIDTH }}>
          {visibleItems.map((it, i) => (
            <button
              key={i}
              type="button"
              className={"action-menu-item" + (it.danger ? " danger" : "")}
              disabled={it.disabled}
              onClick={(e) => { e.stopPropagation(); close(); it.onClick(e); }}
            >
              {it.icon && <Icon name={it.icon} size={14} />}
              <span>{it.label}</span>
            </button>
          ))}
        </div>,
        document.body,
      )}
    </>
  );
}
