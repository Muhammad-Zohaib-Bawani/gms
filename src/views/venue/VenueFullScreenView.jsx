import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../../components/Icons.jsx';
import { getVenue } from '../../api/services/venueService.js';
import { getSeatAssignments } from '../../api/services/seatingService.js';
import { pickBox, boxToTables, computeCanvasSize, DISABLED_SEAT_COLOR, ASSIGNED_SEAT_COLOR } from './venueHelpers.js';
import CanvasElement from './canvas/CanvasElement.jsx';

// Cardinal placeholders anchored to the viewport edges — these never rotate
// or pan; only the floor plan underneath does, so turning the dial simulates
// walking around the venue while "true north" etc. stay put on screen.
const COMPASS = [
  { key: 'N', en: 'N', ar: 'ش', style: { top: 10, left: '50%', transform: 'translateX(-50%)' } },
  { key: 'E', en: 'E', ar: 'ق', style: { right: 10, top: '50%', transform: 'translateY(-50%)' } },
  { key: 'S', en: 'S', ar: 'ج', style: { bottom: 10, left: '50%', transform: 'translateX(-50%)' } },
  { key: 'W', en: 'W', ar: 'غ', style: { left: 10, top: '50%', transform: 'translateY(-50%)' } },
];

const DIR_PRESETS = [
  { deg: 0,   en: 'North', ar: 'الشمال' },
  { deg: 90,  en: 'East',  ar: 'الشرق' },
  { deg: 180, en: 'South', ar: 'الجنوب' },
  { deg: 270, en: 'West',  ar: 'الغرب' },
];

