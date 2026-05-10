import React, { useState, useEffect, useRef } from 'react';
import { toArDigits } from '../i18n/translations.js';
import { Avatar } from '../components/UI.jsx';
import { Icon } from '../components/Icons.jsx';
import { GUESTS } from '../data/mockData.js';

const TABLE_R = 30, SEAT_R = 8, SEAT_DIST = TABLE_R + SEAT_R + 7;
const ROUND_SIZE = (SEAT_DIST + SEAT_R + 5) * 2;
const ROW_LABEL_W = 20;

function hexToRgba(hex, alpha) {
  if (!hex || !hex.startsWith('#')) return null;
  const r = parseInt(hex.slice(1,3), 16);
  const g = parseInt(hex.slice(3,5), 16);
  const b = parseInt(hex.slice(5,7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function getSeatLabel(table, seatIdx) {
  if (table.type === 'stadium') {
    const row = Math.floor(seatIdx / table.seatsPerRow);
    const col = seatIdx % table.seatsPerRow;
    const rowName = (table.rowNames || [])[row] ?? String.fromCharCode(65 + row);
    const seatNum = (table.seatNumbers || {})[`${row}-${col}`] ?? String(col + 1);
    return `${rowName}${seatNum}`;
  }
  return String(seatIdx + 1);
}

const DEFAULT_TABLES = [
  { id:'t1',  type:'round',   x:10,  y:10,  seats:8,  label:'T-01', removedSeats:[] },
  { id:'t2',  type:'round',   x:140, y:10,  seats:8,  label:'T-02', removedSeats:[] },
  { id:'t3',  type:'round',   x:270, y:10,  seats:10, label:'T-03', removedSeats:[] },
  { id:'t4',  type:'round',   x:400, y:10,  seats:8,  label:'T-04', removedSeats:[] },
  { id:'t5',  type:'round',   x:530, y:10,  seats:8,  label:'T-05', removedSeats:[] },
  { id:'t6',  type:'round',   x:10,  y:150, seats:10, label:'T-06', removedSeats:[] },
  { id:'t7',  type:'round',   x:140, y:150, seats:8,  label:'T-07', removedSeats:[] },
  { id:'t8',  type:'round',   x:270, y:150, seats:8,  label:'T-08', removedSeats:[] },
  { id:'t9',  type:'round',   x:400, y:150, seats:10, label:'T-09', removedSeats:[] },
  { id:'t10', type:'round',   x:530, y:150, seats:8,  label:'T-10', removedSeats:[] },
  { id:'t11', type:'rect',    x:680, y:10,  seatsPerSide:4, label:'T-11', removedSeats:[] },
  { id:'t12', type:'rect',    x:680, y:110, seatsPerSide:4, label:'T-12', removedSeats:[] },
  { id:'t13', type:'stadium', x:10,  y:300, rows:3, seatsPerRow:12, label:'Blk-A', removedSeats:[] },
];

function buildDefaultAssignments(tables) {
  const asgn = {};
  let gi = 0;
  for (const t of tables) {
    if (t.type === 'stage' || t.type === 'pitch') continue;
    const removed = new Set(t.removedSeats || []);
    const total = t.type === 'round' ? t.seats
      : t.type === 'rect' ? t.seatsPerSide * 2
      : t.rows * t.seatsPerRow;
    for (let i = 0; i < total && gi < 10; i++) {
      if (!removed.has(i)) { asgn[`${t.id}::${i}`] = GUESTS[gi].id; gi++; }
    }
    if (gi >= 10) break;
  }
  return asgn;
}

// ─── Floor plan renderers (with seat-click for assignment) ───────────────────

function RoundTable({ table, assignments, onSeatClick }) {
  const cx = ROUND_SIZE / 2, cy = ROUND_SIZE / 2;
  const removed = new Set(table.removedSeats || []);
  return (
    <svg width={ROUND_SIZE} height={ROUND_SIZE} style={{ display:'block' }}>
      <circle cx={cx} cy={cy} r={TABLE_R} fill="rgba(26,174,196,0.1)" stroke="rgba(26,174,196,0.45)" strokeWidth="1.5"/>
      <text x={cx} y={cy+4} textAnchor="middle" fontSize="9" fill="var(--ink)" fontFamily="var(--mono)" fontWeight="600">{table.label}</text>
      {Array.from({ length: table.seats }, (_, i) => {
        if (removed.has(i)) return null;
        const angle = (i / table.seats) * Math.PI * 2 - Math.PI / 2;
        const sx = cx + Math.cos(angle) * SEAT_DIST;
        const sy = cy + Math.sin(angle) * SEAT_DIST;
        const key = `${table.id}::${i}`;
        const gId = assignments[key];
        const g = gId ? GUESTS.find(x => x.id === gId) : null;
        return (
          <g key={i} style={{ cursor:'pointer' }} onClick={() => onSeatClick(table, i, gId)}>
            <circle cx={sx} cy={sy} r={SEAT_R} fill={gId ? 'var(--accent)' : 'var(--surface-soft-3)'} stroke={gId ? 'var(--accent)' : 'var(--glass-border)'} strokeWidth="1"/>
            {g  && <text x={sx} y={sy+3} textAnchor="middle" fontSize="6" fill="#fff" fontWeight="bold">{g.initials}</text>}
            {!g && <text x={sx} y={sy+3} textAnchor="middle" fontSize="7" fill="var(--ink-faint)">{i+1}</text>}
          </g>
        );
      })}
    </svg>
  );
}

function RectTable({ table, assignments, onSeatClick }) {
  const sps = table.seatsPerSide;
  const tblW = sps * 24, tblH = 28, tblX = 10, tblY = 26;
  const w = tblW + 20, h = tblH + 52;
  const seatY1 = 10, seatY2 = h - 10;
  const removed = new Set(table.removedSeats || []);
  return (
    <svg width={w} height={h} style={{ display:'block' }}>
      <rect x={tblX} y={tblY} width={tblW} height={tblH} rx={4} fill="rgba(26,174,196,0.1)" stroke="rgba(26,174,196,0.45)" strokeWidth="1.5"/>
      <text x={tblX+tblW/2} y={tblY+tblH/2+4} textAnchor="middle" fontSize="9" fill="var(--ink)" fontFamily="var(--mono)" fontWeight="600">{table.label}</text>
      {Array.from({ length: sps }, (_, i) => {
        const sx = tblX + (i + 0.5) * 24;
        const ti = i, bi = sps + i;
        const tgId = assignments[`${table.id}::${ti}`];
        const bgId = assignments[`${table.id}::${bi}`];
        const tg = tgId ? GUESTS.find(x => x.id === tgId) : null;
        const bg = bgId ? GUESTS.find(x => x.id === bgId) : null;
        return (
          <g key={i}>
            {!removed.has(ti) && (
              <g style={{ cursor:'pointer' }} onClick={() => onSeatClick(table, ti, tgId)}>
                <circle cx={sx} cy={seatY1} r={SEAT_R} fill={tgId ? 'var(--accent)' : 'var(--surface-soft-3)'} stroke={tgId ? 'var(--accent)' : 'var(--glass-border)'} strokeWidth="1"/>
                {tg  ? <text x={sx} y={seatY1+3} textAnchor="middle" fontSize="6" fill="#fff" fontWeight="bold">{tg.initials}</text>
                     : <text x={sx} y={seatY1+3} textAnchor="middle" fontSize="7" fill="var(--ink-faint)">{ti+1}</text>}
              </g>
            )}
            {!removed.has(bi) && (
              <g style={{ cursor:'pointer' }} onClick={() => onSeatClick(table, bi, bgId)}>
                <circle cx={sx} cy={seatY2} r={SEAT_R} fill={bgId ? 'var(--accent)' : 'var(--surface-soft-3)'} stroke={bgId ? 'var(--accent)' : 'var(--glass-border)'} strokeWidth="1"/>
                {bg  ? <text x={sx} y={seatY2+3} textAnchor="middle" fontSize="6" fill="#fff" fontWeight="bold">{bg.initials}</text>
                     : <text x={sx} y={seatY2+3} textAnchor="middle" fontSize="7" fill="var(--ink-faint)">{bi+1}</text>}
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function StadiumTable({ table, assignments, onSeatClick }) {
  const step = 22, seatW = 16, seatH = 16;
  const w = ROW_LABEL_W + table.seatsPerRow * step + 16;
  const h = table.rows * step + 30;
  const removed = new Set(table.removedSeats || []);
  const rowNamesArr = table.rowNames || [];
  const seatNums = table.seatNumbers || {};
  const cc = table.categoryColor;
  const blockColor   = cc || null;
  const assignedFill = blockColor || 'var(--accent)';
  const blockBg      = blockColor ? hexToRgba(blockColor, 0.07) : 'rgba(26,174,196,0.05)';
  const blockStroke  = blockColor ? hexToRgba(blockColor, 0.35) : 'rgba(26,174,196,0.3)';
  const rowLabelFill = blockColor || 'var(--accent)';
  const labelFill    = blockColor || 'var(--accent)';
  return (
    <svg width={w} height={h} style={{ display:'block' }}>
      <rect x={1} y={1} width={w-2} height={h-2} rx={6} fill={blockBg} stroke={blockStroke} strokeWidth="1" strokeDasharray="4 3"/>
      <text x={w/2} y={14} textAnchor="middle" fontSize="9" fill={labelFill} fontFamily="var(--mono)" fontWeight="600">{table.label}</text>
      {Array.from({ length: table.rows }, (_, row) => {
        const rowName = rowNamesArr[row] !== undefined ? rowNamesArr[row] : String.fromCharCode(65 + row);
        const by0 = 20 + row * step;
        return (
          <g key={row}>
            <text x={8 + ROW_LABEL_W / 2} y={by0 + seatH / 2 + 4}
              textAnchor="middle" fontSize="8" fill={rowLabelFill} fontFamily="var(--mono)" fontWeight="700">
              {rowName}
            </text>
            {Array.from({ length: table.seatsPerRow }, (_, col) => {
              const idx = row * table.seatsPerRow + col;
              if (removed.has(idx)) return null;
              const skey = `${row}-${col}`;
              const displayNum = seatNums[skey] !== undefined ? seatNums[skey] : String(col + 1);
              const gId = assignments[`${table.id}::${idx}`];
              const g = gId ? GUESTS.find(x => x.id === gId) : null;
              const bx = 8 + ROW_LABEL_W + col * step;
              const by = by0;
              const cx = bx + seatW / 2, cy = by + seatH / 2;
              const unassignedFill   = blockColor ? hexToRgba(blockColor, 0.13) : 'var(--surface-soft-3)';
              const unassignedStroke = blockColor ? hexToRgba(blockColor, 0.4)  : 'var(--glass-border)';
              return (
                <g key={skey} style={{ cursor:'pointer' }} onClick={() => onSeatClick(table, idx, gId)}>
                  <rect x={bx} y={by} width={seatW} height={seatH} rx={3}
                    fill={gId ? assignedFill : unassignedFill}
                    stroke={gId ? assignedFill : unassignedStroke}
                    strokeWidth="0.8"/>
                  {g
                    ? <text x={cx} y={cy + 3} textAnchor="middle" fontSize="5" fill="#fff" fontWeight="bold">{g.initials}</text>
                    : <text x={cx} y={cy + 3.5} textAnchor="middle" fontSize="6"
                        fill={blockColor ? (hexToRgba(blockColor, 0.75) || 'var(--ink-faint)') : 'var(--ink-faint)'}>
                        {displayNum}
                      </text>
                  }
                </g>
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}

function StageDisplay({ table }) {
  const w = table.stageW || 220, h = table.stageH || 80;
  const svgW = w + 20, svgH = h + 34;
  return (
    <svg width={svgW} height={svgH} style={{ display:'block' }}>
      <text x={svgW/2} y={12} textAnchor="middle" fontSize="9" fill="#e0b864" fontFamily="var(--mono)" fontWeight="600">{table.label}</text>
      <rect x={2} y={16} width={w+16} height={h+10} rx={3} fill="rgba(224,184,100,0.05)" stroke="rgba(224,184,100,0.18)" strokeWidth="1"/>
      <rect x={6} y={19} width={w+8} height={h+6} rx={3} fill="rgba(224,184,100,0.09)" stroke="rgba(224,184,100,0.28)" strokeWidth="1"/>
      <rect x={10} y={22} width={w} height={h} rx={4} fill="rgba(224,184,100,0.14)" stroke="rgba(224,184,100,0.48)" strokeWidth="1.5"/>
      <text x={svgW/2} y={22+h/2+5} textAnchor="middle" fontSize="10" fill="rgba(224,184,100,0.6)" fontFamily="sans-serif" fontWeight="700" letterSpacing="2">▲ STAGE</text>
    </svg>
  );
}

function PitchDisplay({ table }) {
  const pw = table.pitchW || 280, ph = table.pitchH || 140;
  const svgW = pw + 20, svgH = ph + 30;
  const fx = 10, fy = 22;
  const cr = Math.min(pw, ph) * 0.13;
  return (
    <svg width={svgW} height={svgH} style={{ display:'block' }}>
      <text x={svgW/2} y={13} textAnchor="middle" fontSize="9" fill="#5abf6e" fontFamily="var(--mono)" fontWeight="600">{table.label}</text>
      <rect x={fx} y={fy} width={pw} height={ph} rx={6} fill="rgba(90,191,110,0.07)" stroke="rgba(90,191,110,0.36)" strokeWidth="1.5"/>
      <line x1={fx+pw/2} y1={fy+5} x2={fx+pw/2} y2={fy+ph-5} stroke="rgba(90,191,110,0.26)" strokeWidth="1" strokeDasharray="5 3"/>
      <circle cx={fx+pw/2} cy={fy+ph/2} r={cr} fill="none" stroke="rgba(90,191,110,0.26)" strokeWidth="1"/>
      <circle cx={fx+pw/2} cy={fy+ph/2} r={2.5} fill="rgba(90,191,110,0.45)"/>
      <text x={svgW/2} y={fy+ph/2+4} textAnchor="middle" fontSize="9" fill="rgba(90,191,110,0.48)" fontFamily="sans-serif" fontWeight="700" letterSpacing="1.5">PITCH AREA</text>
    </svg>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function SeatingView({ lang }) {
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
  } : {
    title: 'Seating', sub: 'Floor plan · assign and unassign seats',
    tabFloor: 'Floor plan', tabGuests: 'Guest list',
    assignSeat: 'Assign seat', seatAssigned: 'Seat assigned',
    unassign: 'Unassign', searchGuest: 'Search guest…',
    cancel: 'Cancel', assign: 'Assign', table: 'Table', seat: 'Seat', guest: 'Guest',
    noSeat: '—', assigned: 'Assigned', unassigned: 'Unassigned',
    totalAssigned: 'seats assigned', totalSeats: 'total seats',
  };

  const [venueData, setVenueData] = useState(null);
  const [assignments, setAssignments] = useState({});
  const [tab, setTab] = useState('floor');
  const [assignModal, setAssignModal] = useState(null);
  const [assignSearch, setAssignSearch] = useState('');
  const [zoom, setZoom] = useState(1.0);
  const scrollRef = useRef(null);

  const MIN_ZOOM = 0.3, MAX_ZOOM = 2.5, CANVAS_W = 1400, CANVAS_H = 900;
  function zoomIn()    { setZoom(z => Math.min(MAX_ZOOM, +((z + 0.1).toFixed(1)))); }
  function zoomOut()   { setZoom(z => Math.max(MIN_ZOOM, +((z - 0.1).toFixed(1)))); }
  function zoomReset() { setZoom(1.0); }

  useEffect(() => {
    let venue = null, asgn = null;
    try {
      const sv = localStorage.getItem('gms-venue');
      if (sv) venue = JSON.parse(sv);
      const sa = localStorage.getItem('gms-assignments');
      if (sa) asgn = JSON.parse(sa);
    } catch(e) {}
    const tables = venue?.tables || DEFAULT_TABLES;
    setVenueData({ tables });
    setAssignments(asgn || buildDefaultAssignments(tables));
  }, []);

  function handleSeatClick(table, seatIdx, guestId) {
    setAssignModal({ tableId: table.id, table, seatIdx, guestId: guestId || null });
    setAssignSearch('');
  }

  function doAssign(guestId) {
    const key = `${assignModal.tableId}::${assignModal.seatIdx}`;
    const newAsgn = Object.fromEntries(Object.entries(assignments).filter(([, v]) => v !== guestId));
    newAsgn[key] = guestId;
    setAssignments(newAsgn);
    localStorage.setItem('gms-assignments', JSON.stringify(newAsgn));
    setAssignModal(null);
  }

  function doUnassign() {
    const key = `${assignModal.tableId}::${assignModal.seatIdx}`;
    const newAsgn = { ...assignments };
    delete newAsgn[key];
    setAssignments(newAsgn);
    localStorage.setItem('gms-assignments', JSON.stringify(newAsgn));
    setAssignModal(null);
  }

  const assignedGuest = assignModal?.guestId ? GUESTS.find(g => g.id === assignModal.guestId) : null;
  const alreadyAssigned = new Set(Object.values(assignments));
  const filteredForAssign = GUESTS
    .filter(g => !alreadyAssigned.has(g.id) && (!assignSearch || g.name.toLowerCase().includes(assignSearch.toLowerCase())))
    .slice(0, 8);

  const seatByGuest = {};
  (venueData?.tables || []).forEach(t => {
    Object.entries(assignments).forEach(([key, gId]) => {
      const [tId, si] = key.split('::');
      if (tId === t.id) seatByGuest[gId] = { table: t, seatIdx: +si };
    });
  });

  const totalSeats = (venueData?.tables || []).reduce((acc, t) => {
    const r = (t.removedSeats || []).length;
    if (t.type === 'round')   return acc + Math.max(0, (t.seats || 0) - r);
    if (t.type === 'rect')    return acc + Math.max(0, (t.seatsPerSide || 0) * 2 - r);
    if (t.type === 'stadium') return acc + Math.max(0, (t.rows || 0) * (t.seatsPerRow || 0) - r);
    return acc;
  }, 0);

  const totalAssigned = Object.keys(assignments).length;
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

      <div className="tabs" style={{ marginBottom:16 }}>
        {[['floor', STR.tabFloor], ['guests', STR.tabGuests]].map(([k, l]) => (
          <button key={k} className={`tab${tab === k ? ' active' : ''}`} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      {tab === 'floor' && venueData && (
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
          <div ref={scrollRef} style={{ overflow:'auto', minHeight:460 }}
            onWheel={e => {
              if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                const delta = e.deltaY > 0 ? -0.1 : 0.1;
                setZoom(z => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, +((z + delta).toFixed(1)))));
              }
            }}>
            {/* Spacer establishes scrollable area matching the scaled canvas */}
            <div style={{ width: CANVAS_W * zoom, height: CANVAS_H * zoom, position:'relative', flexShrink:0 }}>
              <div style={{
                position:'absolute', top:0, left:0,
                width:CANVAS_W, height:CANVAS_H,
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

                {venueData.tables.map(t => (
                  <div key={t.id} style={{ position:'absolute', left:t.x, top:t.y }}>
                    {t.type === 'round'   && <RoundTable   table={t} assignments={assignments} onSeatClick={handleSeatClick}/>}
                    {t.type === 'rect'    && <RectTable    table={t} assignments={assignments} onSeatClick={handleSeatClick}/>}
                    {t.type === 'stadium' && <StadiumTable table={t} assignments={assignments} onSeatClick={handleSeatClick}/>}
                    {t.type === 'stage'   && <StageDisplay table={t}/>}
                    {t.type === 'pitch'   && <PitchDisplay table={t}/>}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Legend */}
          <div style={{ padding:'10px 16px', borderTop:'1px solid var(--glass-border)', display:'flex', gap:16, fontSize:11, flexShrink:0 }}>
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
              {GUESTS.slice(0, 40).map(g => {
                const info = seatByGuest[g.id];
                return (
                  <tr key={g.id}>
                    <td>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <Avatar initials={g.initials} size={26} tier={g.tier}/>
                        <div>
                          <div style={{ fontSize:12.5, fontWeight:500 }}>{g.name}</div>
                          <div style={{ fontSize:11, color:'var(--ink-mute)' }}>{g.org}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ fontSize:12, fontFamily:'var(--mono)' }}>
                      {info ? info.table.label : <span style={{ color:'var(--ink-faint)' }}>—</span>}
                    </td>
                    <td>
                      {info ? (() => {
                        const cc = info.table.categoryColor;
                        return (
                          <span style={{
                            display:'inline-flex', alignItems:'center', gap:5,
                            fontSize:11, fontFamily:'var(--mono)', fontWeight:500,
                            padding:'2px 9px', borderRadius:20,
                            color: cc || 'var(--accent)',
                            background: cc ? hexToRgba(cc, 0.1) : 'rgba(26,174,196,0.08)',
                            border:`1px solid ${cc ? hexToRgba(cc, 0.3) : 'rgba(26,174,196,0.2)'}`,
                          }}>
                            {cc && <span style={{ width:6, height:6, borderRadius:'50%', background:cc, flexShrink:0 }}/>}
                            {isAr ? `مقعد ${ad(getSeatLabel(info.table, info.seatIdx))}` : `Seat ${getSeatLabel(info.table, info.seatIdx)}`}
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
                  <span style={{ color: assignModal.table.categoryColor || 'var(--accent)' }}>{assignModal.table.label}</span>
                  {' · '}
                  <span>{isAr ? `مقعد ` : 'Seat '}{getSeatLabel(assignModal.table, assignModal.seatIdx)}</span>
                  {assignModal.table.type === 'stadium' && (() => {
                    const row = Math.floor(assignModal.seatIdx / assignModal.table.seatsPerRow);
                    const rowName = (assignModal.table.rowNames || [])[row] ?? String.fromCharCode(65 + row);
                    return <span style={{ color:'var(--ink-faint)' }}> · {isAr ? 'صف' : 'Row'} {rowName}</span>;
                  })()}
                </div>
                {assignModal.table.category && (
                  <div style={{ marginTop:6, display:'flex', alignItems:'center', gap:5 }}>
                    {assignModal.table.categoryColor && (
                      <span style={{ width:8, height:8, borderRadius:'50%', background: assignModal.table.categoryColor, flexShrink:0 }}/>
                    )}
                    <span style={{
                      fontSize:10, fontWeight:600,
                      color: assignModal.table.categoryColor || 'var(--accent)',
                      background: assignModal.table.categoryColor ? hexToRgba(assignModal.table.categoryColor, 0.1) : 'rgba(26,174,196,0.1)',
                      border:`1px solid ${assignModal.table.categoryColor ? hexToRgba(assignModal.table.categoryColor, 0.3) : 'rgba(26,174,196,0.25)'}`,
                      borderRadius:20, padding:'1px 8px', fontFamily:'sans-serif',
                    }}>
                      {assignModal.table.category}
                    </span>
                  </div>
                )}
              </div>
              <button className="icon-btn" onClick={() => setAssignModal(null)}><Icon name="close" size={14}/></button>
            </div>
            <div style={{ padding:'16px 20px' }}>
              {assignedGuest ? (
                <>
                  <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:18, padding:'10px 14px', background:'var(--surface-soft-2)', borderRadius:10 }}>
                    <Avatar initials={assignedGuest.initials} size={36} tier={assignedGuest.tier}/>
                    <div>
                      <div style={{ fontWeight:600 }}>{assignedGuest.name}</div>
                      <div style={{ fontSize:11, color:'var(--ink-mute)' }}>{assignedGuest.role} · {assignedGuest.org}</div>
                      <div style={{ fontSize:11, color:'var(--accent)', fontFamily:'var(--mono)', marginTop:2 }}>
                        {assignedGuest.tier} · {assignedGuest.country}
                      </div>
                    </div>
                  </div>
                  <div style={{ display:'flex', gap:8 }}>
                    <button className="btn" style={{ flex:1 }} onClick={() => setAssignModal(null)}>{STR.cancel}</button>
                    <button className="btn" style={{ flex:1, color:'#e08a7e', borderColor:'rgba(224,138,126,0.3)' }} onClick={doUnassign}>
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
                      <div key={g.id} onClick={() => doAssign(g.id)}
                        style={{ padding:'8px 10px', borderRadius:8, cursor:'pointer', display:'flex', alignItems:'center', gap:10, border:'1px solid var(--glass-border)', background:'var(--surface-soft-2)' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-soft-3)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'var(--surface-soft-2)'}>
                        <Avatar initials={g.initials} size={28} tier={g.tier}/>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:13, fontWeight:500 }}>{g.name}</div>
                          <div style={{ fontSize:11, color:'var(--ink-mute)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{g.role} · {g.org}</div>
                        </div>
                        <Icon name="plus" size={13} style={{ color:'var(--accent)', flexShrink:0 }}/>
                      </div>
                    ))}
                    {filteredForAssign.length === 0 && (
                      <div style={{ padding:'12px', textAlign:'center', color:'var(--ink-faint)', fontSize:12 }}>
                        {isAr ? 'لا نتائج' : 'No results'}
                      </div>
                    )}
                  </div>
                  <button className="btn" style={{ width:'100%', marginTop:10, justifyContent:'center' }} onClick={() => setAssignModal(null)}>
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
