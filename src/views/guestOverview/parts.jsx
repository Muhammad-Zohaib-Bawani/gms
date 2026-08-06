// Presentational pieces for Guest Overview.
//
// The recurring problem this file solves: a guest is a one-to-many in several
// directions at once (events, services, sessions), and a table cell has room
// for about two of anything. Everything here shows the first few and counts the
// rest, with the full list one click away in the expanded row.
import React from 'react';
import { Icon } from '../../components/Icons';
import { Avatar } from '../../components/UI';

export const INVITATION_TONE = {
  accepted: 'confirmed',
  sent: 'pending',
  opened: 'pending',
  declined: 'declined',
  not_sent: 'draft',
};

export const INVITATION_LABEL = {
  accepted: 'Accepted', sent: 'Sent', opened: 'Opened',
  declined: 'Declined', not_sent: 'Not sent',
};

export const ACCREDITATION_TONE = {
  issued: 'confirmed', pending: 'pending', revoked: 'declined', not_issued: 'draft',
};

export const ACCREDITATION_LABEL = {
  issued: 'Issued', pending: 'Pending', revoked: 'Revoked', not_issued: 'Not issued',
};

export function StatusDot({ tone }) {
  return <span className="dot" style={{ background: 'currentColor' }} aria-hidden />;
}

export function LevelChip({ level, size = 10.5 }) {
  if (!level) return <span className="chip draft" style={{ fontSize: size }}>No level</span>;
  return (
    <span
      className="chip"
      style={{
        fontSize: size,
        color: level.color,
        background: `${level.color}1f`,
        borderColor: `${level.color}55`,
      }}
    >
      <span className="dot" style={{ background: level.color }} />
      {level.name}
    </span>
  );
}

/**
 * Chips with an overflow counter. `title` on the counter carries the hidden
 * names, so the information is reachable on hover without widening the column.
 */
export function ChipList({ items, max = 2, render, emptyText = '—', size = 10.5 }) {
  if (!items || items.length === 0) {
    return <span style={{ color: 'var(--ink-faint)', fontSize: 12 }}>{emptyText}</span>;
  }
  const shown = items.slice(0, max);
  const hidden = items.slice(max);
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
      {shown.map((it, i) => render(it, i))}
      {hidden.length > 0 && (
        <span
          className="chip draft"
          style={{ fontSize: size, cursor: 'default' }}
          title={hidden.map((h) => h.label ?? h.name ?? String(h)).join('\n')}
        >
          +{hidden.length}
        </span>
      )}
    </div>
  );
}

export function GuestCell({ guest }) {
  const org = guest.organization ?? guest.organisation;
  const name = `${guest.firstName} ${guest.lastName}`.trim();
  const initials = `${guest.firstName?.[0] || ''}${guest.lastName?.[0] || ''}`.toUpperCase();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
      <Avatar initials={initials} size={32} src={guest.photoUrl} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap' }}>{name}</div>
        <div style={{ fontSize: 11, color: 'var(--ink-mute)', whiteSpace: 'nowrap' }}>
          {guest.email}
        </div>
        {org && (
          <div style={{ fontSize: 10.5, color: 'var(--ink-faint)', whiteSpace: 'nowrap' }}>
            {guest.jobTitle ? `${guest.jobTitle} · ` : ''}{org}
          </div>
        )}
      </div>
    </div>
  );
}

export function ServiceChip({ service }) {
  const done = service.status === 'completed';
  return (
    <span
      className={`chip ${done ? 'confirmed' : 'pending'}`}
      style={{ fontSize: 10.5 }}
      title={service.summary || service.name}
    >
      <span className="dot" />
      {service.name}
    </span>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <div style={{
        fontSize: 9.5, color: 'var(--ink-faint)', textTransform: 'uppercase',
        letterSpacing: '0.09em', marginBottom: 2,
      }}>
        {label}
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--ink)' }}>{value || '—'}</div>
    </div>
  );
}

