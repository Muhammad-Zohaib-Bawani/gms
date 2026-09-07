// One flight, presented the way a boarding pass does.
//
// The arrivals & departures table used to spread a single flight across three
// columns — number, route, duration — with a separate Duration column per
// direction. Seven columns, and the number sat too far from the route it
// belonged to. Everything about one leg now lives in one cell: number and
// status on top, then a route strip with the codes and times at the ends and
// the duration on the connecting line, which is where the eye already looks
// for it.
import React from 'react';
import { Icon } from '../../components/Icons';

/** "2026-12-13T08:30:00" -> "08:30" */
function hhmm(v) {
  return v ? String(v).slice(11, 16) : null;
}

function RouteStrip({ from, to, departAt, arriveAt, duration, inbound }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      {/* Origin */}
      <div style={{ textAlign: 'start', minWidth: 42 }}>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 700, lineHeight: 1.2 }}>
          {from || '—'}
        </div>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-mute)' }}>
          {hhmm(departAt) || '—'}
        </div>
      </div>

      {/* Connector. The line is drawn with borders rather than an SVG so it
          stretches with the column instead of scaling the plane glyph. */}
      <div style={{ flex: 1, minWidth: 46, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
        {duration && (
          <span style={{ fontSize: 10, color: 'var(--ink-mute)', fontFamily: 'var(--mono)', lineHeight: 1.2 }}>
            {duration}
          </span>
        )}
        <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: 3 }}>
          <span style={{ flex: 1, height: 1, background: 'var(--glass-border)' }} />
          <Icon
            name={inbound ? 'planeLanding' : 'planeTakeoff'}
            size={13}
            style={{ color: 'var(--accent)', flexShrink: 0 }}
          />
          <span style={{ flex: 1, height: 1, background: 'var(--glass-border)' }} />
        </div>
      </div>

      {/* Destination */}
      <div style={{ textAlign: 'end', minWidth: 42 }}>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 700, lineHeight: 1.2 }}>
          {to || '—'}
        </div>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-mute)' }}>
          {hhmm(arriveAt) || '—'}
        </div>
      </div>
    </div>
  );
}

/**
 * @param flights  already direction-resolved segments (see `segment()` in TravelView)
 * @param inbound  drives the plane glyph and the empty-state wording
 */
export default function FlightLegCell({ flights, inbound, dateLabelFor, flightDuration, emptyText = '—' }) {
  if (!flights?.length) {
    return <span style={{ color: 'var(--ink-faint)', fontSize: 12 }}>{emptyText}</span>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {flights.map((f, i) => (
        <div
          key={f.id ?? i}
          style={{
            border: '1px solid var(--glass-border)',
            borderRadius: 10,
            padding: '8px 10px',
            background: 'var(--bg-1)',
            minWidth: 210,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 11.5, fontWeight: 700, color: 'var(--accent)' }}>
              {f.flightNumber || '—'}
            </span>
            <span style={{ marginInlineStart: 'auto', fontSize: 10.5, color: 'var(--ink-mute)' }}>
              {dateLabelFor(f.departureTime || f.arrivalTime)}
            </span>
          </div>
          <RouteStrip
            from={f.departureCode}
            to={f.arrivalCode}
            departAt={f.departureTime}
            arriveAt={f.arrivalTime}
            duration={flightDuration(f.departureTime, f.arrivalTime)}
            inbound={inbound}
          />
        </div>
      ))}
    </div>
  );
}
