import React, { useState, useRef, useEffect } from 'react';
import { toArDigits } from '../i18n/translations.js';
import { Icon } from '../components/Icons.jsx';

const TABLE_R = 30, SEAT_R = 8, SEAT_DIST = TABLE_R + SEAT_R + 7;
const ROUND_SIZE = (SEAT_DIST + SEAT_R + 5) * 2;
const ROW_LABEL_W = 20;
const CANVAS_W = 1400, CANVAS_H = 900;
const MIN_ZOOM = 0.3, MAX_ZOOM = 2.5;

function rectTableSize(sps) { return { w: sps * 24 + 20, h: 80 }; }
function stadiumSize(rows, spr) { return { w: ROW_LABEL_W + spr * 22 + 16, h: rows * 22 + 30 }; }

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
  { id:'t13', type:'stadium', x:10,  y:300, rows:3, seatsPerRow:12, label:'Blk-A', removedSeats:[], rowNames:[], seatNumbers:{} },
];

const PREDEFINED_VENUES = [
  { id:'v1', name:'Sheraton Grand Ballroom' },
  { id:'v2', name:'Pearl Auditorium' },
  { id:'v3', name:'Al Mayassa Hall' },
  { id:'v4', name:'Executive Suite A' },
  { id:'v5', name:'Media Center' },
];

const VK = 'gms-venues', VAK = 'gms-venues-active';

const CATEGORY_COLORS = [
  '#e05252', // red
  '#2563eb', // blue
  '#16a34a', // green
  '#f5a623', // amber
  '#7c3aed', // purple
  '#db2777', // pink
  '#0891b2', // cyan
  '#ea7c1e', // orange
];

