// The one guest identity cell every guest-bearing table should use: photo (if
// any) + name, email underneath. Organization/job title deliberately don't
// live here — they vary from page to page and, per product direction, aren't
// worth crowding the identity cell for; a page that still wants organization
// shows it as its own column instead.
import React from 'react';
import { Avatar } from './UI';

function initialsOf(name) {
  const parts = (name || '').trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || '?';
}

export default function GuestCell({ name, email, photoUrl, tier, size = 32, onOpen }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
      <Avatar initials={initialsOf(name)} size={size} tier={tier} src={photoUrl} />
      <div style={{ minWidth: 0 }}>
        <div
          onClick={onOpen}
          style={{
            fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap',
            cursor: onOpen ? 'pointer' : 'default',
            color: onOpen ? 'var(--accent)' : 'var(--ink)',
          }}
        >
          {name || '—'}
        </div>
        <div style={{ fontSize: 11, color: 'var(--ink-mute)', whiteSpace: 'nowrap' }}>
          {email || '—'}
        </div>
      </div>
    </div>
  );
}
