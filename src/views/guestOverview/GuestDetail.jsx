// The expanded row: one guest, A–Z — fetched on demand from
// GET /v1/guest-overview/{id} so the list itself stays lightweight.
//
// One section per data source rather than one card per event: a guest here
// belongs to exactly one event (see GuestOverviewService), so grouping by
// event would just be an extra wrapper around the same content. Each section
// — Event, Sessions, Flights, Seatings, Accommodations, Transport, Other
// services — reads directly off the matching part of the API response.
import React, { useEffect, useState } from 'react';
import { Icon } from '../../components/Icons';
import { getGuestOverviewDetail } from '../../api/services/guestOverviewService';

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

/** A bordered record with an optional status chip in its header. */
function RecordCard({ title, status, children }) {
  return (
    <div style={{
      border: '1px solid var(--glass-border)',
      borderRadius: 10,
      padding: '11px 13px',
      background: 'var(--bg-0)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 9 }}>
        {title && <span style={{ fontSize: 12.5, fontWeight: 650 }}>{title}</span>}
        {status && (
          <span className={`chip ${status === 'completed' ? 'confirmed' : 'pending'}`} style={{ fontSize: 10 }}>
            <span className="dot" />
            {status === 'completed' ? 'Booked' : 'Pending'}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

const dt = (v) => v?.replace('T', ' ').slice(0, 16);

export default function GuestDetail({ guestId }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getGuestOverviewDetail(guestId)
      .then((d) => { if (!cancelled) setDetail(d); })
      .catch((err) => { if (!cancelled) setError(err?.message || 'Could not load this guest'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [guestId]);

  if (loading) {
    return <div style={{ padding: '18px 20px', fontSize: 12.5, color: 'var(--ink-mute)' }}>Loading…</div>;
  }
  if (error) {
    return <div style={{ padding: '18px 20px', fontSize: 12.5, color: 'var(--danger)' }}>{error}</div>;
  }
  if (!detail) return null;

  const {
    event, sessions = [], flights = [], accommodations = [],
    transport = [], seatings = [], otherServices = [],
  } = detail;

  const stack = { display: 'flex', flexDirection: 'column', gap: 8 };

  return (
    <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <Section icon="calendar" title="Event">
        {event ? (
          <RecordCard title={event.title}>
            <Facts data={{
              Type: event.type, Venue: event.venueName,
              'Start date': event.startDate, 'End date': event.endDate,
            }} />
          </RecordCard>
        ) : (
          <div style={{ fontSize: 12, color: 'var(--ink-faint)', fontStyle: 'italic' }}>Not linked to an event</div>
        )}
      </Section>

      <Section icon="meetings" title="Sessions" count={sessions.length} empty="No sessions">
        <div style={stack}>
          {sessions.map((s) => (
            <RecordCard key={s.id} title={s.title}>
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
              title={f.legs?.[0]?.flightNumber || 'Flight'}
              status={f.status === 'Confirmed' ? 'completed' : 'pending'}
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
            <RecordCard key={i} title={s.seatCode}>
              <Facts data={{ Session: s.sessionTitle || 'Event-wide' }} />
            </RecordCard>
          ))}
        </div>
      </Section>

      <Section icon="hotel" title="Accommodations" count={accommodations.length} empty="No stay booked">
        <div style={stack}>
          {accommodations.map((a) => (
            <RecordCard key={a.id} title={a.hotel || 'Accommodation'}>
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
              title={t.vehicle || 'Transport'}
              status={t.tripStatus === 'On Time' ? 'completed' : 'pending'}
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
          {otherServices.map((s) => (
            <RecordCard key={s.serviceId} title={s.name} status={s.status === 'completed' ? 'completed' : 'pending'}>
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
