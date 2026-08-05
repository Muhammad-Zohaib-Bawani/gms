import React, { useMemo } from 'react';
import { Icon } from '../../components/Icons';

// Rooms held × nights. One column per night, one row per hotel + room type, with
// an all-hotels row on top — so "how many rooms exist on the 7th, how many are
// left, how many are taken" is one glance rather than three lookups.
//
// Every series shares the response's date axis, so the columns line up without
// the grid having to reconcile windows itself.

const CELL_W = 62;
const LABEL_W = 200;

// Tight, so a two-week event fits without the numbers colliding.
const cellBase = {
  width: CELL_W, minWidth: CELL_W, boxSizing: 'border-box',
  padding: '6px 4px', textAlign: 'center', borderInlineStart: '1px solid var(--glass-border)',
};
// The label column is sticky, so it has to be OPAQUE — every --surface-* token is
// a 3–8% tint, which let the night columns read straight through it while
// scrolling. Same recipe as the app's popovers (a near-solid base plus a blur),
// with the usual soft tint stacked on top so it still matches the rows.
const labelCell = {
  width: LABEL_W, minWidth: LABEL_W, boxSizing: 'border-box', padding: '6px 12px',
  position: 'sticky', insetInlineStart: 0, zIndex: 2,
  background: 'linear-gradient(var(--surface-soft-2), var(--surface-soft-2)), var(--popover-bg)',
  backdropFilter: 'blur(8px)',
  // Hard edge: mid-scroll the boundary between frozen and moving columns has to
  // be obvious, otherwise the two still read as one surface.
  borderInlineEnd: '1px solid var(--glass-border-strong)',
};

// Sold out reads red, nearly gone amber, the rest neutral. A night with nothing
// held AND nobody booked is blank — it was never on offer, so it isn't "full".
function tone(night) {
  if (night.available < 0) return { fg: '#e57373', bg: 'rgba(229,115,115,0.22)' };
  if (!night.total) return { fg: 'var(--ink-faint)', bg: 'transparent' };
  if (night.available <= 0) return { fg: '#e57373', bg: 'rgba(229,115,115,0.13)' };
  if (night.available <= Math.max(1, Math.floor(night.total * 0.25))) return { fg: '#e0c47e', bg: 'rgba(224,196,126,0.12)' };
  return { fg: 'var(--ink)', bg: 'transparent' };
}

const weekday = (iso, isAr) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString(isAr ? 'ar' : 'en-GB', { weekday: 'short' });
const dayMonth = (iso, isAr) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString(isAr ? 'ar' : 'en-GB', { day: '2-digit', month: 'short' });

function Cell({ night, isAr, strong = false }) {
  const { fg, bg } = tone(night);
  // Nothing held and nobody in it: blank. Nothing held but somebody in it is a
  // real overbooking, so it still shows (as a negative) rather than reading empty.
  const idle = !night.total && !night.booked;
  const title = isAr
    ? `${night.total} غرفة · ${night.booked} محجوزة · ${night.available} متاحة`
    : `${night.total} held · ${night.booked} booked · ${night.available} available`;
  return (
    <td style={{ ...cellBase, background: bg }} title={title}>
      <div style={{ fontSize: strong ? 14 : 13, fontWeight: strong ? 700 : 600, color: fg, lineHeight: 1.2, direction: 'ltr' }}>
        {idle ? '—' : night.available}
      </div>
      {!idle && (
        <div style={{ fontSize: 10, color: 'var(--ink-mute)', direction: 'ltr' }}>
          {night.booked}/{night.total}
        </div>
      )}
    </td>
  );
}

// Column-wise sum of a set of series. All series share one date axis, so index i
// is the same night in every one of them.
function sumNights(rows) {
  const out = [];
  rows.forEach((r) => r.nights.forEach((n, i) => {
    const acc = out[i] || { date: n.date, total: 0, booked: 0, available: 0 };
    out[i] = {
      date: n.date,
      total: acc.total + n.total,
      booked: acc.booked + n.booked,
      available: acc.available + n.available,
    };
  }));
  return out;
}

