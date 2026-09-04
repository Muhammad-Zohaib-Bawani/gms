// The expanded row: one guest, A–Z — fetched on demand from
// GET /v1/guest-overview/{id} so the list itself stays lightweight.
//
// One section per data source rather than one card per event. A person can be
// in more than one event (the backend groups Guest Overview rows by email —
// see GuestOverviewService), so `events` is a list and every other section
// flattens across all of that person's events, each item carrying which event
// it came from.
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../../components/Icons';
import { Avatar } from '../../components/UI';
import { getGuestOverviewDetail } from '../../api/services/guestOverviewService';

// Icon-only action, labelled for both sighted (title tooltip) and assistive
// users (aria-label) — four of these sit in the accordion header, so a text
// label each would take the whole row.
function ActionBtn({ icon, label, onClick, danger }) {
  return (
    <button
      type="button"
      className="icon-btn"
      title={label}
      aria-label={label}
      onClick={onClick}
      style={danger ? { color: 'var(--danger)' } : undefined}
    >
      <Icon name={icon} size={14} />
    </button>
  );
}

const initialsOf = (name) => {
  const p = (name || '').trim().split(/\s+/);
  return ((p[0]?.[0] || '') + (p[1]?.[0] || '')).toUpperCase() || '?';
};

function Section({ icon, title, count, children, empty }) {
  return (
    <section>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        marginBottom: 10, paddingBottom: 6,
        borderBottom: '1px solid var(--glass-border)',
      }}>
        <Icon name={icon} size={13} style={{ color: 'var(--accent)' }} />
        <span style={{
          fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.1em',
          color: 'var(--ink-dim)', fontWeight: 700,
        }}>
          {title}
        </span>
        {count != null && (
          <span className="chip draft" style={{ fontSize: 10 }}>{count}</span>
        )}
      </div>
      {count === 0
        ? <div style={{ fontSize: 12, color: 'var(--ink-faint)', fontStyle: 'italic' }}>{empty}</div>
        : children}
    </section>
  );
}

/** label/value pairs, wrapping into as many columns as fit. */
function Facts({ data }) {
  const entries = Object.entries(data || {}).filter(([, v]) => v != null && v !== '');
  if (entries.length === 0) return null;
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
      gap: '10px 16px',
    }}>
      {entries.map(([k, v]) => (
        <div key={k}>
          <div style={{
            fontSize: 9.5, color: 'var(--ink-faint)', textTransform: 'uppercase',
            letterSpacing: '0.09em', marginBottom: 3,
          }}>
            {k}
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--ink)' }}>{v}</div>
        </div>
      ))}
    </div>
  );
}

/** A bordered record with an optional status chip and event tag in its header.
 *  `icon` gives each service kind its own glyph (plane / hotel / car / seat),
 *  the same at-a-glance cue the Travel & Logistics tabs use. */
