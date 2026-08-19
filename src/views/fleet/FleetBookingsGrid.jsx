import React, { useMemo, useState } from 'react';
import { Icon } from '../../components/Icons';
import { StatusChip } from '../../components/UI';
import GuestCell from '../../components/GuestCell';
import Modal from '../../components/ui/Modal';
import { fmtTime, fmtDate } from '../../lib/date';

// Same TripStatus codes as FleetBookingsView's table (Core/Constants/TransportStatuses.cs).
const STATUS_LABEL = {
  new: { en: 'New', ar: 'جديد' },
  pending: { en: 'Pending', ar: 'قيد الانتظار' },
  assigned: { en: 'Assigned', ar: 'مُعيَّن' },
  'in-progress': { en: 'En Route', ar: 'في الطريق' },
  arrived: { en: 'At Pickup', ar: 'وصل للاستلام' },
  'in-transit': { en: 'In Transit', ar: 'في الرحلة' },
  completed: { en: 'Completed', ar: 'مكتمل' },
};

// Fleet › Bookings, as a driver × hour board for ONE day: one row per driver, one
// column per hour of the clock, every hour a booking occupies painted in that
// booking's status colour. The list answers "show me every booking"; this answers
// "who is free at 14:00", which is the question a dispatcher actually has.
//
// A booking fills only the MINUTES it actually takes, not the whole hour column:
// an 09:00–09:30 ride is half a cell, 09:15–09:45 is the middle half. Rounding it
// up to the hour is what made the board read as "this driver is busy all morning"
// when they had three quarters of it free.
//
// Times are read by slicing the ISO string rather than through `new Date`: the
// API sends local wall-clock stamps with no offset, so parsing them would shift
// the hour a chip lands in whenever the browser's zone disagrees.

const DRIVER_W = 168;
const HOUR_W = 62;
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const UNASSIGNED = '__unassigned';
const DAY_MINUTES = 24 * 60;
// Under this share of an hour there is no room for the vehicle number, so the
// bar carries no label and the tooltip is the only detail.
const LABEL_MIN_SHARE = 0.5;

/** Minutes since midnight off a local 'YYYY-MM-DDTHH:mm' stamp, or NaN. */
const isoMinutes = (iso) => {
  const s = String(iso || '');
  const h = Number(s.slice(11, 13));
  const m = Number(s.slice(14, 16));
  return Number.isNaN(h) || Number.isNaN(m) ? NaN : h * 60 + m;
};

const headCell = {
  padding: '7px 4px', textAlign: 'center', fontWeight: 500,
  borderInlineStart: '1px solid var(--glass-border)',
  width: HOUR_W, minWidth: HOUR_W, boxSizing: 'border-box',
};

// The driver column is sticky, so it has to be OPAQUE — every --surface-* token is
// a 3–8% tint, which lets the hour columns read straight through it while
// scrolling. Same recipe as the app's popovers: a near-solid base plus a blur.
const driverCell = {
  width: DRIVER_W, minWidth: DRIVER_W, boxSizing: 'border-box', padding: '8px 10px',
  position: 'sticky', insetInlineStart: 0, zIndex: 2, verticalAlign: 'middle',
  background: 'linear-gradient(var(--surface-soft-2), var(--surface-soft-2)), var(--popover-bg)',
  backdropFilter: 'blur(8px)',
  borderInlineEnd: '1px solid var(--glass-border-strong)',
};

// Relative + unpadded: the bars inside are positioned by their minute offset, so
// they measure against the cell's full width and any padding would skew it.
const slotCell = {
  width: HOUR_W, minWidth: HOUR_W, boxSizing: 'border-box',
  height: 46, padding: 0, position: 'relative',
  borderInlineStart: '1px solid var(--glass-border)',
};

// Slot fill by trip status, so a board full of colour still separates "not started"
// from "running" from "done" without a legend lookup per slot.
const STATUS_TINT = {
  new: '#e0c47e',
  pending: '#e0c47e',
  assigned: '#8ab4f8',
  'in-progress': '#7ec9a5',
  arrived: '#7ec9a5',
  'in-transit': '#7ec9a5',
  completed: 'var(--ink-faint)',
};

const tintOf = (b) => STATUS_TINT[(b.status || '').toLowerCase()] || 'var(--glass-border-strong)';

