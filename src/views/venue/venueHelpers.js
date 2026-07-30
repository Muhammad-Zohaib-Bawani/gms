// Pure helpers + constants shared across the venue-config components.
// No React here — this module is UI-framework-agnostic on purpose.

export const GUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isGuid = (v) => typeof v === 'string' && GUID_RE.test(v);

export const MIN_ZOOM = 0.3, MAX_ZOOM = 2.5;
// Default/minimum canvas size — the effective size (see computeCanvasSize)
// auto-grows past this to fit content, or can be pinned via an explicit
// manager-set VenueBox.Width/Height.
export const CANVAS_W = 1000, CANVAS_H = 600;
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

// Fixed category set (backend stores these as plain strings, no dedicated
// lookup exists for them) — shared by the venue-level category picker
// (AddVenueModal) and the per-block category picker (VenueConfigView).
export const VENUE_CATEGORY_OPTIONS = [
  { value: 'general', label: { en: 'General', ar: 'عام' } },
  { value: 'indoor',  label: { en: 'Indoor',  ar: 'داخلي' } },
  { value: 'outdoor', label: { en: 'Outdoor', ar: 'خارجي' } },
  { value: 'vip',     label: { en: 'VIP',     ar: 'كبار الشخصيات' } },
  { value: 'media',   label: { en: 'Media',   ar: 'إعلام' } },
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

// Tint used to mark a seat as assigned to a guest (Seating view only — this
// is a derived/display-only color, never persisted back into the layout).
export const ASSIGNED_SEAT_COLOR = '#8d0134';

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
// when a session is selected; otherwise the event's own default box (never
// fall back to a random session-scoped box — that showed the wrong canvas when
// switching a session dropdown back to "Event (default)"). If neither exists,
// fall back to the venue's own event-agnostic box (e.g. blocks added via the
// venue-creation quick-add form before any event was selected) so it's not
// silently invisible — the caller should NOT treat this fallback as "this
// event's own box" for save/clear purposes (see useVenueEditor's isOwnBox).
export function pickBox(boxes, eventId, sessionId) {
  if (!boxes || !boxes.length) return null;
  if (sessionId) return boxes.find(b => b.eventId === eventId && b.sessionId === sessionId) || null;
  const eventBox = boxes.find(b => b.eventId === eventId && !b.sessionId);
  if (eventBox) return eventBox;
  return boxes.find(b => !b.eventId && !b.sessionId) || null;
}

// Per-seat overrides (disabled flag + optional info text + manual color +
// display-name placeholder), keyed by flat index — shared by both elements
// and blocks below.
function buildSeatMeta(p) {
  const seatMeta = {};
  (p.seats || []).forEach(s => {
    if (s.index == null) return;
    if (s.isDisabled || s.seatInfo || s.color || s.placeholder)
      seatMeta[s.index] = { isDisabled: !!s.isDisabled, seatInfo: s.seatInfo || '', color: s.color || null, placeholder: s.placeholder || '' };
  });
  return seatMeta;
}

// Resolve a prop's persisted RemovedSeats (an array of seat *codes*, e.g.
// "C8" — codes are position-derived and stable regardless of what's been
// customized) back into the flat indices the editor keys everything else by.
// Must run against a table object that already has its full shape (type,
// rows/seatsPerRow or seats/seatsPerSide) since seatCodeForIndex needs it.
function resolveRemovedSeats(table, codes) {
  if (!codes || !codes.length) return [];
  const codeSet = new Set(codes);
  const out = [];
  for (let i = 0; i < totalSeatSlots(table); i++) {
    if (codeSet.has(seatCodeForIndex(table, i))) out.push(i);
  }
  return out;
}

// Real backend SeatProperties.Id per flat index — needed anywhere a seat has
// to be referenced outside the layout itself (e.g. guest-seat assignment).
// Populated from whatever the box actually persisted, whether the seats were
// auto-generated or explicitly customized — the backend always assigns a
// real row/id either way, it's only the *save* path that's conditional.
function buildSeatIds(p) {
  const seatIds = {};
  (p.seats || []).forEach(s => {
    if (s.index != null && s.id) seatIds[s.index] = s.id;
  });
  return seatIds;
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
    const seatIds = buildSeatIds(p);
    const base = { id: el.id, type: el.type, x: el.x ?? 0, y: el.y ?? 0, rotation: el.rotation ?? 0, label: p.label || '', color: p.color || null, seatMeta, seatIds };
    let tbl = base;
    if (el.type === 'round')   tbl = { ...base, seats: p.seatsQuantity ?? 8 };
    else if (el.type === 'rect')    tbl = { ...base, seatsPerSide: p.seatsQuantity ?? 4 };
    else if (el.type === 'stadium') tbl = { ...base, rows: p.row ?? 1, seatsPerRow: p.seatsQuantity ?? 1, rowNames: p.rowNames || [] };
    else if (el.type === 'stage')   tbl = { ...base, stageW: p.stageW || 220, stageH: p.stageH || 80 };
    // Pitch + any custom/future non-seat type (e.g. a manager-defined "Podium"
    // lookup item) share the same generic area sizing.
    else if (el.type === 'pitch' || !['round', 'rect', 'stadium', 'stage'].includes(el.type))
      tbl = { ...base, pitchW: p.pitchW || 280, pitchH: p.pitchH || 140 };
    return { ...tbl, removedSeats: resolveRemovedSeats(tbl, p.removedSeats) };
  });
  // Blocks carry x/y; fall back to stacking only when unset (0).
  const blocks = (box.blocks || []).map((b, i) => {
    const p = (b.props && b.props[0]) || {};
    const tbl = {
      id: b.id, type: 'stadium',
      x: b.x || (10 + (i % 4) * 320), y: b.y || (10 + Math.floor(i / 4) * 200),
      rotation: b.rotation ?? 0,
      label: b.label || '',
      color: p.color || null,
      rows: b.rows ?? (p.row ?? 1),
      seatsPerRow: b.seatsPerRow ?? (p.seatsQuantity ?? 1),
      rowNames: p.rowNames || [],
      seatMeta: buildSeatMeta(p),
      seatIds: buildSeatIds(p),
    };
    return { ...tbl, removedSeats: resolveRemovedSeats(tbl, p.removedSeats) };
  });
  return [...elements, ...blocks];
}