export default function VenueFullScreenView({ venueId, eventId, sessionId, lang }) {
  const isAr = lang === 'ar';
  const [tables, setTables] = useState(null); // null = still loading
  const [planSize, setPlanSize] = useState({ w: 1000, h: 600 });
  const [venueName, setVenueName] = useState('');
  const [venueBoxId, setVenueBoxId] = useState(null);
  const [assignments, setAssignments] = useState({}); // seatId -> guestId
  const [error, setError] = useState(null);
  const [viewAngle, setViewAngle] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [viewportSize, setViewportSize] = useState({ w: 0, h: 0 });
  // Callback ref (not a static useRef) so the effect below re-attaches once
  // the viewport <div> actually mounts — it doesn't exist yet on first render
  // (still loading), so a useRef + empty-deps effect would observe `null`
  // forever and the plan would never get a non-zero fit scale.
  const [viewportEl, setViewportEl] = useState(null);

  const dragState = useRef(null); // { startX, startY, panX, panY } while dragging
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', 'dark');
    root.setAttribute('lang', lang);
    root.setAttribute('dir', isAr ? 'rtl' : 'ltr');
  }, [lang, isAr]);

  useEffect(() => {
    if (!venueId) { setError(isAr ? 'لم يتم تحديد المكان' : 'No venue specified'); return; }
    getVenue(venueId)
      .then(v => {
        setVenueName(v.venueName || '');
        const box = pickBox(v.venueBoxes, eventId || null, sessionId || null);
        const tbls = boxToTables(box);
        setTables(tbls);
        setPlanSize(computeCanvasSize(box, tbls));
        setVenueBoxId(box?.id || null);
      })
      .catch(() => setError(isAr
        ? 'تعذّر تحميل المخطط. تأكد من تسجيل الدخول ثم أعد المحاولة.'
        : 'Failed to load the layout. Make sure you are signed in, then retry.'));
  }, [venueId, eventId, sessionId, isAr]);

  // Real seat->guest assignments for this (venue box, event, session) scope —
  // same data source as the Seating screen, so this view stays in sync with it.
  useEffect(() => {
    if (!venueBoxId || !eventId) { setAssignments({}); return; }
    let cancelled = false;
    getSeatAssignments(venueBoxId, { eventId, sessionId: sessionId || undefined }).then(list => {
      if (cancelled) return;
      const map = {};
      (list || []).forEach(a => { map[a.seatId] = a.guestId; });
      setAssignments(map);
    }).catch(() => { if (!cancelled) setAssignments({}); });
    return () => { cancelled = true; };
  }, [venueBoxId, eventId, sessionId]);

  // Track the viewport's actual rendered size so the plan can be scaled to
  // fit it precisely.
  useEffect(() => {
    if (!viewportEl) return;
    const ro = new ResizeObserver(entries => {
      const box = entries[0]?.contentRect;
      if (box) setViewportSize({ w: box.width, h: box.height });
    });
    ro.observe(viewportEl);
    return () => ro.disconnect();
  }, [viewportEl]);

  // Fit the plan inside the viewport rectangle at its default (unrotated,
  // unpanned) state — rotating/zooming past that is expected to overflow, and
  // dragging is how the user repositions it.
  const fitScale = useMemo(() => {
    if (viewportSize.w <= 0 || viewportSize.h <= 0) return 0;
    return Math.min(viewportSize.w / planSize.w, viewportSize.h / planSize.h) * 0.92;
  }, [viewportSize, planSize]);

  // Assigned seats render colored via the same seatMeta.color mechanism the
  // venue editor uses — display-only, computed here rather than persisted,
  // so this stays in sync with whatever the Seating screen currently shows.
  const renderTables = useMemo(() => {
    if (!tables) return tables;
    return tables.map(t => {
      const ids = t.seatIds || {};
      const assignedIdx = Object.keys(ids).filter(idx => assignments[ids[idx]]);
      if (assignedIdx.length === 0) return t;
      const seatMeta = { ...(t.seatMeta || {}) };
      assignedIdx.forEach(idx => {
        seatMeta[idx] = { ...(seatMeta[idx] || {}), color: ASSIGNED_SEAT_COLOR };
      });
      return { ...t, seatMeta };
    });
  }, [tables, assignments]);

  function startDrag(e) {
    dragState.current = { startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y };
    setDragging(true);
  }

  useEffect(() => {
    if (!dragging) return;
    function onMove(e) {
      const d = dragState.current;
      if (!d) return;
      setPan({ x: d.panX + (e.clientX - d.startX), y: d.panY + (e.clientY - d.startY) });
    }
    function onUp() { setDragging(false); dragState.current = null; }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dragging]);

  function resetView() {
    setViewAngle(0);
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-0)', color: 'var(--ink)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '14px 22px', borderBottom: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>{venueName || (isAr ? 'عرض المكان' : 'Venue view')}</div>
          <div style={{ fontSize: 11, color: 'var(--ink-mute)' }}>{isAr ? 'عرض للقراءة فقط' : 'Read-only view'}</div>
        </div>
        <button className="btn" onClick={() => window.close()}>
          <Icon name="close" size={13}/> {isAr ? 'إغلاق' : 'Close'}
        </button>
      </div>

      <div style={{ flex: 1, position: 'relative', minHeight: 0, margin: 16, borderRadius: 12, border: '1px solid var(--glass-border)', background: 'var(--surface-soft-1)' }}>
        {error ? (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-mute)', fontSize: 13.5, padding: 24, textAlign: 'center' }}>{error}</div>
        ) : tables === null ? (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-mute)', fontSize: 13 }}>{isAr ? 'جارٍ التحميل…' : 'Loading…'}</div>
        ) : (
          <>
            {COMPASS.map(c => (
              <div key={c.key} style={{
                position: 'absolute', fontSize: 13, fontWeight: 700, color: 'var(--accent)',
                letterSpacing: '0.08em', zIndex: 2, pointerEvents: 'none', ...c.style,
              }}>
                {isAr ? c.ar : c.en}
              </div>
            ))}

            <div ref={setViewportEl}
              onMouseDown={startDrag}
              style={{
                position: 'absolute', inset: 0, overflow: 'hidden', borderRadius: 12,
                cursor: dragging ? 'grabbing' : 'grab',
              }}>
              {fitScale > 0 && (
                <div style={{
                  position: 'absolute', left: '50%', top: '50%', width: planSize.w, height: planSize.h,
                  transform: `translate(-50%, -50%) translate(${pan.x}px, ${pan.y}px) rotate(${viewAngle}deg) scale(${fitScale * zoom})`,
                  transformOrigin: 'center center',
                  transition: dragging ? 'none' : 'transform 0.25s ease',
                }}>
                  <div style={{ position: 'relative', width: planSize.w, height: planSize.h, background: 'var(--surface-soft-2)', borderRadius: 8 }}>
                    {tables.length === 0 ? (
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-faint)', fontSize: 20 }}>
                        {isAr ? 'لا عناصر' : 'No elements'}
                      </div>
                    ) : renderTables.map(t => (
                      <CanvasElement
                        key={t.id}
                        table={t}
                        selected={false}
                        showDeleteSeat={false}
                        selectedSeatIndex={null}
                        onMouseDown={undefined}
                        onDeleteSeat={null}
                        onSeatClick={null}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {!error && tables !== null && (
        <div style={{ padding: '14px 22px', borderTop: '1px solid var(--glass-border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
    
            {DIR_PRESETS.map(d => (
              <button key={d.deg} className="btn" style={{ fontSize: 11.5, padding: '4px 10px', ...(viewAngle === d.deg ? { color: 'var(--accent)', borderColor: 'var(--accent)' } : {}) }}
                onClick={() => setViewAngle(d.deg)}>
                {isAr ? d.ar : d.en}
              </button>
            ))}

            <div style={{ width: 1, height: 20, background: 'var(--glass-border)' }}/>

            <span style={{ fontSize: 10.5, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              {isAr ? 'التكبير' : 'Zoom'}
            </span>
            <button className="icon-btn" onClick={() => setZoom(z => Math.max(0.4, +(z - 0.2).toFixed(1)))} style={{ width: 26, height: 26 }}>−</button>
            <span style={{ fontSize: 12, fontFamily: 'var(--mono)', minWidth: 34, textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>
            <button className="icon-btn" onClick={() => setZoom(z => Math.min(2, +(z + 0.2).toFixed(1)))} style={{ width: 26, height: 26 }}>+</button>

            <div style={{ width: 1, height: 20, background: 'var(--glass-border)' }}/>

            <button className="btn" style={{ fontSize: 11.5, padding: '4px 10px' }} onClick={resetView}>
              <Icon name="refresh" size={12}/> {isAr ? 'إعادة ضبط' : 'Reset view'}
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16, justifyContent: 'center', marginTop: 12, fontSize: 11, color: 'var(--ink-mute)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: ASSIGNED_SEAT_COLOR, flexShrink: 0 }}/>
              {isAr ? 'مقعد معيّن' : 'Assigned seat'}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: DISABLED_SEAT_COLOR, flexShrink: 0 }}/>
              {isAr ? 'مقعد معطّل' : 'Disabled seat'}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <Icon name="check" size={11} style={{ color: 'var(--ink-mute)' }}/>
              {isAr ? 'مرّر الفأرة فوق المقعد لعرض المعلومات' : 'Hover a seat to see its info'}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <Icon name="drag" size={11} style={{ color: 'var(--ink-mute)' }}/>
              {isAr ? 'اسحب داخل اللوحة للتحريك' : 'Drag inside the canvas to pan'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
