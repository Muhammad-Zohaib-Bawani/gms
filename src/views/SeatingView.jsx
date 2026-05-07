import React, { useState, useEffect } from 'react';
import { toArDigits } from '../i18n/translations.js';
import { Avatar } from '../components/UI.jsx';
import { Icon } from '../components/Icons.jsx';
import { GUESTS } from '../data/mockData.js';

// Same constants as VenueConfigView
const TABLE_R = 30, SEAT_R = 8, SEAT_DIST = TABLE_R + SEAT_R + 7;
const ROUND_SIZE = (SEAT_DIST + SEAT_R + 5) * 2;

const DEFAULT_TABLES = [
  { id:'t1',  type:'round',   x:10,  y:10,  seats:8,  label:'T-01' },
  { id:'t2',  type:'round',   x:140, y:10,  seats:8,  label:'T-02' },
  { id:'t3',  type:'round',   x:270, y:10,  seats:10, label:'T-03' },
  { id:'t4',  type:'round',   x:400, y:10,  seats:8,  label:'T-04' },
  { id:'t5',  type:'round',   x:530, y:10,  seats:8,  label:'T-05' },
  { id:'t6',  type:'round',   x:10,  y:150, seats:10, label:'T-06' },
  { id:'t7',  type:'round',   x:140, y:150, seats:8,  label:'T-07' },
  { id:'t8',  type:'round',   x:270, y:150, seats:8,  label:'T-08' },
  { id:'t9',  type:'round',   x:400, y:150, seats:10, label:'T-09' },
  { id:'t10', type:'round',   x:530, y:150, seats:8,  label:'T-10' },
  { id:'t11', type:'rect',    x:680, y:10,  seatsPerSide:4, label:'T-11' },
  { id:'t12', type:'rect',    x:680, y:110, seatsPerSide:4, label:'T-12' },
  { id:'t13', type:'stadium', x:10,  y:300, rows:3, seatsPerRow:12, label:'Blk-A' },
];

// Seed 10 demo assignments so the floor plan isn't empty
function buildDefaultAssignments(tables) {
  const asgn = {};
  let gi = 0;
  for (const t of tables) {
    const total = t.type === 'round' ? t.seats
      : t.type === 'rect' ? t.seatsPerSide * 2
      : t.rows * t.seatsPerRow;
    for (let i = 0; i < total && gi < 10; i++, gi++) {
      asgn[`${t.id}::${i}`] = GUESTS[gi].id;
    }
    if (gi >= 10) break;
  }
  return asgn;
}

// ─── Table SVG renderers (with seat coloring) ────────────────────────────────

function RoundTable({ table, assignments, onSeatClick }) {
  const cx = ROUND_SIZE / 2, cy = ROUND_SIZE / 2;
  return (
    <svg width={ROUND_SIZE} height={ROUND_SIZE} style={{ display:'block' }}>
      <circle cx={cx} cy={cy} r={TABLE_R} fill="rgba(26,174,196,0.1)" stroke="rgba(26,174,196,0.45)" strokeWidth="1.5"/>
      <text x={cx} y={cy+4} textAnchor="middle" fontSize="9" fill="var(--ink)" fontFamily="var(--mono)" fontWeight="600">{table.label}</text>
      {Array.from({ length: table.seats }, (_, i) => {
        const angle = (i / table.seats) * Math.PI * 2 - Math.PI / 2;
        const sx = cx + Math.cos(angle) * SEAT_DIST;
        const sy = cy + Math.sin(angle) * SEAT_DIST;
        const key = `${table.id}::${i}`;
        const gId = assignments[key];
        const g = gId ? GUESTS.find(x => x.id === gId) : null;
        return (
          <g key={i} style={{ cursor:'pointer' }} onClick={() => onSeatClick(table.id, i, gId)}>
            <circle cx={sx} cy={sy} r={SEAT_R}
              fill={gId ? 'var(--accent)' : 'var(--surface-soft-3)'}
              stroke={gId ? 'var(--accent)' : 'var(--glass-border)'}
              strokeWidth="1"/>
            {g && <text x={sx} y={sy+3} textAnchor="middle" fontSize="6" fill="#fff" fontWeight="bold">{g.initials}</text>}
            {!g && <text x={sx} y={sy+3} textAnchor="middle" fontSize="7" fill="var(--ink-faint)">{i+1}</text>}
          </g>
        );
      })}
    </svg>
  );
}

