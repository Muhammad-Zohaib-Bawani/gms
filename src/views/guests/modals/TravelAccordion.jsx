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
import React from 'react';
import { Icon } from '../../../components/Icons';
import Select from '../../../components/ui/Select';
import DateField from '../../../components/ui/DateField';

// `id` (a specific booking's public id) is populated only when hydrating an
// existing booking — see the module doc comment above. Saving with it set
// updates that exact booking in place; saving with it blank adds a new one.
export const EMPTY_LEG = {
  id: '', flightNumber: '', fromAirportId: '', toAirportId: '', startTime: '', endTime: '',
};

// A return booking is one flight with two legs (outbound + inbound); inbound and
// outbound are a single leg. LEG_COUNT is what the radio group enforces.
export const FLIGHT_LEG_COUNT = { inbound: 1, outbound: 1, return: 2 };

export const EMPTY_TRAVEL = {
  flight: {
    enabled: false, id: '',
    flightType: 'inbound', flightClassId: '', status: 'confirmed', seat: '',
    legs: [{ ...EMPTY_LEG }],
  },
  accommodation: {
    enabled: false, id: '',
    hotelId: '', roomTypeId: '', checkIn: '', checkOut: '',
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

// Build state from GET /travel/guest/{id} → { flight?, accommodation?, transport? }.
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

// Allowing the guest to book their own transport counts as something to save —
// it's the whole point of the toggle that it needs no booking alongside it.
export const anyTravelEnabled = (t) =>
  !!(t.flight.enabled || t.accommodation.enabled || t.transport.enabled || t.allowTransportRequest);

// Returns an error message for the first missing required field, or null if OK.
// A checked-but-empty section is what this guards against: once a section is
// enabled, its core identifying fields become required — fill them in, or
// uncheck the section to skip it entirely.
export function validateTravel(t, isAr = false) {
  if (t.flight.enabled) {
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
  if (t.accommodation.enabled) {
    if (!t.accommodation.hotelId) return isAr ? 'الفندق مطلوب' : 'Hotel is required';
    if (!t.accommodation.checkIn) return isAr ? 'تاريخ تسجيل الوصول مطلوب' : 'Check-in date is required';
    if (!t.accommodation.checkOut) return isAr ? 'تاريخ تسجيل المغادرة مطلوب' : 'Check-out date is required';
  }
  if (t.transport.enabled) {
    if (!t.transport.vehicleId) return isAr ? 'المركبة مطلوبة' : 'Vehicle is required';
    if (!t.transport.pickupLocationId) return isAr ? 'موقع الاستلام مطلوب' : 'Pickup location is required';
    if (!t.transport.dropoffLocationId) return isAr ? 'موقع التوصيل مطلوب' : 'Dropoff location is required';
    if (!t.transport.pickupTime) return isAr ? 'وقت الاستلام مطلوب' : 'Pickup time is required';
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

function cleanSection(sec, numericKeys = []) {
  const out = {};
  for (const [k, v] of Object.entries(sec)) {
    if (k === 'enabled') continue;
    if (v === '' || v == null) { out[k] = null; continue; }
    out[k] = numericKeys.includes(k) ? Number(v) : v;
  }
  return out;
}

// Build the POST body — only the enabled sections, with the `enabled` flag
// stripped. Every id field is sent as-is (already the real lookup public id).
export function buildTravelPayload(travel) {
  const body = {};
  if (travel.flight.enabled) {
    const { legs, ...rest } = travel.flight;
    body.flight = cleanSection(rest);
    body.flight.legs = (legs || []).map((l) => cleanSection(l));
    // Flights.DepartureTime / ArrivalTime — the booking-level copies of the
    // itinerary ends, so listings don't have to walk the legs.
    body.flight.departureTime = body.flight.legs[0]?.startTime ?? null;
    body.flight.arrivalTime = body.flight.legs.at(-1)?.endTime ?? null;
  }
  if (travel.accommodation.enabled) body.accommodation = cleanSection(travel.accommodation, ['guestCount']);
  if (travel.transport.enabled) body.transport = cleanSection(travel.transport);
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
                background: active ? 'rgba(141, 1, 52, 0.12)' : 'var(--surface-soft-3)',
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

      {grid2(<>
        <div>
          <Label>{isAr ? 'الدرجة' : 'Flight Class'}</Label>
          <Select value={flight.flightClassId} onChange={(v) => setFlight({ flightClassId: v })}
            options={flightClassOpts} placeholder={selPlaceholder} isClearable/>
        </div>
        <div>
          <Label>{isAr ? 'المقعد' : 'Seat'}</Label>
          <input style={inputStyle} placeholder="3A" value={flight.seat}
            onChange={(e) => setFlight({ seat: e.target.value })}/>
        </div>
      </>)}

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
              <Label>{isAr ? 'وقت الإقلاع' : 'Departure Time'} *</Label>
              <DateField value={leg.startTime} onChange={(v) => setLeg(i, 'startTime', v || '')}
                minDate={legs[i - 1]?.endTime || legs[i - 1]?.startTime || eventMinDate} maxDate={eventMaxDate}
                showTime placeholder="YYYY-MM-DD HH:mm"/>
            </div>
            <div>
              <Label>{isAr ? 'وقت الوصول' : 'Arrival Time'}</Label>
              <DateField value={leg.endTime} onChange={(v) => setLeg(i, 'endTime', v || '')}
                minDate={leg.startTime || eventMinDate} maxDate={eventMaxDate}
                showTime placeholder="YYYY-MM-DD HH:mm"/>
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
      background: checked ? 'rgba(141, 1, 52, 0.10)' : 'var(--surface-soft-3)',
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
}) {
  const selPlaceholder = isAr ? '— اختر —' : '— Select —';

  const setField = (section, key, value) =>
    onChange((p) => ({ ...p, [section]: { ...p[section], [key]: value } }));

  // Closing a section clears its fields rather than just hiding them — so
  // reopening it (or leaving it closed) never silently resubmits stale data.
  const toggle = (section) => {
    const wasEnabled = travel[section].enabled;
    onChange((p) => ({
      ...p,
      [section]: wasEnabled ? { ...EMPTY_TRAVEL[section] } : { ...p[section], enabled: true },
    }));
  };

  const roomTypeOpts = mapOpts(lookups.roomTypes, (x) => x.name);
  const vehicleOpts = mapOpts(lookups.vehicles, vehicleLabel);
  const hotelOpts = mapOpts(lookups.hotels, (x) => x.name);
  const locationOpts = mapOpts(lookups.locations, (x) => x.address);
  const driverOpts = mapOpts(lookups.drivers, driverLabel);

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

  const sel = (section, key, label, options, { required = false } = {}) => (
    <div>
      <Label>{label}{required ? ' *' : ''}</Label>
      <Select
        value={travel[section][key]}
        onChange={(v) => setField(section, key, v)}
        options={options}
        placeholder={selPlaceholder}
        isClearable={!required}
      />
    </div>
  );

  const date = (section, key, label, { minDate, maxDate, required = false } = {}) => (
    <div>
      <Label>{label}{required ? ' *' : ''}</Label>
      <DateField
        value={travel[section][key]}
        onChange={(v) => setField(section, key, v || '')}
        minDate={minDate}
        maxDate={maxDate}
        placeholder="YYYY-MM-DD"
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
        placeholder="YYYY-MM-DD HH:mm"
      />
    </div>
  );

  const grid = (children) => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>{children}</div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <Section enabled={travel.flight.enabled} onToggle={() => toggle('flight')} icon="flight" title={isAr ? 'الرحلة الجوية' : 'Flight'}>
        <FlightFields
          flight={travel.flight}
          setFlight={(patch) => onChange((p) => ({ ...p, flight: { ...p.flight, ...patch } }))}
          lookups={lookups}
          isAr={isAr}
          eventMinDate={eventMinDate}
          eventMaxDate={eventMaxDate}
        />
      </Section>

      <Section enabled={travel.accommodation.enabled} onToggle={() => toggle('accommodation')} icon="hotel" title={isAr ? 'الإقامة' : 'Accommodation'}>
        {grid(<>
          {sel('accommodation', 'hotelId', isAr ? 'الفندق' : 'Hotel', hotelOpts, { required: true })}
          {sel('accommodation', 'roomTypeId', isAr ? 'نوع الغرفة' : 'Room Type', roomTypeOpts)}
        </>)}
        {grid(<>
          {date('accommodation', 'checkIn', isAr ? 'تسجيل الوصول' : 'Check-in', { minDate: dateMinDate, maxDate: dateMaxDate, required: true })}
          {date('accommodation', 'checkOut', isAr ? 'تسجيل المغادرة' : 'Check-out', { minDate: travel.accommodation.checkIn || dateMinDate, maxDate: dateMaxDate, required: true })}
        </>)}
        {/* {grid(<>
          {txt('accommodation', 'roomView', isAr ? 'إطلالة الغرفة' : 'Room View', { ph: isAr ? 'إطلالة بحرية' : 'Sea view' })}
          {txt('accommodation', 'guestCount', isAr ? 'عدد النزلاء' : 'Guest Count', { type: 'number' })}
        </>)}
        {grid(<>
          {txt('accommodation', 'conciergeName', isAr ? 'اسم الكونسيرج' : 'Concierge Name')}
          {txt('accommodation', 'conciergePhone', isAr ? 'هاتف الكونسيرج' : 'Concierge Phone')}
        </>)} */}
      </Section>

      <Section enabled={travel.transport.enabled} onToggle={() => toggle('transport')} icon="car" title={isAr ? 'النقل' : 'Transport'}>
        {/* Guest-level permission, not part of this booking — kept in `travel`
            root state (not travel.transport), so unticking the section afterwards
            clears the booking fields but keeps the permission. */}
        <CheckRow
          checked={!!travel.allowTransportRequest}
          onChange={(v) => onChange((p) => ({ ...p, allowTransportRequest: v }))}
          label={isAr ? 'السماح للضيف بطلب النقل من التطبيق' : 'Allow guest to book transport themselves'}
          hint={isAr
            ? 'يمكن للضيف طلب سيارة من التطبيق حتى بدون حجز نقل هنا'
            : 'Guest can request a car from the app, even with no transport booked here'}
        />

        {grid(<>
          {sel('transport', 'pickupLocationId', isAr ? 'موقع الاستلام' : 'Pickup Location', locationOpts, { required: true })}
          {sel('transport', 'dropoffLocationId', isAr ? 'موقع التوصيل' : 'Dropoff Location', locationOpts, { required: true })}
        </>)}
        {grid(<>
          {sel('transport', 'vehicleId', isAr ? 'المركبة' : 'Vehicle', vehicleOpts)}
          {sel('transport', 'driverId', isAr ? 'السائق' : 'Driver', driverOpts)}
        </>)}
        {grid(<>
          {dt('transport', 'pickupTime', isAr ? 'وقت الاستلام' : 'Pickup Time', { minDate: dateMinDate, maxDate: dateMaxDate, required: true })}
          {dt('transport', 'dropoffTime', isAr ? 'وقت التوصيل' : 'Dropoff Time', { minDate: travel.transport.pickupTime || dateMinDate, maxDate: dateMaxDate })}
        </>)}
      </Section>
    </div>
  );
}