function hexToRgba(hex, alpha) {
  if (!hex || !hex.startsWith('#')) return null;
  const r = parseInt(hex.slice(1,3), 16);
  const g = parseInt(hex.slice(3,5), 16);
  const b = parseInt(hex.slice(5,7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function getVenueTotalSeats(venue) {
  if (!venue) return 0;
  const tables = venue.venueType === 'stadium'
    ? (venue.blocks || []).flatMap(b => b.tables || [])
    : (venue.tables || []);
  return tables.reduce((acc, t) => {
    const r = (t.removedSeats || []).length;
    if (t.type === 'round')   return acc + Math.max(0, (t.seats || 0) - r);
    if (t.type === 'rect')    return acc + Math.max(0, (t.seatsPerSide || 0) * 2 - r);
    if (t.type === 'stadium') return acc + Math.max(0, (t.rows || 0) * (t.seatsPerRow || 0) - r);
    return acc;
  }, 0);
}

function getBlockTotalSeats(blk) {
  if (!blk) return 0;
  return (blk.tables || []).reduce((acc, t) => {
    const r = (t.removedSeats || []).length;
    if (t.type === 'stadium') return acc + Math.max(0, (t.rows || 0) * (t.seatsPerRow || 0) - r);
    return acc;
  }, 0);
}

// ─── SVG Renderers ────────────────────────────────────────────────────────────

function RoundSVG({ table, selected, onDeleteSeat }) {
  const cx = ROUND_SIZE / 2, cy = ROUND_SIZE / 2;
  const removed = new Set(table.removedSeats || []);
  return (
    <svg width={ROUND_SIZE} height={ROUND_SIZE} style={{ display:'block' }}>
      <circle cx={cx} cy={cy} r={TABLE_R}
        fill={selected ? 'rgba(26,174,196,0.22)' : 'rgba(26,174,196,0.1)'}
        stroke={selected ? 'var(--accent)' : 'rgba(26,174,196,0.45)'}
        strokeWidth={selected ? 2 : 1.5}/>
      <text x={cx} y={cy+4} textAnchor="middle" fontSize="9" fill="var(--ink)" fontFamily="var(--mono)" fontWeight="600">{table.label}</text>
      {Array.from({ length: table.seats }, (_, i) => {
        if (removed.has(i)) return null;
        const angle = (i / table.seats) * Math.PI * 2 - Math.PI / 2;
        const sx = cx + Math.cos(angle) * SEAT_DIST;
        const sy = cy + Math.sin(angle) * SEAT_DIST;
        return (
          <g key={i}>
            <circle cx={sx} cy={sy} r={SEAT_R} fill="var(--surface-soft-3)" stroke="var(--glass-border)" strokeWidth="1"/>
            {onDeleteSeat && (
              <g style={{ cursor:'pointer' }} onClick={e => { e.stopPropagation(); onDeleteSeat(i); }}>
                <circle cx={sx+SEAT_R-2} cy={sy-SEAT_R+2} r={5} fill="rgba(220,70,70,0.9)" stroke="rgba(0,0,0,0.15)" strokeWidth="0.5"/>
                <text x={sx+SEAT_R-2} y={sy-SEAT_R+5.5} textAnchor="middle" fontSize="8" fill="#fff" fontWeight="bold">×</text>
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function RectSVG({ table, selected, onDeleteSeat }) {
  const sps = table.seatsPerSide;
  const { w, h } = rectTableSize(sps);
  const tblX = 10, tblY = 26, tblW = sps * 24, tblH = 28;
  const seatY1 = 10, seatY2 = h - 10;
  const removed = new Set(table.removedSeats || []);
  return (
    <svg width={w} height={h} style={{ display:'block' }}>
      <rect x={tblX} y={tblY} width={tblW} height={tblH} rx={4}
        fill={selected ? 'rgba(26,174,196,0.22)' : 'rgba(26,174,196,0.1)'}
        stroke={selected ? 'var(--accent)' : 'rgba(26,174,196,0.45)'}
        strokeWidth={selected ? 2 : 1.5}/>
      <text x={tblX+tblW/2} y={tblY+tblH/2+4} textAnchor="middle" fontSize="9" fill="var(--ink)" fontFamily="var(--mono)" fontWeight="600">{table.label}</text>
      {Array.from({ length: sps }, (_, i) => {
        const sx = tblX + (i + 0.5) * 24;
        const ti = i, bi = sps + i;
        return (
          <g key={i}>
            {!removed.has(ti) && (
              <g>
                <circle cx={sx} cy={seatY1} r={SEAT_R} fill="var(--surface-soft-3)" stroke="var(--glass-border)" strokeWidth="1"/>
                {onDeleteSeat && (
                  <g style={{ cursor:'pointer' }} onClick={e => { e.stopPropagation(); onDeleteSeat(ti); }}>
                    <circle cx={sx+SEAT_R-2} cy={seatY1-SEAT_R+2} r={5} fill="rgba(220,70,70,0.9)" stroke="rgba(0,0,0,0.15)" strokeWidth="0.5"/>
                    <text x={sx+SEAT_R-2} y={seatY1-SEAT_R+5.5} textAnchor="middle" fontSize="8" fill="#fff" fontWeight="bold">×</text>
                  </g>
                )}
              </g>
            )}
            {!removed.has(bi) && (
              <g>
                <circle cx={sx} cy={seatY2} r={SEAT_R} fill="var(--surface-soft-3)" stroke="var(--glass-border)" strokeWidth="1"/>
                {onDeleteSeat && (
                  <g style={{ cursor:'pointer' }} onClick={e => { e.stopPropagation(); onDeleteSeat(bi); }}>
                    <circle cx={sx+SEAT_R-2} cy={seatY2+SEAT_R-2} r={5} fill="rgba(220,70,70,0.9)" stroke="rgba(0,0,0,0.15)" strokeWidth="0.5"/>
                    <text x={sx+SEAT_R-2} y={seatY2+SEAT_R+1} textAnchor="middle" fontSize="8" fill="#fff" fontWeight="bold">×</text>
                  </g>
                )}
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function StadiumSVG({ table, selected, onDeleteSeat, onSeatClick, selectedSeat }) {
  const { w, h } = stadiumSize(table.rows, table.seatsPerRow);
  const step = 22, seatW = 16, seatH = 16;
  const removed = new Set(table.removedSeats || []);
  const seatNums = table.seatNumbers || {};
  const rowNamesArr = table.rowNames || [];

  return (
    <svg width={w} height={h} style={{ display:'block' }}>
      <rect x={1} y={1} width={w-2} height={h-2} rx={6}
        fill={selected ? 'rgba(26,174,196,0.12)' : 'rgba(26,174,196,0.05)'}
        stroke={selected ? 'var(--accent)' : 'rgba(26,174,196,0.3)'}
        strokeWidth={selected ? 2 : 1} strokeDasharray={selected ? undefined : '4 3'}/>
      <text x={w/2} y={14} textAnchor="middle" fontSize="9" fill="var(--accent)" fontFamily="var(--mono)" fontWeight="600">{table.label}</text>

      {Array.from({ length: table.rows }, (_, row) => {
        const rowName = rowNamesArr[row] !== undefined ? rowNamesArr[row] : String.fromCharCode(65 + row);
        const by0 = 20 + row * step;
        return (
          <g key={row}>
            <text x={8 + ROW_LABEL_W / 2} y={by0 + seatH / 2 + 4}
              textAnchor="middle" fontSize="8" fill="var(--accent)" fontFamily="var(--mono)" fontWeight="700">
              {rowName}
            </text>
            {Array.from({ length: table.seatsPerRow }, (_, col) => {
              const idx = row * table.seatsPerRow + col;
              if (removed.has(idx)) return null;
              const bx = 8 + ROW_LABEL_W + col * step;
              const by = by0;
              const skey = `${row}-${col}`;
              const displayNum = seatNums[skey] !== undefined ? seatNums[skey] : String(col + 1);
              const isSeatSel = selectedSeat && selectedSeat.row === row && selectedSeat.col === col;
              return (
                <g key={skey}
                  onMouseDown={e => e.stopPropagation()}
                  onClick={onSeatClick ? (e => { e.stopPropagation(); onSeatClick(row, col); }) : undefined}
                  style={{ cursor: onSeatClick ? 'pointer' : 'default' }}>
                  <rect x={bx} y={by} width={seatW} height={seatH} rx={3}
                    fill={isSeatSel ? 'rgba(26,174,196,0.35)' : 'var(--surface-soft-3)'}
                    stroke={isSeatSel ? 'var(--accent)' : 'var(--glass-border)'}
                    strokeWidth={isSeatSel ? 1.5 : 0.8}/>
                  <text x={bx + seatW / 2} y={by + seatH / 2 + 3.5}
                    textAnchor="middle" fontSize="7" fill={isSeatSel ? 'var(--accent)' : 'var(--ink)'} fontFamily="var(--mono)">
                    {displayNum}
                  </text>
                  {onDeleteSeat && (
                    <g style={{ cursor:'pointer' }} onClick={e => { e.stopPropagation(); onDeleteSeat(idx); }}>
                      <circle cx={bx+seatW-2} cy={by} r={5} fill="rgba(220,70,70,0.9)" stroke="rgba(0,0,0,0.15)" strokeWidth="0.5"/>
                      <text x={bx+seatW-2} y={by+3.5} textAnchor="middle" fontSize="8" fill="#fff" fontWeight="bold">×</text>
                    </g>
                  )}
                </g>
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}

function StageSVG({ table, selected }) {
  const w = table.stageW || 220, h = table.stageH || 80;
  const svgW = w + 20, svgH = h + 34;
  return (
    <svg width={svgW} height={svgH} style={{ display:'block' }}>
      <text x={svgW/2} y={12} textAnchor="middle" fontSize="9" fill="#e0b864" fontFamily="var(--mono)" fontWeight="600">{table.label}</text>
      <rect x={2} y={16} width={w+16} height={h+10} rx={3} fill="rgba(224,184,100,0.06)" stroke="rgba(224,184,100,0.2)" strokeWidth="1"/>
      <rect x={6} y={19} width={w+8} height={h+6} rx={3} fill="rgba(224,184,100,0.1)" stroke="rgba(224,184,100,0.3)" strokeWidth="1"/>
      <rect x={10} y={22} width={w} height={h} rx={4}
        fill={selected ? 'rgba(224,184,100,0.28)' : 'rgba(224,184,100,0.16)'}
        stroke={selected ? '#e0b864' : 'rgba(224,184,100,0.5)'}
        strokeWidth={selected ? 2 : 1.5}/>
      <text x={svgW/2} y={22+h/2+5} textAnchor="middle" fontSize="10" fill="rgba(224,184,100,0.65)" fontFamily="sans-serif" fontWeight="700" letterSpacing="2">▲ STAGE</text>
    </svg>
  );
}

function PitchSVG({ table, selected }) {
  const pw = table.pitchW || 280, ph = table.pitchH || 140;
  const svgW = pw + 20, svgH = ph + 30;
  const fx = 10, fy = 22;
  const cr = Math.min(pw, ph) * 0.13;
  return (
    <svg width={svgW} height={svgH} style={{ display:'block' }}>
      <text x={svgW/2} y={13} textAnchor="middle" fontSize="9" fill="#5abf6e" fontFamily="var(--mono)" fontWeight="600">{table.label}</text>
      <rect x={fx} y={fy} width={pw} height={ph} rx={6}
        fill={selected ? 'rgba(90,191,110,0.18)' : 'rgba(90,191,110,0.08)'}
        stroke={selected ? '#5abf6e' : 'rgba(90,191,110,0.38)'}
        strokeWidth={selected ? 2 : 1.5}/>
      <line x1={fx+pw/2} y1={fy+5} x2={fx+pw/2} y2={fy+ph-5} stroke="rgba(90,191,110,0.28)" strokeWidth="1" strokeDasharray="5 3"/>
      <circle cx={fx+pw/2} cy={fy+ph/2} r={cr} fill="none" stroke="rgba(90,191,110,0.28)" strokeWidth="1"/>
      <circle cx={fx+pw/2} cy={fy+ph/2} r={2.5} fill="rgba(90,191,110,0.5)"/>
      <text x={svgW/2} y={fy+ph/2+4} textAnchor="middle" fontSize="9" fill="rgba(90,191,110,0.5)" fontFamily="sans-serif" fontWeight="700" letterSpacing="1.5">PITCH AREA</text>
    </svg>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function VenueConfigView({ lang }) {
  const isAr = lang === 'ar';
  const ad = s => isAr ? toArDigits(String(s)) : String(s);

  const STR = isAr ? {
    title: 'تهيئة المكان', sub: 'صمّم مخطط القاعة بالسحب والإفلات',
    palette: 'أنواع العناصر', roundTable: 'طاولة دائرية', rectTable: 'طاولة مستطيلة',
    stadium: 'مدرج', stage: 'مسرح', pitch: 'منطقة ملعب',
    roundDesc: 'مقاعد حول المحيط', rectDesc: 'مقاعد على الجانبين',
    stadiumDesc: 'صفوف × مقاعد في الصف', stageDesc: 'منصة العرض الرئيسية',
    pitchDesc: 'منطقة مفتوحة أو معرض',
    configure: 'تهيئة', label: 'اسم العنصر', seats: 'عدد المقاعد',
    seatsPerSide: 'مقاعد في كل جانب', rows: 'الصفوف', seatsPerRow: 'مقاعد في كل صف',
    deleteTable: 'حذف العنصر', save: 'حفظ التخطيط', saved: 'تم الحفظ ✓',
    clearAll: 'مسح الكل', confirm: 'تأكيد', cancel: 'إلغاء',
    clearMsg: 'مسح كل العناصر في هذا المكان؟',
    dragHint: 'اسحب عنصراً من القائمة إلى اللوحة، وحرّك العناصر بالسحب',
    noSelection: 'انقر على عنصر للتهيئة', totalSeats: 'إجمالي المقاعد', tables: 'عناصر',
    venues: 'الأماكن', newVenue: 'مكان جديد', create: 'إنشاء',
    deleteVenue: 'حذف المكان', deleteVenueMsg: 'حذف هذا المكان وجميع عناصره؟',
    deleteSeats: 'حذف مقاعد', exitDeleteMode: 'إنهاء الحذف',
    deleteSeatsHint: 'انقر × على المقعد لحذفه',
    noStageSeats: 'لا مقاعد فردية على المسرح', noPitchSeats: 'لا مقاعد فردية في منطقة الملعب',
    stageWidth: 'عرض المسرح', stageDepth: 'عمق المسرح',
    areaWidth: 'عرض المنطقة', areaHeight: 'ارتفاع المنطقة',
    rowNames: 'أسماء الصفوف', seatNumber: 'رقم المقعد',
    selectedSeat: 'المقعد المحدد', deselectSeat: 'إلغاء التحديد',
    zoomLabel: 'التكبير', zoomReset: 'إعادة',
  } : {
    title: 'Venue Configuration', sub: 'Design the floor plan using drag-and-drop',
    palette: 'Element types', roundTable: 'Round Table', rectTable: 'Rectangular Table',
    stadium: 'Stadium Block', stage: 'Stage', pitch: 'Pitch Area',
    roundDesc: 'Seats around perimeter', rectDesc: 'Seats on both long sides',
    stadiumDesc: 'Rows × seats per row', stageDesc: 'Performance platform',
    pitchDesc: 'Open area or exhibition space',
    configure: 'Configure', label: 'Label', seats: 'Seats',
    seatsPerSide: 'Seats per side', rows: 'Rows', seatsPerRow: 'Seats per row',
    deleteTable: 'Remove from plan', save: 'Save layout', saved: 'Saved ✓',
    clearAll: 'Clear all', confirm: 'Confirm', cancel: 'Cancel',
    clearMsg: 'Remove all elements from this venue?',
    dragHint: 'Drag a type from the palette onto the canvas, then reposition by dragging.',
    noSelection: 'Click an element to configure it', totalSeats: 'Total seats', tables: 'elements',
    venues: 'Venues', newVenue: 'New Venue', create: 'Create',
    deleteVenue: 'Delete venue', deleteVenueMsg: 'Delete this venue and all its elements?',
    deleteSeats: 'Delete seats', exitDeleteMode: 'Exit delete mode',
    deleteSeatsHint: 'Click × on a seat to remove it',
    noStageSeats: 'No individual seats on stage', noPitchSeats: 'No individual seats in pitch area',
    stageWidth: 'Stage width', stageDepth: 'Stage depth',
    areaWidth: 'Area width', areaHeight: 'Area height',
    rowNames: 'Row Names', seatNumber: 'Seat number',
    selectedSeat: 'Selected seat', deselectSeat: 'Deselect',
    zoomLabel: 'Zoom', zoomReset: 'Reset',
  };

  const [venues, setVenues] = useState(() => {
    try {
      const s = localStorage.getItem(VK);
      if (s) return JSON.parse(s);
    } catch(e) {}
    let firstTables = DEFAULT_TABLES;
    try {
      const old = localStorage.getItem('gms-venue');
      if (old) {
        const p = JSON.parse(old);
        if (p.tables) firstTables = p.tables.map(t => ({ removedSeats: [], rowNames: [], seatNumbers: {}, ...t }));
      }
    } catch(e) {}
    return PREDEFINED_VENUES.map((v, i) => ({ ...v, tables: i === 0 ? firstTables : [] }));
  });

  const [activeVenueId, setActiveVenueId] = useState(() => {
    try { return localStorage.getItem(VAK) || PREDEFINED_VENUES[0].id; } catch(e) {}
    return PREDEFINED_VENUES[0].id;
  });

  const [selectedId, setSelectedId] = useState(null);
  const [selectedSeat, setSelectedSeat] = useState(null);
  const [zoom, setZoom] = useState(1.0);
  const zoomRef = useRef(1.0);
  const [saved, setSaved] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showNewVenue, setShowNewVenue] = useState(false);
  const [newVenueName, setNewVenueName] = useState('');
  const [newVenueType, setNewVenueType] = useState('general');
  const [newVenueCategories, setNewVenueCategories] = useState([]);
  const [newVenueBlocks, setNewVenueBlocks] = useState([]);
  const [activeBlockId, setActiveBlockId] = useState(null);
  const [editingBlockId, setEditingBlockId] = useState(null);
  const [editingBlockLabel, setEditingBlockLabel] = useState('');
  const [showAddBlock, setShowAddBlock] = useState(false);
  const [newBlockLabel, setNewBlockLabel] = useState('');
  const [newBlockRows, setNewBlockRows] = useState(10);
  const [newBlockSeatsPerRow, setNewBlockSeatsPerRow] = useState(20);
  const [newBlockCategoryId, setNewBlockCategoryId] = useState('');
  const [pendingDeleteBlockId, setPendingDeleteBlockId] = useState(null);
  const [pendingDeleteVenueId, setPendingDeleteVenueId] = useState(null);
  const [deleteSeatMode, setDeleteSeatMode] = useState(false);
  const dragTypeRef = useRef(null);
  const canvasRef = useRef(null);
  const idCounter = useRef(100);

  useEffect(() => { zoomRef.current = zoom; }, [zoom]);

  const activeVenue = venues.find(v => v.id === activeVenueId) || venues[0];
  const isStadiumVenue = activeVenue?.venueType === 'stadium';
  const venueBlocks = isStadiumVenue ? (activeVenue?.blocks || []) : [];
  const activeBlock = isStadiumVenue
    ? (venueBlocks.find(b => b.id === activeBlockId) || venueBlocks[0] || null)
    : null;
  const tables = isStadiumVenue ? (activeBlock?.tables || []) : (activeVenue?.tables || []);
  const selectedTable = tables.find(t => t.id === selectedId) || null;
  const isDeletableSeat = selectedTable && ['round','rect','stadium'].includes(selectedTable.type);

  function zoomIn()    { setZoom(z => Math.min(MAX_ZOOM, +((z + 0.1).toFixed(1)))); }
  function zoomOut()   { setZoom(z => Math.max(MIN_ZOOM, +((z - 0.1).toFixed(1)))); }
  function zoomReset() { setZoom(1.0); }

  function setTables(updater) {
    const bid = activeBlock?.id;
    setVenues(prev => prev.map(v => {
      if (v.id !== activeVenueId) return v;
      if (v.venueType === 'stadium') {
        return {
          ...v,
          blocks: (v.blocks || []).map(b =>
            b.id === bid
              ? { ...b, tables: typeof updater === 'function' ? updater(b.tables || []) : updater }
              : b
          ),
        };
      }
      return { ...v, tables: typeof updater === 'function' ? updater(v.tables) : updater };
    }));
  }

  function updateTable(id, patch) {
    setTables(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t));
  }

  function removeTable(id) {
    setTables(prev => prev.filter(t => t.id !== id));
    setSelectedId(null);
    setSelectedSeat(null);
    setDeleteSeatMode(false);
  }

  function addTable(type, x, y) {
    idCounter.current += 1;
    const n = idCounter.current;
    const id = `tu${n}`;
    let extra = {};
    if (type === 'round')   extra = { seats:8, label:`T-${String(n).padStart(2,'0')}`, removedSeats:[] };
    if (type === 'rect')    extra = { seatsPerSide:4, label:`T-${String(n).padStart(2,'0')}`, removedSeats:[] };
    if (type === 'stadium') extra = { rows:3, seatsPerRow:8, label:`Blk-${String.fromCharCode(64+(n%26)+1)}`, removedSeats:[], rowNames:[], seatNumbers:{} };
    if (type === 'stage')   extra = { stageW:220, stageH:80, label: isAr ? 'مسرح' : 'Stage' };
    if (type === 'pitch')   extra = { pitchW:280, pitchH:140, label: isAr ? 'منطقة الملعب' : 'Pitch Area' };
    setTables(prev => [...prev, { id, type, x, y, ...extra }]);
    setSelectedId(id);
    setSelectedSeat(null);
  }

  function handleDeleteSeat(seatIdx) {
    setTables(prev => prev.map(t => {
      if (t.id !== selectedId) return t;
      const s = new Set(t.removedSeats || []);
      s.add(seatIdx);
      return { ...t, removedSeats: Array.from(s) };
    }));
  }

  function restoreSeats() {
    setTables(prev => prev.map(t => t.id === selectedId ? { ...t, removedSeats: [] } : t));
  }

  function startDragTable(e, tableId) {
    if (e.button !== 0) return;
    e.preventDefault(); e.stopPropagation();
    setSelectedId(tableId);
    setSelectedSeat(null);
    const sx = e.clientX, sy = e.clientY;
    const tbl = tables.find(t => t.id === tableId);
    const ox = tbl.x, oy = tbl.y;
    const z = zoomRef.current;
    const onMove = me => {
      setTables(prev => prev.map(t => t.id === tableId
        ? { ...t, x: Math.max(0, ox + (me.clientX - sx) / z), y: Math.max(0, oy + (me.clientY - sy) / z) }
        : t));
    };
    const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  function handleDrop(e) {
    e.preventDefault();
    const type = dragTypeRef.current;
    if (!type) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const z = zoomRef.current;
    addTable(type, Math.max(0, (e.clientX - rect.left) / z - 55), Math.max(0, (e.clientY - rect.top) / z - 55));
    dragTypeRef.current = null;
  }

  function allTablesForSeating(v) {
    if (v?.venueType === 'stadium') return (v.blocks || []).flatMap(b => b.tables || []);
    return v?.tables || [];
  }

  function saveLayout() {
    localStorage.setItem(VK, JSON.stringify(venues));
    localStorage.setItem(VAK, activeVenueId);
    localStorage.setItem('gms-venue', JSON.stringify({ tables: allTablesForSeating(activeVenue) }));
    setSaved(true); setTimeout(() => setSaved(false), 2200);
  }

  function switchVenue(venueId) {
    localStorage.setItem(VK, JSON.stringify(venues));
    const v = venues.find(vv => vv.id === venueId) || { tables: [], blocks: [] };
    const isStad = v.venueType === 'stadium';
    const firstBlock = isStad ? (v.blocks || [])[0] : null;
    localStorage.setItem('gms-venue', JSON.stringify({ tables: allTablesForSeating(v) }));
    localStorage.setItem(VAK, venueId);
    setActiveVenueId(venueId);
    setActiveBlockId(firstBlock?.id || null);
    setSelectedId(null);
    setSelectedSeat(null);
    setDeleteSeatMode(false);
  }

  function addCategory() {
    const id = `cat${Date.now()}`;
    setNewVenueCategories(prev => {
      const color = CATEGORY_COLORS[prev.length % CATEGORY_COLORS.length];
      return [...prev, { id, name: '', color }];
    });
  }
  function removeCategory(id) {
    setNewVenueCategories(prev => prev.filter(c => c.id !== id));
    setNewVenueBlocks(prev => prev.map(b => b.categoryId === id ? { ...b, categoryId: '' } : b));
  }
  function updateCategory(id, name) {
    setNewVenueCategories(prev => prev.map(c => c.id === id ? { ...c, name } : c));
  }
  function addBlock() {
    const id = `blk${Date.now()}`;
    const n = newVenueBlocks.length;
    setNewVenueBlocks(prev => [...prev, {
      id, label: `Block ${String.fromCharCode(65 + n)}`, rows: 10, seatsPerRow: 20, categoryId: '',
    }]);
  }
  function removeBlock(id) {
    setNewVenueBlocks(prev => prev.filter(b => b.id !== id));
  }
  function updateBlock(id, patch) {
    setNewVenueBlocks(prev => prev.map(b => b.id === id ? { ...b, ...patch } : b));
  }

  function resetNewVenueForm() {
    setNewVenueName(''); setNewVenueType('general');
    setNewVenueCategories([]); setNewVenueBlocks([]);
  }

  function commitRenameBlock(blockId) {
    const label = editingBlockLabel.trim();
    setEditingBlockId(null);
    if (!label) return;
    setVenues(prev => prev.map(v =>
      v.id !== activeVenueId ? v : {
        ...v, blocks: (v.blocks || []).map(b => b.id === blockId ? { ...b, label } : b),
      }
    ));
  }

  function confirmDeleteBlock() {
    const bid = pendingDeleteBlockId;
    if (!bid || venueBlocks.length <= 1) { setPendingDeleteBlockId(null); return; }
    setVenues(prev => prev.map(v =>
      v.id !== activeVenueId ? v : {
        ...v, blocks: (v.blocks || []).filter(b => b.id !== bid),
      }
    ));
    if (activeBlock?.id === bid) {
      const remaining = venueBlocks.filter(b => b.id !== bid);
      setActiveBlockId(remaining[0]?.id || null);
    }
    setPendingDeleteBlockId(null);
    setSelectedId(null); setSelectedSeat(null); setDeleteSeatMode(false);
  }

  function doAddBlock() {
    const label = newBlockLabel.trim() || `Block ${String.fromCharCode(65 + venueBlocks.length)}`;
    const rows = Math.max(1, newBlockRows);
    const seatsPerRow = Math.max(1, newBlockSeatsPerRow);
    const cat = (activeVenue?.categories || []).find(c => c.id === newBlockCategoryId);
    const catName = cat?.name || '';
    const catColor = cat?.color || '';
    const bid = `blk${Date.now()}`;
    const newBlock = {
      id: bid, label, category: catName, categoryColor: catColor, rows, seatsPerRow,
      tables: [{
        id: `${bid}_t0`, type: 'stadium', x: 10, y: 10,
        rows, seatsPerRow, label,
        removedSeats: [], rowNames: [], seatNumbers: {},
        category: catName, categoryColor: catColor,
      }],
    };
    setVenues(prev => prev.map(v =>
      v.id !== activeVenueId ? v : { ...v, blocks: [...(v.blocks || []), newBlock] }
    ));
    setActiveBlockId(bid);
    setSelectedId(null); setSelectedSeat(null);
    setNewBlockLabel(''); setNewBlockRows(10); setNewBlockSeatsPerRow(20); setNewBlockCategoryId('');
    setShowAddBlock(false);
  }

  function createVenue() {
    const name = newVenueName.trim();
    if (!name) return;
    const id = `vc${Date.now()}`;

    let nv;
    if (newVenueType === 'stadium') {
      const blocks = newVenueBlocks.map((blk, i) => {
        const rows = Math.max(1, blk.rows);
        const seatsPerRow = Math.max(1, blk.seatsPerRow);
        const cat = newVenueCategories.find(c => c.id === blk.categoryId);
        const catName = cat?.name || '';
        const catColor = cat?.color || '';
        const label = blk.label || `Block ${String.fromCharCode(65 + i)}`;
        return {
          id: `${id}_b${i}`,
          label,
          category: catName,
          categoryColor: catColor,
          rows,
          seatsPerRow,
          tables: [{
            id: `${id}_b${i}_t0`,
            type: 'stadium',
            x: 10, y: 10,
            rows, seatsPerRow, label,
            removedSeats: [], rowNames: [], seatNumbers: {},
            category: catName,
            categoryColor: catColor,
          }],
        };
      });
      nv = { id, name, venueType: 'stadium', categories: newVenueCategories, blocks, tables: [] };
      const updated = [...venues, nv];
      setVenues(updated);
      localStorage.setItem(VK, JSON.stringify(updated));
      localStorage.setItem(VAK, id);
      localStorage.setItem('gms-venue', JSON.stringify({ tables: allTablesForSeating(nv) }));
      setActiveVenueId(id);
      setActiveBlockId(blocks[0]?.id || null);
    } else {
      nv = { id, name, venueType: newVenueType, categories: [], tables: [] };
      const updated = [...venues, nv];
      setVenues(updated);
      localStorage.setItem(VK, JSON.stringify(updated));
      localStorage.setItem(VAK, id);
      localStorage.setItem('gms-venue', JSON.stringify({ tables: [] }));
      setActiveVenueId(id);
      setActiveBlockId(null);
    }

    setSelectedId(null); setSelectedSeat(null);
    resetNewVenueForm(); setShowNewVenue(false);
  }

  function confirmDeleteVenue() {
    const vid = pendingDeleteVenueId;
    if (!vid || venues.length <= 1) { setPendingDeleteVenueId(null); return; }
    const updated = venues.filter(v => v.id !== vid);
    setVenues(updated);
    if (activeVenueId === vid) {
      const na = updated[0].id;
      setActiveVenueId(na);
      localStorage.setItem(VAK, na);
      localStorage.setItem('gms-venue', JSON.stringify({ tables: updated[0].tables }));
    }
    localStorage.setItem(VK, JSON.stringify(updated));
    setPendingDeleteVenueId(null);
  }

  const totalSeats = tables.reduce((acc, t) => {
    const r = (t.removedSeats || []).length;
    if (t.type === 'round')   return acc + Math.max(0, (t.seats || 0) - r);
    if (t.type === 'rect')    return acc + Math.max(0, (t.seatsPerSide || 0) * 2 - r);
    if (t.type === 'stadium') return acc + Math.max(0, (t.rows || 0) * (t.seatsPerRow || 0) - r);
    return acc;
  }, 0);

  const sliderStyle = { width:'100%', accentColor:'var(--accent)' };
  const inputStyle = { width:'100%', background:'var(--surface-soft-3)', border:'1px solid var(--glass-border)', borderRadius:8, padding:'8px 11px', color:'var(--ink)', fontSize:13, boxSizing:'border-box' };
  const labelStyle = { display:'block', fontSize:10.5, color:'var(--ink-mute)', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:4 };

  const paletteItems = [
    { type:'round',   icon:'seating',   label:STR.roundTable, desc:STR.roundDesc,   color:'var(--accent)' },
    { type:'rect',    icon:'meetings',  label:STR.rectTable,  desc:STR.rectDesc,    color:'var(--accent)' },
    { type:'stadium', icon:'dashboard', label:STR.stadium,    desc:STR.stadiumDesc, color:'var(--accent)' },
    { type:'stage',   icon:'star',      label:STR.stage,      desc:STR.stageDesc,   color:'#e0b864' },
    { type:'pitch',   icon:'globe',     label:STR.pitch,      desc:STR.pitchDesc,   color:'#5abf6e' },
  ];

  const paletteItemBorder = type =>
    type === 'stage' ? 'rgba(224,184,100,0.45)'
    : type === 'pitch' ? 'rgba(90,191,110,0.45)'
    : 'var(--glass-border)';

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

      {/* Venues bar */}
      <div className="card" style={{ padding:'10px 14px', marginBottom:14 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:10.5, color:'var(--ink-mute)', textTransform:'uppercase', letterSpacing:'0.1em', fontWeight:600, flexShrink:0 }}>
            {STR.venues}
          </span>
          <select
            value={activeVenueId}
            onChange={e => switchVenue(e.target.value)}
            style={{ flex:1, maxWidth:280, background:'var(--surface-soft-3)', border:'1px solid var(--glass-border)', borderRadius:8, padding:'6px 10px', color:'var(--ink)', fontSize:13, cursor:'pointer' }}>
            {venues.map(v => {
              const sc = getVenueTotalSeats(v);
              return (
                <option key={v.id} value={v.id}>
                  {v.name}{sc > 0 ? ` · ${sc} seats` : ''}
                </option>
              );
            })}
          </select>
          {activeVenue?.venueType && activeVenue.venueType !== 'general' && (
            <span style={{ fontSize:11, fontWeight:600, color:'var(--accent)', background:'rgba(26,174,196,0.1)', border:'1px solid rgba(26,174,196,0.25)', borderRadius:20, padding:'3px 10px', flexShrink:0, textTransform:'capitalize' }}>
              {activeVenue.venueType}
            </span>
          )}
          {venues.length > 1 && (
            <button className="btn" style={{ fontSize:11, padding:'4px 10px', color:'#e08a7e', borderColor:'rgba(224,138,126,0.3)' }}
              onClick={() => setPendingDeleteVenueId(activeVenueId)}>
              <Icon name="trash" size={12}/>
            </button>
          )}
          <button className="btn" style={{ padding:'4px 12px', fontSize:12, flexShrink:0 }} onClick={() => setShowNewVenue(true)}>
            <Icon name="plus" size={12}/> {STR.newVenue}
          </button>
        </div>
      </div>

      {/* Block selector — stadium venues only */}
      {isStadiumVenue && venueBlocks.length > 0 && (
        <div className="card" style={{ padding:'10px 14px', marginBottom:14 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
            <span style={{ fontSize:10.5, color:'var(--ink-mute)', textTransform:'uppercase', letterSpacing:'0.1em', fontWeight:600, flexShrink:0 }}>
              {isAr ? 'الكتل' : 'Blocks'}
            </span>

            {venueBlocks.map(blk => {
              const isActive = blk.id === activeBlock?.id;
              const isEditing = editingBlockId === blk.id;
              const cc = blk.categoryColor;
              const chipColor  = cc || 'var(--accent)';
              const chipBg     = cc ? hexToRgba(cc, isActive ? 0.18 : 0.08) : (isActive ? 'rgba(26,174,196,0.1)' : 'var(--surface-soft-2)');
              const chipBorder = cc ? (isActive ? cc : (hexToRgba(cc, 0.45) || 'var(--glass-border)')) : (isActive ? 'var(--accent)' : 'var(--glass-border)');
              return (
                <div key={blk.id} style={{
                  display:'flex', alignItems:'center',
                  borderRadius:20, border:`1px solid ${chipBorder}`, background: chipBg,
                  overflow:'hidden',
                }}>
                  {/* Main click area */}
                  <button
                    onClick={() => { setActiveBlockId(blk.id); setSelectedId(null); setSelectedSeat(null); setDeleteSeatMode(false); }}
                    style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 10px 5px 14px', background:'none', border:'none', cursor:'pointer',
                      fontSize:12.5, fontWeight: isActive ? 600 : 400, color: isActive ? chipColor : 'var(--ink)' }}>
                    {cc && <span style={{ width:8, height:8, borderRadius:'50%', background:cc, flexShrink:0 }}/>}
                    {isEditing ? (
                      <input
                        autoFocus
                        value={editingBlockLabel}
                        onChange={e => setEditingBlockLabel(e.target.value)}
                        onBlur={() => commitRenameBlock(blk.id)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') commitRenameBlock(blk.id);
                          if (e.key === 'Escape') setEditingBlockId(null);
                          e.stopPropagation();
                        }}
                        onClick={e => e.stopPropagation()}
                        style={{ width:90, background:'transparent', border:'none', borderBottom:`1px solid ${chipColor}`,
                          outline:'none', fontSize:12.5, fontWeight:600, color: chipColor, padding:'0 2px' }}
                      />
                    ) : (
                      <span>{blk.label}</span>
                    )}
                    {blk.category && !isEditing && (
                      <span style={{ fontSize:10, color: isActive ? chipColor : 'var(--ink-mute)', fontWeight:400 }}>· {blk.category}</span>
                    )}
                    {!isEditing && (
                      <span style={{ fontSize:10.5, fontFamily:'var(--mono)', fontWeight:600,
                        color: isActive ? chipColor : 'var(--ink-mute)' }}>
                        {getBlockTotalSeats(blk)}
                      </span>
                    )}
                  </button>

                  {/* Rename button */}
                  <button
                    title={isAr ? 'إعادة تسمية' : 'Rename'}
                    onClick={e => { e.stopPropagation(); setEditingBlockId(blk.id); setEditingBlockLabel(blk.label); }}
                    style={{ padding:'4px 5px', background:'none', border:'none', cursor:'pointer',
                      color: isActive ? chipColor : 'var(--ink)', opacity:0.75, lineHeight:1 }}>
                    <Icon name="edit" size={12}/>
                  </button>

                  {/* Delete button — only when more than one block */}
                  {venueBlocks.length > 1 && (
                    <button
                      title={isAr ? 'حذف الكتلة' : 'Delete block'}
                      onClick={e => { e.stopPropagation(); setPendingDeleteBlockId(blk.id); }}
                      style={{ padding:'4px 8px 4px 2px', background:'none', border:'none', cursor:'pointer',
                        color:'#e05252', opacity:0.85, lineHeight:1 }}>
                      <Icon name="trash" size={11}/>
                    </button>
                  )}
                </div>
              );
            })}

            {/* Add block button */}
            <button className="btn" style={{ borderRadius:20, padding:'4px 12px', fontSize:12 }}
              onClick={() => setShowAddBlock(true)}>
              <Icon name="plus" size={12}/> {isAr ? 'كتلة' : 'Add block'}
            </button>
          </div>
        </div>
      )}

      {/* Stats */}
      <div style={{ display:'flex', gap:16, marginBottom:14 }}>
        <span style={{ fontSize:12, color:'var(--ink-mute)' }}><strong style={{ color:'var(--ink)' }}>{ad(tables.length)}</strong> {STR.tables}</span>
        <span style={{ fontSize:12, color:'var(--ink-mute)' }}><strong style={{ color:'var(--ink)' }}>{ad(totalSeats)}</strong> {STR.totalSeats}</span>
      </div>

      <div style={{ display:'flex', gap:14, alignItems:'flex-start' }}>
        {/* Palette */}
        <div style={{ width:200, flexShrink:0 }}>
          <div className="card" style={{ padding:0 }}>
            <div style={{ padding:'12px 14px', borderBottom:'1px solid var(--glass-border)', fontSize:11, letterSpacing:'0.1em', textTransform:'uppercase', color:'var(--ink-mute)', fontWeight:600 }}>
              {STR.palette}
            </div>
            <div style={{ padding:'10px', display:'flex', flexDirection:'column', gap:8 }}>
              {paletteItems.map(item => (
                <div key={item.type} draggable
                  onDragStart={() => { dragTypeRef.current = item.type; }}
                  style={{ padding:'10px 12px', borderRadius:9, border:`1px dashed ${paletteItemBorder(item.type)}`, cursor:'grab', background:'var(--surface-soft-2)', userSelect:'none' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                    <Icon name={item.icon} size={14} style={{ color:item.color }}/>
                    <span style={{ fontSize:12.5, fontWeight:600 }}>{item.label}</span>
                    <Icon name="drag" size={12} style={{ marginLeft:'auto', color:'var(--ink-faint)' }}/>
                  </div>
                  <div style={{ fontSize:10.5, color:'var(--ink-mute)' }}>{item.desc}</div>
                </div>
              ))}
            </div>
            <div style={{ padding:'10px 14px', borderTop:'1px solid var(--glass-border)', fontSize:10.5, color:'var(--ink-faint)', lineHeight:1.5 }}>
              {STR.dragHint}
            </div>
          </div>
        </div>

        {/* Canvas */}
        <div className="card" style={{ flex:1, padding:0, overflow:'hidden', display:'flex', flexDirection:'column' }}>
          {/* Zoom toolbar */}
          <div style={{ padding:'6px 12px', borderBottom:'1px solid var(--glass-border)', display:'flex', alignItems:'center', gap:6, background:'var(--surface-soft-3)', flexShrink:0 }}>
            <span style={{ fontSize:10.5, color:'var(--ink-mute)', textTransform:'uppercase', letterSpacing:'0.1em', marginRight:2 }}>{STR.zoomLabel}</span>
            <button className="icon-btn" onClick={zoomOut} disabled={zoom <= MIN_ZOOM}
              style={{ fontSize:16, fontWeight:300, lineHeight:'24px', width:28, height:28 }}>−</button>
            <span style={{ fontSize:12, fontFamily:'var(--mono)', minWidth:38, textAlign:'center', color:'var(--ink)' }}>
              {Math.round(zoom * 100)}%
            </span>
            <button className="icon-btn" onClick={zoomIn} disabled={zoom >= MAX_ZOOM}
              style={{ fontSize:16, fontWeight:300, lineHeight:'24px', width:28, height:28 }}>+</button>
            <button className="btn" style={{ fontSize:11, padding:'3px 9px', marginLeft:2 }} onClick={zoomReset}>{STR.zoomReset}</button>
            <span style={{ marginLeft:'auto', fontSize:10.5, color:'var(--ink-faint)' }}>
              {isAr ? 'Ctrl+scroll للتكبير' : 'Ctrl+scroll to zoom'}
            </span>
          </div>

          {/* Scrollable canvas area */}
          <div style={{ overflow:'auto', minHeight:480 }}
            onWheel={e => {
              if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                const delta = e.deltaY > 0 ? -0.1 : 0.1;
                setZoom(z => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, +((z + delta).toFixed(1)))));
              }
            }}>
            {/* Spacer establishes scrollable dimensions matching the scaled canvas */}
            <div style={{ width: CANVAS_W * zoom, height: CANVAS_H * zoom, position:'relative', flexShrink:0 }}>
              <div ref={canvasRef}
                style={{
                  position:'absolute', top:0, left:0,
                  width:CANVAS_W, height:CANVAS_H,
                  transform:`scale(${zoom})`,
                  transformOrigin:'top left',
                  background:'var(--surface-soft-2)',
                }}
                onDragOver={e => e.preventDefault()}
                onDrop={handleDrop}
                onClick={e => { if (e.currentTarget === e.target) { setSelectedId(null); setSelectedSeat(null); } }}>

                <svg style={{ position:'absolute', inset:0, width:'100%', height:'100%', pointerEvents:'none' }}>
                  <defs>
                    <pattern id="gridPat" width="40" height="40" patternUnits="userSpaceOnUse">
                      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="var(--glass-border)" strokeWidth="0.4"/>
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#gridPat)"/>
                </svg>

                {tables.map(t => {
                  const isSel = t.id === selectedId;
                  const showDel = deleteSeatMode && isSel && isDeletableSeat;
                  const thisSeat = selectedSeat && selectedSeat.tableId === t.id
                    ? { row: selectedSeat.row, col: selectedSeat.col } : null;
                  let svgEl;
                  if (t.type === 'round')
                    svgEl = <RoundSVG table={t} selected={isSel} onDeleteSeat={showDel ? handleDeleteSeat : null}/>;
                  else if (t.type === 'rect')
                    svgEl = <RectSVG table={t} selected={isSel} onDeleteSeat={showDel ? handleDeleteSeat : null}/>;
                  else if (t.type === 'stadium')
                    svgEl = <StadiumSVG table={t} selected={isSel}
                      onDeleteSeat={showDel ? handleDeleteSeat : null}
                      onSeatClick={!deleteSeatMode && isSel ? (row, col) => setSelectedSeat({ tableId: t.id, row, col }) : null}
                      selectedSeat={thisSeat}/>;
                  else if (t.type === 'stage')
                    svgEl = <StageSVG table={t} selected={isSel}/>;
                  else
                    svgEl = <PitchSVG table={t} selected={isSel}/>;
                  return (
                    <div key={t.id}
                      style={{ position:'absolute', left:t.x, top:t.y, cursor:'move', userSelect:'none', filter: isSel ? 'drop-shadow(0 0 6px rgba(26,174,196,0.5))' : undefined }}
                      onMouseDown={e => startDragTable(e, t.id)}>
                      {svgEl}
                    </div>
                  );
                })}

                {tables.length === 0 && (
                  <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--ink-faint)', fontSize:13, pointerEvents:'none' }}>
                    {isAr ? 'اسحب عنصراً من القائمة' : 'Drag an element from the palette'}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Config panel */}
        <div style={{ width:224, flexShrink:0 }}>
          <div className="card" style={{ padding:0 }}>
            <div style={{ padding:'12px 14px', borderBottom:'1px solid var(--glass-border)', fontSize:11, letterSpacing:'0.1em', textTransform:'uppercase', color:'var(--ink-mute)', fontWeight:600 }}>
              {STR.configure}
            </div>
            {selectedTable ? (
              <div style={{ padding:'14px', display:'flex', flexDirection:'column', gap:14, maxHeight:'70vh', overflowY:'auto' }}>
                <div>
                  <label style={labelStyle}>{STR.label}</label>
                  <input style={inputStyle} value={selectedTable.label}
                    onChange={e => updateTable(selectedTable.id, { label: e.target.value })}/>
                </div>
                {selectedTable.type === 'stadium' && selectedTable.category && (() => {
                  const cc = selectedTable.categoryColor;
                  return (
                    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <span style={{ fontSize:10, color:'var(--ink-mute)', textTransform:'uppercase', letterSpacing:'0.08em' }}>
                        {isAr ? 'الفئة' : 'Category'}
                      </span>
                      <span style={{
                        display:'flex', alignItems:'center', gap:5,
                        fontSize:11, fontWeight:600,
                        color: cc || 'var(--accent)',
                        background: cc ? hexToRgba(cc, 0.1) : 'rgba(26,174,196,0.1)',
                        border:`1px solid ${cc ? hexToRgba(cc, 0.3) : 'rgba(26,174,196,0.25)'}`,
                        borderRadius:20, padding:'2px 10px',
                      }}>
                        {cc && <span style={{ width:7, height:7, borderRadius:'50%', background:cc, flexShrink:0 }}/>}
                        {selectedTable.category}
                      </span>
                    </div>
                  );
                })()}

                {selectedTable.type === 'round' && (
                  <div>
                    <label style={labelStyle}>{STR.seats} · {ad(selectedTable.seats)}</label>
                    <input type="range" min={4} max={20} value={selectedTable.seats} style={sliderStyle}
                      onChange={e => updateTable(selectedTable.id, { seats: +e.target.value })}/>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:'var(--ink-faint)', marginTop:2 }}><span>4</span><span>20</span></div>
                  </div>
                )}

                {selectedTable.type === 'rect' && (
                  <div>
                    <label style={labelStyle}>{STR.seatsPerSide} · {ad(selectedTable.seatsPerSide)}</label>
                    <input type="range" min={2} max={8} value={selectedTable.seatsPerSide} style={sliderStyle}
                      onChange={e => updateTable(selectedTable.id, { seatsPerSide: +e.target.value })}/>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:'var(--ink-faint)', marginTop:2 }}><span>2</span><span>8</span></div>
                  </div>
                )}

                {selectedTable.type === 'stadium' && (
                  <>
                    <div>
                      <label style={labelStyle}>{STR.rows} · {ad(selectedTable.rows)}</label>
                      <input type="range" min={2} max={10} value={selectedTable.rows} style={sliderStyle}
                        onChange={e => {
                          const newRows = +e.target.value;
                          updateTable(selectedTable.id, { rows: newRows });
                          if (selectedSeat && selectedSeat.tableId === selectedTable.id && selectedSeat.row >= newRows)
                            setSelectedSeat(null);
                        }}/>
                      <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:'var(--ink-faint)', marginTop:2 }}><span>2</span><span>10</span></div>
                    </div>
                    <div>
                      <label style={labelStyle}>{STR.seatsPerRow} · {ad(selectedTable.seatsPerRow)}</label>
                      <input type="range" min={5} max={20} value={selectedTable.seatsPerRow} style={sliderStyle}
                        onChange={e => {
                          const newSpr = +e.target.value;
                          updateTable(selectedTable.id, { seatsPerRow: newSpr });
                          if (selectedSeat && selectedSeat.tableId === selectedTable.id && selectedSeat.col >= newSpr)
                            setSelectedSeat(null);
                        }}/>
                      <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:'var(--ink-faint)', marginTop:2 }}><span>5</span><span>20</span></div>
                    </div>
                    <div style={{ fontSize:11, color:'var(--ink-mute)', background:'var(--surface-soft-2)', borderRadius:6, padding:'6px 10px' }}>
                      {ad(selectedTable.rows * selectedTable.seatsPerRow)} {isAr ? 'مقعد' : 'seats total'}
                    </div>

                    {/* Row names */}
                    <div>
                      <label style={labelStyle}>{STR.rowNames}</label>
                      <div style={{ maxHeight:120, overflowY:'auto', display:'flex', flexDirection:'column', gap:4 }}>
                        {Array.from({ length: selectedTable.rows }, (_, row) => {
                          const rns = selectedTable.rowNames || [];
                          const defName = String.fromCharCode(65 + row);
                          const val = rns[row] !== undefined ? rns[row] : defName;
                          return (
                            <div key={row} style={{ display:'flex', alignItems:'center', gap:5 }}>
                              <span style={{ fontSize:10, color:'var(--ink-faint)', width:16, textAlign:'right', flexShrink:0, fontFamily:'var(--mono)' }}>
                                {defName}
                              </span>
                              <input style={{ ...inputStyle, flex:1, padding:'4px 7px', fontSize:12 }}
                                value={val}
                                onChange={e => {
                                  const arr = Array.from({ length: selectedTable.rows }, (_, i) => {
                                    if (i === row) return e.target.value;
                                    const ex = (selectedTable.rowNames || [])[i];
                                    return ex !== undefined ? ex : String.fromCharCode(65 + i);
                                  });
                                  updateTable(selectedTable.id, { rowNames: arr });
                                }}/>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Selected seat editor */}
                    {selectedSeat && selectedSeat.tableId === selectedTable.id && (() => {
                      const { row, col } = selectedSeat;
                      const rns = selectedTable.rowNames || [];
                      const rowName = rns[row] !== undefined ? rns[row] : String.fromCharCode(65 + row);
                      const skey = `${row}-${col}`;
                      const seatNums = selectedTable.seatNumbers || {};
                      const seatNum = seatNums[skey] !== undefined ? seatNums[skey] : String(col + 1);
                      return (
                        <div style={{ padding:'10px', background:'rgba(26,174,196,0.07)', border:'1px solid rgba(26,174,196,0.2)', borderRadius:8 }}>
                          <div style={{ fontSize:10.5, color:'var(--ink-mute)', marginBottom:8 }}>
                            {STR.selectedSeat}:{' '}
                            <strong style={{ color:'var(--accent)', fontFamily:'var(--mono)' }}>
                              {rowName}{seatNum}
                            </strong>
                          </div>
                          <label style={labelStyle}>{STR.seatNumber}</label>
                          <input style={inputStyle} value={seatNum}
                            onChange={e => {
                              const nums = { ...(selectedTable.seatNumbers || {}), [skey]: e.target.value };
                              updateTable(selectedTable.id, { seatNumbers: nums });
                            }}/>
                          <button className="btn" style={{ marginTop:6, width:'100%', justifyContent:'center', fontSize:11 }}
                            onClick={() => setSelectedSeat(null)}>
                            {STR.deselectSeat}
                          </button>
                        </div>
                      );
                    })()}
                  </>
                )}

                {selectedTable.type === 'stage' && (
                  <>
                    <div>
                      <label style={labelStyle}>{STR.stageWidth} · {ad(selectedTable.stageW || 220)}px</label>
                      <input type="range" min={100} max={400} value={selectedTable.stageW || 220} style={sliderStyle}
                        onChange={e => updateTable(selectedTable.id, { stageW: +e.target.value })}/>
                    </div>
                    <div>
                      <label style={labelStyle}>{STR.stageDepth} · {ad(selectedTable.stageH || 80)}px</label>
                      <input type="range" min={40} max={160} value={selectedTable.stageH || 80} style={sliderStyle}
                        onChange={e => updateTable(selectedTable.id, { stageH: +e.target.value })}/>
                    </div>
                    <div style={{ fontSize:11, color:'rgba(224,184,100,0.85)', background:'rgba(224,184,100,0.08)', borderRadius:6, padding:'6px 10px' }}>
                      {STR.noStageSeats}
                    </div>
                  </>
                )}

                {selectedTable.type === 'pitch' && (
                  <>
                    <div>
                      <label style={labelStyle}>{STR.areaWidth} · {ad(selectedTable.pitchW || 280)}px</label>
                      <input type="range" min={120} max={500} value={selectedTable.pitchW || 280} style={sliderStyle}
                        onChange={e => updateTable(selectedTable.id, { pitchW: +e.target.value })}/>
                    </div>
                    <div>
                      <label style={labelStyle}>{STR.areaHeight} · {ad(selectedTable.pitchH || 140)}px</label>
                      <input type="range" min={80} max={300} value={selectedTable.pitchH || 140} style={sliderStyle}
                        onChange={e => updateTable(selectedTable.id, { pitchH: +e.target.value })}/>
                    </div>
                    <div style={{ fontSize:11, color:'rgba(90,191,110,0.85)', background:'rgba(90,191,110,0.08)', borderRadius:6, padding:'6px 10px' }}>
                      {STR.noPitchSeats}
                    </div>
                  </>
                )}

                {isDeletableSeat && (
                  <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
                    <div style={{ height:1, background:'var(--glass-border)' }}/>
                    <button className="btn" style={{ width:'100%', justifyContent:'center', ...(deleteSeatMode ? { background:'rgba(220,70,70,0.1)', color:'#e05555', borderColor:'rgba(220,70,70,0.3)' } : {}) }}
                      onClick={() => setDeleteSeatMode(d => !d)}>
                      <Icon name="trash" size={13}/> {deleteSeatMode ? STR.exitDeleteMode : STR.deleteSeats}
                    </button>
                    {(selectedTable.removedSeats?.length > 0) && (
                      <button className="btn" style={{ width:'100%', justifyContent:'center', fontSize:11 }} onClick={restoreSeats}>
                        {isAr ? `استعادة ${ad(selectedTable.removedSeats.length)} مقعد` : `Restore ${selectedTable.removedSeats.length} seat(s)`}
                      </button>
                    )}
                    {deleteSeatMode && (
                      <div style={{ fontSize:10.5, color:'var(--ink-mute)', textAlign:'center', lineHeight:1.4 }}>
                        {STR.deleteSeatsHint}
                      </div>
                    )}
                  </div>
                )}

                <button className="btn" style={{ width:'100%', justifyContent:'center', color:'#e08a7e', borderColor:'rgba(224,138,126,0.3)' }}
                  onClick={() => removeTable(selectedTable.id)}>
                  <Icon name="trash" size={13}/> {STR.deleteTable}
                </button>
              </div>
            ) : (
              <div style={{ padding:'24px 14px', textAlign:'center', color:'var(--ink-faint)', fontSize:12 }}>
                {STR.noSelection}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* New venue modal */}
      {showNewVenue && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:16 }}>
          <div className="card glass" style={{ width: newVenueType === 'stadium' ? 540 : 380, maxHeight:'90vh', display:'flex', flexDirection:'column' }}>

            {/* Header */}
            <div style={{ padding:'16px 22px', borderBottom:'1px solid var(--glass-border)', fontWeight:600, fontSize:15, flexShrink:0 }}>
              {STR.newVenue}
            </div>

            {/* Scrollable body */}
            <div style={{ padding:'18px 22px', overflowY:'auto', flex:1, display:'flex', flexDirection:'column', gap:16 }}>

              {/* Venue name */}
              <div>
                <label style={labelStyle}>{isAr ? 'اسم المكان' : 'Venue name'}</label>
                <input style={inputStyle} value={newVenueName}
                  onChange={e => setNewVenueName(e.target.value)}
                  placeholder={isAr ? 'مثال: قاعة الأميرة' : 'e.g. Grand Ballroom'}
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && newVenueType !== 'stadium' && createVenue()}/>
              </div>

              {/* Venue type */}
              <div>
                <label style={labelStyle}>{isAr ? 'نوع المكان' : 'Venue type'}</label>
                <select style={inputStyle} value={newVenueType}
                  onChange={e => {
                    const t = e.target.value;
                    setNewVenueType(t);
                    if (t === 'stadium' && newVenueCategories.length === 0) {
                      const catId = `cat${Date.now()}`;
                      setNewVenueCategories([{ id: catId, name: 'General', color: CATEGORY_COLORS[0] }]);
                      setNewVenueBlocks([{ id: `blk${Date.now()}`, label: 'Block A', rows: 10, seatsPerRow: 20, categoryId: catId }]);
                    }
                  }}>
                  <option value="general">{isAr ? 'عام' : 'General'}</option>
                  <option value="banquet">{isAr ? 'قاعة مأدبة' : 'Banquet Hall'}</option>
                  <option value="conference">{isAr ? 'قاعة مؤتمرات' : 'Conference Room'}</option>
                  <option value="theater">{isAr ? 'مسرح' : 'Theater'}</option>
                  <option value="arena">{isAr ? 'ساحة' : 'Arena'}</option>
                  <option value="stadium">{isAr ? 'ملعب' : 'Stadium'}</option>
                </select>
              </div>

              {/* Stadium-only: Categories + Blocks */}
              {newVenueType === 'stadium' && (
                <>
                  {/* Categories */}
                  <div style={{ borderTop:'1px solid var(--glass-border)', paddingTop:14 }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                      <label style={{ ...labelStyle, marginBottom:0 }}>{isAr ? 'الفئات' : 'Categories'}</label>
                      <button className="btn" style={{ fontSize:11, padding:'3px 10px' }} onClick={addCategory}>
                        <Icon name="plus" size={11}/> {isAr ? 'إضافة' : 'Add'}
                      </button>
                    </div>
                    <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                      {newVenueCategories.map(cat => (
                        <div key={cat.id} style={{ display:'flex', gap:6, alignItems:'center' }}>
                          <span style={{ width:12, height:12, borderRadius:'50%', background: cat.color || '#ccc', flexShrink:0 }}/>
                          <input style={{ ...inputStyle, flex:1 }} value={cat.name}
                            onChange={e => updateCategory(cat.id, e.target.value)}
                            placeholder={isAr ? 'اسم الفئة، مثال: VIP' : 'e.g. VIP, General Stand'}/>
                          <button className="btn" style={{ padding:'6px 10px', flexShrink:0, color:'var(--ink-faint)' }}
                            onClick={() => removeCategory(cat.id)}>×</button>
                        </div>
                      ))}
                      {newVenueCategories.length === 0 && (
                        <div style={{ fontSize:11, color:'var(--ink-faint)', padding:'4px 0' }}>
                          {isAr ? 'لا فئات — اضغط إضافة' : 'No categories yet — click Add'}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Blocks */}
                  <div style={{ borderTop:'1px solid var(--glass-border)', paddingTop:14 }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                      <label style={{ ...labelStyle, marginBottom:0 }}>{isAr ? 'الكتل' : 'Blocks'}</label>
                      <button className="btn" style={{ fontSize:11, padding:'3px 10px' }} onClick={addBlock}>
                        <Icon name="plus" size={11}/> {isAr ? 'إضافة' : 'Add'}
                      </button>
                    </div>
                    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                      {newVenueBlocks.map((blk, i) => (
                        <div key={blk.id} style={{ padding:'12px 14px', background:'var(--surface-soft-2)', borderRadius:10, border:'1px solid var(--glass-border)' }}>
                          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                            <span style={{ fontSize:12, fontWeight:600, color:'var(--accent)', fontFamily:'var(--mono)' }}>
                              {blk.label || `Block ${String.fromCharCode(65 + i)}`}
                            </span>
                            <button className="btn" style={{ padding:'2px 8px', fontSize:12, color:'var(--ink-faint)' }}
                              onClick={() => removeBlock(blk.id)}>×</button>
                          </div>
                          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:8 }}>
                            <div>
                              <label style={labelStyle}>{isAr ? 'الاسم' : 'Label'}</label>
                              <input style={inputStyle} value={blk.label}
                                onChange={e => updateBlock(blk.id, { label: e.target.value })}/>
                            </div>
                            <div>
                              <label style={labelStyle}>{isAr ? 'الفئة' : 'Category'}</label>
                              <select style={inputStyle} value={blk.categoryId}
                                onChange={e => updateBlock(blk.id, { categoryId: e.target.value })}>
                                <option value="">— {isAr ? 'بدون' : 'none'} —</option>
                                {newVenueCategories.filter(c => c.name.trim()).map(c => (
                                  <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label style={labelStyle}>{isAr ? 'الصفوف' : 'Rows'}</label>
                              <input type="number" min={1} max={50} style={inputStyle} value={blk.rows}
                                onChange={e => updateBlock(blk.id, { rows: Math.max(1, +e.target.value || 1) })}/>
                            </div>
                            <div>
                              <label style={labelStyle}>{isAr ? 'مقاعد / صف' : 'Seats / row'}</label>
                              <input type="number" min={1} max={100} style={inputStyle} value={blk.seatsPerRow}
                                onChange={e => updateBlock(blk.id, { seatsPerRow: Math.max(1, +e.target.value || 1) })}/>
                            </div>
                          </div>
                          <div style={{ fontSize:11, color:'var(--ink-mute)', fontFamily:'var(--mono)' }}>
                            {blk.rows * blk.seatsPerRow} {isAr ? 'مقعد' : 'seats'}
                            {blk.categoryId && newVenueCategories.find(c => c.id === blk.categoryId)?.name && (
                              <span style={{ marginLeft:8, color:'var(--accent)' }}>
                                · {newVenueCategories.find(c => c.id === blk.categoryId).name}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                      {newVenueBlocks.length === 0 && (
                        <div style={{ fontSize:11, color:'var(--ink-faint)', padding:'4px 0' }}>
                          {isAr ? 'لا كتل — اضغط إضافة' : 'No blocks yet — click Add'}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div style={{ padding:'14px 22px', borderTop:'1px solid var(--glass-border)', display:'flex', gap:8, justifyContent:'flex-end', flexShrink:0 }}>
              <button className="btn" onClick={() => { setShowNewVenue(false); resetNewVenueForm(); }}>{STR.cancel}</button>
              <button className="btn primary" onClick={createVenue} disabled={!newVenueName.trim()}>{STR.create}</button>
            </div>
          </div>
        </div>
      )}

      {/* Add block modal */}
      {showAddBlock && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:16 }}>
          <div className="card glass" style={{ width:400 }}>
            <div style={{ padding:'16px 22px', borderBottom:'1px solid var(--glass-border)', fontWeight:600, fontSize:15 }}>
              {isAr ? 'إضافة كتلة' : 'Add block'}
            </div>
            <div style={{ padding:'18px 22px', display:'flex', flexDirection:'column', gap:14 }}>
              <div>
                <label style={labelStyle}>{isAr ? 'الاسم' : 'Label'}</label>
                <input style={inputStyle} value={newBlockLabel}
                  onChange={e => setNewBlockLabel(e.target.value)}
                  placeholder={`Block ${String.fromCharCode(65 + venueBlocks.length)}`}
                  autoFocus onKeyDown={e => e.key === 'Enter' && doAddBlock()}/>
              </div>
              {(activeVenue?.categories || []).length > 0 && (
                <div>
                  <label style={labelStyle}>{isAr ? 'الفئة' : 'Category'}</label>
                  <select style={inputStyle} value={newBlockCategoryId}
                    onChange={e => setNewBlockCategoryId(e.target.value)}>
                    <option value="">— {isAr ? 'بدون' : 'none'} —</option>
                    {(activeVenue.categories || []).filter(c => c.name.trim()).map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div>
                  <label style={labelStyle}>{isAr ? 'الصفوف' : 'Rows'}</label>
                  <input type="number" min={1} max={50} style={inputStyle} value={newBlockRows}
                    onChange={e => setNewBlockRows(Math.max(1, +e.target.value || 1))}/>
                </div>
                <div>
                  <label style={labelStyle}>{isAr ? 'مقاعد / صف' : 'Seats / row'}</label>
                  <input type="number" min={1} max={100} style={inputStyle} value={newBlockSeatsPerRow}
                    onChange={e => setNewBlockSeatsPerRow(Math.max(1, +e.target.value || 1))}/>
                </div>
              </div>
              <div style={{ fontSize:11, color:'var(--ink-mute)', fontFamily:'var(--mono)' }}>
                {newBlockRows * newBlockSeatsPerRow} {isAr ? 'مقعد' : 'seats total'}
              </div>
            </div>
            <div style={{ padding:'14px 22px', borderTop:'1px solid var(--glass-border)', display:'flex', gap:8, justifyContent:'flex-end' }}>
              <button className="btn" onClick={() => { setShowAddBlock(false); setNewBlockLabel(''); setNewBlockRows(10); setNewBlockSeatsPerRow(20); setNewBlockCategoryId(''); }}>
                {STR.cancel}
              </button>
              <button className="btn primary" onClick={doAddBlock}>{isAr ? 'إضافة' : 'Add'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete block confirm */}
      {pendingDeleteBlockId && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}>
          <div className="card glass" style={{ width:340, padding:'22px 24px' }}>
            <div style={{ fontWeight:600, marginBottom:8 }}>{isAr ? 'حذف الكتلة' : 'Delete block'}</div>
            <div style={{ fontSize:12, color:'var(--ink-mute)', marginBottom:6 }}>
              <strong>{venueBlocks.find(b => b.id === pendingDeleteBlockId)?.label}</strong>
            </div>
            <div style={{ fontSize:12, color:'var(--ink-mute)', marginBottom:20 }}>
              {isAr ? 'سيتم حذف هذه الكتلة وتخطيطها بالكامل.' : 'This will permanently delete the block and its entire layout.'}
            </div>
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
              <button className="btn" onClick={() => setPendingDeleteBlockId(null)}>{STR.cancel}</button>
              <button className="btn primary" style={{ background:'rgba(224,138,126,0.2)', color:'#e08a7e', borderColor:'rgba(224,138,126,0.3)' }}
                onClick={confirmDeleteBlock}>{STR.confirm}</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete venue confirm */}
      {pendingDeleteVenueId && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}>
          <div className="card glass" style={{ width:340, padding:'22px 24px' }}>
            <div style={{ fontWeight:600, marginBottom:8 }}>{STR.deleteVenue}</div>
            <div style={{ fontSize:12, color:'var(--ink-mute)', marginBottom:6 }}>
              <strong>{venues.find(v => v.id === pendingDeleteVenueId)?.name}</strong>
            </div>
            <div style={{ fontSize:12, color:'var(--ink-mute)', marginBottom:20 }}>{STR.deleteVenueMsg}</div>
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
              <button className="btn" onClick={() => setPendingDeleteVenueId(null)}>{STR.cancel}</button>
              <button className="btn primary" style={{ background:'rgba(224,138,126,0.2)', color:'#e08a7e', borderColor:'rgba(224,138,126,0.3)' }}
                onClick={confirmDeleteVenue}>{STR.confirm}</button>
            </div>
          </div>
        </div>
      )}

      {/* Clear confirm */}
      {showClearConfirm && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}>
          <div className="card glass" style={{ width:340, padding:'22px 24px' }}>
            <div style={{ fontWeight:600, marginBottom:8 }}>{STR.clearMsg}</div>
            <div style={{ fontSize:12, color:'var(--ink-mute)', marginBottom:20 }}>
              {isAr ? `سيتم حذف ${ad(tables.length)} عنصر.` : `This will remove all ${tables.length} elements from this venue.`}
            </div>
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
              <button className="btn" onClick={() => setShowClearConfirm(false)}>{STR.cancel}</button>
              <button className="btn primary" style={{ background:'rgba(224,138,126,0.2)', color:'#e08a7e', borderColor:'rgba(224,138,126,0.3)' }}
                onClick={() => { setTables([]); setSelectedId(null); setSelectedSeat(null); setShowClearConfirm(false); }}>
                {STR.confirm}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
