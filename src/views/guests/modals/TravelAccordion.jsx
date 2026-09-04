// Shared travel step for the guest create/edit wizards, and reused by
// TravelView's "New Booking" + per-row Edit modals — one field set, wired
// straight to the real backend DTOs (Core/ViewModel/Travel/TravelModels.cs):
// FlightInput, AccommodationInput, TransportInput. roomTypeId/vehicleId
// are real lookup-table ids end to end (no more name-string resolution).
//
// State shape (held by the parent modal):
//   {
//     flight:        { enabled, flightType, flightClassId, status, seat,
//                       legs: [{ id, flightNumber, fromAirportId, toAirportId,
//                                startTime, endTime }] },
//     accommodation: { enabled, hotelId, roomTypeId, checkIn, checkOut,
//                       roomView, guestCount, conciergeName, conciergePhone },
//     transport:     { enabled, pickupLocationId, dropoffLocationId, vehicleId,
//                       driverId, pickupTime, dropoffTime },
// Trip status and the actual pickup/dropoff times are dispatch-side only — the
// backend owns them, this form neither shows nor sends them.
//   }
import React, { useEffect } from 'react';
import { Icon } from '../../../components/Icons';
import Select from '../../../components/ui/Select';
import DateField from '../../../components/ui/DateField';
import DateRangeCalendar from '../../../components/ui/DateRangeCalendar';
import ImageField from '../../../components/ui/ImageField';
import { stripSasToken } from '../../../api/services/uploadService';
import { useAvailableVehicles, useAvailableDrivers } from '../../../lib/useAvailableVehicles';
import { useHotelRoomTypes, useRoomAvailability } from '../../../lib/useRoomInventory';
import { addDaysIso, fmtDate } from '../../../lib/date';

// `id` (a specific booking's public id) is populated only when hydrating an
// existing booking — see the module doc comment above. Saving with it set
// updates that exact booking in place; saving with it blank adds a new one.
// flightClassId/seat live per leg — a return booking's two legs can be on
// different fare classes/seats (e.g. Business outbound, Economy inbound).
export const EMPTY_LEG = {
  id: '', flightNumber: '', fromAirportId: '', toAirportId: '', startTime: '', endTime: '',
  flightClassId: '', seat: '',
};

// A return booking is one flight with two legs (outbound + inbound); inbound and
// outbound are a single leg. LEG_COUNT is what the radio group enforces.
export const FLIGHT_LEG_COUNT = { inbound: 1, outbound: 1, return: 2 };

export const EMPTY_TRAVEL = {
  flight: {
    enabled: false, id: '',
    flightType: 'inbound', flightClassId: '', status: 'confirmed', seat: '',
    // Ticket / boarding pass. A blob url from the upload endpoint, stored on
    // Flights.ImageUrl — see ImageField below.
    imageUrl: '',
    legs: [{ ...EMPTY_LEG }],
  },
  accommodation: {
    enabled: false, id: '',
    hotelId: '', roomTypeId: '', checkIn: '', checkOut: '',
    // Voucher or room photo, stored on Accommodations.ImageUrl. Not the hotel's
    // own picture — that lives on the hotel lookup.
    imageUrl: '',
    roomView: '', guestCount: '', conciergeName: '', conciergePhone: '',
  },
  transport: {
    enabled: false, id: '',
    pickupLocationId: '', dropoffLocationId: '', vehicleId: '', driverId: '',
    pickupTime: '', dropoffTime: '',
  },
  // Guest-level permission, deliberately outside `transport`: it applies with no
  // booking at all, and toggling a section clears that section's fields.
  // undefined = untouched → left out of the payload → backend leaves it alone.
  // That's what keeps TravelView's per-booking Edit modals (which rebuild state
  // from EMPTY_TRAVEL) from silently revoking it.
  allowTransportRequest: undefined,
};

// Merge a backend section into the empty defaults, coercing null → '' so the
// controlled inputs stay happy. Marks the section enabled if data came back.
// Also used for a single leg, which has no `enabled` flag of its own — hence
// the key check rather than always stamping one on.
function hydrateSection(defaults, data) {
  if (!data) return { ...defaults };
  const out = { ...defaults, ...('enabled' in defaults ? { enabled: true } : null) };
  for (const k of Object.keys(defaults)) {
    if (k === 'enabled') continue;
    const v = data[k];
    // datetime fields want 'YYYY-MM-DDTHH:mm' — trim seconds/zone if present.
    if (v == null) out[k] = '';
    else if (typeof v === 'string' && v.includes('T')) out[k] = v.slice(0, 16);
    else out[k] = v;
  }
  return out;
}

