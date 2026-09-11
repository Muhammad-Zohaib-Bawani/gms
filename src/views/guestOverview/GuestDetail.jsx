// The right-hand pane of Guest Overview: everything known about ONE PERSON.
//
// `personId` is Guest.PublicId. A person spans events, so the pane is scoped by
// ONE picker — the event — rather than being one flat run of sections that
// repeated an "event" caption on every card and left the reader to reassemble
// the relationship. There is deliberately no second picker for sessions: a
// session is not a scope the reader has to choose before seeing anything, it is
// just another card, and the seat card names the session it belongs to.
//
// The cards themselves are the guest-detail card family (views/guests/cards) —
// the same shell, type scale, status pills and pager the event-scoped guest page
// uses. Nothing is restyled here: a flight should look like a flight wherever
// you found the guest. Where a person holds several of the same thing, CardSlider
// shows one at a time with a pager in the card's header, so a card can't grow
// into a scroll wall and the grid keeps its row heights.
//
// Read-only by design. The only action is Message, and only for a role that may
// write in support chat: this screen exists to look a guest up, and every edit
// path already lives on the event-scoped guest page.
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../../components/Icons';
import { Avatar } from '../../components/UI';
import Select from '../../components/ui/Select';
import FlagIcon from '../../components/FlagIcon';
import { useAccess } from '../../auth/AccessContext';
import { getGuestOverviewDetail } from '../../api/services/guestOverviewService';
import { fmtDate as isoDate, fmtDateTime as isoDateTime } from '../../lib/date';
import { isConfirmed, isLocked, serviceStatusLabel } from '../../lib/serviceStatus';
import { makeFieldDisplay, serviceProps, lookupSourceKeys } from '../../lib/serviceValues';
import { loadLookupOptions } from '../../components/ui/lookupSources';
import {
  TYPE, GuestCard, CardHeader, CardDivider, FieldPair, StatusPill,
  CardSlider, GuestDetailSkeleton, SessionCard, SeatCard, HotelCard,
  TransportCard, FlightCard, ServiceCard,
} from '../guests/cards/GuestDetailCards';

// Portal-wide DD-MM-YYYY. Null (not a dash) when empty — the fact grid drops
// empties rather than printing a row of dashes.
const fmtDate = (v) => (v ? isoDate(v, null) : null);
const dt = (v) => (v ? isoDateTime(v, null) : null);

const initialsOf = (name) => {
  const p = (name || '').trim().split(/\s+/);
  return ((p[0]?.[0] || '') + (p[1]?.[0] || '')).toUpperCase() || '?';
};

const nightsBetween = (a, b) => {
  if (!a || !b) return 0;
  const ms = new Date(b) - new Date(a);
  return ms > 0 ? Math.round(ms / 86400000) : 0;
};

// A service entry's values arrive as an object, but tolerate the raw JSON
// string a few callers still hand back.
const valuesOf = (entry) => {
  const v = entry?.values;
  if (!v) return {};
  if (typeof v === 'string') { try { return JSON.parse(v) || {}; } catch { return {}; } }
  return v;
};

const factsOf = (data) => Object.entries(data || {})
  .filter(([, v]) => v != null && String(v).trim() !== '');

// ── Local pieces ──────────────────────────────────────────────────────────

/** The 46px subject tile SessionCard uses, with a cover image over the icon. */
function MediaTile({ src, icon }) {
  return (
    <div style={{
      width: 46, height: 46, flexShrink: 0, borderRadius: 14,
      position: 'relative', overflow: 'hidden',
      border: '1px solid var(--gc-border)', display: 'grid', placeItems: 'center',
    }}>
      <Icon name={icon} size={19} style={{ color: 'var(--gc-accent)' }} />
      {src && (
        <img
          src={src}
          alt=""
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          onError={(e) => { e.target.style.display = 'none'; }}
        />
      )}
    </div>
  );
}

