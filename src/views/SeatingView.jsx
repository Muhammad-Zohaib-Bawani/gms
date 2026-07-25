import React, { useState, useEffect, useRef } from 'react';
import { toArDigits } from '../i18n/translations.js';
import { Avatar } from '../components/UI.jsx';
import { Icon } from '../components/Icons.jsx';
import Select from '../components/ui/Select.jsx';
import toast from '../lib/toast.js';
import { getVenues, getVenue } from '../api/services/venueService.js';
import { listSessions } from '../api/services/eventService.js';
import { listGuests } from '../api/services/guestService.js';
import { assignSeat, unassignSeat, getSeatAssignments } from '../api/services/seatingService.js';
import {
  pickBox, boxToTables, computeCanvasSize, tableHasSeats, seatCodeForIndex, ASSIGNED_SEAT_COLOR,
} from './venue/venueHelpers.js';
import CanvasElement from './venue/canvas/CanvasElement.jsx';

const MIN_ZOOM = 0.3, MAX_ZOOM = 2.5;

function guestInitials(g) {
  return ((g.firstName?.[0] || '') + (g.lastName?.[0] || '')).toUpperCase() || '?';
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function SeatingView({ lang, activeEventId }) {
  const isAr = lang === 'ar';
  const ad = s => isAr ? toArDigits(String(s)) : String(s);

  const STR = isAr ? {
    title: 'الجلوس', sub: 'خطة الطابق · تعيين وإلغاء تعيين المقاعد',
    tabFloor: 'خطة الطابق', tabGuests: 'قائمة الضيوف',
    assignSeat: 'تعيين مقعد', seatAssigned: 'المقعد معيّن',
    unassign: 'إلغاء التعيين', searchGuest: 'بحث عن ضيف…',
    cancel: 'إلغاء', assign: 'تعيين', table: 'الطاولة', seat: 'المقعد', guest: 'الضيف',
    noSeat: '—', assigned: 'معيّن', unassigned: 'غير معيّن',
    totalAssigned: 'مقعد معيّن', totalSeats: 'إجمالي المقاعد',
    venue: 'المكان', session: 'الجلسة',
    noVenues: '— لا أماكن —', noSessions: '— لا جلسات —',
    viewFullscreen: 'عرض ملء الشاشة', loadingFloor: 'جارٍ تحميل المخطط…',
    noFloor: 'لا يوجد مخطط لهذا الاختيار', selectEventFirst: 'يرجى اختيار فعالية من الأعلى لتعيين الضيوف',
    noResults: 'لا نتائج', seatDisabled: 'هذا المقعد معطّل ولا يمكن تعيينه',
  } : {
    title: 'Seating', sub: 'Floor plan · assign and unassign seats',
    tabFloor: 'Floor plan', tabGuests: 'Guest list',
    assignSeat: 'Assign seat', seatAssigned: 'Seat assigned',
    unassign: 'Unassign', searchGuest: 'Search guest…',
    cancel: 'Cancel', assign: 'Assign', table: 'Table', seat: 'Seat', guest: 'Guest',
    noSeat: '—', assigned: 'Assigned', unassigned: 'Unassigned',
    totalAssigned: 'seats assigned', totalSeats: 'total seats',
    venue: 'Venue', session: 'Session',
    noVenues: '— No venues —', noSessions: '— No sessions —',
    viewFullscreen: 'View fullscreen', loadingFloor: 'Loading layout…',
    noFloor: 'No layout for this selection', selectEventFirst: 'Select an event from the top bar to assign guests',
    noResults: 'No results', seatDisabled: 'This seat is disabled and cannot be assigned',
  };

  // ── Venue / Session selection — event comes from the app's active event,
  // not a local dropdown, so it always matches what the rest of the app is
  // showing (top bar / sidebar), and there's no local eventId state at all.
  const eventId = activeEventId || '';
  const [venues, setVenues] = useState([]);
  const [venueId, setVenueId] = useState('');
  const [sessions, setSessions] = useState([]);
  const [sessionId, setSessionId] = useState('');

  useEffect(() => {
    getVenues()
      .then(list => {
        const mapped = (list || []).map(v => ({ id: v.id, name: v.venueName }));
        setVenues(mapped);
        setVenueId(prev => prev || mapped[0]?.id || '');
      })
      .catch(() => setVenues([]));
  }, []);

  // Sessions load per active event; no event or an event with none → empty dropdown.
  useEffect(() => {
    setSessionId('');
    if (!eventId) { setSessions([]); return; }
    listSessions(eventId).then(r => setSessions(r || [])).catch(() => setSessions([]));
  }, [eventId]);

  const venueOptions = venues.map(v => ({ value: v.id, label: v.name }));
  const sessionOptions = sessions.map(s => ({ value: s.id, label: s.title }));

  // ── Floor plan (real venue data) ────────────────────────────────────────────
  const [box, setBox] = useState(null);
  const [tables, setTables] = useState([]);
  const [canvasSize, setCanvasSize] = useState({ w: 1400, h: 900 });
  const [loadingFloor, setLoadingFloor] = useState(false);
  const [assignments, setAssignments] = useState({}); // seatId -> guestId

  useEffect(() => {
    if (!venueId) { setTables([]); setBox(null); return; }
    let cancelled = false;
    setLoadingFloor(true);
    getVenue(venueId).then(v => {
      if (cancelled) return;
      const b = pickBox(v.venueBoxes, eventId || null, sessionId || null);
      const tbls = boxToTables(b);
      setBox(b);
      setTables(tbls);
      setCanvasSize(computeCanvasSize(b, tbls));
    }).catch(() => { if (!cancelled) { setTables([]); setBox(null); } })
      .finally(() => { if (!cancelled) setLoadingFloor(false); });
    return () => { cancelled = true; };
  }, [venueId, eventId, sessionId]);

  // Real seat->guest assignments for this (venue box, event, session) scope.
  // Assigning requires a real event (mirrors the backend's Seating model, which
  // is always scoped to an event), so this stays empty until one is picked.
  useEffect(() => {
    if (!box?.id || !eventId) { setAssignments({}); return; }
    let cancelled = false;
    getSeatAssignments(box.id, { eventId, sessionId: sessionId || undefined }).then(list => {
      if (cancelled) return;
      const map = {};
      (list || []).forEach(a => { map[a.seatId] = a.guestId; });
      setAssignments(map);
    }).catch(() => { if (!cancelled) setAssignments({}); });
    return () => { cancelled = true; };
  }, [box, eventId, sessionId]);

  // Event roster, for both the "Guest list" tab and the assign-seat search —
  // guests are event-scoped, so this reloads whenever the event changes.
  const [guests, setGuests] = useState([]);
  useEffect(() => {
    if (!eventId) { setGuests([]); return; }
    listGuests({ eventId, pageSize: 100, excludeDeclined: true }).then(page => setGuests(page?.items || [])).catch(() => setGuests([]));
  }, [eventId]);

  const [tab, setTab] = useState('floor');
  const [assignModal, setAssignModal] = useState(null);
  const [assignSearch, setAssignSearch] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [zoom, setZoom] = useState(1.0);
  const scrollRef = useRef(null);

  function zoomIn()    { setZoom(z => Math.min(MAX_ZOOM, +((z + 0.1).toFixed(1)))); }
  function zoomOut()   { setZoom(z => Math.max(MIN_ZOOM, +((z - 0.1).toFixed(1)))); }
  function zoomReset() { setZoom(1.0); }

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
  }, []);

  function openFullscreenView() {
    const params = new URLSearchParams({
      screen: 'venueView',
      venueId: venueId || '',
      eventId: eventId || '',
      sessionId: sessionId || '',
      lang,
    });
    window.open(`${window.location.origin}${window.location.pathname}?${params.toString()}`, '_blank', 'noopener');
  }

  function handleSeatClick(table, seatIdx) {
    const seatId = table.seatIds?.[seatIdx];
    if (!seatId) {
      toast.error(isAr ? 'تعذّر تحديد هذا المقعد' : 'Could not identify this seat');
      return;
    }
    setAssignModal({ table, seatIdx, seatId, guestId: assignments[seatId] || null });
    setAssignSearch('');
  }

  async function doAssign(guestId) {
    if (!eventId) return;
    setAssigning(true);
    try {
      await assignSeat({ seatId: assignModal.seatId, guestId, eventId, sessionId: sessionId || null });
      setAssignments(prev => {
        const next = { ...prev };
        // A guest can only sit in one seat within this scope — drop wherever they were.
        for (const k of Object.keys(next)) if (next[k] === guestId) delete next[k];
        next[assignModal.seatId] = guestId;
        return next;
      });
      setAssignModal(null);
      toast.success(isAr ? 'تم تعيين المقعد' : 'Seat assigned');
    } catch (err) {
      toast.error(err?.message || (isAr ? 'تعذّر تعيين المقعد' : 'Could not assign seat'));
    } finally {
      setAssigning(false);
    }
  }

  async function doUnassign() {
    if (!box?.id || !eventId) return;
    setAssigning(true);
    try {
      await unassignSeat(assignModal.seatId, { venueBoxId: box.id, eventId, sessionId: sessionId || null });
      setAssignments(prev => {
        const next = { ...prev };
        delete next[assignModal.seatId];
        return next;
      });
      setAssignModal(null);
      toast.success(isAr ? 'تم إلغاء التعيين' : 'Seat unassigned');
    } catch (err) {
      toast.error(err?.message || (isAr ? 'تعذّر إلغاء التعيين' : 'Could not unassign seat'));
    } finally {
      setAssigning(false);
    }
  }

  const assignedGuest = assignModal?.guestId ? guests.find(g => g.id === assignModal.guestId) : null;
  // Disabled seats can't be assigned (the backend enforces this too — this is
  // just so the UI doesn't let someone search/pick a guest for a seat that's
  // guaranteed to be rejected). A seat that was assigned before being disabled
  // can still be unassigned, just not newly assigned to someone else.
  const isSeatDisabled = !!assignModal?.table?.seatMeta?.[assignModal?.seatIdx]?.isDisabled;
  const alreadyAssigned = new Set(Object.values(assignments));
  const filteredForAssign = guests
    .filter(g => !alreadyAssigned.has(g.id) && (!assignSearch || g.fullName?.toLowerCase().includes(assignSearch.toLowerCase())))
    .slice(0, 8);

  // assignments is keyed by the real seat GUID, so resolving it back to a
  // (table, seatIdx) location needs the same seatIds map boxToTables built.
  const seatIdIndex = {};
  tables.forEach(t => {
    Object.entries(t.seatIds || {}).forEach(([idx, sid]) => { seatIdIndex[sid] = { table: t, seatIdx: +idx }; });
  });

  // Assigned seats render colored via the same seatMeta.color mechanism the
  // venue editor already uses — computed here, display-only, so assignment
  // status never gets persisted back into the actual layout.
  const renderTables = tables.map(t => {
    const ids = t.seatIds || {};
    const assignedIdx = Object.keys(ids).filter(idx => assignments[ids[idx]]);
    if (assignedIdx.length === 0) return t;
    const seatMeta = { ...(t.seatMeta || {}) };
    assignedIdx.forEach(idx => {
      seatMeta[idx] = { ...(seatMeta[idx] || {}), color: ASSIGNED_SEAT_COLOR };
    });
    return { ...t, seatMeta };
  });

  const seatByGuest = {};
  Object.entries(assignments).forEach(([seatId, gId]) => {
    const loc = seatIdIndex[seatId];
    if (loc) seatByGuest[gId] = loc;
  });

  const totalSeats = tables.reduce((acc, t) => {
    const r = (t.removedSeats || []).length;
    if (t.type === 'round')   return acc + Math.max(0, (t.seats || 0) - r);
    if (t.type === 'rect')    return acc + Math.max(0, (t.seatsPerSide || 0) * 2 - r);
    if (t.type === 'stadium') return acc + Math.max(0, (t.rows || 0) * (t.seatsPerRow || 0) - r);
    return acc;
  }, 0);

  const totalAssigned = Object.keys(assignments).filter(seatId => seatIdIndex[seatId]).length;
  const inputStyle = { width:'100%', background:'var(--surface-soft-3)', border:'1px solid var(--glass-border)', borderRadius:8, padding:'9px 12px', color:'var(--ink)', fontSize:13, boxSizing:'border-box' };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{STR.title}</h1>
          <div className="page-sub">{STR.sub}</div>
        </div>
        <div className="page-actions">
          <span style={{ fontSize:12, color:'var(--ink-mute)' }}>
            <strong style={{ color:'var(--accent)' }}>{ad(totalAssigned)}</strong> / {ad(totalSeats)} {STR.totalSeats}
          </span>
        </div>
      </div>

      {/* Venue / Event / Session selectors */}
      <div className="card" style={{ padding: '10px 14px', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10.5, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600, flexShrink: 0 }}>
            {STR.venue}
          </span>
          <div style={{ minWidth: 200, flexShrink: 0 }}>
            <Select value={venueId} onChange={setVenueId} options={venueOptions} placeholder={STR.noVenues}/>
          </div>
          <span style={{ fontSize: 10.5, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600, flexShrink: 0 }}>
            {STR.session}
          </span>
          <div style={{ minWidth: 200, flexShrink: 0 }}>
            <Select value={sessionId} onChange={v => setSessionId(v || '')} options={sessionOptions}
              placeholder={STR.noSessions} isDisabled={!eventId} isClearable/>
          </div>
          <button className="btn" style={{ marginLeft: 'auto', flexShrink: 0 }} onClick={openFullscreenView} disabled={!venueId}>
            <Icon name="expand" size={14}/> {STR.viewFullscreen}
          </button>
        </div>
      </div>

      <div className="tabs" style={{ marginBottom:16 }}>
        {[['floor', STR.tabFloor], ['guests', STR.tabGuests]].map(([k, l]) => (
          <button key={k} className={`tab${tab === k ? ' active' : ''}`} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      {tab === 'floor' && (
        <div className="card" style={{ padding:0, overflow:'hidden', display:'flex', flexDirection:'column' }}>
          {/* Zoom toolbar */}
          <div style={{ padding:'6px 12px', borderBottom:'1px solid var(--glass-border)', display:'flex', alignItems:'center', gap:6, background:'var(--surface-soft-3)', flexShrink:0 }}>
            <span style={{ fontSize:10.5, color:'var(--ink-mute)', textTransform:'uppercase', letterSpacing:'0.1em', marginRight:2 }}>
              {isAr ? 'التكبير' : 'Zoom'}
            </span>
            <button className="icon-btn" onClick={zoomOut} disabled={zoom <= MIN_ZOOM}
              style={{ fontSize:16, fontWeight:300, lineHeight:'24px', width:28, height:28 }}>−</button>
            <span style={{ fontSize:12, fontFamily:'var(--mono)', minWidth:38, textAlign:'center', color:'var(--ink)' }}>
              {Math.round(zoom * 100)}%
            </span>
            <button className="icon-btn" onClick={zoomIn} disabled={zoom >= MAX_ZOOM}
              style={{ fontSize:16, fontWeight:300, lineHeight:'24px', width:28, height:28 }}>+</button>
            <button className="btn" style={{ fontSize:11, padding:'3px 9px', marginLeft:2 }} onClick={zoomReset}>
              {isAr ? 'إعادة' : 'Reset'}
            </button>
            <span style={{ marginLeft:'auto', fontSize:10.5, color:'var(--ink-faint)' }}>
              {isAr ? 'Ctrl+scroll للتكبير' : 'Ctrl+scroll to zoom'}
            </span>
          </div>

          {/* Scrollable canvas */}
          <div ref={scrollRef} style={{ overflow:'auto', minHeight:460, position: 'relative' }}>
            {loadingFloor ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-mute)', fontSize: 13 }}>{STR.loadingFloor}</div>
            ) : !venueId ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-faint)', fontSize: 13 }}>{STR.noVenues}</div>
            ) : tables.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-faint)', fontSize: 13 }}>{STR.noFloor}</div>
            ) : (
              <div style={{ width: canvasSize.w * zoom, height: canvasSize.h * zoom, position:'relative', flexShrink:0 }}>
                <div style={{
                  position:'absolute', top:0, left:0,
                  width: canvasSize.w, height: canvasSize.h,
                  transform:`scale(${zoom})`,
                  transformOrigin:'top left',
                  background:'var(--surface-soft-2)',
                }}>
                  <svg style={{ position:'absolute', inset:0, width:'100%', height:'100%', pointerEvents:'none' }}>
                    <defs>
                      <pattern id="sgrid" width="40" height="40" patternUnits="userSpaceOnUse">
                        <path d="M 40 0 L 0 0 0 40" fill="none" stroke="var(--glass-border)" strokeWidth="0.4"/>
                      </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#sgrid)"/>
                  </svg>

                  {renderTables.map(t => (
                    <CanvasElement
                      key={t.id}
                      table={t}
                      selected={false}
                      showDeleteSeat={false}
                      selectedSeatIndex={null}
                      onMouseDown={undefined}
                      onDeleteSeat={null}
                      onSeatClick={tableHasSeats(t) ? (index => handleSeatClick(t, index)) : null}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Legend */}
          <div style={{ padding:'10px 16px', borderTop:'1px solid var(--glass-border)', display:'flex', gap:16, fontSize:11, flexShrink:0, flexWrap: 'wrap' }}>
            <span style={{ display:'flex', alignItems:'center', gap:5 }}>
              <svg width={14} height={14}><circle cx={7} cy={7} r={6} fill="var(--accent)"/></svg>
              {STR.assigned}
            </span>
            <span style={{ display:'flex', alignItems:'center', gap:5 }}>
              <svg width={14} height={14}><circle cx={7} cy={7} r={6} fill="var(--surface-soft-3)" stroke="var(--glass-border)" strokeWidth="1"/></svg>
              {STR.unassigned}
            </span>
            <span style={{ display:'flex', alignItems:'center', gap:5 }}>
              <svg width={14} height={14}><rect x={1} y={1} width={12} height={12} rx={2} fill="rgba(224,184,100,0.2)" stroke="rgba(224,184,100,0.5)" strokeWidth="1"/></svg>
              {isAr ? 'مسرح' : 'Stage'}
            </span>
            <span style={{ display:'flex', alignItems:'center', gap:5 }}>
              <svg width={14} height={14}><rect x={1} y={1} width={12} height={12} rx={2} fill="rgba(90,191,110,0.15)" stroke="rgba(90,191,110,0.4)" strokeWidth="1"/></svg>
              {isAr ? 'منطقة الملعب' : 'Pitch Area'}
            </span>
          </div>
        </div>
      )}

      {tab === 'guests' && (
        <div className="card" style={{ padding:0 }}>
          <table className="table">
            <thead>
              <tr>
                <th>{STR.guest}</th>
                <th>{STR.table}</th>
                <th>{STR.seat}</th>
              </tr>
            </thead>
            <tbody>
              {guests.length === 0 ? (
                <tr><td colSpan={3} style={{ textAlign: 'center', padding: 24, color: 'var(--ink-faint)', fontSize: 13 }}>
                  {eventId ? STR.noResults : STR.selectEventFirst}
                </td></tr>
              ) : guests.map(g => {
                const info = seatByGuest[g.id];
                return (
                  <tr key={g.id}>
                    <td>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <Avatar initials={guestInitials(g)} size={26} tier={g.tier}/>
                        <div>
                          <div style={{ fontSize:12.5, fontWeight:500 }}>{g.fullName}</div>
                          <div style={{ fontSize:11, color:'var(--ink-mute)' }}>{g.organization}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ fontSize:12, fontFamily:'var(--mono)' }}>
                      {info ? info.table.label : <span style={{ color:'var(--ink-faint)' }}>—</span>}
                    </td>
                    <td>
                      {info ? (() => {
                        const cc = info.table.color;
                        return (
                          <span style={{
                            display:'inline-flex', alignItems:'center', gap:5,
                            fontSize:11, fontFamily:'var(--mono)', fontWeight:500,
                            padding:'2px 9px', borderRadius:20,
                            color: cc || 'var(--accent)',
                            background: cc ? `${cc}1a` : 'rgba(141, 1, 52,0.08)',
                            border:`1px solid ${cc ? `${cc}4d` : 'rgba(141, 1, 52,0.2)'}`,
                          }}>
                            {cc && <span style={{ width:6, height:6, borderRadius:'50%', background:cc, flexShrink:0 }}/>}
                            {isAr ? `مقعد ${ad(seatCodeForIndex(info.table, info.seatIdx))}` : `Seat ${seatCodeForIndex(info.table, info.seatIdx)}`}
                          </span>
                        );
                      })() : (
                        <span style={{ color:'var(--ink-faint)', fontSize:12 }}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {assignModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}>
          <div className="card glass" style={{ width:360, padding:0 }}>
            <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--glass-border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div>
                <div style={{ fontWeight:600, fontSize:14 }}>{assignModal.guestId ? STR.seatAssigned : STR.assignSeat}</div>
                <div style={{ fontSize:11, color:'var(--ink-mute)', marginTop:2, fontFamily:'var(--mono)' }}>
                  <span style={{ color: assignModal.table.color || 'var(--accent)' }}>{assignModal.table.label}</span>
                  {' · '}
                  <span>{isAr ? `مقعد ` : 'Seat '}{seatCodeForIndex(assignModal.table, assignModal.seatIdx)}</span>
                </div>
              </div>
              <button className="icon-btn" onClick={() => setAssignModal(null)}><Icon name="close" size={14}/></button>
            </div>
            <div style={{ padding:'16px 20px' }}>
              {!eventId ? (
                <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--ink-faint)', fontSize: 13 }}>
                  {STR.selectEventFirst}
                </div>
              ) : isSeatDisabled && !assignedGuest ? (
                <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--ink-faint)', fontSize: 13 }}>
                  {STR.seatDisabled}
                </div>
              ) : assignedGuest ? (
                <>
                  <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:18, padding:'10px 14px', background:'var(--surface-soft-2)', borderRadius:10 }}>
                    <Avatar initials={guestInitials(assignedGuest)} size={36} tier={assignedGuest.tier}/>
                    <div>
                      <div style={{ fontWeight:600 }}>{assignedGuest.fullName}</div>
                      <div style={{ fontSize:11, color:'var(--ink-mute)' }}>{assignedGuest.guestType} · {assignedGuest.organization}</div>
                      <div style={{ fontSize:11, color:'var(--accent)', fontFamily:'var(--mono)', marginTop:2 }}>
                        {assignedGuest.tier} · {assignedGuest.nationalityName}
                      </div>
                    </div>
                  </div>
                  <div style={{ display:'flex', gap:8 }}>
                    <button className="btn" style={{ flex:1 }} onClick={() => setAssignModal(null)} disabled={assigning}>{STR.cancel}</button>
                    <button className="btn" style={{ flex:1, color:'#e08a7e', borderColor:'rgba(224,138,126,0.3)' }} onClick={doUnassign} disabled={assigning}>
                      <Icon name="x" size={13}/> {STR.unassign}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <input style={inputStyle} value={assignSearch} onChange={e => setAssignSearch(e.target.value)}
                    placeholder={STR.searchGuest} autoFocus/>
                  <div style={{ marginTop:8, display:'flex', flexDirection:'column', gap:4, maxHeight:240, overflowY:'auto' }}>
                    {filteredForAssign.map(g => (
                      <div key={g.id} onClick={() => !assigning && doAssign(g.id)}
                        style={{ padding:'8px 10px', borderRadius:8, cursor: assigning ? 'default' : 'pointer', opacity: assigning ? 0.6 : 1, display:'flex', alignItems:'center', gap:10, border:'1px solid var(--glass-border)', background:'var(--surface-soft-2)' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-soft-3)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'var(--surface-soft-2)'}>
                        <Avatar initials={guestInitials(g)} size={28} tier={g.tier}/>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:13, fontWeight:500 }}>{g.fullName}</div>
                          <div style={{ fontSize:11, color:'var(--ink-mute)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{g.guestType} · {g.organization}</div>
                        </div>
                        <Icon name="plus" size={13} style={{ color:'var(--accent)', flexShrink:0 }}/>
                      </div>
                    ))}
                    {filteredForAssign.length === 0 && (
                      <div style={{ padding:'12px', textAlign:'center', color:'var(--ink-faint)', fontSize:12 }}>
                        {STR.noResults}
                      </div>
                    )}
                  </div>
                  <button className="btn" style={{ width:'100%', marginTop:10, justifyContent:'center' }} onClick={() => setAssignModal(null)} disabled={assigning}>
                    {STR.cancel}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