// A booked slot: solid-ish fill in the status colour, spanning only the minutes
// [from, to) of its hour — so half an hour is half a cell. The vehicle number
// shows only in the hour the ride starts, so a 3-hour ride reads as one bar
// rather than three labels, and only when the bar is wide enough to hold it.
//
// `index`/`count` split the cell vertically when two rides overlap in the same
// hour — a real double-booking, which has to stay visible rather than hide one
// behind the other.
function Slot({ b, from, to, start, isAr, index = 0, count = 1, onOpen }) {
  const tint = tintOf(b);
  const share = (to - from) / 60;
  return (
    <div
      // Everything the slot has no room for — click opens the full detail.
      title={[
        b.vehicleModel,
        b.driverName || (isAr ? 'لم يُعيَّن' : 'Unassigned'),
        b.guestName,
        b.fleetProviderName,
        b.status,
        `${fmtTime(b.pickupTime)} → ${fmtTime(b.dropoffTime)}`,
        [b.pickup, b.dropoff].filter(Boolean).join(' → '),
      ].filter(Boolean).join(' · ')}
      onClick={() => onOpen?.(b)}
      style={{
        position: 'absolute',
        insetInlineStart: `${(from / 60) * 100}%`,
        width: `${share * 100}%`,
        top: `calc(${(index / count) * 100}% + 2px)`,
        height: `calc(${100 / count}% - 4px)`,
        borderRadius: 5, padding: '2px 3px', boxSizing: 'border-box',
        display: 'grid', placeItems: 'center', overflow: 'hidden',
        cursor: 'pointer',
        background: `color-mix(in srgb, ${tint} 26%, transparent)`,
        borderInlineStart: start ? `3px solid ${tint}` : undefined,
      }}
    >
      {start && share >= LABEL_MIN_SHARE && (
        <>
          <div style={{ fontSize: 10.5, fontFamily: 'var(--mono)', fontWeight: 600,
            maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {b.vehicleModel || '—'}
          </div>
          <div style={{ fontSize: 9.5, fontFamily: 'var(--mono)', color: 'var(--ink-mute)', direction: 'ltr' }}>
            {b.guestName}
          </div>
        </>
      )}
    </div>
  );
}

function DetailRow({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 3 }}>
        {label}
      </div>
      <div style={{ fontSize: 13, color: 'var(--ink)' }}>{value || '—'}</div>
    </div>
  );
}

function BookingDetailModal({ booking, onClose, isAr }) {
  if (!booking) return null;
  const code = (booking.status || '').toLowerCase();
  return (
    <Modal
      open
      onClose={onClose}
      title={isAr ? 'تفاصيل الحجز' : 'Booking details'}
      width={460}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 10 }}>
        <GuestCell name={booking.guestName} email={booking.guestEmail} photoUrl={booking.guestPhotoUrl} size={36} />
        <StatusChip status={code} label={STATUS_LABEL[code]?.[isAr ? 'ar' : 'en'] || booking.status || '—'} />
      </div>

      <div style={{ fontSize: 11.5, color: 'var(--ink-mute)', fontFamily: 'var(--mono)', marginBottom: 16 }}>
        {fmtDate(booking.pickupTime)} · {fmtTime(booking.pickupTime)} → {fmtTime(booking.dropoffTime)}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 16px' }}>
        <DetailRow label={isAr ? 'المركبة' : 'Vehicle'} value={[booking.vehicleModel, booking.vehicleNumber].filter(Boolean).join(' · ')} />
        <DetailRow label={isAr ? 'المزوّد' : 'Provider'} value={booking.fleetProviderName} />
        <DetailRow label={isAr ? 'السائق' : 'Driver'} value={booking.driverName || (isAr ? 'لم يُعيَّن' : 'Unassigned')} />
        <DetailRow label={isAr ? 'هاتف السائق' : 'Driver phone'} value={booking.driverPhone} />
        <DetailRow label={isAr ? 'الاستلام' : 'Pickup'} value={booking.pickup} />
        <DetailRow label={isAr ? 'التوصيل' : 'Dropoff'} value={booking.dropoff} />
      </div>
    </Modal>
  );
}