// Legs come back as an array of objects, so hydrateSection's scalar coercion
// can't touch them — normalised here instead, padded to the count the flight
// type needs so the form always has the right number of leg field sets.
function hydrateFlight(data) {
  const flight = hydrateSection(EMPTY_TRAVEL.flight, data);
  const type = (data?.flightType || 'inbound').toLowerCase();
  const legs = (data?.legs || []).map((l) => hydrateSection(EMPTY_LEG, l));
  // Bookings saved before class/seat moved to the leg only have the
  // booking-level value — show it on the first leg instead of blank.
  if (legs[0] && !legs[0].flightClassId && !legs[0].seat) {
    legs[0].flightClassId = flight.flightClassId;
    legs[0].seat = flight.seat;
  }
  flight.flightType = type;
  flight.legs = padLegs(legs, FLIGHT_LEG_COUNT[type] ?? 1);
  return flight;
}

// Exactly `count` legs: extra ones dropped, missing ones blank.
export function padLegs(legs, count) {
  const out = (legs || []).slice(0, count);
  while (out.length < count) out.push({ ...EMPTY_LEG });
  return out;
}

// Build state from GET /travel/guest/{eventGuestId} → { flight?, accommodation?, transport? }.
// roomTypeId/vehicleId/hotelId/flightClassId/pickupLocationId/dropoffLocationId
// all come back as real lookup-table public ids already; flightType is an enum code.
export function hydrateTravel(data) {
  return {
    flight: hydrateFlight(data?.flight),
    accommodation: hydrateSection(EMPTY_TRAVEL.accommodation, data?.accommodation),
    transport: hydrateSection(EMPTY_TRAVEL.transport, data?.transport),
    allowTransportRequest: !!data?.allowTransportRequest,
  };
}

const isBlank = (v) => v === '' || v == null;

/**
 * Has anything actually been typed into this section?
 *
 * An open-but-untouched section is "not added yet", not "added and invalid" —
 * that is what lets the guest wizard walk past a service the user intends to fill
 * in later, without a service being required at creation time. A section with
 * SOME fields filled is still validated in full: a half-booking is an error.
 *
 * Compared against the empty shape rather than tested for falsiness, because
 * flightType/status carry defaults that are not user input.
 */
export function sectionHasData(travel, key) {
  const sec = travel?.[key];
  const empty = EMPTY_TRAVEL[key];
  if (!sec || !empty) return false;

  return Object.keys(empty).some((k) => {
    if (k === 'enabled' || k === 'id') return false;
    if (k === 'legs') {
      return (sec.legs || []).some((leg) => Object.keys(EMPTY_LEG).some(
        (lk) => lk !== 'id' && !isBlank(leg?.[lk]) && leg[lk] !== EMPTY_LEG[lk],
      ));
    }
    return !isBlank(sec[k]) && sec[k] !== empty[k];
  });
}

/** Sections that will actually be saved: switched on AND filled in. */
const activeSections = (t) =>
  ['flight', 'accommodation', 'transport'].filter((k) => t?.[k]?.enabled && sectionHasData(t, k));

// Allowing the guest to book their own transport counts as something to save —
// it's the whole point of the toggle that it needs no booking alongside it.
export const anyTravelEnabled = (t) =>
  activeSections(t).length > 0 || !!t.allowTransportRequest;