/** Labelled values in the same grid the other cards use. */
function FactGrid({ data }) {
  const facts = factsOf(data);
  if (facts.length === 0) {
    return (
      <div style={{ fontSize: 12.5, color: 'var(--ink-faint)', padding: '6px 0' }}>
        Nothing recorded
      </div>
    );
  }
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(112px, 1fr))',
      gap: '13px 12px',
    }}>
      {facts.map(([label, value], i) => <FieldPair key={`${label}-${i}`} label={label} value={value} />)}
    </div>
  );
}

/**
 * A card that may hold several records. One shows at a time; the pager lands in
 * the card's header, so the nav sits top-right of the card it steps through.
 * An empty list still renders the header — a missing card would make the grid
 * reflow every time a guest happens to have no transport.
 */
function SliderCard({ items, icon, title, empty, render }) {
  if (!items || items.length === 0) {
    return (
      <GuestCard embedded>
        <CardHeader icon={icon} title={title} />
        <div style={{ fontSize: 12.5, color: 'var(--ink-faint)', padding: '6px 0' }}>{empty}</div>
      </GuestCard>
    );
  }
  return (
    <CardSlider items={items}>
      {(item, pager) => render(item, pager)}
    </CardSlider>
  );
}

export default function GuestDetail({ personId, guest }) {
  const navigate = useNavigate();
  const { canWrite } = useAccess();
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Which participation. The only scope the reader picks.
  const [eventKey, setEventKey] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setDetail(null);
    getGuestOverviewDetail(personId)
      .then((d) => { if (!cancelled) setDetail(d); })
      .catch((err) => { if (!cancelled) setError(err?.message || 'Could not load this guest'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [personId]);

  const events = useMemo(() => detail?.events || [], [detail]);

  // Default to the event the list row is describing (its most recent
  // participation), else the last one loaded. Re-runs per person.
  useEffect(() => {
    if (events.length === 0) { setEventKey(''); return; }
    const match = events.find((e) => e.eventId === guest?.eventId);
    setEventKey(String((match || events[events.length - 1]).eventGuestId));
  }, [events, guest?.eventId]);

  const ev = events.find((e) => String(e.eventGuestId) === eventKey) || null;

  // Child rows carry the event's TITLE and no id (see GuestOverviewModels — only
  // the event blocks have EventId), so the title is the only available join. Two
  // events named identically would pool their rows; that is a data-shape limit,
  // and the fix would be an EventId on each child row.
  const ofEvent = (rows) =>
    (ev ? (rows || []).filter((r) => (r.eventTitle || '') === (ev.eventTitle || '')) : []);

  const sessions = ofEvent(detail?.sessions);
  const seatings = ofEvent(detail?.seatings);
  const flights = ofEvent(detail?.flights);
  const stays = ofEvent(detail?.accommodations);
  const transport = ofEvent(detail?.transport);
  const services = ofEvent(detail?.otherServices);

  // One card steps through every service record the guest holds, whichever
  // service it belongs to — the header names the current one.
  const serviceItems = useMemo(() => services.flatMap((s) => (
    s.entries?.length ? s.entries.map((e) => ({ svc: s, entry: e })) : [{ svc: s, entry: null }]
  )), [services]);

  // A `lookup` field stores a row's PublicId, so naming it means fetching that
  // lookup's options. Only the sources this event's services actually use.
  const [lookups, setLookups] = useState({});
  const sourceKeys = useMemo(
    () => lookupSourceKeys(services.map((s) => s.form)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [services.map((s) => s.serviceId).join(','), eventKey],
  );

  useEffect(() => {
    if (sourceKeys.length === 0) return undefined;
    let cancelled = false;
    Promise.all(sourceKeys.map((k) => loadLookupOptions(k, { eventId: ev?.eventId }).then((o) => [k, o])))
      .then((pairs) => { if (!cancelled) setLookups(Object.fromEntries(pairs)); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [sourceKeys, ev?.eventId]);

  const display = useMemo(() => makeFieldDisplay(lookups, false), [lookups]);

  const fullName = `${guest?.firstName || ''} ${guest?.lastName || ''}`.trim();

  const grid = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: 16,
    alignItems: 'stretch',
  };

  if (loading) return <GuestDetailSkeleton embedded />;
  if (error) {
    return <div style={{ padding: 24, fontSize: 12.5, color: 'var(--danger)' }}>{error}</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* ── Personal ─────────────────────────────────────────────────────── */}
      <GuestCard>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', minWidth: 0 }}>
          <Avatar initials={initialsOf(fullName)} size={52} src={guest?.photoUrl} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ ...TYPE.headline, overflowWrap: 'anywhere' }}>{fullName || '—'}</div>
            <div style={{ ...TYPE.sub, overflowWrap: 'anywhere' }}>{guest?.email || '—'}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 7 }}>
              {guest?.nationalityName && (
                <span style={{ ...TYPE.sub, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <FlagIcon code={guest.nationalityCode} size={13} />
                  {guest.nationalityName}
                </span>
              )}
              {guest?.organization && <span style={TYPE.sub}>{guest.organization}</span>}
              {guest?.guestType && <span className="chip" style={{ fontSize: 10.5 }}>{guest.guestType}</span>}
              <span style={{ ...TYPE.sub, color: 'var(--ink-faint)' }}>
                {events.length} event{events.length === 1 ? '' : 's'}
              </span>
            </div>
          </div>
          {/* Scope + the one action, on the identity line. The event picker
              belongs here rather than in a strip of its own: it says which
              participation everything below is about, which is part of who you
              are looking at. */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            {events.length > 0 && (
              <div style={{ minWidth: 210 }}>
                <Select
                  value={eventKey}
                  onChange={(v) => setEventKey(v || '')}
                  options={events.map((e) => ({
                    value: String(e.eventGuestId),
                    label: e.eventTitle || 'Event',
                  }))}
                  isClearable={false}
                />
              </div>
            )}
            {canWrite('support-chat') && (
              <button
                className="btn"
                onClick={() => navigate('/support-chat', {
                  state: {
                    personId,
                    guestName: fullName,
                    guestOrganization: guest?.organization || '',
                  },
                })}
              >
                <Icon name="message" size={13} /> Message
              </button>
            )}
          </div>
        </div>
      </GuestCard>

      {events.length === 0 ? (
        <div style={{ ...TYPE.sub }}>This guest is not linked to an event.</div>
      ) : (
        <>
          {ev && (
            <div style={grid}>
              {/* The event itself. */}
              <GuestCard embedded>
                <CardHeader icon="calendar" title="Event">
                  <StatusPill status={ev.invitationStatus} label={ev.invitationStatus} />
                </CardHeader>
                <div style={{ display: 'flex', gap: 13, alignItems: 'flex-start', minWidth: 0 }}>
                  <MediaTile src={ev.imageUrl} icon="calendar" />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ ...TYPE.title, overflowWrap: 'anywhere' }}>{ev.eventTitle || 'Event'}</div>
                    <div style={{ ...TYPE.sub, overflowWrap: 'anywhere' }}>
                      {[ev.eventType, ev.venueName].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                </div>
                <CardDivider />
                <FactGrid data={{
                  'Start date': fmtDate(ev.startDate),
                  'End date': fmtDate(ev.endDate),
                  'Service level': ev.serviceLevelName,
                  Accreditation: ev.accreditationStatus,
                  Arrival: fmtDate(ev.arrivalDate),
                  Departure: fmtDate(ev.departureDate),
                }} />
              </GuestCard>

              {/* Sessions are a card, not a scope — the pager steps through
                  them with each one's own image, time and room. */}
              <SliderCard
                items={sessions}
                icon="meetings"
                title="Session"
                empty="No sessions."
                render={(s, pager) => (
                  <SessionCard
                    embedded
                    header={<CardHeader icon="meetings" title="Session">
                      <StatusPill status={s.status || 'selected'} label={s.status || 'Selected'} />
                      {pager}
                    </CardHeader>}
                    title={s.title || 'Session'}
                    category={s.speaker}
                    dateLabel={fmtDate(s.date)}
                    timeLabel={s.time}
                    venue={s.room}
                    imageUrl={s.imageUrl}
                  />
                )}
              />

              {/* One seats card for every seat the guest holds on this event.
                  Which session a seat is for is stated inside the card, which
                  is what removed the need to pick a session first — a seat with
                  no session is event-wide and says so. */}
              <SliderCard
                items={seatings}
                icon="seating"
                title="Seat"
                empty="No seat assigned."
                render={(s, pager) => (
                  <SeatCard
                    embedded
                    header={<CardHeader icon="seating" title="Seat">{pager}</CardHeader>}
                    seatCode={s.seatCode}
                    eventTitle={s.eventTitle}
                    sessionTitle={s.sessionTitle || 'Event-wide'}
                  />
                )}
              />

              <SliderCard
                    items={flights}
                    icon="flight"
                    title="Flight"
                    empty="No flight booked."
                    render={(f, pager) => (
                      <FlightCard
                        embedded
                        header={<CardHeader icon="flight" title={f.flightType || 'Flight'}>{pager}</CardHeader>}
                        status={f.status}
                        statusLabel={f.status}
                        legs={(f.legs?.length ? f.legs : [{}]).map((l, i) => ({
                          key: i,
                          fromCode: l.departureCode,
                          fromCity: l.departureCity,
                          toCode: l.arrivalCode,
                          toCity: l.arrivalCity,
                          dateTime: dt(l.startTime) || dt(f.departureTime),
                          flightNumber: l.flightNumber,
                          flightClass: l.flightClass || f.flightClass,
                        }))}
                      />
                    )}
                  />

                  <SliderCard
                    items={stays}
                    icon="hotel"
                    title="Accommodation"
                    empty="No stay booked."
                    render={(a, pager) => (
                      <HotelCard
                        embedded
                        header={<CardHeader icon="hotel" title="Accommodation">{pager}</CardHeader>}
                        hotel={a.hotel}
                        roomType={a.roomType}
                        checkIn={fmtDate(a.checkIn)}
                        checkOut={fmtDate(a.checkOut)}
                        nights={nightsBetween(a.checkIn, a.checkOut)}
                      />
                    )}
                  />

                  <SliderCard
                    items={transport}
                    icon="car"
                    title="Transport"
                    empty="No transport arranged."
                    render={(t, pager) => (
                      <TransportCard
                        embedded
                        header={<CardHeader icon="car" title="Transport">{pager}</CardHeader>}
                        pickup={t.pickup}
                        dropoff={t.dropoff}
                        pickupTime={dt(t.pickupTime)}
                        dropoffTime={dt(t.dropoffTime)}
                        vehicle={t.vehicle}
                        driver={t.driverName}
                        status={t.tripStatus}
                        statusLabel={t.tripStatus}
                      />
                    )}
                  />

                  {/* Grows on its own as new services are configured. */}
                  <SliderCard
                    items={serviceItems}
                    icon="star"
                    title="Other services"
                    empty="None configured."
                    render={({ svc, entry }, pager) => (
                      <ServiceCard
                        embedded
                        icon={svc.icon || 'star'}
                        header={<CardHeader icon={svc.icon || 'star'} title={svc.name || 'Service'}>
                          <StatusPill
                            status={isConfirmed(svc.status) ? 'confirmed' : (isLocked(svc.status) ? 'locked' : 'pending')}
                            label={serviceStatusLabel(svc.status)}
                          />
                          {pager}
                        </CardHeader>}
                        {...serviceProps(svc.form, valuesOf(entry), display, false)}
                        emptyText={isLocked(svc.status) || !svc.isUnlocked
                          ? (svc.lockedReason || 'Locked')
                          : 'Nothing recorded yet'}
                      />
                    )}
                  />
            </div>
          )}
        </>
      )}
    </div>
  );
}
