// One form section, rendered compactly for a table cell.
//
// A service form can hold 25+ fields; a column each is unreadable, so a table
// gets one column per SECTION and this renders that section's values inside it.
//
// When a section looks like a journey — two lookup fields (from/to) and two
// datetimes — it draws the boarding-pass route strip the old Travel table used.
// Anything else falls back to a compact label/value list, so a service nobody
// anticipated still renders tidily.
import React from 'react';
import { Icon } from '../../components/Icons';

const hhmm = (v) => (v ? String(v).replace('T', ' ').slice(11, 16) : null);
const dayLabel = (v) => {
  if (!v) return '';
  const d = new Date(v);
  return Number.isNaN(d.getTime())
    ? String(v).slice(0, 10)
    : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

/**
 * Two place fields plus two time fields is a journey. Detected rather than
 * configured: it keeps the nice layout automatic for Flight and Transport
 * without asking an admin to declare "this section is a route".
 */
function routeShape(section) {
  const fields = section.fields || [];
  const places = fields.filter((f) => f.type === 'lookup');
  const times = fields.filter((f) => f.type === 'datetime');
  if (places.length < 2 || times.length < 2) return null;
  return { from: places[0], to: places[1], depart: times[0], arrive: times[1] };
}

function RouteStrip({ shape, values, display, inbound }) {
  const from = display(shape.from, values[shape.from.key]);
  const to = display(shape.to, values[shape.to.key]);
  const dep = values[shape.depart.key];
  const arr = values[shape.arrive.key];

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ textAlign: 'start', minWidth: 40 }}>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 12.5, fontWeight: 700, lineHeight: 1.2 }}>
          {String(from).split(' — ')[0]}
        </div>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--ink-mute)' }}>
          {hhmm(dep) || '—'}
        </div>
      </div>

      <div style={{ flex: 1, minWidth: 40, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: 3 }}>
          <span style={{ flex: 1, height: 1, background: 'var(--glass-border)' }} />
          <Icon name={inbound ? 'planeLanding' : 'planeTakeoff'} size={12} style={{ color: 'var(--accent)' }} />
          <span style={{ flex: 1, height: 1, background: 'var(--glass-border)' }} />
        </div>
      </div>

      <div style={{ textAlign: 'end', minWidth: 40 }}>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 12.5, fontWeight: 700, lineHeight: 1.2 }}>
          {String(to).split(' — ')[0]}
        </div>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--ink-mute)' }}>
          {hhmm(arr) || '—'}
        </div>
      </div>
    </div>
  );
}

export default function SectionCell({ section, values, display, isAr, inbound = false }) {
  const fields = (section.fields || []).filter(
    (f) => values?.[f.key] != null && String(values[f.key]).trim() !== '',
  );
  if (fields.length === 0) {
    return <span style={{ color: 'var(--ink-faint)', fontSize: 12 }}>—</span>;
  }

  const shape = routeShape(section);
  // Fields the strip already shows must not repeat underneath it.
  const shown = shape ? new Set([shape.from.key, shape.to.key, shape.depart.key, shape.arrive.key]) : new Set();
  const rest = fields.filter((f) => !shown.has(f.key));

  // The first short text field reads as the identifier — flight number, booking
  // reference — so it headlines the card.
  const headline = rest.find((f) => f.type === 'text');
  const details = rest.filter((f) => f !== headline).slice(0, 4);

  return (
    <div style={{
      border: '1px solid var(--glass-border)',
      borderRadius: 9,
      padding: '7px 9px',
      background: 'var(--bg-1)',
      minWidth: shape ? 210 : 160,
    }}>
      {(headline || shape) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: shape ? 6 : 3 }}>
          {headline && (
            <span style={{ fontFamily: 'var(--mono)', fontSize: 11.5, fontWeight: 700, color: 'var(--accent)' }}>
              {display(headline, values[headline.key])}
            </span>
          )}
          {shape && (
            <span style={{ marginInlineStart: 'auto', fontSize: 10.5, color: 'var(--ink-mute)' }}>
              {dayLabel(values[shape.depart.key] || values[shape.arrive.key])}
            </span>
          )}
        </div>
      )}

      {shape && <RouteStrip shape={shape} values={values} display={display} inbound={inbound} />}

      {details.length > 0 && (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(88px, 1fr))',
          gap: '2px 10px', marginTop: shape ? 6 : 0,
        }}>
          {details.map((f) => (
            <div key={f.key} style={{ fontSize: 10.5, lineHeight: 1.45 }}>
              <span style={{ color: 'var(--ink-faint)' }}>
                {((isAr ? f.labelAr : null) || f.label)}:{' '}
              </span>
              <span style={{ color: 'var(--ink-dim)' }}>{display(f, values[f.key])}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export { routeShape };
