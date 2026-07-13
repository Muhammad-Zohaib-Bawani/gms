import React, { useEffect, useRef } from 'react';
import CanvasElement from './CanvasElement.jsx';
import { MIN_ZOOM, MAX_ZOOM, tableHasSeats } from '../venueHelpers.js';

export default function VenueCanvas({
  tables, selectedId, selectedSeat, deleteSeatMode,
  zoom, setZoom, zoomIn, zoomOut, zoomReset,
  canvasW, canvasH,
  dragTypeRef, onDrop, onCanvasClick, onElementMouseDown, onSeatClick, onDeleteSeat,
  isAr, emptyHint,
}) {
  const scrollRef = useRef(null);
  const canvasRef = useRef(null);

  // React's onWheel is a passive listener, so calling preventDefault() on it is a
  // silent no-op — ctrl+scroll would zoom the whole page instead of the canvas.
  // A native listener with { passive: false } is required to actually stop that.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handler = (e) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setZoom(z => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, +((z + delta).toFixed(1)))));
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, [setZoom]);

  function handleDrop(e) {
    e.preventDefault();
    const type = dragTypeRef.current;
    if (!type) return;
    const rect = canvasRef.current.getBoundingClientRect();
    onDrop(type, Math.max(0, (e.clientX - rect.left) / zoom - 55), Math.max(0, (e.clientY - rect.top) / zoom - 55));
    dragTypeRef.current = null;
  }

  return (
    <div className="card venue-canvas-panel" style={{ flex: 1, padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* Zoom toolbar */}
      <div style={{ padding: '6px 12px', borderBottom: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', gap: 6, background: 'var(--surface-soft-3)', flexShrink: 0 }}>
        <span style={{ fontSize: 10.5, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.1em', marginRight: 2 }}>{isAr ? 'التكبير' : 'Zoom'}</span>
        <button className="icon-btn" onClick={zoomOut} disabled={zoom <= MIN_ZOOM}
          style={{ fontSize: 16, fontWeight: 300, lineHeight: '24px', width: 28, height: 28 }}>−</button>
        <span style={{ fontSize: 12, fontFamily: 'var(--mono)', minWidth: 38, textAlign: 'center', color: 'var(--ink)' }}>
          {Math.round(zoom * 100)}%
        </span>
        <button className="icon-btn" onClick={zoomIn} disabled={zoom >= MAX_ZOOM}
          style={{ fontSize: 16, fontWeight: 300, lineHeight: '24px', width: 28, height: 28 }}>+</button>
        <button className="btn" style={{ fontSize: 11, padding: '3px 9px', marginLeft: 2 }} onClick={zoomReset}>{isAr ? 'إعادة' : 'Reset'}</button>
        <span style={{ marginLeft: 'auto', fontSize: 10.5, color: 'var(--ink-faint)' }}>
          {isAr ? 'Ctrl+scroll للتكبير' : 'Ctrl+scroll to zoom'}
        </span>
      </div>

      {/* Scrollable canvas area */}
      <div ref={scrollRef} className="venue-canvas-scroll" style={{ overflow: 'auto', minHeight: 480 }}>
        {/* Spacer establishes scrollable dimensions matching the scaled canvas */}
        <div style={{ width: canvasW * zoom, height: canvasH * zoom, position: 'relative', flexShrink: 0 }}>
          <div ref={canvasRef}
            style={{
              position: 'absolute', top: 0, left: 0,
              width: canvasW, height: canvasH,
              transform: `scale(${zoom})`,
              transformOrigin: 'top left',
              background: 'var(--surface-soft-2)',
            }}
            onDragOver={e => e.preventDefault()}
            onDrop={handleDrop}
            onClick={e => { if (e.currentTarget === e.target) onCanvasClick(); }}>

            <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
              <defs>
                <pattern id="gridPat" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="var(--glass-border)" strokeWidth="0.4"/>
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#gridPat)"/>
            </svg>

            {tables.map(t => {
              const isSel = t.id === selectedId;
              const showDel = deleteSeatMode && isSel && tableHasSeats(t);
              const seatIdx = selectedSeat && selectedSeat.tableId === t.id ? selectedSeat.index : null;
              return (
                <CanvasElement
                  key={t.id}
                  table={t}
                  selected={isSel}
                  showDeleteSeat={showDel}
                  selectedSeatIndex={seatIdx}
                  onMouseDown={e => onElementMouseDown(e, t.id)}
                  onDeleteSeat={onDeleteSeat}
                  onSeatClick={!deleteSeatMode && isSel && tableHasSeats(t) ? (index => onSeatClick(t.id, index)) : null}
                />
              );
            })}

            {tables.length === 0 && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-faint)', fontSize: 13, pointerEvents: 'none' }}>
                {emptyHint}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
