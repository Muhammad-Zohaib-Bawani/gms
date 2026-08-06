import React, { useMemo } from 'react';
import { Icon } from '../../components/Icons';
import { fmtDate, fmtTime } from '../../lib/date';

// Fleet › Bookings, as a day × hour board: one row per date, one column per hour,
// each booking a chip in the hour it starts. The list answers "show me every
// booking"; this answers "what is happening at 09:00 on the 7th", which is the
// question a dispatcher actually has.
//
// Times are read by slicing the ISO string rather than through `new Date`: the
// API sends local wall-clock stamps with no offset, so parsing them would shift
// the hour a chip lands in whenever the browser's zone disagrees.

const DATE_W = 104;
const HOUR_W = 196;

const isoDate = (iso) => String(iso || '').slice(0, 10);
const isoHour = (iso) => Number(String(iso || '').slice(11, 13));

const headCell = {
  padding: '7px 10px', textAlign: 'center', fontWeight: 500,
  borderInlineStart: '1px solid var(--glass-border)',
  width: HOUR_W, minWidth: HOUR_W, boxSizing: 'border-box',
};

// The date column is sticky, so it has to be OPAQUE — every --surface-* token is
// a 3–8% tint, which lets the hour columns read straight through it while
// scrolling. Same recipe as the app's popovers: a near-solid base plus a blur.
const dateCell = {
  width: DATE_W, minWidth: DATE_W, boxSizing: 'border-box', padding: '8px 10px',
  position: 'sticky', insetInlineStart: 0, zIndex: 2, verticalAlign: 'top',
  background: 'linear-gradient(var(--surface-soft-2), var(--surface-soft-2)), var(--popover-bg)',
  backdropFilter: 'blur(8px)',
  borderInlineEnd: '1px solid var(--glass-border-strong)',
};

const slotCell = {
  width: HOUR_W, minWidth: HOUR_W, boxSizing: 'border-box',
  padding: 5, verticalAlign: 'top',
  borderInlineStart: '1px solid var(--glass-border)',
};

// Chip edge by trip status, so a board full of chips still separates "not started"
// from "running" from "done" without a legend lookup per chip.
const STATUS_TINT = {
  new: '#e0c47e',
  pending: '#e0c47e',
  assigned: '#8ab4f8',
  'in-progress': '#7ec9a5',
  arrived: '#7ec9a5',
  'in-transit': '#7ec9a5',
  completed: 'var(--ink-faint)',
};

const weekday = (iso, isAr) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString(isAr ? 'ar' : 'en-GB', { weekday: 'short' });

