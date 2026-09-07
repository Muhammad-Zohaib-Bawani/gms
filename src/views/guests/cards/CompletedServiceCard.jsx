// A service that's already been completed, shown read-only inside the booking
// accordion (see ServiceAccordion).
//
// Same visual language as the guest-detail service cards — type icon, the two
// ends of the journey either side of it, remaining fields as labelled values,
// tabs when a return booking holds two flights. Deliberately a WIDE, flat
// rectangle rather than the boxed card those use: here it sits inside an
// already-boxed accordion row, and a card inside a card inside a dialog reads
// as clutter.
//
// The data is whatever the accordion could assemble — flat [label, value] pairs
// (see travelSectionFacts / dynamicFieldFacts). There are no airport codes or
// leg records at this layer, so the strip shows the times rather than the
// route: the guest-detail card gets codes because it also loads the event's
// travel rows, which this dialog has no reason to fetch.
import React, { useState } from 'react';
import { Icon } from '../../../components/Icons';
import { fmtDate } from '../../../lib/date';
import { TYPE } from './GuestDetailCards';

const MONTHS = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

/**
 * Values reach this card already formatted, in two different shapes depending
 * on where they came from: "11-Dec-2026 08:00" for a saved booking (the
 * backend's own Text()) and "2026-12-11 08:00" for an unsaved snapshot. Both
 * are parsed explicitly rather than handed to `new Date`, which is
 * engine-dependent on the first shape and would silently produce NaN.
 */
function parseWhen(v) {
  const s = String(v ?? '').trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2}))?/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0));
  m = s.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
  const mon = m && MONTHS[m[2].toLowerCase()];
  if (m && mon !== undefined) {
    return new Date(+m[3], mon, +m[1], +(m[4] || 0), +(m[5] || 0));
  }
  return null;
}

/** "5h 15m" / "45m", or nights for a stay. Null when the pair can't support it. */
function spanLabel(a, b, kind, isAr) {
  if (!a || !b || b <= a) return null;
  const mins = Math.round((b - a) / 60000);
  if (kind === 'accommodation') {
    const nights = Math.max(1, Math.round(mins / 1440));
    return isAr ? `${nights} ليلة` : `${nights} ${nights === 1 ? 'night' : 'nights'}`;
  }
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h ? `${h}h${m ? ` ${m}m` : ''}` : `${m}m`;
}

// Labels arrive in whichever language they were built in — the backend always
// sends English for a saved booking, travelSectionFacts localises. So roles are
// matched against both rather than by position.
// `above` and the span/timestamp below it sandwich the type glyph, so the three
// things that identify a booking sit together on the connector instead of
// competing with the headline: what it is (flight no. / room / driver), and how
// long or when.
const ROLES = {
  flight: {
    icon: 'planeTakeoff',
    primary: ['Type', 'النوع'],
    above: ['Flight', 'الرحلة'],
    from: ['Departs', 'الموعد'],
    to: ['Arrives'],
    status: ['Flight Status', 'Status'],
  },
  accommodation: {
    icon: 'hotel',
    primary: ['Hotel', 'الفندق'],
    above: ['Room type', 'نوع الغرفة'],
    from: ['Check-in', 'الوصول'],
    to: ['Check-out', 'المغادرة'],
  },
  transport: {
    icon: 'car',
    primary: ['Vehicle', 'المركبة'],
    above: ['Driver', 'السائق'],
    from: ['Pickup', 'الاستلام'],
    to: ['Dropoff', 'التوصيل'],
    status: ['Status', 'Trip Status'],
    // A saved ride has ADDRESSES at both ends, so there's no span to compute —
    // its one timestamp goes under the car icon rather than into the field list.
    when: ['Pickup time', 'وقت الاستلام'],
  },
};

const hhmm = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
const hasClock = (s) => /\d{1,2}:\d{2}/.test(String(s ?? ''));

// A return booking comes back as one row with its legs joined — "AB689 / CD123"
// (see LoadSystemBookingsAsync). That separator is the only signal here that
// there's more than one flight in the booking.
const LEG_SEP = ' / ';
const legCountOf = (facts) => Math.max(
  ...facts.map(([, v]) => String(v ?? '').split(LEG_SEP).length),
  1,
);
const legSlice = (facts, i, count) => facts.map(([k, v]) => {
  const parts = String(v ?? '').split(LEG_SEP);
  // A field that isn't per-leg (status, class) repeats rather than blanking.
  return [k, parts.length === count ? parts[i] : String(v ?? '')];
});

