// Pure helpers + constants shared across the venue-config components.
// No React here — this module is UI-framework-agnostic on purpose.

export const GUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isGuid = (v) => typeof v === 'string' && GUID_RE.test(v);

export const MIN_ZOOM = 0.3, MAX_ZOOM = 2.5;
// Default/minimum canvas size — the effective size (see computeCanvasSize)
// auto-grows past this to fit content, or can be pinned via an explicit
// manager-set VenueBox.Width/Height.
export const CANVAS_W = 1400, CANVAS_H = 900;
export const TABLE_R = 30, SEAT_R = 8, SEAT_DIST = TABLE_R + SEAT_R + 7;
export const ROUND_SIZE = (SEAT_DIST + SEAT_R + 5) * 2;
export const ROW_LABEL_W = 20;

export const SWATCH_COLORS = [
  '#e05252', '#ef4444', '#f97316', '#ea7c1e',
  '#f5a623', '#eab308', '#f0c040', '#84cc16',
  '#16a34a', '#22c55e', '#14b8a6', '#0891b2',
  '#06b6d4', '#3b82f6', '#2563eb', '#6366f1',
  '#7c3aed', '#a855f7', '#d946ef', '#db2777',
  '#ec4899', '#64748b', '#94a3b8', '#475569',
];

// Presentation only (icon/accent color per element type). The list of element
// types itself comes from the ELEMENT_TYPE lookup; this maps a type code to its
// visual affordances, with a neutral fallback for any unknown code.
export const ELEMENT_META = {
  round:   { icon: 'seating',   color: 'var(--accent)' },
  rect:    { icon: 'meetings',  color: 'var(--accent)' },
  stadium: { icon: 'dashboard', color: 'var(--accent)' },
  stage:   { icon: 'star',      color: '#e0b864' },
  pitch:   { icon: 'globe',     color: '#5abf6e' },
};

// Fallback tint for a disabled seat that has no manager-set color of its own.
export const DISABLED_SEAT_COLOR = '#e05555';

// A seat's effective color: a manually-set override always wins; otherwise a
// muted "disabled" tone kicks in once marked unavailable; otherwise null (use
// the shape's own default styling).
export function seatColor(meta) {
  if (!meta) return null;
  return meta.color || (meta.isDisabled ? DISABLED_SEAT_COLOR : null);
}