function Chip({ b, isAr }) {
  const tint = STATUS_TINT[(b.status || '').toLowerCase()] || 'var(--glass-border-strong)';
  const route = [b.pickup, b.dropoff].filter(Boolean).join(' → ');
  return (
    <div
      // Everything the chip has no room for: the guest, the provider, the status.
      title={[
        b.guestName,
        b.fleetProviderName,
        b.status,
        `${fmtTime(b.pickupTime)} → ${fmtTime(b.dropoffTime)}`,
      ].filter(Boolean).join(' · ')}
      style={{
        borderRadius: 8, padding: '6px 8px', marginBottom: 5,
        background: 'var(--surface-soft-2)',
        border: '1px solid var(--glass-border)',
        borderInlineStartWidth: 3, borderInlineStartStyle: 'solid', borderInlineStartColor: tint,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <Icon name="car" size={11} style={{ color: 'var(--ink-mute)', flexShrink: 0 }} />
        <span style={{ fontSize: 11.5, fontFamily: 'var(--mono)', fontWeight: 600 }}>
          {b.vehicleNumber || '—'}
        </span>
        <span style={{ fontSize: 10.5, fontFamily: 'var(--mono)', color: 'var(--ink-mute)',
          marginInlineStart: 'auto', direction: 'ltr' }}>
          {fmtTime(b.pickupTime)}→{fmtTime(b.dropoffTime)}
        </span>
      </div>

      <div style={{ fontSize: 11, marginTop: 3,
        color: b.driverName ? 'var(--ink-dim)' : '#e0c47e' }}>
        {/* A ride with no driver yet is the thing a dispatcher is scanning for, so
            it is called out rather than left blank. */}
        {b.driverName || (isAr ? 'لم يُعيَّن' : 'Unassigned')}
      </div>

      {route && (
        <div style={{ fontSize: 10.5, color: 'var(--ink-faint)', marginTop: 2,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {route}
        </div>
      )}
    </div>
  );
}

export default function FleetBookingsGrid({ rows, loading, isAr = false }) {
  // Dated bookings only. A booking with no pickup time has no cell to sit in —
  // counted and reported rather than dropped silently.
  const { days, hours, undated } = useMemo(() => {
    const all = rows || [];
    const byDate = new Map();
    let minH = 23;
    let maxH = 0;
    let placed = 0;

    all.forEach((b) => {
      if (!b.pickupTime) return;
      const d = isoDate(b.pickupTime);
      const h = isoHour(b.pickupTime);
      if (Number.isNaN(h)) return;
      placed += 1;
      minH = Math.min(minH, h);
      maxH = Math.max(maxH, h);
      const slots = byDate.get(d) || new Map();
      slots.set(h, [...(slots.get(h) || []), b]);
      byDate.set(d, slots);
    });

    // Only the hours in play get a column — a 24-column board for rides that all
    // happen between 07:00 and 19:00 is mostly empty scroll.
    const hourList = byDate.size
      ? Array.from({ length: maxH - minH + 1 }, (_, i) => minH + i)
      : [];

    return {
      days: [...byDate.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, slots]) => ({
          date,
          slots: new Map([...slots].map(([h, list]) => [
            h,
            [...list].sort((x, y) => String(x.pickupTime).localeCompare(String(y.pickupTime))),
          ])),
          count: [...slots.values()].reduce((n, l) => n + l.length, 0),
        })),
      hours: hourList,
      // Anything that couldn't be placed in a cell, whatever the reason.
      undated: all.length - placed,
    };
  }, [rows]);

  if (loading) {
    return <div style={{ padding: 28, textAlign: 'center', fontSize: 13, color: 'var(--ink-mute)' }}>
      {isAr ? 'جارٍ التحميل…' : 'Loading…'}
    </div>;
  }

  if (!days.length) {
    return (
      <div style={{ padding: 28, textAlign: 'center', fontSize: 13, color: 'var(--ink-mute)' }}>
        {undated > 0
          ? (isAr
            ? `${undated} حجز بدون وقت استلام — لا يمكن عرضها على الشبكة، استخدم القائمة`
            : `${undated} booking(s) have no pickup time, so the grid can't place them — use the list view`)
          : (isAr ? 'لا توجد حجوزات' : 'No bookings')}
      </div>
    );
  }

  return (
    <div>
      {/* The table scrolls, not the page — a full day of hour columns would
          otherwise push the whole layout sideways. */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: 'max-content', minWidth: '100%' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--glass-border)' }}>
              <th style={{ ...dateCell, textAlign: 'start', fontSize: 10.5, color: 'var(--ink-mute)',
                textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 500 }}>
                {isAr ? 'التاريخ' : 'Date'}
              </th>
              {hours.map((h) => (
                <th key={h} style={{ ...headCell, fontSize: 11.5, fontFamily: 'var(--mono)',
                  color: 'var(--ink-dim)', direction: 'ltr' }}>
                  {String(h).padStart(2, '0')}:00
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {days.map((d) => (
              <tr key={d.date} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                <td style={dateCell}>
                  <div style={{ fontSize: 10, color: 'var(--ink-mute)', textTransform: 'uppercase' }}>
                    {weekday(d.date, isAr)}
                  </div>
                  <div style={{ fontSize: 12.5, fontWeight: 600, direction: 'ltr' }}>{fmtDate(d.date)}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--ink-faint)' }}>
                    {d.count} {isAr ? 'حجز' : d.count === 1 ? 'ride' : 'rides'}
                  </div>
                </td>
                {hours.map((h) => (
                  <td key={h} style={slotCell}>
                    {(d.slots.get(h) || []).map((b) => <Chip key={b.id} b={b} isAr={isAr} />)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
        padding: '10px 14px', borderTop: '1px solid var(--glass-border)', fontSize: 11, color: 'var(--ink-mute)' }}>
        <span>{isAr ? 'كل عمود = ساعة البداية' : 'Each column is the hour a ride starts'}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 3, height: 12, borderRadius: 2, background: '#e0c47e' }} />
          {isAr ? 'لم تبدأ' : 'Not started'}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 3, height: 12, borderRadius: 2, background: '#7ec9a5' }} />
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
    </div>
  );
}