function RecordCard({ icon, title, status, eventTitle, onEdit, children }) {
  return (
    <div style={{
      border: '1px solid var(--glass-border)',
      borderRadius: 10,
      padding: '11px 13px',
      background: 'var(--bg-0)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 9 }}>
        {icon && <Icon name={icon} size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />}
        {title && <span style={{ fontSize: 12.5, fontWeight: 650 }}>{title}</span>}
        {status && (
          <span className={`chip ${status === 'completed' ? 'confirmed' : 'pending'}`} style={{ fontSize: 10 }}>
            <span className="dot" />
            {status === 'completed' ? 'Booked' : 'Pending'}
          </span>
        )}
        {eventTitle && (
          <span
            className="chip draft"
            style={{ fontSize: 10, marginInlineStart: 'auto', whiteSpace: 'nowrap' }}
          >
            {eventTitle}
          </span>
        )}
        {onEdit && (
          <span style={{ marginInlineStart: eventTitle ? 0 : 'auto' }}>
            <ActionBtn icon="edit" label="Edit" onClick={onEdit} />
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

const dt = (v) => v?.replace('T', ' ').slice(0, 16);

// The cross-event detail for ONE PERSON. `personId` is Guest.PublicId; every
// event-scoped jump out of here (view/edit the guest, their travel, their seat)
// has to go through a participation from `detail.events[]`, each of which
// carries its own `eventGuestId`.
export default function GuestDetail({ personId, guest }) {
  const navigate = useNavigate();
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getGuestOverviewDetail(personId)
      .then((d) => { if (!cancelled) setDetail(d); })
      .catch((err) => { if (!cancelled) setError(err?.message || 'Could not load this delegate'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [personId]);

  if (loading) {
    return <div style={{ padding: '18px 20px', fontSize: 12.5, color: 'var(--ink-mute)' }}>Loading…</div>;
  }
  if (error) {
    return <div style={{ padding: '18px 20px', fontSize: 12.5, color: 'var(--danger)' }}>{error}</div>;
  }
  if (!detail) return null;

  const {
    events = [], sessions = [], flights = [], accommodations = [],
    transport = [], seatings = [], otherServices = [],
  } = detail;

  const stack = { display: 'flex', flexDirection: 'column', gap: 8 };

  const fullName = `${guest?.firstName || ''} ${guest?.lastName || ''}`.trim();
  // Support chat is person-scoped — personId is what it takes.
  const goChat = () => navigate('/support-chat', {
    state: { personId, guestName: fullName, guestOrganization: guest?.organization || '' },
  });
  // The participation to open for the event-scoped guest page: the one matching
  // the row's current event, else the latest block loaded.
  const primaryEventGuestId =
    (events.find((e) => e.eventId === guest?.eventId) || events[events.length - 1])?.eventGuestId || null;
  const goParticipation = () => {
    if (!primaryEventGuestId) return;
    navigate(`/guests/${primaryEventGuestId}`);
  };

  return (
    <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Identity + actions for the guest whose row is expanded. The list row
          above is a dense table cell, so who you're looking at (and what you
          can do to them) is restated here where the detail actually lives —
          that's what lets the separate top info card go away. */}
      {guest && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
          paddingBottom: 14, borderBottom: '1px solid var(--glass-border)',
        }}>
          <Avatar initials={initialsOf(fullName)} size={44} src={guest.photoUrl} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.25 }}>{fullName || '—'}</div>
            <div style={{ fontSize: 11.5, color: 'var(--ink-mute)' }}>{guest.email || '—'}</div>
            {guest.organization && (
              <div style={{ fontSize: 11.5, color: 'var(--ink-dim)', marginTop: 1 }}>{guest.organization}</div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            <ActionBtn icon="guests" label="View profile" onClick={goParticipation} />
            <ActionBtn icon="message" label="Message" onClick={goChat} />
            <ActionBtn icon="edit" label="Edit delegate" onClick={goParticipation} />
            <ActionBtn icon="badge" label="Accreditation" onClick={() => navigate('/accreditation')} />
          </div>
        </div>
      )}

      <Section icon="calendar" title="Events" count={events.length} empty="Not linked to an event">
        <div style={stack}>
          {events.map((ev) => (
            <RecordCard key={ev.eventGuestId} title={ev.eventTitle}>
              <Facts data={{
                Type: ev.eventType, Venue: ev.venueName,
                'Start date': ev.startDate, 'End date': ev.endDate,
                'Service level': ev.serviceLevelName,
                Invitation: ev.invitationStatus, Accreditation: ev.accreditationStatus,
                Arrival: ev.arrivalDate, Departure: ev.departureDate,
              }} />
            </RecordCard>
          ))}
        </div>
      </Section>

      <Section icon="meetings" title="Sessions" count={sessions.length} empty="No sessions">
        <div style={stack}>
          {sessions.map((s, i) => (
            <RecordCard key={s.id || i} icon="meetings" title={s.title} eventTitle={s.eventTitle}>
              <Facts data={{ Date: s.date, Time: s.time, Room: s.room, Speaker: s.speaker, Status: s.status || 'selected' }} />
            </RecordCard>
          ))}
        </div>
      </Section>

      <Section icon="flight" title="Flights" count={flights.length} empty="No flights booked">
        <div style={stack}>
          {flights.map((f) => (
            <RecordCard
              key={f.id}
              icon="flight"
              title={f.legs?.[0]?.flightNumber || 'Flight'}
              status={f.status === 'Confirmed' ? 'completed' : 'pending'}
              eventTitle={f.eventTitle}
            >
              <Facts data={{
                Type: f.flightType, Class: f.flightClass, Seat: f.seat,
                Departure: dt(f.departureTime), Arrival: dt(f.arrivalTime),
              }} />
              {f.legs?.length > 0 && (
                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {f.legs.map((leg, i) => (
                    <div key={i} style={{ fontSize: 11.5, color: 'var(--ink-dim)' }}>
                      {leg.flightNumber || 'Segment'} · {leg.departureCode || '—'}{leg.departureCity ? ` (${leg.departureCity})` : ''}
                      {' → '}
                      {leg.arrivalCode || '—'}{leg.arrivalCity ? ` (${leg.arrivalCity})` : ''}
                    </div>
                  ))}
                </div>
              )}
            </RecordCard>
          ))}
        </div>
      </Section>

      <Section icon="seating" title="Seatings" count={seatings.length} empty="No seat assigned">
        <div style={stack}>
          {seatings.map((s, i) => (
            <RecordCard key={i} icon="seating" title={s.seatCode} eventTitle={s.eventTitle}>
              <Facts data={{ Session: s.sessionTitle || 'Event-wide' }} />
            </RecordCard>
          ))}
        </div>
      </Section>

      <Section icon="hotel" title="Accommodations" count={accommodations.length} empty="No stay booked">
        <div style={stack}>
          {accommodations.map((a) => (
            <RecordCard key={a.id} icon="hotel" title={a.hotel || 'Accommodation'} eventTitle={a.eventTitle}>
              <Facts data={{ 'Room type': a.roomType, 'Check-in': a.checkIn, 'Check-out': a.checkOut }} />
            </RecordCard>
          ))}
        </div>
      </Section>

      <Section icon="car" title="Transport" count={transport.length} empty="No transport arranged">
        <div style={stack}>
          {transport.map((t) => (
            <RecordCard
              key={t.id}
              icon="car"
              title={t.vehicle || 'Transport'}
              status={t.tripStatus === 'On Time' ? 'completed' : 'pending'}
              eventTitle={t.eventTitle}
            >
              <Facts data={{
                Driver: t.driverName, Pickup: t.pickup, Dropoff: t.dropoff,
                'Pickup time': dt(t.pickupTime), Status: t.tripStatus,
              }} />
            </RecordCard>
          ))}
        </div>
      </Section>

      {/* Whatever the admin has configured beyond Flight/Accommodation/Transport
          — this section grows on its own as new services are created. */}
      <Section icon="star" title="Other services" count={otherServices.length} empty="None configured">
        <div style={stack}>
          {otherServices.map((s, i) => (
            <RecordCard
              key={`${s.serviceId}-${i}`}
              icon={s.icon || 'star'}
              title={s.name}
              status={s.status === 'completed' ? 'completed' : 'pending'}
              eventTitle={s.eventTitle}
            >
              {s.entries?.length > 0 ? (
                <div style={stack}>
                  {s.entries.map((e) => <Facts key={e.id} data={e.values} />)}
                </div>
              ) : (
                <div style={{ fontSize: 12, color: 'var(--ink-mute)' }}>
                  {s.isUnlocked ? 'Not yet arranged' : (s.lockedReason || 'Locked')}
                </div>
              )}
            </RecordCard>
          ))}
        </div>
      </Section>
    </div>
  );
}
