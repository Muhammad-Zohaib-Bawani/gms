import React, { useMemo } from 'react';
import { Icon } from '../../components/Icons.jsx';
import Select from '../../components/ui/Select.jsx';
import { getVenueTotalSeats } from './venueHelpers.js';

export default function VenueToolbar({
  venues, activeVenueId, onSwitchVenue,
  sessions, selectedSessionId, onSessionChange,
  activeVenue, canDeleteVenue, onDeleteVenueClick, onAddVenueClick,
  boxWidth, boxHeight, canvasSize, onSetBoxSize,
  isAr, t,
}) {
  const numInputStyle = {
    width: 62, background: 'var(--surface-soft-3)', border: '1px solid var(--glass-border)',
    borderRadius: 7, padding: '4px 7px', color: 'var(--ink)', fontSize: 12, textAlign: 'center',
  };
  function patchSize(patch) {
    const next = { w: boxWidth, h: boxHeight, ...patch };
    onSetBoxSize(next.w, next.h);
  }
  const venueOptions = useMemo(() => venues.map(v => {
    const sc = getVenueTotalSeats(v);
    return { value: v.id, label: sc > 0 ? `${v.name} · ${sc} seats` : v.name };
  }), [venues]);

  const sessionOptions = useMemo(() => [
    { value: '', label: isAr ? 'الفعالية (افتراضي)' : 'Event (default)' },
    ...sessions.map(s => ({ value: s.id, label: s.title || s.name })),
  ], [sessions, isAr]);

  return (
    <div className="card" style={{ padding: '10px 14px', marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 10.5, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600, flexShrink: 0 }}>
          {t.venues}
        </span>
        <div style={{ flex: 1, maxWidth: 280 }}>
          <Select
            value={activeVenueId || ''}
            onChange={onSwitchVenue}
            options={venueOptions}
            placeholder={isAr ? '— لا أماكن —' : '— No venues —'}
          />
        </div>
        {sessions.length > 0 && (
          <div style={{ minWidth: 200, flexShrink: 0 }}>
            <Select
              value={selectedSessionId}
              onChange={onSessionChange}
              options={sessionOptions}
            />
          </div>
        )}
        {activeVenue?.venueType && activeVenue.venueType !== 'general' && (
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', background: 'rgba(26,174,196,0.1)', border: '1px solid rgba(26,174,196,0.25)', borderRadius: 20, padding: '3px 10px', flexShrink: 0, textTransform: 'capitalize' }}>
            {activeVenue.venueType}
          </span>
        )}
        {canDeleteVenue && (
          <button className="btn" style={{ fontSize: 11, padding: '4px 10px', color: '#e08a7e', borderColor: 'rgba(224,138,126,0.3)', flexShrink: 0 }}
            onClick={onDeleteVenueClick}>
            <Icon name="trash" size={12}/>
          </button>
        )}
        <button className="btn" style={{ padding: '4px 12px', fontSize: 12, flexShrink: 0 }} onClick={onAddVenueClick}>
          <Icon name="plus" size={12}/> {t.newVenue}
        </button>
      </div>

      {activeVenueId && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--glass-border)' }}>
          <span style={{ fontSize: 10.5, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600, flexShrink: 0 }}>
            {t.canvasSize}
          </span>
          <input type="number" min={300} style={numInputStyle} value={boxWidth || ''}
            placeholder={String(canvasSize.w)}
            onChange={e => patchSize({ w: e.target.value ? +e.target.value : null })}/>
          <span style={{ fontSize: 11, color: 'var(--ink-faint)' }}>×</span>
          <input type="number" min={300} style={numInputStyle} value={boxHeight || ''}
            placeholder={String(canvasSize.h)}
            onChange={e => patchSize({ h: e.target.value ? +e.target.value : null })}/>
          <span style={{ fontSize: 11, color: 'var(--ink-faint)' }}>px</span>
          {(boxWidth || boxHeight) ? (
            <button className="btn" style={{ fontSize: 11, padding: '3px 9px' }} onClick={() => onSetBoxSize(null, null)}>
              {t.canvasSizeAuto}
            </button>
          ) : (
            <span style={{ fontSize: 10.5, color: 'var(--ink-faint)', fontStyle: 'italic' }}>{t.canvasSizeAutoHint}</span>
          )}
        </div>
      )}
    </div>
  );
}
