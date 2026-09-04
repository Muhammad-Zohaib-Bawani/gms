import React, { useMemo, useState, useRef } from 'react';
import { Icon } from '../../components/Icons';
import toast from '../../lib/toast';
import { fmtDayMonth } from '../../lib/date';

// Rooms held × nights, for ONE hotel and one month at a time. Each room type is
// three rows — Total, Booked, Available — because that is the question being
// asked, and three labelled rows beat one cell holding three numbers.
//
// One hotel, not all of them: an all-hotels column sum mixes room types that have
// nothing to do with each other, so the number it printed was never actionable.
// One month, because the date axis spans every block in the event and a long
// event pushed 60+ columns through a sideways scroll.
//
// Every series shares the response's date axis, so the columns line up without
// the grid having to reconcile windows itself.
//
// Total and Available are click-to-edit when the parent passes `blockAt` +
// `onSaveNight`, and an edit changes THAT NIGHT only. The DB holds one count per
// (room type, from..to) window rather than one per night, so the server splits
// the block around the edited night — that's the whole reason this posts a night
// instead of a room count. Available is the same number seen from the other
// side, so it writes Total = value + that night's Booked.

const CELL_W = 62;
const LABEL_W = 190;

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

// Only the Available row is coloured — Total and Booked are facts, Available is
// the one that needs reading at a glance. Sold out red, nearly gone amber. A
// night with nothing held AND nobody booked was never on offer, so it is blank
// rather than "full".
function tone(night) {
  if (night.available < 0) return { fg: '#e57373', bg: 'rgba(229,115,115,0.22)' };
  if (!night.total) return { fg: 'var(--ink-faint)', bg: 'transparent' };
  if (night.available <= 0) return { fg: '#e57373', bg: 'rgba(229,115,115,0.13)' };
  if (night.available <= Math.max(1, Math.floor(night.total * 0.25))) return { fg: '#e0c47e', bg: 'rgba(224,196,126,0.12)' };
  return { fg: 'var(--ink)', bg: 'transparent' };
}

// Weekday is a word, so it does follow the locale. The date itself uses the
// portal's DD-MM, clipped of the year — a 62px column has no room for it.
const weekday = (iso, isAr) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString(isAr ? 'ar' : 'en-GB', { weekday: 'short' });

// Column-wise sum of a set of series. All series share one date axis, so index i
// is the same night in every one of them.
function sumNights(rows) {
  const out = [];
  rows.forEach((r) => (r.nights || []).forEach((n, i) => {
    const acc = out[i] || { total: 0, booked: 0, available: 0 };
    out[i] = {
      date: n.date,
      total: acc.total + n.total,
      booked: acc.booked + n.booked,
      available: acc.available + n.available,
    };
  }));
  return out;
}

/** Every 'YYYY-MM' present on the axis, in order — the month filter's options. */
export function monthsOf(data) {
  const nights = data?.series?.[0]?.nights || [];
  return [...new Set(nights.map((n) => String(n.date).slice(0, 7)))];
}

const inMonth = (nights, month) =>
  (month ? (nights || []).filter((n) => String(n.date).startsWith(month)) : (nights || []));

const editInput = {
  width: '100%', boxSizing: 'border-box', textAlign: 'center', direction: 'ltr',
  background: 'var(--surface-soft-3)', border: '1px solid var(--brand, var(--accent))',
  borderRadius: 5, padding: '2px 3px', color: 'var(--ink)', fontSize: 13, fontWeight: 700,
  // A number spinner inside a 62px cell is all spinner and no number.
  MozAppearance: 'textfield',
};

