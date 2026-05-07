import React, { useState, useRef } from 'react';
import { toArDigits } from '../i18n/translations.js';
import { Icon } from '../components/Icons.jsx';

// Round table: widget size = (dist + sr + 4) * 2 where dist = tableR + sr + 6
const TABLE_R = 30;
const SEAT_R = 8;
const SEAT_DIST = TABLE_R + SEAT_R + 7;
const ROUND_SIZE = (SEAT_DIST + SEAT_R + 5) * 2; // ~120px

function roundTableSize() { return ROUND_SIZE; }
function rectTableSize(seatsPerSide) {
  const w = seatsPerSide * 24 + 20;
  const h = 80;
  return { w, h };
}
function stadiumSize(rows, seatsPerRow) {
  return { w: seatsPerRow * 22 + 16, h: rows * 22 + 30 };
}

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

function RoundSVG({ table, selected }) {
  const cx = ROUND_SIZE / 2, cy = ROUND_SIZE / 2;
  return (
    <svg width={ROUND_SIZE} height={ROUND_SIZE} style={{ display:'block' }}>
      <circle cx={cx} cy={cy} r={TABLE_R}
        fill={selected ? 'rgba(26,174,196,0.22)' : 'rgba(26,174,196,0.1)'}
        stroke={selected ? 'var(--accent)' : 'rgba(26,174,196,0.45)'}
        strokeWidth={selected ? 2 : 1.5}/>
      <text x={cx} y={cy+4} textAnchor="middle" fontSize="9" fill="var(--ink)" fontFamily="var(--mono)" fontWeight="600">{table.label}</text>
      {Array.from({ length: table.seats }, (_, i) => {
        const angle = (i / table.seats) * Math.PI * 2 - Math.PI / 2;
        const sx = cx + Math.cos(angle) * SEAT_DIST;
        const sy = cy + Math.sin(angle) * SEAT_DIST;
        return <circle key={i} cx={sx} cy={sy} r={SEAT_R} fill="var(--surface-soft-3)" stroke="var(--glass-border)" strokeWidth="1"/>;
      })}
    </svg>
  );
}

function RectSVG({ table, selected }) {
  const sps = table.seatsPerSide;
  const { w, h } = rectTableSize(sps);
  const tblX = 10, tblY = 26, tblW = sps * 24, tblH = 28;
  const seatY1 = 10, seatY2 = h - 10;
  return (
    <svg width={w} height={h} style={{ display:'block' }}>
      <rect x={tblX} y={tblY} width={tblW} height={tblH} rx={4}
        fill={selected ? 'rgba(26,174,196,0.22)' : 'rgba(26,174,196,0.1)'}
        stroke={selected ? 'var(--accent)' : 'rgba(26,174,196,0.45)'}
        strokeWidth={selected ? 2 : 1.5}/>
      <text x={tblX + tblW/2} y={tblY + tblH/2 + 4} textAnchor="middle" fontSize="9" fill="var(--ink)" fontFamily="var(--mono)" fontWeight="600">{table.label}</text>
      {Array.from({ length: sps }, (_, i) => {
        const sx = tblX + (i + 0.5) * 24;
        return (
          <g key={i}>
            <circle cx={sx} cy={seatY1} r={SEAT_R} fill="var(--surface-soft-3)" stroke="var(--glass-border)" strokeWidth="1"/>
            <circle cx={sx} cy={seatY2} r={SEAT_R} fill="var(--surface-soft-3)" stroke="var(--glass-border)" strokeWidth="1"/>
          </g>
        );
      })}
    </svg>
  );
}

function StadiumSVG({ table, selected }) {
  const { w, h } = stadiumSize(table.rows, table.seatsPerRow);
  const step = 22;
  return (
    <svg width={w} height={h} style={{ display:'block' }}>
      <rect x={1} y={1} width={w-2} height={h-2} rx={6}
        fill={selected ? 'rgba(26,174,196,0.12)' : 'rgba(26,174,196,0.05)'}
        stroke={selected ? 'var(--accent)' : 'rgba(26,174,196,0.3)'}
        strokeWidth={selected ? 2 : 1} strokeDasharray={selected ? undefined : '4 3'}/>
      <text x={w/2} y={14} textAnchor="middle" fontSize="9" fill="var(--accent)" fontFamily="var(--mono)" fontWeight="600">{table.label}</text>
      {Array.from({ length: table.rows }, (_, row) =>
        Array.from({ length: table.seatsPerRow }, (_, col) => (
          <rect key={`${row}-${col}`} x={8 + col * step} y={20 + row * step}
            width={16} height={16} rx={3}
            fill="var(--surface-soft-3)" stroke="var(--glass-border)" strokeWidth="0.8"/>
        ))
      )}
    </svg>
  );
}