// Returns an error message for the first missing required field, or null if OK.
// A PARTLY filled section is what this guards against: start one and its core
// fields become required. An untouched section is skipped entirely — nothing here
// forces a guest to be given travel at all.
//
// `only` narrows it to a single section ('flight' | 'accommodation' | 'transport'),
// so confirming one service's form doesn't report a problem in another's.
export function validateTravel(t, isAr = false, only = null) {
  const active = (key) => (!only || only === key) && t?.[key]?.enabled && sectionHasData(t, key);

  if (active('flight')) {
    if (!t.flight.flightType) return isAr ? 'نوع الرحلة مطلوب' : 'Flight Type is required';
    // Every leg is required in full — a return booking is only useful with both
    // halves filled in.
    const legs = t.flight.legs || [];
    for (let i = 0; i < legs.length; i++) {
      const leg = legs[i];
      const n = legs.length > 1 ? ` (${legTitle(t.flight.flightType, i, isAr)})` : '';
      if (!leg.flightNumber?.trim()) return (isAr ? 'رقم الرحلة مطلوب' : 'Flight number is required') + n;
      if (!leg.fromAirportId) return (isAr ? 'مطار المغادرة مطلوب' : 'Departure airport is required') + n;
      if (!leg.toAirportId) return (isAr ? 'مطار الوصول مطلوب' : 'Arrival airport is required') + n;
      if (!leg.startTime) return (isAr ? 'وقت الإقلاع مطلوب' : 'Departure time is required') + n;
    }
  }
  if (active('accommodation')) {
    if (!t.accommodation.hotelId) return isAr ? 'الفندق مطلوب' : 'Hotel is required';
    // Half a range is as unusable as none — the calendar leaves it that way
    // between the two clicks, so both are checked.
    if (!t.accommodation.checkIn || !t.accommodation.checkOut)
      return isAr ? 'ليالي الإقامة مطلوبة' : 'Pick the stay dates on the calendar';
    // A stay occupies the nights from check-in up to (not including) check-out, so
    // a same-day pair is zero nights — nothing to book a room for.
    if (t.accommodation.checkOut <= t.accommodation.checkIn)
      return isAr ? 'تاريخ المغادرة يجب أن يكون بعد الوصول' : 'Check-out must be after check-in';
  }
  if (active('transport')) {
    if (!t.transport.vehicleId) return isAr ? 'المركبة مطلوبة' : 'Vehicle is required';
    if (!t.transport.pickupLocationId) return isAr ? 'موقع الاستلام مطلوب' : 'Pickup location is required';
    if (!t.transport.dropoffLocationId) return isAr ? 'موقع التوصيل مطلوب' : 'Dropoff location is required';
    if (!t.transport.pickupTime) return isAr ? 'وقت الاستلام مطلوب' : 'Pickup time is required';
    // Required, not optional: the drop-off is what bounds the vehicle's busy
    // window, so without it the same car can be booked twice over.
    if (!t.transport.dropoffTime) return isAr ? 'وقت التوصيل مطلوب' : 'Dropoff time is required';
    if (t.transport.dropoffTime <= t.transport.pickupTime)
      return isAr ? 'وقت التوصيل يجب أن يكون بعد وقت الاستلام' : 'Dropoff time must be after the pickup time';
  }
  return null;
}

// Flights.FlightType enum codes → display label. Falls back to the raw code so
// a value the UI doesn't know still shows something.
const FLIGHT_TYPE_LABEL = {
  inbound: { en: 'Inbound', ar: 'قادمة' },
  outbound: { en: 'Outbound', ar: 'مغادرة' },
  return: { en: 'Return', ar: 'ذهاب وعودة' },
};

export const flightTypeLabel = (code, isAr = false) =>
  FLIGHT_TYPE_LABEL[code]?.[isAr ? 'ar' : 'en'] || code || '—';

// Which half of the trip a leg is, for labels. Only a return booking has two.
export function legTitle(type, i, isAr = false) {
  if (type === 'return') {
    return i === 0 ? (isAr ? 'مغادرة' : 'Outbound') : (isAr ? 'قادمة' : 'Inbound');
  }
  if (type === 'outbound') return isAr ? 'مغادرة' : 'Outbound';
  return isAr ? 'قادمة' : 'Inbound';
}

// `imageUrl` keeps its empty string rather than collapsing to null: the API reads
// null as "not sent, leave the stored image alone" and "" as an explicit clear, so
// removing an image has to survive this step as ''.
const KEEP_EMPTY = ['imageUrl'];

function cleanSection(sec, numericKeys = []) {
  const out = {};
  for (const [k, v] of Object.entries(sec)) {
    if (k === 'enabled') continue;
    if (v === '' || v == null) { out[k] = KEEP_EMPTY.includes(k) ? '' : null; continue; }
    out[k] = numericKeys.includes(k) ? Number(v) : v;
  }
  return out;
}

// Build the POST body — only the sections that were switched on AND filled in,
// with the `enabled` flag stripped. Every id field is sent as-is (already the real
// lookup public id). An untouched section is left out rather than POSTed empty.
export function buildTravelPayload(travel) {
  const body = {};
  const active = activeSections(travel);

  if (active.includes('flight')) {
    const { legs, ...rest } = travel.flight;
    body.flight = cleanSection(rest);
    body.flight.legs = (legs || []).map((l) => cleanSection(l));
    // Flights.DepartureTime / ArrivalTime — the booking-level copies of the
    // itinerary ends, so listings don't have to walk the legs.
    body.flight.departureTime = body.flight.legs[0]?.startTime ?? null;
    body.flight.arrivalTime = body.flight.legs.at(-1)?.endTime ?? null;
    // Booking-level FlightClassId/Seat are a "primary" copy mirrored from the
    // first leg — same pattern as departure/arrival time above — since class
    // and seat are now edited per leg (see FlightFields).
    body.flight.flightClassId = body.flight.legs[0]?.flightClassId ?? null;
    body.flight.seat = body.flight.legs[0]?.seat ?? null;
  }
  if (active.includes('accommodation')) body.accommodation = cleanSection(travel.accommodation, ['guestCount']);
  if (active.includes('transport')) body.transport = cleanSection(travel.transport);
  // Only when it was actually set — see EMPTY_TRAVEL.allowTransportRequest.
  if (typeof travel.allowTransportRequest === 'boolean')
    body.allowTransportRequest = travel.allowTransportRequest;
  return body;
}