export default function RoomAvailabilityGrid({ data, loading, hotelId = '', isAr = false }) {
  const all = data?.series || [];

  // Filtered on the client: the response already holds every hotel, so switching
  // costs nothing and the date axis stays put between hotels.
  const series = useMemo(
    () => (hotelId ? all.filter((s) => s.hotelId === hotelId) : all),
    [all, hotelId],
  );

  // Derived, never read off the response — with a hotel filter on, a server-side
  // total would be the wrong subtotal.
  const totals = useMemo(() => sumNights(series), [series]);

  // Hotel rows are only worth showing when a hotel has more than one room type —
  // otherwise the room-type row already says it.
  const hotelSubtotals = useMemo(() => {
    const byHotel = new Map();
    series.forEach((s) => {
      const bucket = byHotel.get(s.hotelId) || { name: s.hotelName, rows: [] };
      bucket.rows.push(s);
      byHotel.set(s.hotelId, bucket);
    });
    return new Map([...byHotel].map(([id, b]) => [id, {
      name: b.name, count: b.rows.length, nights: sumNights(b.rows),
    }]));
  }, [series]);

  if (loading) {
    return <div style={{ padding: 28, textAlign: 'center', fontSize: 13, color: 'var(--ink-mute)' }}>
      {isAr ? 'جارٍ التحميل…' : 'Loading…'}
    </div>;
  }

  if (!totals.length) {
    return <div style={{ padding: 28, textAlign: 'center', fontSize: 13, color: 'var(--ink-mute)' }}>
      {hotelId
        ? (isAr ? 'لا توجد غرف محجوزة في هذا الفندق' : 'No rooms held at this hotel')
        : (isAr ? 'لا توجد غرف محجوزة بعد' : 'No rooms held yet')}
    </div>;
  }

  // Grouped by hotel so a hotel's room types sit together under its subtotal.
  // Filtered to one hotel, its subtotal IS the top row — don't print it twice.
  const grouped = [];
  [...hotelSubtotals.entries()].forEach(([id, bucket]) => {
    if (!hotelId) grouped.push({ kind: 'hotel', hotelId: id, ...bucket });
    series.filter((s) => s.hotelId === id).forEach((s) => grouped.push({ kind: 'roomType', ...s }));
  });

  return (
    <div>
      {/* The table scrolls, not the page — a month-long event would otherwise push
          the whole layout sideways. */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: 'max-content', minWidth: '100%' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--glass-border)' }}>
              <th style={{ ...labelCell, textAlign: 'start', fontSize: 10.5, color: 'var(--ink-mute)',
                textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 500 }}>
                {isAr ? 'الفندق / نوع الغرفة' : 'Hotel / Room Type'}
              </th>
              {totals.map((n) => (
                <th key={n.date} style={{ ...cellBase, fontWeight: 500 }}>
                  <div style={{ fontSize: 10, color: 'var(--ink-mute)', textTransform: 'uppercase' }}>{weekday(n.date, isAr)}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--ink-dim)' }}>{dayMonth(n.date, isAr)}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Headline row: every room type in scope — all hotels, or the one
                the filter is on. */}
            <tr style={{ borderBottom: '1px solid var(--glass-border)', background: 'var(--surface-soft-2)' }}>
              <td style={{ ...labelCell, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {hotelId
                  ? (series[0]?.hotelName || (isAr ? 'الإجمالي' : 'Total'))
                  : (isAr ? 'كل الفنادق' : 'All Hotels')}
              </td>
              {totals.map((n) => <Cell key={n.date} night={n} isAr={isAr} strong />)}
            </tr>

            {grouped.map((row) => (
              row.kind === 'hotel' ? (
                // Skipped when the hotel has a single room type: the row below it
                // would repeat these exact numbers.
                row.count > 1 && (
                  <tr key={`h-${row.hotelId}`} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                    <td style={{ ...labelCell, fontSize: 12.5, fontWeight: 600 }}>{row.name}</td>
                    {row.nights.map((n) => <Cell key={n.date} night={n} isAr={isAr} />)}
                  </tr>
                )
              ) : (
                <tr key={`${row.hotelId}-${row.roomTypeId}`} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                  <td style={labelCell}>
                    <div style={{ fontSize: 12.5 }}>{row.roomTypeName}</div>
                    <div style={{ fontSize: 10.5, color: 'var(--ink-mute)', whiteSpace: 'nowrap',
                      overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.hotelName}</div>
                  </td>
                  {row.nights.map((n) => <Cell key={n.date} night={n} isAr={isAr} />)}
                </tr>
              )
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
        padding: '10px 14px', borderTop: '1px solid var(--glass-border)', fontSize: 11, color: 'var(--ink-mute)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <Icon name="alert" size={12} />
          {isAr
            ? 'الرقم الكبير = المتاح، والصغير = محجوز / إجمالي'
            : 'Big number = available, small = booked / held'}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: 'rgba(229,115,115,0.5)' }} />
          {isAr ? 'ممتلئ' : 'Full'}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: 'rgba(224,196,126,0.5)' }} />
          {isAr ? 'يكاد ينتهي' : 'Almost gone'}
        </span>
        <span>{isAr ? 'كل عمود = ليلة واحدة' : 'Each column is one night'}</span>
      </div>
    </div>
  );
}