// Map a canvas element (table/stage/etc.) to a VenueLayoutDto for the API.
export function toLayoutDto(t) {
  return {
    // The layout's own real backend id (echoed back from a previous save via
    // boxToTables' `id: el.id`) — how the server matches this table to its
    // existing row and updates it in place instead of deleting and
    // recreating it. Omitted (null) for a table added this session that's
    // never been saved — the temp local id ("tu101"…) isn't a real one.
    id: isGuid(t.id) ? t.id : null,
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
      // Codes (not indices) — stable identifiers the backend stores on the
      // prop itself, so a removed seat's grid slot renders as blank space on
      // reload instead of just disappearing from the (index-based) Seats array.
      removedSeats: buildRemovedSeatCodes(t),
    }],
  };
}

function buildRemovedSeatCodes(t) {
  if (!tableHasSeats(t) || !(t.removedSeats || []).length) return [];
  return t.removedSeats.map(i => seatCodeForIndex(t, i));
}

// Only send an explicit seat list when the table actually has per-seat
// customization (disabled flag / info text / manual color / placeholder) or
// removed seats to exclude — otherwise keep sending an empty array so the
// backend auto-generates seats as before (least-surprise default).
function buildSeatDtos(t) {
  const meta = t.seatMeta || {};
  const removed = new Set(t.removedSeats || []);
  if (!tableHasSeats(t) || (Object.keys(meta).length === 0 && removed.size === 0)) return [];
  const seats = [];
  for (let i = 0; i < totalSeatSlots(t); i++) {
    if (removed.has(i)) continue;
    const m = meta[i] || {};
    seats.push({
      code: seatCodeForIndex(t, i),
      placeholder: m.placeholder || null,
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

// Resolve a flat seat `index` back to its ACTUAL code — derived purely from
// grid position, never from a manager-typed override. This is what's sent to
// the backend as SeatProperties.Code and what RemovedSeats codes are matched
// against, so it has to stay stable even after the seat gets a placeholder.
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
    return `${rowName}${col + 1}`;
  }
  return String(index + 1);
}

// The label to actually show a user — a manager-set placeholder always wins;
// otherwise falls back to the real position-derived code.
export function seatDisplayCode(table, index) {
  const placeholder = (table.seatMeta || {})[index]?.placeholder;
  return placeholder || seatCodeForIndex(table, index);
}