export default function FleetBookingsGrid({ rows, loading, isAr = false }) {
  const [selected, setSelected] = useState(null);
  // Timed bookings only. A booking with no pickup time has no cell to sit in —
  // counted and reported rather than dropped silently.
  const { drivers, undated } = useMemo(() => {
    const all = rows || [];
    const byDriver = new Map();
    let placed = 0;

    all.forEach((b) => {
      const startMin = isoMinutes(b.pickupTime);
      if (!b.pickupTime || Number.isNaN(startMin)) return;
      placed += 1;

      const key = b.driverId || (b.driverName ? `n:${b.driverName}` : UNASSIGNED);
      const row = byDriver.get(key)
        || { key, name: b.driverName || '', phone: b.driverPhone || '', slots: new Map(), count: 0 };
      row.count += 1;

      const h = Math.floor(startMin / 60);
      const endRaw = isoMinutes(b.dropoffTime);
      // No drop-off time (or one that isn't after the pickup) means the length is
      // unknown — fill the rest of that hour, which is what the board has always
      // shown, rather than invent a duration.
      const endMin = endRaw > startMin ? Math.min(DAY_MINUTES, endRaw) : (h + 1) * 60;

      // Paint every hour the ride occupies, not just the one it starts in — a
      // driver busy 09:00–12:00 is not free at 10:00. A ride ending exactly on
      // the hour contributes nothing to that hour, so it drops out here.
      const lastHour = Math.min(23, Math.ceil(endMin / 60) - 1);
      for (let x = h; x <= lastHour; x += 1) {
        const from = Math.max(0, startMin - x * 60);
        const to = Math.min(60, endMin - x * 60);
        if (to <= from) continue;
        row.slots.set(x, [...(row.slots.get(x) || []), { b, from, to, start: x === h }]);
      }
      byDriver.set(key, row);
    });

    return {
      // Unassigned first — it's the row a dispatcher is scanning for.
      drivers: [...byDriver.values()].sort((a, z) => {
        if (a.key === UNASSIGNED) return -1;
        if (z.key === UNASSIGNED) return 1;
        return a.name.localeCompare(z.name);
      }),
      undated: all.length - placed,
    };
  }, [rows]);

  if (loading) {
    return <div style={{ padding: 28, textAlign: 'center', fontSize: 13, color: 'var(--ink-mute)' }}>
      {isAr ? 'جارٍ التحميل…' : 'Loading…'}
    </div>;
  }

  if (!drivers.length) {
    return (
      <div style={{ padding: 28, textAlign: 'center', fontSize: 13, color: 'var(--ink-mute)' }}>
        {undated > 0
          ? (isAr
            ? `${undated} حجز بدون وقت استلام — لا يمكن عرضها على الشبكة، استخدم القائمة`
            : `${undated} booking(s) have no pickup time, so the grid can't place them — use the list view`)
          : (isAr ? 'لا توجد حجوزات في هذا اليوم' : 'No bookings on this day')}
      </div>
    );
  }

  return (
    <div>
      {/* The table scrolls, not the page — 24 hour columns would otherwise push
          the whole layout sideways. */}
      <div className="grid-scroll" style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: 'max-content', minWidth: '100%' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--glass-border)' }}>
              <th style={{ ...driverCell, textAlign: 'start', fontSize: 10.5, color: 'var(--ink-mute)',
                textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 500 }}>
                {isAr ? 'السائق' : 'Driver'}
              </th>
              {HOURS.map((h) => (
                <th key={h} style={{ ...headCell, fontSize: 10.5, fontFamily: 'var(--mono)',
                  color: 'var(--ink-dim)', direction: 'ltr' }}>
                  {String(h).padStart(2, '0')}:00
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {drivers.map((d) => (
              <tr key={d.key} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                <td style={driverCell}>
                  <div style={{ fontSize: 12.5, fontWeight: 600,
                    color: d.key === UNASSIGNED ? '#e0c47e' : undefined }}>
                    {d.name || (isAr ? 'لم يُعيَّن' : 'Unassigned')}
                  </div>
                  {d.phone && (
                    <div style={{ fontSize: 10.5, fontFamily: 'var(--mono)', color: 'var(--ink-mute)', direction: 'ltr' }}>
                      {d.phone}
                    </div>
                  )}
                  <div style={{ fontSize: 10.5, color: 'var(--ink-faint)' }}>
                    {d.count} {isAr ? 'حجز' : d.count === 1 ? 'ride' : 'rides'}
                  </div>
                </td>
                {HOURS.map((h) => {
                  const items = d.slots.get(h) || [];
                  return (
                    <td key={h} style={slotCell}>
                      {items.map(({ b, from, to, start }, i) => (
                        <Slot key={b.id} b={b} from={from} to={to} start={start}
                          index={i} count={items.length} isAr={isAr} onOpen={setSelected} />
                      ))}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
        padding: '10px 14px', borderTop: '1px solid var(--glass-border)', fontSize: 11, color: 'var(--ink-mute)' }}>
        <span>
          {isAr
            ? 'عرض الشريط = مدة الحجز فعلياً — نصف الخانة يعني ٣٠ دقيقة'
            : 'Bar width is the actual duration — half a cell is 30 minutes'}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 12, height: 12, borderRadius: 3, background: '#e0c47e' }} />
          {isAr ? 'لم تبدأ' : 'Not started'}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 12, height: 12, borderRadius: 3, background: '#7ec9a5' }} />
          {isAr ? 'جارية' : 'Running'}
        </span>
        {/* Never hide a truncation: a board that quietly omitted rides would read
            as "these are all of them". */}
        {undated > 0 && (
          <span style={{ color: '#e0c47e' }}>
            <Icon name="alert" size={12} />{' '}
            {isAr
              ? `${undated} حجز بدون وقت استلام — يظهر في القائمة فقط`
              : `${undated} booking(s) have no pickup time — list view only`}
          </span>
        )}
      </div>

      <BookingDetailModal booking={selected} onClose={() => setSelected(null)} isAr={isAr} />
    </div>
  );
}