const inputStyle = {
  width: '100%', background: 'var(--surface-soft-3)', border: '1px solid var(--glass-border)',
  borderRadius: 8, padding: '9px 12px', color: 'var(--ink)', fontSize: 13,
};

const mapOpts = (arr, labelFn) => (arr || []).map((x) => ({ value: x.id, label: labelFn(x) }));

// Driver rows come from GET /lookups/drivers (users with the driver role).
export const driverLabel = (d) =>
  d.fullName || [d.firstName, d.lastName].filter(Boolean).join(' ') || d.name || d.email || '—';

// Fleet rows come from GET /v1/vehicles — plate first, it's what dispatch uses.
export const vehicleLabel = (v) =>
  [v.vehicleNumber, v.vehicleModel].filter(Boolean).join(' · ') || '—';

function Label({ children }) {
  return (
    <label style={{ display: 'block', fontSize: 10.5, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 5 }}>
      {children}
    </label>
  );
}

const grid2 = (children) => (
  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>{children}</div>
);

// The flight field set, shared by the guest wizard's accordion and TravelView's
// per-booking Edit modal so both stay in step. `setFlight` takes a patch object.
export function FlightFields({ flight, setFlight, lookups = {}, isAr = false, eventMinDate, eventMaxDate }) {
  const selPlaceholder = isAr ? '— اختر —' : '— Select —';
  const flightTypes = lookups.flightTypes?.length
    ? lookups.flightTypes
    : [{ code: 'inbound', name: 'Inbound' }, { code: 'outbound', name: 'Outbound' }, { code: 'return', name: 'Return' }];
  const airportOpts = mapOpts(lookups.airports, (a) => `${a.code} — ${a.city}`);
  const flightClassOpts = mapOpts(lookups.flightClasses, (x) => x.name);
  const legs = flight.legs || [];

  // Switching type resizes the leg list — return grows to two, one-ways shrink
  // back to one (the second leg's data is dropped, not hidden).
  const pickType = (code) =>
    setFlight({ flightType: code, legs: padLegs(legs, FLIGHT_LEG_COUNT[code] ?? 1) });

  const setLeg = (i, key, value) =>
    setFlight({ legs: legs.map((l, idx) => (idx === i ? { ...l, [key]: value } : l)) });

  return (
    <>
      <div>
        <Label>{isAr ? 'نوع الرحلة' : 'Flight Type'} *</Label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {flightTypes.map((t) => {
            const active = flight.flightType === t.code;
            return (
              <label key={t.code} style={{
                display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
                padding: '7px 12px', borderRadius: 8, fontSize: 12.5,
                border: `1px solid ${active ? 'var(--accent)' : 'var(--glass-border)'}`,
                background: active ? 'hsl(var(--brand-hsl) / 0.12)' : 'var(--surface-soft-3)',
                color: active ? 'var(--accent)' : 'var(--ink-mute)',
              }}>
                <input type="radio" name="flightType" value={t.code} checked={active}
                  onChange={() => pickType(t.code)} style={{ accentColor: 'var(--accent)' }}/>
                {isAr ? (t.nameAr || t.name) : t.name}
              </label>
            );
          })}
        </div>
      </div>

      {legs.map((leg, i) => (
        <div key={i} style={{
          display: 'flex', flexDirection: 'column', gap: 12,
          ...(legs.length > 1 ? {
            border: '1px solid var(--glass-border)', borderRadius: 10, padding: 12,
          } : null),
        }}>
          {legs.length > 1 && (
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--accent)' }}>
              {legTitle(flight.flightType, i, isAr)}
            </div>
          )}
          {grid2(<>
            <div>
              <Label>{isAr ? 'من' : 'From'} *</Label>
              <Select value={leg.fromAirportId} onChange={(v) => setLeg(i, 'fromAirportId', v)}
                options={airportOpts} placeholder={selPlaceholder}/>
            </div>
            <div>
              <Label>{isAr ? 'إلى' : 'To'} *</Label>
              <Select value={leg.toAirportId} onChange={(v) => setLeg(i, 'toAirportId', v)}
                options={airportOpts} placeholder={selPlaceholder}/>
            </div>
          </>)}
          <div>
            <Label>{isAr ? 'رقم الرحلة' : 'Flight No.'} *</Label>
            <input style={inputStyle} placeholder="QR 512" value={leg.flightNumber}
              onChange={(e) => setLeg(i, 'flightNumber', e.target.value)}/>
          </div>
          {grid2(<>
            <div>
              <Label>{isAr ? 'الدرجة' : 'Flight Class'}</Label>
              <Select value={leg.flightClassId} onChange={(v) => setLeg(i, 'flightClassId', v)}
                options={flightClassOpts} placeholder={selPlaceholder} isClearable/>
            </div>
            <div>
              <Label>{isAr ? 'المقعد' : 'Seat'}</Label>
              <input style={inputStyle} placeholder="3A" value={leg.seat}
                onChange={(e) => setLeg(i, 'seat', e.target.value)}/>
            </div>
          </>)}
          {grid2(<>
            <div>
              <Label>{isAr ? 'وقت الإقلاع' : 'Departure Time'} *</Label>
              <DateField value={leg.startTime} onChange={(v) => setLeg(i, 'startTime', v || '')}
                minDate={legs[i - 1]?.endTime || legs[i - 1]?.startTime || eventMinDate} maxDate={eventMaxDate}
                showTime placeholder="DD-MM-YYYY HH:mm"/>
            </div>
            <div>
              <Label>{isAr ? 'وقت الوصول' : 'Arrival Time'}</Label>
              <DateField value={leg.endTime} onChange={(v) => setLeg(i, 'endTime', v || '')}
                minDate={leg.startTime || eventMinDate} maxDate={eventMaxDate}
                showTime placeholder="DD-MM-YYYY HH:mm"/>
            </div>
          </>)}
        </div>
      ))}
    </>
  );
}