export default function CompletedServiceCard({
  kind, icon, facts = [], isAr, index = 0, total = 1,
}) {
  const role = ROLES[kind];
  // Flights only: they're the one type the backend joins per leg. Checking
  // every type would turn a hotel called "Hilton / Doha" into two fake legs.
  const legs = kind === 'flight' ? legCountOf(facts) : 1;
  const [leg, setLeg] = useState(0);
  const safeLeg = leg < legs ? leg : 0;
  const shown = legs > 1 ? legSlice(facts, safeLeg, legs) : facts;

  // Pull the roles out by label, leaving everything else for the grid.
  const taken = new Set();
  const pick = (names) => {
    if (!names) return null;
    const hit = shown.find(([k]) => names.includes(k) && !taken.has(k));
    if (hit) taken.add(hit[0]);
    return hit || null;
  };
  let primary = pick(role?.primary);
  // A dynamic service has no fixed roles, so its first filled field becomes the
  // headline rather than leaving a dash above a list that already holds it.
  if (!primary && !role && shown.length > 0) {
    primary = shown[0];
    taken.add(shown[0][0]);
  }
  const above = pick(role?.above);
  const from = pick(role?.from);
  const to = pick(role?.to);
  const status = pick(role?.status);
  const whenFact = pick(role?.when);
  const rest = shown.filter(([k]) => !taken.has(k));

  // Under the connector, in order of what's most useful: how long the
  // journey/stay took, else the one timestamp the booking carries (a saved ride
  // has addresses at both ends, so there's no span to compute), else the first
  // readable date anywhere in it.
  let midLines = [];
  const span = spanLabel(parseWhen(from?.[1]), parseWhen(to?.[1]), kind, isAr);
  if (span) {
    midLines = [span];
  } else if (whenFact) {
    const d = parseWhen(whenFact[1]);
    midLines = d
      ? [fmtDate(d, ''), hasClock(whenFact[1]) ? hhmm(d) : ''].filter(Boolean)
      : [String(whenFact[1])];
  } else {
    const any = shown.map(([, v]) => parseWhen(v)).find(Boolean);
    if (any) midLines = [fmtDate(any, '')];
  }

  const headIcon = role?.icon || icon || 'star';
  const dash = { flex: 1, minWidth: 6, height: 0, borderTop: '1px dashed var(--glass-border-strong)' };

  return (
    <div style={{
      // The rectangle: full width, small radius, and an accent edge instead of
      // a full border so it reads as a record rather than a nested card.
      width: '100%', boxSizing: 'border-box',
      borderRadius: 'var(--radius-sm)',
      border: '1px solid var(--glass-border)',
      borderInlineStart: '3px solid var(--gc-accent)',
      background: 'var(--bg-1)',
      padding: '8px 11px',
      display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <Icon name={headIcon} size={14} style={{ color: 'var(--gc-accent)', flexShrink: 0 }} />
        {/* Holds the plain-language identity now — flight type, hotel, vehicle —
            since the code (flight no.) moved to the connector. No mono: these
            are words, not references. */}
        <span style={{
          ...TYPE.value, fontSize: 12.5,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          flexShrink: 1, minWidth: 0,
        }}>
          {primary?.[1] || (total > 1 ? `${isAr ? 'إدخال' : 'Entry'} ${index + 1}` : '—')}
        </span>
        {status?.[1] && (
          <span className="chip confirmed" style={{ fontSize: 10, marginInlineStart: 'auto', flexShrink: 0 }}>
            {status[1]}
          </span>
        )}
      </div>

      {/* Return booking: one tab per flight, same Inbound-then-Outbound order
          as the guest-detail flight card (the guest arrives before they leave). */}
      {legs > 1 && (
        <div className="tabs" style={{ padding: 2, borderRadius: 8, gap: 2, alignSelf: 'flex-start' }}>
          {Array.from({ length: legs }).map((_, i) => (
            <button
              key={i}
              type="button"
              className={i === safeLeg ? 'active' : ''}
              onClick={() => setLeg(i)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '3px 8px', borderRadius: 6, fontSize: 10.5,
                fontWeight: i === safeLeg ? 600 : 500, cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >
              <Icon
                name={i === 0 ? 'planeLanding' : 'planeTakeoff'}
                size={11}
                style={{ color: i === safeLeg ? 'var(--gc-accent)' : 'var(--ink-mute)' }}
              />
              {i === 0 ? (isAr ? 'قادمة' : 'Inbound') : (isAr ? 'مغادرة' : 'Outbound')}
            </button>
          ))}
        </div>
      )}

      {/* The two ends, connected — the same strip the detail cards use, laid
          out flat. Both sides share one flex basis so the icon stays centred
          however long the values are. */}
      {(from || to) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <div style={{ flex: '1 1 0', minWidth: 0 }}>
            <div style={{ fontSize: 9, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              {from?.[0]}
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {from?.[1] || '—'}
            </div>
          </div>
          {/* Wider than the icon needs so the line actually reads as a
              journey, with how long it took sitting under it. */}
          <div style={{
            flex: '0 0 104px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
          }}>
            {above?.[1] && (
              <span style={{
                fontSize: 10.5, lineHeight: 1.3, fontWeight: 700,
                color: 'var(--ink)', fontFamily: 'var(--mono)',
                maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {above[1]}
              </span>
            )}
            <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: 4 }}>
              <span style={dash} />
              <Icon name={role?.icon || 'arrow'} size={12} style={{ color: 'var(--gc-accent)', flexShrink: 0 }} />
              <span style={dash} />
            </div>
            {midLines.map((line, i) => (
              <span key={i} style={{
                fontSize: 9.5, lineHeight: 1.3,
                // The time is the point when there are two lines; the date
                // above it is context.
                color: i === midLines.length - 1 ? 'var(--ink-dim)' : 'var(--ink-mute)',
                whiteSpace: 'nowrap', fontFamily: 'var(--mono)',
              }}>
                {line}
              </span>
            ))}
          </div>
          <div style={{ flex: '1 1 0', minWidth: 0, textAlign: 'end' }}>
            <div style={{ fontSize: 9, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              {to?.[0]}
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {to?.[1] || '—'}
            </div>
          </div>
        </div>
      )}

      {/* Flowing label·value pairs, not a grid. `auto-fit` columns stretched a
          leftover field across a whole empty row and padded the card out; these
          pack left-to-right and wrap only when they run out of room, so the
          card is as short as its content. */}
      {rest.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px', minWidth: 0 }}>
          {rest.map(([k, v], i) => (
            <div key={`${k}-${i}`} style={{
              display: 'flex', alignItems: 'baseline', gap: 6,
              minWidth: 0, maxWidth: '100%',
            }}>
              <span style={{
                fontSize: 9, color: 'var(--ink-faint)', flexShrink: 0,
                textTransform: 'uppercase', letterSpacing: '0.08em',
              }}>
                {k}
              </span>
              <span style={{ fontSize: 12, color: 'var(--ink)', overflowWrap: 'anywhere' }}>{v}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
