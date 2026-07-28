// Shared travel step for the guest create/edit wizards, and reused by
// TravelView's "New Booking" + per-row Edit modals — one field set, wired
// straight to the real backend DTOs (Core/ViewModel/Travel/TravelModels.cs):
// FlightInput, AccommodationInput, TransportInput. roomTypeId/vehicleId
// are real lookup-table ids end to end (no more name-string resolution).
//
// State shape (held by the parent modal):
//   {
//     flight:        { enabled, flightTypeId, flightClassId, status, seat,
//                       flightNumber, fromAirportId, toAirportId, startTime, endTime },
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
export const EMPTY_TRAVEL = {
  flight: {
    enabled: false, id: '',
    flightTypeId: '', flightClassId: '', status: 'confirmed', seat: '',
    flightNumber: '', fromAirportId: '', toAirportId: '',
    startTime: '', endTime: '',
  },
  accommodation: {
    enabled: false, id: '',
    hotelId: '', roomTypeId: '', checkIn: '', checkOut: '',
    roomView: '', guestCount: '', conciergeName: '', conciergePhone: '',
  },
  transport: {
    enabled: false,
    pickupLocationId: '', dropoffLocationId: '', vehicleId: '', driverId: '',
    pickupTime: '', dropoffTime: '',
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
    // datetime fields want 'YYYY-MM-DDTHH:mm' — trim seconds/zone if present.
    if (v == null) out[k] = '';
    else if (typeof v === 'string' && v.includes('T')) out[k] = v.slice(0, 16);
    else out[k] = v;
  }
  return out;
}

// Build state from GET /travel/guest/{id} → { flight?, accommodation?, transport? }.
// roomTypeId/vehicleId/hotelId/flightTypeId/flightClassId/pickupLocationId/
// dropoffLocationId all come back as real lookup-table public ids already.
export function hydrateTravel(data) {
  return {
    flight: hydrateSection(EMPTY_TRAVEL.flight, data?.flight),
    accommodation: hydrateSection(EMPTY_TRAVEL.accommodation, data?.accommodation),
    transport: hydrateSection(EMPTY_TRAVEL.transport, data?.transport),
  };
}

export const anyTravelEnabled = (t) =>
  !!(t.flight.enabled || t.accommodation.enabled || t.transport.enabled);

// Returns an error message for the first missing required field, or null if OK.
// A checked-but-empty section is what this guards against: once a section is
// enabled, its core identifying fields become required — fill them in, or
// uncheck the section to skip it entirely.
export function validateTravel(t, isAr = false) {
  if (t.flight.enabled) {
    if (!t.flight.flightTypeId) return isAr ? 'نوع الرحلة مطلوب' : 'Flight Type is required';
    if (!t.flight.flightNumber?.trim()) return isAr ? 'رقم الرحلة مطلوب' : 'Flight number is required';
    if (!t.flight.fromAirportId) return isAr ? 'مطار المغادرة مطلوب' : 'Departure airport is required';
    if (!t.flight.toAirportId) return isAr ? 'مطار الوصول مطلوب' : 'Arrival airport is required';
    if (!t.flight.startTime) return isAr ? 'وقت الإقلاع مطلوب' : 'Departure time is required';
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
  if (travel.flight.enabled) body.flight = cleanSection(travel.flight);
  if (travel.accommodation.enabled) body.accommodation = cleanSection(travel.accommodation, ['guestCount']);
  if (travel.transport.enabled) body.transport = cleanSection(travel.transport);
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

  const flightTypeOpts = mapOpts(lookups.flightTypes, (x) => x.name);
  const flightClassOpts = mapOpts(lookups.flightClasses, (x) => x.name);
  const roomTypeOpts = mapOpts(lookups.roomTypes, (x) => x.name);
  const vehicleOpts = mapOpts(lookups.vehicles, vehicleLabel);
  const hotelOpts = mapOpts(lookups.hotels, (x) => x.name);
  const locationOpts = mapOpts(lookups.locations, (x) => x.address);
  const driverOpts = mapOpts(lookups.drivers, driverLabel);

  // Airports (GET /lookups/airports) back the flight From/To dropdowns —
  // fromAirportId/toAirportId store the airport's own id (not its code).
  const airportOpts = mapOpts(lookups.airports, (a) => `${a.code} — ${a.city}`);

  const flightStatusOpts = [
    { value: 'confirmed', label: isAr ? 'مؤكد' : 'Confirmed' },
    { value: 'pending', label: isAr ? 'قيد الانتظار' : 'Pending' },
  ];

  // ── field renderers (plain functions → stable element types, no focus loss) ──
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
        {grid(<>
          {sel('flight', 'fromAirportId', isAr ? 'من' : 'From', airportOpts, { required: true })}
          {sel('flight', 'toAirportId', isAr ? 'إلى' : 'To', airportOpts, { required: true })}
        </>)}
        {grid(<>
          {sel('flight', 'flightTypeId', isAr ? 'نوع الرحلة' : 'Flight Type', flightTypeOpts, { required: true })}
          {sel('flight', 'flightClassId', isAr ? 'الدرجة' : 'Flight Class', flightClassOpts)}
        </>)}
        {grid(<>
          {txt('flight', 'flightNumber', isAr ? 'رقم الرحلة' : 'Flight No.', { ph: 'QR 512', required: true })}
          {txt('flight', 'seat', isAr ? 'المقعد' : 'Seat', { ph: '3A' })}
        </>)}
        {grid(<>
          {dt('flight', 'startTime', isAr ? 'وقت الإقلاع' : 'Departure Time', { minDate: eventMinDate, maxDate: eventMaxDate, required: true })}
          {dt('flight', 'endTime', isAr ? 'وقت الوصول' : 'Arrival Time', { minDate: travel.flight.startTime || eventMinDate, maxDate: eventMaxDate })}
        </>)}
        {sel('flight', 'status', isAr ? 'حالة الحجز' : 'Booking Status', flightStatusOpts)}
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