// One metric row. `metric` picks which number this row prints. `editor` (see the
// grid below) makes Total/Available cells click-to-edit; without it, or on the
// all-room-types aggregate row (no roomTypeId → no single block to write to),
// the row stays read-only.
function MetricRow({ label, nights, metric, strong = false, coloured = false, roomTypeId = null, editor = null }) {
  const editable = !!(editor && roomTypeId && (metric === 'total' || metric === 'available'));
  return (
    <tr style={{ borderBottom: '1px solid var(--glass-border)' }}>
      <td style={{
        ...labelCell,
        fontSize: 11.5,
        color: coloured ? 'var(--ink)' : 'var(--ink-mute)',
        fontWeight: coloured ? 600 : 500,
        paddingInlineStart: 26,
      }}>
        {label}
      </td>
      {nights.map((n) => {
        const { fg, bg } = coloured ? tone(n) : {};
        // Nothing held and nobody in it: blank. Nothing held but somebody in it is
        // a real overbooking, so it still shows (as a negative) rather than empty.
        const idle = !n.total && !n.booked;
        // A night no block covers has no count to write to — it stays read-only
        // even on an editable row.
        const hit = editable ? editor.blockAt(roomTypeId, n.date) : null;
        const editing = hit && editor.isActive(roomTypeId, metric, n.date);
        return (
          <td key={n.date} style={{ ...cellBase, background: coloured ? bg : 'transparent' }}>
            {editing ? (
              <input
                autoFocus
                type="number"
                min={0}
                value={editor.value}
                disabled={editor.saving}
                onChange={(e) => editor.setValue(e.target.value)}
                onKeyDown={editor.onKeyDown}
                onBlur={editor.onBlur}
                style={editInput}
              />
            ) : (
              <div
                onClick={hit ? () => editor.start(roomTypeId, metric, n, hit) : undefined}
                style={{
                  fontSize: coloured || strong ? 13.5 : 12.5,
                  fontWeight: coloured || strong ? 700 : 500,
                  color: coloured ? fg : 'var(--ink-dim)',
                  direction: 'ltr', lineHeight: 1.2,
                  cursor: hit ? 'pointer' : 'default',
                  borderBottom: hit ? '1px dashed var(--glass-border-strong)' : '1px solid transparent',
                }}
              >
                {idle ? '—' : n[metric]}
              </div>
            )}
          </td>
        );
      })}
    </tr>
  );
}

// The three rows one scope (a room type, or the hotel as a whole) expands into.
function ScopeRows({ title, subtitle, nights, isAr, colSpan, roomTypeId = null, editor = null }) {
  return (
    <>
      <tr style={{ background: 'var(--surface-soft-2)', borderBottom: '1px solid var(--glass-border)' }}>
        <td style={{ ...labelCell, fontSize: 12.5, fontWeight: 700 }}>
          {title}
          {subtitle && (
            <div style={{ fontSize: 10.5, fontWeight: 400, color: 'var(--ink-mute)' }}>{subtitle}</div>
          )}
        </td>
        {/* The group header carries no numbers — the three rows under it do. */}
        <td colSpan={colSpan} style={{ ...cellBase, textAlign: 'start', borderInlineStart: '1px solid var(--glass-border)' }} />
      </tr>
      <MetricRow label={isAr ? 'الإجمالي' : 'Total'} nights={nights} metric="total" roomTypeId={roomTypeId} editor={editor} />
      {/* Booked is never editable here — it's guests' actual stays, not inventory. */}
      <MetricRow label={isAr ? 'محجوز' : 'Booked'} nights={nights} metric="booked" />
      <MetricRow label={isAr ? 'متاح' : 'Available'} nights={nights} metric="available" coloured roomTypeId={roomTypeId} editor={editor} />
    </>
  );
}

