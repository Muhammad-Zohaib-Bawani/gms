// Shared travel step for the guest create/edit wizards.
// Renders three collapsible sections — Flight, Accommodation, Transport — each
// with an "include this" toggle. Only enabled sections are sent to the backend.
// Field names mirror the Travel_logistics columns exactly (the same table the
// Travel & Logistics "New Booking" flow writes to), except `roomTypeId`/
// `vehicleTypeId` which are UI-only — the entity stores both as plain name
// strings, so they're resolved to/from their lookup lists at the payload
// boundary below.
//
// State shape (held by the parent modal):
//   {
//     flight:        { enabled, flightNumber, flightTypeId, flightClassId,
//                       flightDate, flightDeparture, flightArrival },
//     accommodation: { enabled, hotelId, roomTypeId, hotelCheckIn, hotelCheckOut },
//     transport:     { enabled, vehicleTypeId, driverName, pickupLocationId,
//                      dropoffLocationId, pickupTime, estimatedArrival },
//   }
import React from 'react';
import { Icon } from '../../../components/Icons';
import Select from '../../../components/ui/Select';
import DateField from '../../../components/ui/DateField';

export const EMPTY_TRAVEL = {
  flight: {
    enabled: false,
    flightNumber: '', flightTypeId: '', flightClassId: '',
    flightDate: '', flightDeparture: '', flightArrival: '',
  },
  accommodation: {
    enabled: false,
    hotelId: '', roomTypeId: '', hotelCheckIn: '', hotelCheckOut: '',
  },
  transport: {
    enabled: false,
    vehicleTypeId: '', driverName: '', pickupLocationId: '', dropoffLocationId: '',
    pickupTime: '', estimatedArrival: '',
  },
};

// Merge a backend section into the empty defaults, coercing null → '' so the
// controlled inputs stay happy. Marks the section enabled if data came back.
function hydrateSection(defaults, data) {
  if (!data) return { ...defaults };
  const out = { ...defaults, enabled: true };
  for (const k of Object.keys(defaults)) {
    if (k === 'enabled') continue;
    const v = data[k];
    // datetime-local inputs want 'YYYY-MM-DDTHH:mm' — trim seconds/zone if present.
    if (v == null) out[k] = '';
    else if (typeof v === 'string' && v.includes('T')) out[k] = v.slice(0, 16);
    else out[k] = v;
  }
  return out;
}

// Build state from GET /travel/guest/{id} → { flight?, accommodation?, transport? }.
// `lookups.roomTypes`/`lookups.vehicleTypes` resolve the backend's plain-string
// RoomType/VehicleType back to the matching lookup id for the Select — falls
// back to blank if no match (a value saved by name only, then renamed/removed
// from the lookup, or otherwise no longer present in the list).
export function hydrateTravel(data, lookups = {}) {
  const accommodation = hydrateSection(EMPTY_TRAVEL.accommodation, data?.accommodation);
  const roomTypeId = (lookups.roomTypes || []).find((r) => r.name === data?.accommodation?.roomType)?.id || '';
  const transport = hydrateSection(EMPTY_TRAVEL.transport, data?.transport);
  const vehicleTypeId = (lookups.vehicleTypes || []).find((v) => v.name === data?.transport?.vehicleType)?.id || '';
  return {
    flight: hydrateSection(EMPTY_TRAVEL.flight, data?.flight),
    accommodation: { ...accommodation, roomTypeId },
    transport: { ...transport, vehicleTypeId },
  };
}

export const anyTravelEnabled = (t) =>
  !!(t.flight.enabled || t.accommodation.enabled || t.transport.enabled);

// Returns an error message for the first missing required field, or null if OK.
// Required = the selects marked `required` in the form (Flight Type, Hotel).
export function validateTravel(t, isAr = false) {
  if (t.flight.enabled && !t.flight.flightTypeId)
    return isAr ? 'نوع الرحلة مطلوب' : 'Flight Type is required';
  if (t.accommodation.enabled && !t.accommodation.hotelId)
    return isAr ? 'الفندق مطلوب' : 'Hotel is required';
  return null;
}

function cleanSection(sec) {
  const out = {};
  for (const [k, v] of Object.entries(sec)) {
    if (k === 'enabled') continue;
    if (v === '' || v == null) { out[k] = null; continue; }
    out[k] = v;
  }
  return out;
}

// Build the POST body — only the enabled sections, with the `enabled` flag
// stripped. Accommodation's `roomTypeId`/transport's `vehicleTypeId` are
// resolved to their lookup's name text, since those are the string columns
// the entity actually stores.
export function buildTravelPayload(travel, lookups = {}) {
  const body = {};
  if (travel.flight.enabled) body.flight = cleanSection(travel.flight);
  if (travel.accommodation.enabled) {
    const { roomTypeId, ...rest } = travel.accommodation;
    const roomType = (lookups.roomTypes || []).find((r) => r.id === roomTypeId)?.name || null;
    body.accommodation = { ...cleanSection(rest), roomType };
  }
  if (travel.transport.enabled) {
    const { vehicleTypeId, ...rest } = travel.transport;
    const vehicleType = (lookups.vehicleTypes || []).find((v) => v.id === vehicleTypeId)?.name || null;
    body.transport = { ...cleanSection(rest), vehicleType };
  }
  return body;
}

const inputStyle = {
  width: '100%', background: 'var(--surface-soft-3)', border: '1px solid var(--glass-border)',
  borderRadius: 8, padding: '9px 12px', color: 'var(--ink)', fontSize: 13,
};

const mapOpts = (arr, labelFn) => (arr || []).map((x) => ({ value: x.id, label: labelFn(x) }));

