// Shared travel step for the guest create/edit wizards.
// Renders three collapsible sections — Flight, Accommodation, Transport — each
// with an "include this" toggle. Only enabled sections are sent to the backend.
//
// State shape (held by the parent modal):
//   {
//     flight:        { enabled, flightTypeId, flightClassId, flightNumber, startTime, endTime },
//     accommodation: { enabled, hotelId, roomTypeId, checkIn, checkOut },
//     transport:     { enabled, pickupLocationId, dropoffLocationId, vehicleType,
//                      pickupTime, estimatedArrival },
//   }
import React from 'react';
import { Icon } from '../../../components/Icons';
import Select from '../../../components/ui/Select';
import DateField from '../../../components/ui/DateField';

export const EMPTY_TRAVEL = {
  flight: {
    enabled: false,
    flightTypeId: '', flightClassId: '', flightNumber: '',
    startTime: '', endTime: '',
  },
  accommodation: {
    enabled: false,
    hotelId: '', roomTypeId: '', checkIn: '', checkOut: '',
  },
  transport: {
    enabled: false,
    pickupLocationId: '', dropoffLocationId: '', vehicleType: '',
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

// Build the POST body — only the enabled sections, with the `enabled` flag stripped.
export function buildTravelPayload(travel) {
  const body = {};
  if (travel.flight.enabled) body.flight = cleanSection(travel.flight);
  if (travel.accommodation.enabled) body.accommodation = cleanSection(travel.accommodation);
  if (travel.transport.enabled) body.transport = cleanSection(travel.transport);
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

export default function TravelAccordion({ travel, onChange, lookups = {}, isAr = false }) {
  const selPlaceholder = isAr ? '— اختر —' : '— Select —';

  const setField = (section, key, value) =>
    onChange((p) => ({ ...p, [section]: { ...p[section], [key]: value } }));

  const toggle = (section) =>
    onChange((p) => ({ ...p, [section]: { ...p[section], enabled: !p[section].enabled } }));

  const flightTypeOpts = mapOpts(lookups.flightTypes, (x) => x.name);
  const flightClassOpts = mapOpts(lookups.flightClasses, (x) => x.name);
  const roomTypeOpts = mapOpts(lookups.roomTypes, (x) => x.name);
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

  const date = (section, key, label) => (
    <div>
      <Label>{label}</Label>
      <DateField
        value={travel[section][key]}
        onChange={(v) => setField(section, key, v || '')}
        placeholder="YYYY-MM-DD"
      />
    </div>
  );

  const dt = (section, key, label) => (
    <div>
      <Label>{label}</Label>
      <DateField
        value={travel[section][key]}
        onChange={(v) => setField(section, key, v || '')}
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
          {sel('flight', 'flightTypeId', isAr ? 'نوع الرحلة' : 'Flight Type', flightTypeOpts, { required: true })}
          {sel('flight', 'flightClassId', isAr ? 'الدرجة' : 'Flight Class', flightClassOpts)}
        </>)}
        {grid(<>
          {txt('flight', 'flightNumber', isAr ? 'رقم الرحلة' : 'Flight No.', { ph: 'QR 512' })}
          <div />
        </>)}
        {grid(<>
          {dt('flight', 'startTime', isAr ? 'وقت المغادرة' : 'Departure Time')}
          {dt('flight', 'endTime', isAr ? 'وقت الوصول' : 'Arrival Time')}
        </>)}
      </Section>

      <Section enabled={travel.accommodation.enabled} onToggle={() => toggle('accommodation')} icon="hotel" title={isAr ? 'الإقامة' : 'Accommodation'}>
        {grid(<>
          {sel('accommodation', 'hotelId', isAr ? 'الفندق' : 'Hotel', hotelOpts, { required: true })}
          {sel('accommodation', 'roomTypeId', isAr ? 'نوع الغرفة' : 'Room Type', roomTypeOpts)}
        </>)}
        {grid(<>
          {date('accommodation', 'checkIn', isAr ? 'تسجيل الوصول' : 'Check-in')}
          {date('accommodation', 'checkOut', isAr ? 'تسجيل المغادرة' : 'Check-out')}
        </>)}
      </Section>

      <Section enabled={travel.transport.enabled} onToggle={() => toggle('transport')} icon="car" title={isAr ? 'النقل' : 'Transport'}>
        {grid(<>
          {sel('transport', 'pickupLocationId', isAr ? 'موقع الاستلام' : 'Pickup Location', locationOpts)}
          {sel('transport', 'dropoffLocationId', isAr ? 'موقع التوصيل' : 'Dropoff Location', locationOpts)}
        </>)}
        {grid(<>
          {txt('transport', 'vehicleType', isAr ? 'نوع المركبة' : 'Vehicle Type')}
          <div />
        </>)}
        {grid(<>
          {dt('transport', 'pickupTime', isAr ? 'وقت الاستلام' : 'Pickup Time')}
          {dt('transport', 'estimatedArrival', isAr ? 'الوصول المتوقع' : 'Est. Arrival')}
        </>)}
      </Section>
    </div>
  );
}
