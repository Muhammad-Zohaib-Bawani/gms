import { useState, useEffect, useRef, useCallback } from 'react';
import { createVenueBox, deleteVenueBox, deleteVenue, getVenues, getVenue, addVenueBlock as addVenueBlockApi, getElementTypes } from '../../api/services/venueService.js';
import { listSessions } from '../../api/services/eventService.js';
import toast from '../../lib/toast.js';
import {
  isGuid, MIN_ZOOM, MAX_ZOOM, pickBox, boxToTables, toLayoutDto, tableSeatCount, computeCanvasSize,
} from './venueHelpers.js';

// All venue-editor state, effects and handlers. VenueConfigView (and its
// children) are purely presentational and driven entirely by this hook.
export default function useVenueEditor({ lang, activeEventId }) {
  const isAr = lang === 'ar';

  // Venues + arrangements come from the API (no localStorage, no hardcoded seeds).
  const [venues, setVenues] = useState([]);
  const [activeVenueId, setActiveVenueId] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [activeBoxId, setActiveBoxId] = useState(null);
  const [clearingLayout, setClearingLayout] = useState(false);
  const [deletingVenue, setDeletingVenue] = useState(false);

  const [selectedId, setSelectedId] = useState(null);
  const [selectedSeat, setSelectedSeat] = useState(null); // { tableId, index } | null
  const [zoom, setZoom] = useState(1.0);
  const [saved, setSaved] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showAddVenue, setShowAddVenue] = useState(false);
  const [elementTypes, setElementTypes] = useState([]);
  const [savingLayout, setSavingLayout] = useState(false);
  const [pendingDeleteVenueId, setPendingDeleteVenueId] = useState(null);
  const [deleteSeatMode, setDeleteSeatMode] = useState(false);
  const [applyingDefault, setApplyingDefault] = useState(false);
  const [showAddBlock, setShowAddBlock] = useState(false);
  const [addingBlock, setAddingBlock] = useState(false);

  const dragTypeRef = useRef(null);
  const idCounter = useRef(100);

  // Element types come from the dedicated ElementType endpoint.
  useEffect(() => {
    getElementTypes()
      .then(r => setElementTypes(r || []))
      .catch(() => setElementTypes([]));
  }, []);

  // Load the venue list from the API.
  const loadVenues = useCallback(() => {
    getVenues()
      .then(list => {
        const mapped = (list || []).map(v => ({ id: v.id, name: v.venueName, venueType: 'general', tables: [], boxWidth: null, boxHeight: null, hasAnyLayout: false }));
        setVenues(mapped);
        setActiveVenueId(prev => prev || mapped[0]?.id || null);
      })
      .catch(() => setVenues([]));
  }, []);
  useEffect(() => { loadVenues(); }, [loadVenues]);

  // Sessions for the active event (drives the arrangement dropdown).
  useEffect(() => {
    if (!activeEventId) { setSessions([]); return; }
    listSessions(activeEventId).then(r => setSessions(r || [])).catch(() => setSessions([]));
  }, [activeEventId]);

  // Load the selected venue's saved arrangement (box) for the current event/session.
  useEffect(() => {
    if (!activeVenueId || !isGuid(activeVenueId)) { setActiveBoxId(null); return; }
    let cancelled = false;
    getVenue(activeVenueId).then(v => {
      if (cancelled || !v) return;
      const box = pickBox(v.venueBoxes, activeEventId, selectedSessionId || null);
      const tables = boxToTables(box);
      // Only treat it as "this event's own box" (safe for Save/Clear to
      // target) when it's genuinely scoped to the current event/session —
      // pickBox's fallback to the venue's shared event-agnostic box must not
      // be deleted/overwritten as if it were this event's own arrangement.
      const isOwnBox = box && box.eventId === activeEventId && (box.sessionId || null) === (selectedSessionId || null);
      setActiveBoxId(isOwnBox ? box.id : null);
      setVenues(prev => prev.map(x => x.id === activeVenueId
        ? { ...x, tables, boxWidth: box?.width || null, boxHeight: box?.height || null, hasAnyLayout: (v.venueBoxes || []).length > 0 }
        : x));
    }).catch(() => setActiveBoxId(null));
    return () => { cancelled = true; };
  }, [activeVenueId, selectedSessionId, activeEventId]);

  const activeVenue = venues.find(v => v.id === activeVenueId) || venues[0]
    || { id: null, name: '', venueType: 'general', tables: [] };
  const tables = activeVenue.tables || [];
  const selectedTable = tables.find(t => t.id === selectedId) || null;

  function zoomIn()    { setZoom(z => Math.min(MAX_ZOOM, +((z + 0.1).toFixed(1)))); }
  function zoomOut()   { setZoom(z => Math.max(MIN_ZOOM, +((z - 0.1).toFixed(1)))); }
  function zoomReset() { setZoom(1.0); }

  function setTables(updater) {
    setVenues(prev => prev.map(v => v.id !== activeVenueId ? v : {
      ...v, tables: typeof updater === 'function' ? updater(v.tables || []) : updater,
    }));
  }

  // Explicit canvas size override (null = auto-fit to content, see computeCanvasSize).
  function setBoxSize(width, height) {
    setVenues(prev => prev.map(v => v.id !== activeVenueId ? v : { ...v, boxWidth: width, boxHeight: height }));
  }

  const canvasSize = computeCanvasSize({ width: activeVenue.boxWidth, height: activeVenue.boxHeight }, tables);

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
    if (type === 'round')   extra = { seats: 8, label: `T-${String(n).padStart(2, '0')}`, removedSeats: [] };
    if (type === 'rect')    extra = { seatsPerSide: 4, label: `T-${String(n).padStart(2, '0')}`, removedSeats: [] };
    if (type === 'stadium') extra = { rows: 3, seatsPerRow: 8, label: `Blk-${String.fromCharCode(64 + (n % 26) + 1)}`, removedSeats: [], rowNames: [] };
    if (type === 'stage')   extra = { stageW: 220, stageH: 80, label: isAr ? 'مسرح' : 'Stage' };
    // Pitch + any custom/future non-seat type (e.g. a manager-defined "Podium"
    // lookup item) share the same generic area sizing.
    if (!['round', 'rect', 'stadium', 'stage'].includes(type))
      extra = { pitchW: 280, pitchH: 140, label: type === 'pitch' ? (isAr ? 'منطقة الملعب' : 'Pitch Area') : (isAr ? 'منطقة' : 'Area') };
    setTables(prev => [...prev, { id, type, x, y, rotation: 0, ...extra }]);
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

  function onSeatClick(tableId, index) {
    setSelectedSeat({ tableId, index });
  }

  function onElementMouseDown(e, tableId) {
    if (e.button !== 0) return;
    e.preventDefault(); e.stopPropagation();
    setSelectedId(tableId);
    setSelectedSeat(null);
    const sx = e.clientX, sy = e.clientY;
    const tbl = tables.find(t => t.id === tableId);
    const ox = tbl.x, oy = tbl.y;
    const z = zoom;
    const onMove = me => {
      setTables(prev => prev.map(t => t.id === tableId
        ? { ...t, x: Math.max(0, ox + (me.clientX - sx) / z), y: Math.max(0, oy + (me.clientY - sy) / z) }
        : t));
    };
    const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  function onCanvasClick() {
    setSelectedId(null);
    setSelectedSeat(null);
  }

  async function saveLayout() {
    if (!activeEventId) {
      toast.error(isAr ? 'يرجى اختيار فعالية أولاً' : 'Select an event first');
      return;
    }
    if (!isGuid(activeVenue?.id)) {
      toast.error(isAr ? 'هذا المكان غير محفوظ على الخادم' : 'This venue is not saved to the server yet');
      return;
    }

    setSavingLayout(true);
    try {
      const result = await createVenueBox({
        eventId: activeEventId,
        sessionId: selectedSessionId || null,
        venueId: activeVenue.id,
        width: activeVenue.boxWidth || null,
        height: activeVenue.boxHeight || null,
        venueBlocks: [],
        venueLayouts: tables.map(toLayoutDto),
      });
      const newBox = pickBox(result?.venueBoxes, activeEventId, selectedSessionId || null);
      if (newBox?.id) setActiveBoxId(newBox.id);
      // Refresh local tables from what was actually persisted — most importantly,
      // a brand-new table's temp local id gets replaced with its real backend id,
      // so the *next* save (even without a page reload) can match it by that real
      // id instead of treating it as a new insert every time.
      if (newBox) setTables(boxToTables(newBox));
      setSaved(true); setTimeout(() => setSaved(false), 2200);
      toast.success(isAr ? 'تم حفظ المخطط' : 'Layout saved');
    } catch (err) {
      const msg = err?.response?.data?.message;
      toast.error(msg || (isAr ? 'تعذّر حفظ المخطط' : 'Could not save layout'));
    } finally {
      setSavingLayout(false);
    }
  }

  async function clearLayout() {
    if (!activeBoxId) {
      setTables([]); setSelectedId(null); setSelectedSeat(null); setShowClearConfirm(false);
      return;
    }
    setClearingLayout(true);
    try {
      await deleteVenueBox(activeBoxId, {
        venueId: activeVenue.id,
        eventId: selectedSessionId ? null : activeEventId,
        sessionId: selectedSessionId || null,
      });
      setTables([]); setSelectedId(null); setSelectedSeat(null);
      setActiveBoxId(null);
      toast.success(isAr ? 'تم حذف المخطط' : 'Layout cleared');
    } catch (err) {
      const msg = err?.response?.data?.message;
      toast.error(err.message || msg || (isAr ? 'تعذّر حذف المخطط' : 'Could not clear layout'));
    } finally {
      setClearingLayout(false);
      setShowClearConfirm(false);
    }
  }

  // Loads whichever box was created first for this venue (across all its
  // events/sessions) into the local canvas — same as any other edit, it's
  // only persisted once the user hits "Save layout".
  async function applyDefaultLayout() {
    if (!isGuid(activeVenue?.id)) return;
    setApplyingDefault(true);
    try {
      const v = await getVenue(activeVenue.id);
      const boxes = v?.venueBoxes || [];
      if (!boxes.length) {
        toast.error(isAr ? 'لا يوجد مخطط لهذا المكان' : 'No layout exists for this venue');
        return;
      }
      const first = boxes.reduce((a, b) => new Date(a.createdAt) <= new Date(b.createdAt) ? a : b);
      setTables(boxToTables(first));
      setSelectedId(null);
      setSelectedSeat(null);
      toast.success(isAr ? 'تم تطبيق المخطط الافتراضي — اضغط حفظ لتثبيته' : 'Default layout applied — click Save to keep it');
    } catch (err) {
      const msg = err?.response?.data?.message;
      toast.error(msg || (isAr ? 'تعذّر تطبيق المخطط الافتراضي' : 'Could not apply default layout'));
    } finally {
      setApplyingDefault(false);
    }
  }

  // Adds one more block directly via the API — persisted immediately (unlike
  // addTable, which only stages an element locally until "Save layout"). Only
  // valid once this event/session already has its own saved box — the backend
  // endpoint doesn't create one on the fly, it only adds to an existing box.
  async function addVenueBlock({ label, category, rows, seatsPerRow }) {
    if (!activeEventId) {
      toast.error(isAr ? 'يرجى اختيار فعالية أولاً' : 'Select an event first');
      return false;
    }
    if (!isGuid(activeVenue?.id)) {
      toast.error(isAr ? 'هذا المكان غير محفوظ على الخادم' : 'This venue is not saved to the server yet');
      return false;
    }
    if (!activeBoxId) {
      toast.error(isAr ? 'يرجى حفظ التخطيط أولاً لإنشاء صندوق لهذه الفعالية' : 'Save the layout first to create a box for this event');
      return false;
    }
    setAddingBlock(true);
    try {
      // Walk the same stacking sequence blocks fall back to (see boxToTables)
      // and take the first slot no existing block already occupies — the
      // backend rejects an exact (X, Y) clash, so this avoids handing back a
      // position that's already taken (e.g. after a block was moved/removed).
      const taken = new Set(tables.filter(t => t.type === 'stadium').map(t => `${t.x}:${t.y}`));
      let i = 0, x, y;
      do {
        x = 10 + (i % 4) * 320;
        y = 10 + Math.floor(i / 4) * 200;
        i++;
      } while (taken.has(`${x}:${y}`));

      const result = await addVenueBlockApi(activeEventId, selectedSessionId || null, activeVenue.id, {
        label,
        category: category || null,
        x, y,
        rotation: 0,
        rows,
        seatsPerRow,
      });
      const box = pickBox(result?.venueBoxes, activeEventId, selectedSessionId || null);
      if (box) {
        setTables(boxToTables(box));
        setVenues(prev => prev.map(v => v.id === activeVenueId ? { ...v, hasAnyLayout: true } : v));
      }
      toast.success(isAr ? 'تمت إضافة القسم' : 'Block added');
      setShowAddBlock(false);
      return true;
    } catch (err) {
      const msg = err?.response?.data?.message;
      toast.error(msg || (isAr ? 'تعذّر إضافة القسم' : 'Could not add block'));
      return false;
    } finally {
      setAddingBlock(false);
    }
  }

  function switchVenue(venueId) {
    setActiveVenueId(venueId);
    setSelectedId(null);
    setSelectedSeat(null);
    setDeleteSeatMode(false);
  }

  // A venue was created via the API modal — select it and refresh the list from the API.
  function handleVenueCreated(venue) {
    if (!venue?.id) return;
    setActiveVenueId(venue.id);
    setSelectedSessionId('');
    loadVenues();
  }

  async function confirmDeleteVenue() {
    const vid = pendingDeleteVenueId;
    if (!vid) { setPendingDeleteVenueId(null); return; }

    if (!isGuid(vid)) {
      const updated = venues.filter(v => v.id !== vid);
      setVenues(updated);
      if (activeVenueId === vid) setActiveVenueId(updated[0]?.id || null);
      setPendingDeleteVenueId(null);
      return;
    }

    setDeletingVenue(true);
    try {
      await deleteVenue(vid);
      const updated = venues.filter(v => v.id !== vid);
      setVenues(updated);
      if (activeVenueId === vid) setActiveVenueId(updated[0]?.id || null);
      toast.success(isAr ? 'تم حذف المكان' : 'Venue deleted');
      setPendingDeleteVenueId(null);
    } catch (err) {
      const msg = err?.response?.data?.message;
      toast.error(err.message || msg || (isAr ? 'تعذّر حذف المكان' : 'Could not delete venue'));
    } finally {
      setDeletingVenue(false);
    }
  }

  const totalSeats = tables.reduce((acc, t) => acc + tableSeatCount(t), 0);

  return {
    isAr,
    venues, activeVenue, activeVenueId, tables, selectedTable, selectedId, selectedSeat,
    sessions, selectedSessionId, setSelectedSessionId,
    canvasSize, boxWidth: activeVenue.boxWidth, boxHeight: activeVenue.boxHeight, setBoxSize,
    hasAnyLayout: activeVenue.hasAnyLayout, applyingDefault, applyDefaultLayout,
    showAddBlock, setShowAddBlock, addingBlock, addVenueBlock,
    zoom, setZoom, zoomIn, zoomOut, zoomReset,
    saved, savingLayout, clearingLayout, deletingVenue,
    showClearConfirm, setShowClearConfirm,
    showAddVenue, setShowAddVenue,
    elementTypes,
    pendingDeleteVenueId, setPendingDeleteVenueId,
    deleteSeatMode, setDeleteSeatMode,
    dragTypeRef,
    totalSeats,
    setSelectedId, setSelectedSeat,
    updateTable, removeTable, addTable, handleDeleteSeat, restoreSeats,
    onSeatClick, onElementMouseDown, onCanvasClick,
    saveLayout, clearLayout, switchVenue, handleVenueCreated, confirmDeleteVenue,
  };
}