export function hexToRgba(hex, alpha) {
  if (!hex || !hex.startsWith('#')) return null;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function rectTableSize(sps) { return { w: sps * 24 + 20, h: 80 }; }
export function stadiumSize(rows, spr) { return { w: ROW_LABEL_W + spr * 22 + 16, h: rows * 22 + 30 }; }

// Approximate rendered footprint of an element (from its x,y origin) — used
// only to auto-size the canvas, not for actual rendering.
function elementFootprint(t) {
  if (t.type === 'round')   return { w: ROUND_SIZE, h: ROUND_SIZE };
  if (t.type === 'rect')    return rectTableSize(t.seatsPerSide || 0);
  if (t.type === 'stadium') return stadiumSize(t.rows || 0, t.seatsPerRow || 0);
  if (t.type === 'stage')   return { w: (t.stageW || 220) + 20, h: (t.stageH || 80) + 34 };
  // Pitch + any custom/future non-seat type (e.g. a manager-defined "Podium").
  return { w: (t.pitchW || 280) + 20, h: (t.pitchH || 140) + 30 };
}

const CANVAS_AUTO_MARGIN = 80;

// Resolve the effective canvas size for a box: an explicit manager-set size
// (VenueBox.Width/Height) always wins; otherwise auto-fit to the placed
// elements' bounding box plus a margin, never shrinking below the default
// minimum (CANVAS_W x CANVAS_H) so a sparse layout doesn't collapse.
export function computeCanvasSize(box, tables) {
  if (box?.width && box?.height) return { w: box.width, h: box.height };
  let maxRight = 0, maxBottom = 0;
  (tables || []).forEach(t => {
    const { w, h } = elementFootprint(t);
    maxRight = Math.max(maxRight, (t.x || 0) + w);
    maxBottom = Math.max(maxBottom, (t.y || 0) + h);
  });
  return {
    w: Math.max(CANVAS_W, Math.ceil(maxRight + CANVAS_AUTO_MARGIN)),
    h: Math.max(CANVAS_H, Math.ceil(maxBottom + CANVAS_AUTO_MARGIN)),
  };
}

// Pick the arrangement box for the current event/session: session-specific box
// when a session is selected; otherwise ONLY the event's own default box (never
// fall back to a random session-scoped box — that showed the wrong canvas when
// switching a session dropdown back to "Event (default)").
export function pickBox(boxes, eventId, sessionId) {
  if (!boxes || !boxes.length) return null;
  if (sessionId) return boxes.find(b => b.eventId === eventId && b.sessionId === sessionId) || null;
  return boxes.find(b => b.eventId === eventId && !b.sessionId) || null;
}

// Per-seat overrides (disabled flag + optional info text + manual color),
// keyed by flat index — shared by both elements and blocks below.
function buildSeatMeta(p) {
  const seatMeta = {};
  (p.seats || []).forEach(s => {
    if (s.index == null) return;
    if (s.isDisabled || s.seatInfo || s.color) seatMeta[s.index] = { isDisabled: !!s.isDisabled, seatInfo: s.seatInfo || '', color: s.color || null };
  });
  return seatMeta;
}

// Map an API box's elements + blocks into the editor's flat `tables` model.
// These are two distinct arrays on the box (individually-placed elements vs.
// stadium "blocks" created via the venue-creation quick-add form) — NOT a
// fallback of one for the other, since a box can carry both at once.
export function boxToTables(box) {
  if (!box) return [];
  const elements = (box.venueElements || []).map(el => {
    const p = (el.props && el.props[0]) || {};
    const seatMeta = buildSeatMeta(p);
    const base = { id: el.id, type: el.type, x: el.x ?? 0, y: el.y ?? 0, rotation: el.rotation ?? 0, label: p.label || '', color: p.color || null, removedSeats: [], seatMeta };
    if (el.type === 'round')   return { ...base, seats: p.seatsQuantity ?? 8 };
    if (el.type === 'rect')    return { ...base, seatsPerSide: p.seatsQuantity ?? 4 };
    if (el.type === 'stadium') return { ...base, rows: p.row ?? 1, seatsPerRow: p.seatsQuantity ?? 1, rowNames: p.rowNames || [], seatNumbers: {} };
    if (el.type === 'stage')   return { ...base, stageW: p.stageW || 220, stageH: p.stageH || 80 };
    // Pitch + any custom/future non-seat type (e.g. a manager-defined "Podium"
    // lookup item) share the same generic area sizing.
    if (el.type === 'pitch' || !['round', 'rect', 'stadium', 'stage'].includes(el.type))
      return { ...base, pitchW: p.pitchW || 280, pitchH: p.pitchH || 140 };
    return base;
  });
  // Blocks carry x/y; fall back to stacking only when unset (0).
  const blocks = (box.blocks || []).map((b, i) => {
    const p = (b.props && b.props[0]) || {};
    return {
      id: b.id, type: 'stadium',
      x: b.x || (10 + (i % 4) * 320), y: b.y || (10 + Math.floor(i / 4) * 200),
      rotation: b.rotation ?? 0,
      label: b.label || '',
      color: p.color || null,
      rows: b.rows ?? (p.row ?? 1),
      seatsPerRow: b.seatsPerRow ?? (p.seatsQuantity ?? 1),
      rowNames: p.rowNames || [], seatNumbers: {}, removedSeats: [],
      seatMeta: buildSeatMeta(p),
    };
  });
  return [...elements, ...blocks];
}

// Map a canvas element (table/stage/etc.) to a VenueLayoutDto for the API.
export function toLayoutDto(t) {
  return {
    type: t.type,
    x: t.x ?? 0,
    y: t.y ?? 0,
    rotation: t.rotation ?? 0,
    scaleX: 1,
    scaleY: 1,
    offsetX: 0,
    offsetY: 0,
    props: [{
      code: String(t.id ?? ''),
      label: t.label ?? '',
      // Rect tables always have exactly 2 rows (top + bottom side); other types
      // send their own row count (stadium) or none (round has no row concept).
      row: t.type === 'rect' ? 2 : (t.rows ?? null),
      seatsQuantity: t.seats ?? t.seatsPerSide ?? t.seatsPerRow ?? null,
      rowNames: t.rowNames ?? [],
      pitchW: t.pitchW ?? 0,
      pitchH: t.pitchH ?? 0,
      stageW: t.stageW ?? 0,
      stageH: t.stageH ?? 0,
      color: t.color ?? null,
      seats: buildSeatDtos(t),
    }],
  };
}

// Only send an explicit seat list when the table actually has per-seat
// customization (disabled flag / info text / manual color) — otherwise keep
// sending an empty array so the backend auto-generates seats as before
// (least-surprise default).
function buildSeatDtos(t) {
  const meta = t.seatMeta || {};
  if (!tableHasSeats(t) || Object.keys(meta).length === 0) return [];
  const removed = new Set(t.removedSeats || []);
  const seats = [];
  for (let i = 0; i < totalSeatSlots(t); i++) {
    if (removed.has(i)) continue;
    const m = meta[i] || {};
    seats.push({
      code: seatCodeForIndex(t, i),
      index: i,
      color: m.color || null,
      status: null,
      isDisabled: !!m.isDisabled,
      seatInfo: m.seatInfo || null,
    });
  }
  return seats;
}

export function getVenueTotalSeats(venue) {
  if (!venue) return 0;
  return (venue.tables || []).reduce((acc, t) => acc + tableSeatCount(t), 0);
}

export function tableSeatCount(t) {
  const r = (t.removedSeats || []).length;
  return Math.max(0, totalSeatSlots(t) - r);
}

// Total seat slots for a table BEFORE excluding removed seats (i.e. the full
// 0..N-1 index range the backend/seatCodeForIndex expect).
export function totalSeatSlots(t) {
  if (t.type === 'round')   return t.seats || 0;
  if (t.type === 'rect')    return (t.seatsPerSide || 0) * 2;
  if (t.type === 'stadium') return (t.rows || 0) * (t.seatsPerRow || 0);
  return 0;
}

// A table "has seats" (i.e. individually clickable/selectable seats) when it's
// one of the seat-bearing types — stage/pitch are areas with no individual seats.
export function tableHasSeats(t) {
  return t && ['round', 'rect', 'stadium'].includes(t.type);
}

// Resolve a flat seat `index` back to its display code, for any seat-bearing type.
export function seatCodeForIndex(table, index) {
  if (table.type === 'round') return String(index + 1);
  if (table.type === 'rect') {
    const sps = table.seatsPerSide || 0;
    return index < sps ? `A${index + 1}` : `B${index - sps + 1}`;
  }
  if (table.type === 'stadium') {
    const spr = table.seatsPerRow || 1;
    const row = Math.floor(index / spr), col = index % spr;
    const rns = table.rowNames || [];
    const rowName = rns[row] !== undefined ? rns[row] : String.fromCharCode(65 + row);
    const seatNums = table.seatNumbers || {};
    const skey = `${row}-${col}`;
    const seatNum = seatNums[skey] !== undefined ? seatNums[skey] : String(col + 1);
    return `${rowName}${seatNum}`;
  }
  return String(index + 1);
}