function Label({ children }) {
  return (
    <label style={{ display: 'block', fontSize: 10.5, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 5 }}>
      {children}
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
  arrivalDate, departureDate, onArrivalDateChange, onDepartureDateChange,
  dateMinDate, dateMaxDate, dateOpenTo,
  // Raw event start/end (no margin) — bounds every other travel date
  // (flight date, hotel check-in/out, pickup/est. arrival). Only Arrival
  // Date/Departure Date above get the wider dateMinDate/dateMaxDate margin.
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
    if (wasEnabled && section === 'flight') {
      onArrivalDateChange?.('');
      onDepartureDateChange?.('');
    }
  };

  const flightTypeOpts = mapOpts(lookups.flightTypes, (x) => x.name);
  const flightClassOpts = mapOpts(lookups.flightClasses, (x) => x.name);
  const roomTypeOpts = mapOpts(lookups.roomTypes, (x) => x.name);
  const vehicleTypeOpts = mapOpts(lookups.vehicleTypes, (x) => x.name);
  const hotelOpts = mapOpts(lookups.hotels, (x) => x.name);
  const locationOpts = mapOpts(lookups.locations, (x) => x.address);

  // ── field renderers (plain functions → stable element types, no focus loss) ──
  const txt = (section, key, label, { ph = '', type = 'text' } = {}) => (
    <div>
      <Label>{label}</Label>
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

  const date = (section, key, label, { minDate, maxDate } = {}) => (
    <div>
      <Label>{label}</Label>
      <DateField
        value={travel[section][key]}
        onChange={(v) => setField(section, key, v || '')}
        minDate={minDate}
        maxDate={maxDate}
        placeholder="YYYY-MM-DD"
      />
    </div>
  );

  const dt = (section, key, label, { minDate, maxDate } = {}) => (
    <div>
      <Label>{label}</Label>
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
        {grid(<>
          <div>
            <Label>{isAr ? 'تاريخ الوصول' : 'Arrival Date'}</Label>
            <DateField
              value={arrivalDate}
              onChange={onArrivalDateChange}
              minDate={dateMinDate}
              maxDate={dateMaxDate}
              openToDate={dateOpenTo}
              placeholder="YYYY-MM-DD"
            />
          </div>
          <div>
            <Label>{isAr ? 'تاريخ المغادرة' : 'Departure Date'}</Label>
            <DateField
              value={departureDate}
              onChange={onDepartureDateChange}
              minDate={arrivalDate || dateMinDate}
              maxDate={dateMaxDate}
              openToDate={dateOpenTo}
              placeholder="YYYY-MM-DD"
            />
          </div>
        </>)}
        {grid(<>
          {txt('flight', 'flightDeparture', isAr ? 'من' : 'From', { ph: 'DOH' })}
          {txt('flight', 'flightArrival', isAr ? 'إلى' : 'To', { ph: 'LHR' })}
        </>)}
        {grid(<>
          {sel('flight', 'flightTypeId', isAr ? 'نوع الرحلة' : 'Flight Type', flightTypeOpts, { required: true })}
          {sel('flight', 'flightClassId', isAr ? 'الدرجة' : 'Flight Class', flightClassOpts)}
        </>)}
        {grid(<>
          {txt('flight', 'flightNumber', isAr ? 'رقم الرحلة' : 'Flight No.', { ph: 'QR 512' })}
          {date('flight', 'flightDate', isAr ? 'تاريخ الرحلة' : 'Flight Date', { minDate: eventMinDate, maxDate: eventMaxDate })}
        </>)}
      </Section>

      <Section enabled={travel.accommodation.enabled} onToggle={() => toggle('accommodation')} icon="hotel" title={isAr ? 'الإقامة' : 'Accommodation'}>
        {grid(<>
          {sel('accommodation', 'hotelId', isAr ? 'الفندق' : 'Hotel', hotelOpts, { required: true })}
          {sel('accommodation', 'roomTypeId', isAr ? 'نوع الغرفة' : 'Room Type', roomTypeOpts)}
        </>)}
        {grid(<>
          {date('accommodation', 'hotelCheckIn', isAr ? 'تسجيل الوصول' : 'Check-in', { minDate: dateMinDate, maxDate: dateMaxDate })}
          {date('accommodation', 'hotelCheckOut', isAr ? 'تسجيل المغادرة' : 'Check-out', { minDate: travel.accommodation.hotelCheckIn || dateMinDate, maxDate: dateMaxDate })}
        </>)}
      </Section>

      <Section enabled={travel.transport.enabled} onToggle={() => toggle('transport')} icon="car" title={isAr ? 'النقل' : 'Transport'}>
        {grid(<>
          {sel('transport', 'pickupLocationId', isAr ? 'موقع الاستلام' : 'Pickup Location', locationOpts)}
          {sel('transport', 'dropoffLocationId', isAr ? 'موقع التوصيل' : 'Dropoff Location', locationOpts)}
        </>)}
        {grid(<>
          {sel('transport', 'vehicleTypeId', isAr ? 'نوع المركبة' : 'Vehicle Type', vehicleTypeOpts)}
          {txt('transport', 'driverName', isAr ? 'اسم السائق' : 'Driver Name')}
        </>)}
        {grid(<>
          {dt('transport', 'pickupTime', isAr ? 'وقت الاستلام' : 'Pickup Time', { minDate: dateMinDate, maxDate: dateMaxDate })}
          {dt('transport', 'estimatedArrival', isAr ? 'الوصول المتوقع' : 'Est. Arrival', { minDate: travel.transport.pickupTime || dateMinDate, maxDate: dateMaxDate })}
        </>)}
      </Section>
    </div>
  );
}