function RectTable({ table, assignments, onSeatClick }) {
  const sps = table.seatsPerSide;
  const tblW = sps * 24, tblH = 28;
  const tblX = 10, tblY = 26;
  const w = tblW + 20, h = tblH + 52;
  const seatY1 = 10, seatY2 = h - 10;
  const totalSeats = sps * 2;
  return (
    <svg width={w} height={h} style={{ display:'block' }}>
      <rect x={tblX} y={tblY} width={tblW} height={tblH} rx={4} fill="rgba(26,174,196,0.1)" stroke="rgba(26,174,196,0.45)" strokeWidth="1.5"/>
      <text x={tblX + tblW/2} y={tblY + tblH/2 + 4} textAnchor="middle" fontSize="9" fill="var(--ink)" fontFamily="var(--mono)" fontWeight="600">{table.label}</text>
      {Array.from({ length: sps }, (_, i) => {
        const sx = tblX + (i + 0.5) * 24;
        const topIdx = i;
        const botIdx = sps + i;
        const topGId = assignments[`${table.id}::${topIdx}`];
        const botGId = assignments[`${table.id}::${botIdx}`];
        const topG = topGId ? GUESTS.find(x => x.id === topGId) : null;
        const botG = botGId ? GUESTS.find(x => x.id === botGId) : null;
        return (
          <g key={i}>
            <g style={{ cursor:'pointer' }} onClick={() => onSeatClick(table.id, topIdx, topGId)}>
              <circle cx={sx} cy={seatY1} r={SEAT_R} fill={topGId ? 'var(--accent)' : 'var(--surface-soft-3)'} stroke={topGId ? 'var(--accent)' : 'var(--glass-border)'} strokeWidth="1"/>
              {topG ? <text x={sx} y={seatY1+3} textAnchor="middle" fontSize="6" fill="#fff" fontWeight="bold">{topG.initials}</text>
                : <text x={sx} y={seatY1+3} textAnchor="middle" fontSize="7" fill="var(--ink-faint)">{topIdx+1}</text>}
            </g>
            <g style={{ cursor:'pointer' }} onClick={() => onSeatClick(table.id, botIdx, botGId)}>
              <circle cx={sx} cy={seatY2} r={SEAT_R} fill={botGId ? 'var(--accent)' : 'var(--surface-soft-3)'} stroke={botGId ? 'var(--accent)' : 'var(--glass-border)'} strokeWidth="1"/>
              {botG ? <text x={sx} y={seatY2+3} textAnchor="middle" fontSize="6" fill="#fff" fontWeight="bold">{botG.initials}</text>
                : <text x={sx} y={seatY2+3} textAnchor="middle" fontSize="7" fill="var(--ink-faint)">{botIdx+1}</text>}
            </g>
          </g>
        );
      })}
    </svg>
  );
}

function StadiumTable({ table, assignments, onSeatClick }) {
  const step = 22;
  const w = table.seatsPerRow * step + 16;
  const h = table.rows * step + 30;
  return (
    <svg width={w} height={h} style={{ display:'block' }}>
      <rect x={1} y={1} width={w-2} height={h-2} rx={6} fill="rgba(26,174,196,0.05)" stroke="rgba(26,174,196,0.3)" strokeWidth="1" strokeDasharray="4 3"/>
      <text x={w/2} y={14} textAnchor="middle" fontSize="9" fill="var(--accent)" fontFamily="var(--mono)" fontWeight="600">{table.label}</text>
      {Array.from({ length: table.rows }, (_, row) =>
        Array.from({ length: table.seatsPerRow }, (_, col) => {
          const idx = row * table.seatsPerRow + col;
          const gId = assignments[`${table.id}::${idx}`];
          const g = gId ? GUESTS.find(x => x.id === gId) : null;
          const sx = 8 + col * step + 8;
          const sy = 20 + row * step + 8;
          return (
            <g key={`${row}-${col}`} style={{ cursor:'pointer' }} onClick={() => onSeatClick(table.id, idx, gId)}>
              <rect x={8 + col * step} y={20 + row * step} width={16} height={16} rx={3}
                fill={gId ? 'var(--accent)' : 'var(--surface-soft-3)'}
                stroke={gId ? 'var(--accent)' : 'var(--glass-border)'}
                strokeWidth="0.8"/>
              {g && <text x={sx} y={sy+3} textAnchor="middle" fontSize="5" fill="#fff" fontWeight="bold">{g.initials}</text>}
            </g>
          );
        })
      )}
    </svg>
  );
}