// Opt-in row with a two-line label. Same box/check/accent treatment as the
// Section header's tick, so a checkbox inside a panel reads as the same control
// as the one on the panel itself — the native input is kept only for keyboard
// and screen readers (browsers won't style it to match).
function CheckRow({ checked, onChange, label, hint }) {
  return (
    <label style={{
      display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer',
      padding: '11px 12px', borderRadius: 8,
      border: `1px solid ${checked ? 'var(--accent)' : 'var(--glass-border)'}`,
      background: checked ? 'hsl(var(--brand-hsl) / 0.10)' : 'var(--surface-soft-3)',
      transition: 'border-color 0.15s ease, background 0.15s ease',
    }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        // Off-screen, not display:none — still focusable and announced.
        style={{ position: 'absolute', opacity: 0, width: 1, height: 1, margin: 0 }}
      />
      <div style={{
        width: 18, height: 18, borderRadius: 5, flexShrink: 0, marginTop: 1,
        display: 'grid', placeItems: 'center',
        border: `2px solid ${checked ? 'var(--accent)' : 'var(--glass-border)'}`,
        background: checked ? 'var(--accent)' : 'transparent',
      }}>
        {checked && <Icon name="check" size={10} style={{ color: '#fff' }} />}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: checked ? 600 : 400, color: 'var(--ink)' }}>{label}</div>
        {hint && (
          <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginTop: 2, lineHeight: 1.4 }}>{hint}</div>
        )}
      </div>
    </label>
  );
}