/** The A–Z view, shown when a row is expanded. */
export function GuestDetailPanel({ guest }) {
  const grid = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: 12,
  };

  return (
    <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <section>
        <SectionTitle icon="guests">Personal</SectionTitle>
        <div style={grid}>
          <Field label="Full name" value={`${guest.firstName} ${guest.lastName}`} />
          <Field label="Guest type" value={guest.guestType} />
          <Field label="Nationality" value={guest.nationality ? `${guest.nationality.flag} ${guest.nationality.name}` : null} />
          <Field label="Date of birth" value={guest.dateOfBirth} />
          <Field label="Gender" value={guest.gender} />
          <Field label="Email" value={guest.email} />
          <Field label="Phone" value={guest.phone} />
          <Field label="Organisation" value={guest.organisation} />
          <Field label="Job title" value={guest.jobTitle} />
          <Field label="Passport no." value={guest.passportNo} />
          <Field label="Passport expiry" value={guest.passportExpiry} />
        </div>
      </section>

      <section>
        <SectionTitle icon="calendar">
          Events &amp; participation ({guest.events.length})
        </SectionTitle>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {guest.events.map((ev) => (
            <div
              key={ev.eventId}
              style={{
                border: '1px solid var(--glass-border)',
                borderRadius: 10,
                padding: '10px 12px',
                background: 'var(--bg-1)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                <span style={{ fontSize: 12.5, fontWeight: 600 }}>{ev.eventName}</span>
                <LevelChip level={ev.level} />
                <span className={`chip ${INVITATION_TONE[ev.invitation] || 'draft'}`} style={{ fontSize: 10.5 }}>
                  <span className="dot" />{INVITATION_LABEL[ev.invitation] || ev.invitation}
                </span>
                <span className={`chip ${ACCREDITATION_TONE[ev.accreditation] || 'draft'}`} style={{ fontSize: 10.5 }}>
                  <span className="dot" />{ACCREDITATION_LABEL[ev.accreditation] || ev.accreditation}
                </span>
                {ev.badgeNo && (
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--ink-mute)' }}>
                    {ev.badgeNo}
                  </span>
                )}
              </div>

              <div style={{ ...grid, marginBottom: ev.services.length || ev.sessions.length ? 10 : 0 }}>
                <Field label="Arrival" value={ev.arrival} />
                <Field label="Departure" value={ev.departure} />
                <Field label="Seat" value={ev.seat} />
              </div>

              {ev.services.length > 0 && (
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 9.5, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 4 }}>
                    Services
                  </div>
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                    {ev.services.map((s) => (
                      <span
                        key={s.id}
                        className={`chip ${s.status === 'completed' ? 'confirmed' : 'pending'}`}
                        style={{ fontSize: 10.5 }}
                      >
                        <span className="dot" />
                        {s.name}{s.summary ? ` · ${s.summary}` : ''}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {ev.sessions.length > 0 && (
                <div>
                  <div style={{ fontSize: 9.5, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 4 }}>
                    Sessions
                  </div>
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                    {ev.sessions.map((s) => (
                      <span key={s} className="chip" style={{ fontSize: 10.5 }}>{s}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {guest.notes && (
        <section>
          <SectionTitle icon="doc">Notes</SectionTitle>
          <div style={{ fontSize: 12.5, color: 'var(--ink-dim)' }}>{guest.notes}</div>
        </section>
      )}

      <div style={{ fontSize: 10.5, color: 'var(--ink-faint)' }}>
        Created {guest.createdAt?.replace('T', ' ').slice(0, 16)} · Updated {guest.updatedAt?.replace('T', ' ').slice(0, 16)}
      </div>
    </div>
  );
}

function SectionTitle({ icon, children }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8,
      paddingBottom: 5, borderBottom: '1px solid var(--glass-border)',
    }}>
      <Icon name={icon} size={13} style={{ color: 'var(--accent)' }} />
      <span style={{
        fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.1em',
        color: 'var(--ink-mute)', fontWeight: 650,
      }}>
        {children}
      </span>
    </div>
  );
}