export default function VenueConfigView({ lang }) {
  const isAr = lang === 'ar';
  const ad = s => isAr ? toArDigits(String(s)) : String(s);

  const STR = isAr ? {
    title: 'تهيئة المكان',
    sub: 'قم بتصميم مخطط القاعة بالسحب والإفلات',
    palette: 'أنواع الطاولات',
    roundTable: 'طاولة دائرية',
    rectTable: 'طاولة مستطيلة',
    stadium: 'مدرج',
    roundDesc: 'مقاعد حول المحيط',
    rectDesc: 'مقاعد على الجانبين',
    stadiumDesc: 'صفوف × مقاعد في الصف',
    configure: 'تهيئة',
    label: 'اسم الطاولة',
    seats: 'عدد المقاعد',
    seatsPerSide: 'مقاعد في كل جانب',
    rows: 'الصفوف',
    seatsPerRow: 'مقاعد في كل صف',
    deleteTable: 'حذف الطاولة',
    save: 'حفظ التخطيط',
    saved: 'تم الحفظ ✓',
    clearAll: 'مسح الكل',
    confirm: 'تأكيد',
    cancel: 'إلغاء',
    clearMsg: 'مسح كل الطاولات؟',
    dragHint: 'اسحب الطاولة من القائمة أو حرك الطاولات على اللوحة',
    noSelection: 'انقر على طاولة للتهيئة',
    totalSeats: 'إجمالي المقاعد',
    tables: 'طاولة',
  } : {
    title: 'Venue Configuration',
    sub: 'Design the floor plan using drag-and-drop',
    palette: 'Table types',
    roundTable: 'Round Table',
    rectTable: 'Rectangular Table',
    stadium: 'Stadium Block',
    roundDesc: 'Seats around perimeter',
    rectDesc: 'Seats on both long sides',
    stadiumDesc: 'Rows × seats per row',
    configure: 'Configure',
    label: 'Table label',
    seats: 'Seats',
    seatsPerSide: 'Seats per side',
    rows: 'Rows',
    seatsPerRow: 'Seats per row',
    deleteTable: 'Delete table',
    save: 'Save layout',
    saved: 'Saved ✓',
    clearAll: 'Clear all',
    confirm: 'Confirm',
    cancel: 'Cancel',
    clearMsg: 'Remove all tables from the canvas?',
    dragHint: 'Drag a type from the palette onto the canvas, then reposition tables by dragging.',
    noSelection: 'Click a table to configure it',
    totalSeats: 'Total seats',
    tables: 'tables',
  };

  const [tables, setTables] = useState(() => {
    try {
      const stored = localStorage.getItem('gms-venue');
      if (stored) return JSON.parse(stored).tables;
    } catch (e) {}
    return DEFAULT_TABLES;
  });

  const [selectedId, setSelectedId] = useState(null);
  const [saved, setSaved] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const dragTypeRef = useRef(null);
  const canvasRef = useRef(null);
  const idCounter = useRef(tables.length + 1);

  const selectedTable = tables.find(t => t.id === selectedId) || null;

  function updateTable(id, patch) {
    setTables(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t));
  }

  function removeTable(id) {
    setTables(prev => prev.filter(t => t.id !== id));
    setSelectedId(null);
  }

  function addTable(type, x, y) {
    idCounter.current += 1;
    const id = `tu${idCounter.current}`;
    const base = { id, type, x, y };
    let extra = {};
    if (type === 'round') extra = { seats: 8, label: `T-${String(idCounter.current).padStart(2,'0')}` };
    if (type === 'rect') extra = { seatsPerSide: 4, label: `T-${String(idCounter.current).padStart(2,'0')}` };
    if (type === 'stadium') extra = { rows: 3, seatsPerRow: 8, label: `Blk-${String.fromCharCode(64 + idCounter.current % 26 + 1)}` };
    setTables(prev => [...prev, { ...base, ...extra }]);
    setSelectedId(id);
  }

  function startDragTable(e, tableId) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    setSelectedId(tableId);
    const startX = e.clientX, startY = e.clientY;
    const tbl = tables.find(t => t.id === tableId);
    const origX = tbl.x, origY = tbl.y;
    const onMove = (me) => {
      const dx = me.clientX - startX, dy = me.clientY - startY;
      setTables(prev => prev.map(t => t.id === tableId ? { ...t, x: Math.max(0, origX + dx), y: Math.max(0, origY + dy) } : t));
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  function handleDrop(e) {
    e.preventDefault();
    const type = dragTypeRef.current;
    if (!type) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.max(0, e.clientX - rect.left - 55);
    const y = Math.max(0, e.clientY - rect.top - 55);
    addTable(type, x, y);
    dragTypeRef.current = null;
  }

  function saveLayout() {
    localStorage.setItem('gms-venue', JSON.stringify({ tables }));
    setSaved(true);
    setTimeout(() => setSaved(false), 2200);
  }

  const totalSeats = tables.reduce((acc, t) => {
    if (t.type === 'round') return acc + (t.seats || 0);
    if (t.type === 'rect') return acc + (t.seatsPerSide || 0) * 2;
    if (t.type === 'stadium') return acc + (t.rows || 0) * (t.seatsPerRow || 0);
    return acc;
  }, 0);

  const sliderStyle = { width: '100%', accentColor: 'var(--accent)' };
  const inputStyle = { width: '100%', background: 'var(--surface-soft-3)', border: '1px solid var(--glass-border)', borderRadius: 8, padding: '8px 11px', color: 'var(--ink)', fontSize: 13, boxSizing: 'border-box' };
  const labelStyle = { display: 'block', fontSize: 10.5, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 };

  const paletteItems = [
    { type: 'round', icon: 'seating', label: STR.roundTable, desc: STR.roundDesc },
    { type: 'rect', icon: 'meetings', label: STR.rectTable, desc: STR.rectDesc },
    { type: 'stadium', icon: 'dashboard', label: STR.stadium, desc: STR.stadiumDesc },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{STR.title}</h1>
          <div className="page-sub">{STR.sub}</div>
        </div>
        <div className="page-actions">
          <button className="btn" onClick={() => setShowClearConfirm(true)}>
            <Icon name="trash" size={14}/> {STR.clearAll}
          </button>
          <button className="btn primary" onClick={saveLayout}>
            <Icon name={saved ? 'check' : 'download'} size={14}/> {saved ? STR.saved : STR.save}
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 14 }}>
        <span style={{ fontSize: 12, color: 'var(--ink-mute)' }}>
          <strong style={{ color: 'var(--ink)' }}>{ad(tables.length)}</strong> {STR.tables}
        </span>
        <span style={{ fontSize: 12, color: 'var(--ink-mute)' }}>
          <strong style={{ color: 'var(--ink)' }}>{ad(totalSeats)}</strong> {STR.totalSeats}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
        {/* Palette */}
        <div style={{ width: 200, flexShrink: 0 }}>
          <div className="card" style={{ padding: 0 }}>
            <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--glass-border)', fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-mute)', fontWeight: 600 }}>
              {STR.palette}
            </div>
            <div style={{ padding: '10px 10px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {paletteItems.map(item => (
                <div key={item.type}
                  draggable
                  onDragStart={() => { dragTypeRef.current = item.type; }}
                  onDragEnd={() => {}}
                  style={{ padding: '10px 12px', borderRadius: 9, border: '1px dashed var(--glass-border)', cursor: 'grab', background: 'var(--surface-soft-2)', userSelect: 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <Icon name={item.icon} size={14} style={{ color: 'var(--accent)' }}/>
                    <span style={{ fontSize: 12.5, fontWeight: 600 }}>{item.label}</span>
                    <Icon name="drag" size={12} style={{ marginLeft: 'auto', color: 'var(--ink-faint)' }}/>
                  </div>
                  <div style={{ fontSize: 10.5, color: 'var(--ink-mute)' }}>{item.desc}</div>
                </div>
              ))}
            </div>
            <div style={{ padding: '10px 14px', borderTop: '1px solid var(--glass-border)', fontSize: 10.5, color: 'var(--ink-faint)', lineHeight: 1.5 }}>
              {STR.dragHint}
            </div>
          </div>
        </div>

        {/* Canvas */}
        <div className="card" style={{ flex: 1, padding: 0, overflow: 'hidden' }}>
          <div
            ref={canvasRef}
            style={{ position: 'relative', minHeight: 500, background: 'var(--surface-soft-2)', overflow: 'auto' }}
            onDragOver={e => e.preventDefault()}
            onDrop={handleDrop}
            onClick={e => { if (e.target === canvasRef.current || e.currentTarget === e.target) setSelectedId(null); }}>
            {/* Grid lines */}
            <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
              <defs>
                <pattern id="gridPat" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="var(--glass-border)" strokeWidth="0.4"/>
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#gridPat)"/>
            </svg>

            {tables.map(t => {
              const isSelected = t.id === selectedId;
              let svgEl;
              if (t.type === 'round') svgEl = <RoundSVG table={t} selected={isSelected}/>;
              else if (t.type === 'rect') svgEl = <RectSVG table={t} selected={isSelected}/>;
              else svgEl = <StadiumSVG table={t} selected={isSelected}/>;

              return (
                <div key={t.id}
                  style={{ position: 'absolute', left: t.x, top: t.y, cursor: 'move', userSelect: 'none',
                    filter: isSelected ? 'drop-shadow(0 0 6px rgba(26,174,196,0.5))' : undefined }}
                  onMouseDown={e => startDragTable(e, t.id)}>
                  {svgEl}
                </div>
              );
            })}

            {tables.length === 0 && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-faint)', fontSize: 13, pointerEvents: 'none' }}>
                {isAr ? 'اسحب طاولة من القائمة' : 'Drag a table type from the palette'}
              </div>
            )}
          </div>
        </div>

        {/* Config panel */}
        <div style={{ width: 220, flexShrink: 0 }}>
          <div className="card" style={{ padding: 0 }}>
            <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--glass-border)', fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-mute)', fontWeight: 600 }}>
              {STR.configure}
            </div>
            {selectedTable ? (
              <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={labelStyle}>{STR.label}</label>
                  <input style={inputStyle} value={selectedTable.label}
                    onChange={e => updateTable(selectedTable.id, { label: e.target.value })}/>
                </div>

                {selectedTable.type === 'round' && (
                  <div>
                    <label style={labelStyle}>{STR.seats} · {ad(selectedTable.seats)}</label>
                    <input type="range" min={4} max={20} value={selectedTable.seats} style={sliderStyle}
                      onChange={e => updateTable(selectedTable.id, { seats: +e.target.value })}/>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--ink-faint)', marginTop: 2 }}>
                      <span>4</span><span>20</span>
                    </div>
                  </div>
                )}

                {selectedTable.type === 'rect' && (
                  <div>
                    <label style={labelStyle}>{STR.seatsPerSide} · {ad(selectedTable.seatsPerSide)}</label>
                    <input type="range" min={2} max={8} value={selectedTable.seatsPerSide} style={sliderStyle}
                      onChange={e => updateTable(selectedTable.id, { seatsPerSide: +e.target.value })}/>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--ink-faint)', marginTop: 2 }}>
                      <span>2</span><span>8</span>
                    </div>
                  </div>
                )}

                {selectedTable.type === 'stadium' && (
                  <>
                    <div>
                      <label style={labelStyle}>{STR.rows} · {ad(selectedTable.rows)}</label>
                      <input type="range" min={2} max={10} value={selectedTable.rows} style={sliderStyle}
                        onChange={e => updateTable(selectedTable.id, { rows: +e.target.value })}/>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--ink-faint)', marginTop: 2 }}>
                        <span>2</span><span>10</span>
                      </div>
                    </div>
                    <div>
                      <label style={labelStyle}>{STR.seatsPerRow} · {ad(selectedTable.seatsPerRow)}</label>
                      <input type="range" min={5} max={20} value={selectedTable.seatsPerRow} style={sliderStyle}
                        onChange={e => updateTable(selectedTable.id, { seatsPerRow: +e.target.value })}/>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--ink-faint)', marginTop: 2 }}>
                        <span>5</span><span>20</span>
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--ink-mute)', background: 'var(--surface-soft-2)', borderRadius: 6, padding: '6px 10px' }}>
                      {ad(selectedTable.rows * selectedTable.seatsPerRow)} {isAr ? 'مقعد' : 'seats total'}
                    </div>
                  </>
                )}

                <button className="btn" style={{ width: '100%', justifyContent: 'center', color: '#e08a7e', borderColor: 'rgba(224,138,126,0.3)' }}
                  onClick={() => removeTable(selectedTable.id)}>
                  <Icon name="trash" size={13}/> {STR.deleteTable}
                </button>
              </div>
            ) : (
              <div style={{ padding: '24px 14px', textAlign: 'center', color: 'var(--ink-faint)', fontSize: 12 }}>
                {STR.noSelection}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Clear confirm modal */}
      {showClearConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card glass" style={{ width: 340, padding: '22px 24px' }}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>{STR.clearMsg}</div>
            <div style={{ fontSize: 12, color: 'var(--ink-mute)', marginBottom: 20 }}>
              {isAr ? `سيتم حذف ${ad(tables.length)} طاولة.` : `This will remove all ${tables.length} tables.`}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => setShowClearConfirm(false)}>{STR.cancel}</button>
              <button className="btn primary" style={{ background: 'rgba(224,138,126,0.2)', color: '#e08a7e', borderColor: 'rgba(224,138,126,0.3)' }}
                onClick={() => { setTables([]); setSelectedId(null); setShowClearConfirm(false); }}>
                {STR.confirm}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