// Module scope on purpose: defining this inside TravelAccordion gives it a new
// component identity every render, so React remounts the whole section subtree
// (inputs included) on each keystroke → lost focus + jerky typing.
function Section({ enabled, onToggle, icon, title, children }) {
  return (
    <div style={{ border: `1px solid ${enabled ? 'var(--accent)' : 'var(--glass-border)'}`, borderRadius: 10, overflow: 'hidden', background: 'var(--surface-soft-2)' }}>
      <div
        onClick={onToggle}
        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', cursor: 'pointer' }}
      >
        <div style={{
          width: 18, height: 18, borderRadius: 5, flexShrink: 0, display: 'grid', placeItems: 'center',
          border: `2px solid ${enabled ? 'var(--accent)' : 'var(--glass-border)'}`,
          background: enabled ? 'var(--accent)' : 'transparent',
        }}>
          {enabled && <Icon name="check" size={10} style={{ color: '#fff' }} />}
        </div>
        <Icon name={icon} size={15} style={{ color: enabled ? 'var(--accent)' : 'var(--ink-mute)', flexShrink: 0 }} />
        <span style={{ fontSize: 13, fontWeight: enabled ? 600 : 400, flex: 1 }}>{title}</span>
        <Icon name={enabled ? 'chevronDown' : 'chevronRight'} size={14} style={{ color: 'var(--ink-mute)', flexShrink: 0 }} />
      </div>
      {enabled && (
        <div style={{ padding: '4px 14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {children}
        </div>
      )}
    </div>
  );
}

export default function TravelAccordion({
  travel, onChange, lookups = {}, isAr = false,
  dateMinDate, dateMaxDate,
  // Raw event start/end (no margin) — bounds the flight departure/arrival
  // datetimes. Hotel and transport dates use the wider dateMinDate/dateMaxDate.
  eventMinDate, eventMaxDate,
  // Narrows the vehicle dropdown to this event's fleet. Optional — omitting it
  // only means the whole fleet is offered.
  eventId,
  // Render only these sections ('flight' | 'accommodation' | 'transport'), with
  // no enable/disable chrome — the guest's service checklist already decided
  // which ones apply, so a checkbox there would just be a second answer to the
  // same question. Omit for the wizard's pick-what-you-want accordion.
  only,
}) {
  const selPlaceholder = isAr ? '— اختر —' : '— Select —';

  const pinned = only ? (Array.isArray(only) ? only : [only]) : null;

  // A pinned section is always on: nothing offers to turn it off, so leaving
  // `enabled` false would silently drop everything typed into it on save.
  useEffect(() => {
    if (!pinned) return;
    const off = pinned.filter((s) => travel[s] && !travel[s].enabled);
    if (off.length === 0) return;
    onChange((p) => off.reduce((acc, s) => ({ ...acc, [s]: { ...acc[s], enabled: true } }), p));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinned?.join(','), travel.flight.enabled, travel.accommodation.enabled, travel.transport.enabled]);

  const setField = (section, key, value) =>
    onChange((p) => ({
      ...p,
      [section]: {
        ...p[section],
        [key]: value,
        // Both of these move the room block the stay calendar is bounded by, so
        // dates picked against the old one no longer mean anything — and a room
        // type belongs to its hotel, so that goes with it too.
        ...(section === 'accommodation' && key === 'hotelId'
          ? { roomTypeId: '', checkIn: '', checkOut: '' } : {}),
        ...(section === 'accommodation' && key === 'roomTypeId'
          ? { checkIn: '', checkOut: '' } : {}),
      },
    }));

  // Closing a section clears its fields rather than just hiding them — so
  // reopening it (or leaving it closed) never silently resubmits stale data.
  const toggle = (section) => {
    const wasEnabled = travel[section].enabled;
    onChange((p) => ({
      ...p,
      [section]: wasEnabled ? { ...EMPTY_TRAVEL[section] } : { ...p[section], enabled: true },
    }));
  };

  // Room types narrow to the ones the event actually holds rooms of at the chosen
  // hotel; an unmanaged hotel falls back to the global list.
  const heldRoomTypes = useHotelRoomTypes({
    eventId,
    hotelId: travel.accommodation.enabled ? travel.accommodation.hotelId : '',
    fallback: lookups.roomTypes,
  });
  const roomTypeOpts = mapOpts(heldRoomTypes, (x) => x.name);

  // Per-night capacity for that hotel + room type: bounds the date pickers to the
  // held window and greys out nights with nothing left.
  const rooms = useRoomAvailability({
    eventId,
    hotelId: travel.accommodation.enabled ? travel.accommodation.hotelId : '',
    roomTypeId: travel.accommodation.enabled ? travel.accommodation.roomTypeId : '',
  });

  // Once both transport times are set, only cars actually free in that window are
  // offered — before that (or if the lookup fails) the full fleet is.
  const freeVehicles = useAvailableVehicles({
    pickupTime: travel.transport.enabled ? travel.transport.pickupTime : '',
    dropoffTime: travel.transport.enabled ? travel.transport.dropoffTime : '',
    eventId,
    excludeTransportId: travel.transport.id,
    fallback: lookups.vehicles,
  });
  const vehicleOpts = mapOpts(freeVehicles, vehicleLabel);

  // Same for drivers: a driver already on a ride in that window is not offered.
  const freeDrivers = useAvailableDrivers({
    pickupTime: travel.transport.enabled ? travel.transport.pickupTime : '',
    dropoffTime: travel.transport.enabled ? travel.transport.dropoffTime : '',
    excludeTransportId: travel.transport.id,
    fallback: lookups.drivers,
  });
  // The stay calendar is bounded by the room block for this hotel + room type, so
  // it has nothing to draw until both are chosen.
  const accommodationDatesReady = !!(travel.accommodation.hotelId && travel.accommodation.roomTypeId);

  const hotelOpts = mapOpts(lookups.hotels, (x) => x.name);
  const locationOpts = mapOpts(lookups.locations, (x) => x.address);
  const driverOpts = mapOpts(freeDrivers, driverLabel);

  // ── field renderers (plain functions → stable element types, no focus loss) ──
  // eslint-disable-next-line no-unused-vars
  const txt = (section, key, label, { ph = '', type = 'text', required = false } = {}) => (
    <div>
      <Label>{label}{required ? ' *' : ''}</Label>
      <input
        type={type}
        style={inputStyle}
        placeholder={ph}
        value={travel[section][key]}
        onChange={(e) => setField(section, key, e.target.value)}
      />
    </div>
  );

  const sel = (section, key, label, options, { required = false, disabled = false } = {}) => (
    <div>
      <Label>{label}{required ? ' *' : ''}</Label>
      <Select
        value={travel[section][key]}
        onChange={(v) => setField(section, key, v)}
        options={options}
        placeholder={selPlaceholder}
        isClearable={!required}
        isDisabled={disabled}
      />
    </div>
  );

  const dt = (section, key, label, { minDate, maxDate, required = false } = {}) => (
    <div>
      <Label>{label}{required ? ' *' : ''}</Label>
      <DateField
        value={travel[section][key]}
        onChange={(v) => setField(section, key, v || '')}
        minDate={minDate}
        maxDate={maxDate}
        showTime
        placeholder="DD-MM-YYYY HH:mm"
      />
    </div>
  );

  const grid = (children) => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>{children}</div>
  );

  // Optional attachment for the booking. The SAS token is stripped before it goes
  // into state: it expires within minutes, and the backend re-signs the bare URL
  // on every read (BlobSasMiddleware). '' clears it, which the API treats as an
  // explicit "remove" — null there would mean "leave whatever is stored".
  const image = (section, label, hint) => (
    <div>
      <Label>{label}</Label>
      <ImageField
        value={travel[section].imageUrl || ''}
        onChange={(url) => setField(section, 'imageUrl', stripSasToken(url) || '')}
        isAr={isAr}
      />
      <div style={{ fontSize: 11, color: 'var(--ink-faint)', marginTop: 4 }}>{hint}</div>
    </div>
  );

  // Pinned mode drops the collapsible chrome and renders the fields bare. A plain
  // function, not a component: an inline component would be a new element type on
  // every render and remount its children, losing focus mid-typing.
  const section = (key, icon, title, children) => {
    if (pinned && !pinned.includes(key)) return null;
    if (pinned) {
      return <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{children}</div>;
    }
    return (
      <Section enabled={travel[key].enabled} onToggle={() => toggle(key)} icon={icon} title={title}>
        {children}
      </Section>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {section('flight', 'flight', isAr ? 'الرحلة الجوية' : 'Flight', (<>
        <FlightFields
          flight={travel.flight}
          setFlight={(patch) => onChange((p) => ({ ...p, flight: { ...p.flight, ...patch } }))}
          lookups={lookups}
          isAr={isAr}
          eventMinDate={eventMinDate}
          eventMaxDate={eventMaxDate}
        />
        {image('flight',
          isAr ? 'صورة التذكرة' : 'Upload Itinerary' ,
          isAr
            ? 'اختياري — تذكرة أو بطاقة صعود الطائرة. صورة واضحة ومستوية أفضل لقراءة OCR، ويراها المندوب في التطبيق'
            : 'Optional — ticket or boarding pass.')}
      </>))}

      {section('accommodation', 'hotel', isAr ? 'الإقامة' : 'Accommodation', (<>
        {grid(<>
          {sel('accommodation', 'hotelId', isAr ? 'الفندق' : 'Hotel', hotelOpts, { required: true })}
          {/* Which room types exist at all depends on the hotel, and capacity is
              tracked per type — so there is nothing to offer until one is picked. */}
          {sel('accommodation', 'roomTypeId', isAr ? 'نوع الغرفة' : 'Room Type', roomTypeOpts, {
            required: rooms.managed,
            disabled: !travel.accommodation.hotelId,
          })}
        </>)}

        {/* One calendar instead of two date fields: the stay is a range, and which
            nights are free depends on the hotel + room type above — so the dates
            only appear once both are chosen, with the room block's window as the
            bounds and sold-out nights struck out. */}
        <div>
          <Label>{isAr ? 'ليالي الإقامة *' : 'Stay Dates *'}</Label>
          {!accommodationDatesReady ? (
            <div style={{
              padding: '14px 12px', borderRadius: 8, fontSize: 12, color: 'var(--ink-faint)',
              background: 'var(--surface-soft-2)', border: '1px dashed var(--glass-border)',
            }}>
              {isAr
                ? 'اختر الفندق ونوع الغرفة لعرض الليالي المتاحة'
                : 'Pick a hotel and room type to see the nights available'}
            </div>
          ) : (
            <>
              <DateRangeCalendar
                start={travel.accommodation.checkIn}
                end={travel.accommodation.checkOut}
                onChange={(checkIn, checkOut) => onChange((p) => ({
                  ...p, accommodation: { ...p.accommodation, checkIn, checkOut },
                }))}
                minDate={rooms.window?.min || dateMinDate}
                maxDate={rooms.window?.max || dateMaxDate}
                excludeDates={rooms.fullDates}
                // Check-out is the morning after the last night slept, so it may
                // fall one day past the window — and it can't reach past the first
                // sold-out night, which is what caps the stay.
                endMaxFor={(s) => rooms.firstFullAfter(s)
                  || (rooms.window && addDaysIso(rooms.window.max, 1))
                  || dateMaxDate}
                isAr={isAr}
              />
              <div style={{ fontSize: 11, color: 'var(--ink-faint)', marginTop: 6 }}>
                {(() => {
                  const { checkIn, checkOut } = travel.accommodation;
                  if (!checkIn) {
                    return isAr ? 'اختر ليلة الوصول' : 'Pick the check-in night';
                  }
                  if (!checkOut) {
                    return isAr ? 'اختر تاريخ المغادرة' : 'Now pick the check-out date';
                  }
                  const nights = Math.max(0, Math.round(
                    (new Date(`${checkOut}T00:00:00`) - new Date(`${checkIn}T00:00:00`)) / 86400000,
                  ));
                  const left = rooms.managed ? rooms.availableOn(checkIn) : null;
                  const stay = isAr
                    ? `${fmtDate(checkIn)} ← ${fmtDate(checkOut)} · ${nights} ليلة`
                    : `${fmtDate(checkIn)} → ${fmtDate(checkOut)} · ${nights} night${nights === 1 ? '' : 's'}`;
                  if (left === null) return stay;
                  return isAr
                    ? `${stay} · ${left} غرفة متاحة ليلة الوصول`
                    : `${stay} · ${left} room(s) left on the first night`;
                })()}
              </div>
            </>
          )}
        </div>
        {/* {grid(<>
          {txt('accommodation', 'roomView', isAr ? 'إطلالة الغرفة' : 'Room View', { ph: isAr ? 'إطلالة بحرية' : 'Sea view' })}
          {txt('accommodation', 'guestCount', isAr ? 'عدد النزلاء' : 'Guest Count', { type: 'number' })}
        </>)}
        {grid(<>
          {txt('accommodation', 'conciergeName', isAr ? 'اسم الكونسيرج' : 'Concierge Name')}
          {txt('accommodation', 'conciergePhone', isAr ? 'هاتف الكونسيرج' : 'Concierge Phone')}
        </>)} */}
        {image('accommodation',
          isAr ? 'صورة الحجز' : 'Upload Itinerary',
          isAr
            ? 'اختياري — قسيمة الحجز أو صورة الغرفة. صورة واضحة ومستوية أفضل لقراءة OCR، ويراها المندوب في التطبيق'
            : 'Optional — Upload itinerary')}
      </>))}

      {section('transport', 'car', isAr ? 'النقل' : 'Transport', (<>
        {/* Guest-level permission, not part of this booking — kept in `travel`
            root state (not travel.transport), so unticking the section afterwards
            clears the booking fields but keeps the permission. */}
        <CheckRow
          checked={!!travel.allowTransportRequest}
          onChange={(v) => onChange((p) => ({ ...p, allowTransportRequest: v }))}
          label={isAr ? 'السماح للمندوب بطلب النقل من التطبيق' : 'Allow delegate to book transport themselves'}
          hint={isAr
            ? 'يمكن للمندوب طلب سيارة من التطبيق حتى بدون حجز نقل هنا'
            : 'Delegate can request a car from the app, even with no transport booked here'}
        />

        {grid(<>
          {sel('transport', 'pickupLocationId', isAr ? 'موقع الاستلام' : 'Pickup Location', locationOpts, { required: true })}
          {sel('transport', 'dropoffLocationId', isAr ? 'موقع التوصيل' : 'Dropoff Location', locationOpts, { required: true })}
        </>)}
        {/* Times come first: the vehicle list below is filtered to what's free in
            that window, so picking a car before the times would offer the whole
            fleet and then quietly narrow it. */}
        {grid(<>
          {dt('transport', 'pickupTime', isAr ? 'وقت الاستلام' : 'Pickup Time', { minDate: dateMinDate, maxDate: dateMaxDate, required: true })}
          {dt('transport', 'dropoffTime', isAr ? 'وقت التوصيل' : 'Dropoff Time', { minDate: travel.transport.pickupTime || dateMinDate, maxDate: dateMaxDate, required: true })}
        </>)}
        {grid(<>
          {sel('transport', 'vehicleId', isAr ? 'المركبة' : 'Vehicle', vehicleOpts, { required: true })}
          {sel('transport', 'driverId', isAr ? 'السائق' : 'Driver', driverOpts)}
        </>)}
        {travel.transport.enabled && travel.transport.pickupTime && travel.transport.dropoffTime && (
          <div style={{ fontSize: 11, color: 'var(--ink-faint)' }}>
            {isAr
              ? 'المركبات المحجوزة في هذا الوقت مستثناة من القائمة'
              : 'Vehicles already booked in this window are left out of the list'}
          </div>
        )}
      </>))}
    </div>
  );
}