export default function SeatingView({ lang }) {
  const isAr = lang === 'ar';
  const ad = s => isAr ? toArDigits(String(s)) : String(s);

  const STR = isAr ? {
    title: 'الجلوس',
    sub: 'خطة الطابق · تعيين وإلغاء تعيين المقاعد',
    tabFloor: 'خطة الطابق',
    tabGuests: 'قائمة الضيوف',
    assignSeat: 'تعيين مقعد',
    seatAssigned: 'المقعد معيّن',
    unassign: 'إلغاء التعيين',
    searchGuest: 'بحث عن ضيف…',
    cancel: 'إلغاء',
    assign: 'تعيين',
    table: 'الطاولة',
    seat: 'المقعد',
    guest: 'الضيف',
    noSeat: '—',
    noVenue: 'لا يوجد تخطيط محفوظ. قم بتهيئة المكان أولاً.',
    goConfig: 'الذهاب إلى تهيئة المكان',
    assigned: 'معيّن',
    unassigned: 'غير معيّن',
    totalAssigned: 'مقعد معيّن',
    totalSeats: 'إجمالي المقاعد',
  } : {
    title: 'Seating',
    sub: 'Floor plan · assign and unassign seats',
    tabFloor: 'Floor plan',
    tabGuests: 'Guest list',
    assignSeat: 'Assign seat',
    seatAssigned: 'Seat assigned',
    unassign: 'Unassign',
    searchGuest: 'Search guest…',
    cancel: 'Cancel',
    assign: 'Assign',
    table: 'Table',
    seat: 'Seat',
    guest: 'Guest',
    noSeat: '—',
    noVenue: 'No saved layout. Configure the venue first.',
    goConfig: 'Go to Venue Configuration',
    assigned: 'Assigned',
    unassigned: 'Unassigned',
    totalAssigned: 'seats assigned',
    totalSeats: 'total seats',
  };

  const [venueData, setVenueData] = useState(null);
  const [assignments, setAssignments] = useState({});
  const [tab, setTab] = useState('floor');
  const [assignModal, setAssignModal] = useState(null); // { tableId, seatIdx, guestId }
  const [assignSearch, setAssignSearch] = useState('');

  useEffect(() => {
    let venue = null;
    let asgn = null;
    try {
      const storedVenue = localStorage.getItem('gms-venue');
      if (storedVenue) venue = JSON.parse(storedVenue);
      const storedAsgn = localStorage.getItem('gms-assignments');
      if (storedAsgn) asgn = JSON.parse(storedAsgn);
    } catch (e) {}
    const tables = venue?.tables || DEFAULT_TABLES;
    setVenueData({ tables });
    setAssignments(asgn || buildDefaultAssignments(tables));
  }, []);

  function handleSeatClick(tableId, seatIdx, guestId) {
    setAssignModal({ tableId, seatIdx, guestId: guestId || null });
    setAssignSearch('');
  }

  function doAssign(guestId) {
    const key = `${assignModal.tableId}::${assignModal.seatIdx}`;
    // First remove this guest from any other seat
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

  // Build reverse lookup: guestId → { tableLabel, seatIdx }
  const seatByGuest = {};
  (venueData?.tables || []).forEach(t => {
    Object.entries(assignments).forEach(([key, gId]) => {
      const [tId, si] = key.split('::');
      if (tId === t.id) seatByGuest[gId] = { table: t, seatIdx: +si };
    });
  });

  const totalSeats = (venueData?.tables || []).reduce((acc, t) => {
    if (t.type === 'round') return acc + (t.seats || 0);
    if (t.type === 'rect') return acc + (t.seatsPerSide || 0) * 2;
    if (t.type === 'stadium') return acc + (t.rows || 0) * (t.seatsPerRow || 0);
    return acc;
  }, 0);

  const totalAssigned = Object.keys(assignments).length;

  const inputStyle = { width: '100%', background: 'var(--surface-soft-3)', border: '1px solid var(--glass-border)', borderRadius: 8, padding: '9px 12px', color: 'var(--ink)', fontSize: 13, boxSizing: 'border-box' };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{STR.title}</h1>
          <div className="page-sub">{STR.sub}</div>
        </div>
        <div className="page-actions">
          <span style={{ fontSize: 12, color: 'var(--ink-mute)' }}>
            <strong style={{ color: 'var(--accent)' }}>{ad(totalAssigned)}</strong> / {ad(totalSeats)} {STR.totalSeats}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs" style={{ marginBottom: 16 }}>
        {[['floor', STR.tabFloor], ['guests', STR.tabGuests]].map(([k, l]) => (
          <button key={k} className={`tab${tab === k ? ' active' : ''}`} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      {tab === 'floor' && venueData && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflow: 'auto', minHeight: 460 }}>
            <div style={{ position: 'relative', minWidth: 860, minHeight: 460, background: 'var(--surface-soft-2)' }}>
              {/* Grid pattern */}
              <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
                <defs>
                  <pattern id="sgrid" width="40" height="40" patternUnits="userSpaceOnUse">
                    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="var(--glass-border)" strokeWidth="0.4"/>
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#sgrid)"/>
              </svg>

              {venueData.tables.map(t => (
                <div key={t.id} style={{ position: 'absolute', left: t.x, top: t.y }}>
                  {t.type === 'round' && <RoundTable table={t} assignments={assignments} onSeatClick={handleSeatClick}/>}
                  {t.type === 'rect' && <RectTable table={t} assignments={assignments} onSeatClick={handleSeatClick}/>}
                  {t.type === 'stadium' && <StadiumTable table={t} assignments={assignments} onSeatClick={handleSeatClick}/>}
                </div>
              ))}
            </div>
          </div>

          {/* Legend */}
          <div style={{ padding: '10px 16px', borderTop: '1px solid var(--glass-border)', display: 'flex', gap: 16, fontSize: 11 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <svg width={14} height={14}><circle cx={7} cy={7} r={6} fill="var(--accent)"/></svg>
              {STR.assigned}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <svg width={14} height={14}><circle cx={7} cy={7} r={6} fill="var(--surface-soft-3)" stroke="var(--glass-border)" strokeWidth="1"/></svg>
              {STR.unassigned}
            </span>
          </div>
        </div>
      )}

      {tab === 'guests' && (
        <div className="card" style={{ padding: 0 }}>
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Avatar initials={g.initials} size={26} tier={g.tier}/>
                        <div>
                          <div style={{ fontSize: 12.5, fontWeight: 500 }}>{g.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--ink-mute)' }}>{g.org}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ fontSize: 12, fontFamily: 'var(--mono)' }}>{info ? info.table.label : <span style={{ color: 'var(--ink-faint)' }}>—</span>}</td>
                    <td>
                      {info ? (
                        <span className="chip" style={{ fontSize: 11, fontFamily: 'var(--mono)' }}>
                          {isAr ? `مقعد ${ad(info.seatIdx + 1)}` : `Seat ${info.seatIdx + 1}`}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--ink-faint)', fontSize: 12 }}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Assignment modal */}
      {assignModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card glass" style={{ width: 360, padding: 0 }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>{assignModal.guestId ? STR.seatAssigned : STR.assignSeat}</span>
              <button className="icon-btn" onClick={() => setAssignModal(null)}><Icon name="close" size={14}/></button>
            </div>
            <div style={{ padding: '16px 20px' }}>
              {assignedGuest ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18, padding: '10px 14px', background: 'var(--surface-soft-2)', borderRadius: 10 }}>
                    <Avatar initials={assignedGuest.initials} size={36} tier={assignedGuest.tier}/>
                    <div>
                      <div style={{ fontWeight: 600 }}>{assignedGuest.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--ink-mute)' }}>{assignedGuest.role} · {assignedGuest.org}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn" style={{ flex: 1 }} onClick={() => setAssignModal(null)}>{STR.cancel}</button>
                    <button className="btn" style={{ flex: 1, color: '#e08a7e', borderColor: 'rgba(224,138,126,0.3)' }} onClick={doUnassign}>
                      <Icon name="x" size={13}/> {STR.unassign}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <input style={inputStyle} value={assignSearch} onChange={e => setAssignSearch(e.target.value)}
                    placeholder={STR.searchGuest} autoFocus/>
                  <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 240, overflowY: 'auto' }}>
                    {filteredForAssign.map(g => (
                      <div key={g.id} onClick={() => doAssign(g.id)}
                        style={{ padding: '8px 10px', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, border: '1px solid var(--glass-border)', background: 'var(--surface-soft-2)' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-soft-3)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'var(--surface-soft-2)'}>
                        <Avatar initials={g.initials} size={28} tier={g.tier}/>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 500 }}>{g.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--ink-mute)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.role} · {g.org}</div>
                        </div>
                        <Icon name="plus" size={13} style={{ color: 'var(--accent)', flexShrink: 0 }}/>
                      </div>
                    ))}
                    {filteredForAssign.length === 0 && (
                      <div style={{ padding: '12px', textAlign: 'center', color: 'var(--ink-faint)', fontSize: 12 }}>
                        {isAr ? 'لا نتائج' : 'No results'}
                      </div>
                    )}
                  </div>
                  <button className="btn" style={{ width: '100%', marginTop: 10, justifyContent: 'center' }} onClick={() => setAssignModal(null)}>
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