export default function RoomAvailabilityGrid({
  data, loading, hotelId = '', month = '', isAr = false,
  // Both required to make the grid editable — omit either (no permission, no
  // blocks loaded) and it renders exactly as before.
  //   blockAt(roomTypeId, date) → { id, fromDate, toDate, roomCount } | null
  //   onSaveNight(block, date, roomCount) → Promise, rejects on failure (parent toasts)
  blockAt = null, onSaveNight = null,
}) {
  const all = data?.series || [];

  // { roomTypeId, metric, date, night, block, value, saving } | null
  const [edit, setEdit] = useState(null);
  // Escape unmounts the input, which fires onBlur on the way out — without this
  // the cancel would immediately be undone by a commit.
  const skipBlur = useRef(false);

  const editable = !!(blockAt && onSaveNight);

  const commit = async () => {
    if (!edit || edit.saving) return;
    const raw = Number(edit.value);
    // Available is Total seen from the other side: the booked half is fixed, so
    // typing there is really typing Total − Booked for that night.
    const total = edit.metric === 'total' ? raw : raw + edit.night.booked;

    if (!Number.isInteger(raw) || raw < 0 || !Number.isInteger(total) || total < 0) {
      toast.error(isAr ? 'أدخل رقماً صحيحاً' : 'Enter a whole number');
      return;
    }
    // The guard the whole feature is for. Only THIS night's bookings matter —
    // the edit touches this night alone. The server enforces the same rule
    // (FindBreachAsync) — this just says so before the round trip.
    if (total < edit.night.booked) {
      toast.error(isAr
        ? `${edit.night.booked} غرفة محجوزة في هذه الليلة — لا يمكن أن يقل الإجمالي عن ذلك`
        : `${edit.night.booked} room(s) booked on this night — Total can't go below that`);
      return;
    }
    if (total === edit.night.total) { setEdit(null); return; }

    setEdit((e) => ({ ...e, saving: true }));
    try {
      await onSaveNight(edit.block, edit.date, total);
      setEdit(null);
    } catch {
      // Parent already reported it; keep the value on screen to be fixed.
      setEdit((e) => (e ? { ...e, saving: false } : null));
    }
  };

  const editor = editable ? {
    blockAt,
    value: edit?.value ?? '',
    saving: !!edit?.saving,
    isActive: (roomTypeId, metric, date) =>
      !!edit && edit.roomTypeId === roomTypeId && edit.metric === metric && edit.date === date,
    start: (roomTypeId, metric, night, block) => {
      if (edit?.saving) return;
      setEdit({
        roomTypeId, metric, date: night.date, night, block,
        value: String(metric === 'total' ? night.total : night.available),
        saving: false,
      });
    },
    setValue: (v) => setEdit((e) => (e ? { ...e, value: v } : null)),
    onKeyDown: (e) => {
      if (e.key === 'Enter') { e.preventDefault(); commit(); }
      if (e.key === 'Escape') { skipBlur.current = true; setEdit(null); }
    },
    onBlur: () => {
      if (skipBlur.current) { skipBlur.current = false; return; }
      commit();
    },
  } : null;

  // Filtered on the client: the response already holds every hotel, so switching
  // costs nothing and the date axis stays put between hotels.
  const series = useMemo(
    () => all.filter((s) => s.hotelId === hotelId),
    [all, hotelId],
  );

  // Derived, never read off the response — scoped to one hotel and one month, a
  // server-side total would be the wrong subtotal.
  const hotelNights = useMemo(() => inMonth(sumNights(series), month), [series, month]);
  const axis = hotelNights;

  if (loading) {
    return <div style={{ padding: 28, textAlign: 'center', fontSize: 13, color: 'var(--ink-mute)' }}>
      {isAr ? 'جارٍ التحميل…' : 'Loading…'}
    </div>;
  }

  if (!hotelId) {
    return <div style={{ padding: 28, textAlign: 'center', fontSize: 13, color: 'var(--ink-mute)' }}>
      {isAr ? 'اختر فندقاً لعرض التوفّر' : 'Pick a hotel to see its availability'}
    </div>;
  }

  if (!axis.length) {
    return <div style={{ padding: 28, textAlign: 'center', fontSize: 13, color: 'var(--ink-mute)' }}>
      {series.length
        ? (isAr ? 'لا توجد ليالٍ في هذا الشهر' : 'No nights held in this month')
        : (isAr ? 'لا توجد غرف محجوزة في هذا الفندق' : 'No rooms held at this hotel')}
    </div>;
  }

  const hotelName = series[0]?.hotelName || '';
  // The hotel block only earns its rows when there is more than one room type to
  // add up — with one type it would repeat the rows directly beneath it.
  const showHotelRows = series.length > 1;

  return (
    <div>
      {/* The table scrolls, not the page — a month of columns would otherwise push
          the whole layout sideways. */}
      <div className="grid-scroll" style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: 'max-content', minWidth: '100%' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--glass-border)' }}>
              <th style={{ ...labelCell, textAlign: 'start', fontSize: 10.5, color: 'var(--ink-mute)',
                textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 500 }}>
                {isAr ? 'نوع الغرفة' : 'Room Type'}
              </th>
              {axis.map((n) => (
                <th key={n.date} style={{ ...cellBase, fontWeight: 500 }}>
                  <div style={{ fontSize: 10, color: 'var(--ink-mute)', textTransform: 'uppercase' }}>{weekday(n.date, isAr)}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--ink-dim)', direction: 'ltr' }}>{fmtDayMonth(n.date)}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {showHotelRows && (
              <ScopeRows
                title={hotelName}
                subtitle={isAr ? 'كل أنواع الغرف' : 'All room types'}
                nights={hotelNights}
                isAr={isAr}
                colSpan={axis.length}
              />
            )}

            {series.map((s) => (
              <ScopeRows
                key={`${s.hotelId}-${s.roomTypeId}`}
                title={s.roomTypeName}
                nights={inMonth(s.nights, month)}
                isAr={isAr}
                colSpan={axis.length}
                roomTypeId={s.roomTypeId}
                editor={editor}
              />
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
        padding: '10px 14px', borderTop: '1px solid var(--glass-border)', fontSize: 11, color: 'var(--ink-mute)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <Icon name="alert" size={12} />
          {isAr ? 'متاح = الإجمالي − المحجوز' : 'Available = Total − Booked'}
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
        {editable && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <Icon name="edit" size={12} />
            {isAr
              ? 'انقر الإجمالي أو المتاح لتعديل تلك الليلة وحدها'
              : 'Click Total or Available to edit that night only'}
          </span>
        )}
      </div>
    </div>
  );
}
