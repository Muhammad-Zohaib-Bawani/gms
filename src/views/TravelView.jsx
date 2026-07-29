import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { fmtNum, toArDigits } from '../i18n/translations.js';
import { Avatar } from '../components/UI.jsx';
import { Icon } from '../components/Icons.jsx';
import toast from '../lib/toast.js';
import { getGuestPicker } from '../api/services/guestService.js';
import { getEvent } from '../api/services/eventService.js';
import { getEventFlights, getEventAccommodation, getEventTransport, getEventArrivalsDepartures, getGuestTravel, saveGuestTravel, getTravelLookups, deleteFlight, deleteAccommodation, deleteTransport } from '../api/services/travelService.js';
import Select from '../components/ui/Select.jsx';
import DataTable from '../components/ui/DataTable.jsx';
import ActionMenu from '../components/ui/ActionMenu.jsx';
import DateField from '../components/ui/DateField.jsx';
import { addDaysIso } from '../lib/date.js';
import TravelAccordion, {
  driverLabel,
  vehicleLabel,
  EMPTY_TRAVEL,
  hydrateTravel,
  anyTravelEnabled,
  buildTravelPayload,
  validateTravel,
} from './guests/modals/TravelAccordion.jsx';

// One week of slack around the event's own start/end date — same rule as the
// guest wizard's Arrival/Departure fields (GuestModal.jsx).
const DATE_MARGIN_DAYS = 7;

// Edit-modal "type" (flight/hotel/transfer, matches the tab) → the travel
// state's section key (flight/accommodation/transport, matches the backend).
const TYPE_TO_SECTION = { flight: 'flight', hotel: 'accommodation', transfer: 'transport' };

function initialsFromName(name) {
  const parts = (name || '').trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || '?';
}

function guestFullName(g) {
  return g.fullName || `${g.firstName || ''} ${g.lastName || ''}`.trim() || '—';
}

// Guest picker page size — one screenful plus a bit, so the first page paints fast.
const GUEST_PAGE_SIZE = 20;

// "09:15 → 14:30 · 5h 15m" under a route. Each part is dropped independently
// when the data can't support it, so a leg missing its arrival still shows the
// departure rather than a dash.
function timeRange(start, end) {
  const hhmm = (v) => (v ? String(v).slice(11, 16) : null);
  const a = hhmm(start);
  const b = hhmm(end);
  const span = flightDuration(start, end);
  const clock = a && b ? `${a} → ${b}` : (a || b);
  if (clock && span) return `${clock} · ${span}`;
  return clock || span || '—';
}

// Elapsed time between the two ends of an itinerary, as "5h 15m" / "45m".
// Returns null when either end is missing or the pair is nonsensical.
function flightDuration(start, end) {
  if (!start || !end) return null;
  const ms = new Date(end) - new Date(start);
  if (!Number.isFinite(ms) || ms <= 0) return null;
  const mins = Math.round(ms / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h ? `${h}h${m ? ` ${m}m` : ''}` : `${m}m`;
}

function dateLabelFor(dateStr) {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch { return ''; }
}

// ─── API row → table row mappers (data comes from the travel tables) ─────────
// `bookingId` is that specific Flight/Accommodation/Transport's own id — a
// guest can have more than one, so it's never the same as guestId.
function mapFlight(r) {
  return {
    bookingId: r.id,
    guestId: r.guestId,
    name: r.guestName || '—',
    initials: initialsFromName(r.guestName),
    tier: r.tier,
    org: r.organization,
    flight: r.flightNumber || '—',
    flightType: r.flightType || '—',
    flightClass: r.flightClass || '—',
    from: r.departureCode || '—',
    to: r.arrivalCode || '—',
    date: r.date ? r.date.slice(0, 10) : '',
    dateLabel: r.date ? dateLabelFor(r.date) : '—',
    flightStatus: (r.status || '').toLowerCase(),
  };
}

function mapHotel(r) {
  return {
    bookingId: r.id,
    guestId: r.guestId,
    name: r.guestName || '—',
    initials: initialsFromName(r.guestName),
    tier: r.tier,
    org: r.organization,
    hotel: r.hotel || '—',
    roomType: r.roomType || '—',
    checkIn: r.checkIn || '',
    checkOut: r.checkOut || '',
  };
}

function mapTransfer(r) {
  return {
    bookingId: r.id,
    guestId: r.guestId,
    name: r.guestName || '—',
    initials: initialsFromName(r.guestName),
    tier: r.tier,
    vehicle: r.vehicle || '—',
    driver: r.driverName || '—',
    pickup: r.pickup || '—',
    dropoff: r.dropoff || '—',
    date: r.pickupTime ? r.pickupTime.slice(0, 10) : '',
    dateLabel: r.pickupTime ? dateLabelFor(r.pickupTime) : '—',
    time: r.pickupTime ? r.pickupTime.slice(11, 16) : '—',
    transferStatus: (r.tripStatus || '').toLowerCase(),
  };
}

// A guest can have more than one booking of the same kind — group the flat
// per-booking rows into one entry per guest so the table shows one row per
// guest, with every booking stacked inside that guest's (widened) details
// column instead of a duplicate row.
function groupByGuest(rows) {
  const map = new Map();
  for (const r of rows) {
    if (!map.has(r.guestId)) {
      map.set(r.guestId, { guestId: r.guestId, name: r.name, initials: r.initials, tier: r.tier, org: r.org, bookings: [] });
    }
    map.get(r.guestId).bookings.push(r);
  }
  return Array.from(map.values());
}

const STATUS_COLOR = {
  approved:'var(--accent)', confirmed:'var(--accent)', scheduled:'var(--accent)',
  submitted:'#e0c47e', pending:'#e0c47e',
  rejected:'#e08a7e', completed:'var(--ink-mute)',
};

// ─── Shared sub-components ────────────────────────────────────────────────────

function StatusChip({ status, label }) {
  if (!status) return <span style={{ color:'var(--ink-faint)' }}>—</span>;
  const color = STATUS_COLOR[status] || 'var(--ink-mute)';
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'3px 9px', borderRadius:20, fontSize:11, fontWeight:600, background:`${color}18`, color, border:`1px solid ${color}40` }}>
      <span style={{ width:5, height:5, borderRadius:'50%', background:color, flexShrink:0 }}/>
      {label || status}
    </span>
  );
}

// Search + one dropdown + a result count, laid out exactly like the Guests
// filter bar so the two modules read the same.
function FilterBar({ search, onSearch, searchPlaceholder, filter, onFilter, filterOptions, filterPlaceholder, shown, total, countLabel, extra }) {
  return (
    <div className="filter-bar">
      <div className="search" style={{ flex:1, maxWidth:320 }}>
        <Icon name="search" size={14}/>
        <input value={search} onChange={e => onSearch(e.target.value)} placeholder={searchPlaceholder}/>
      </div>
      <div style={{ minWidth:170 }}>
        <Select value={filter} onChange={onFilter} options={filterOptions} placeholder={filterPlaceholder}/>
      </div>
      {/* Slot for tab-specific controls (e.g. the arrivals date range). */}
      {extra}
      <span style={{ fontSize:12, color:'var(--ink-mute)', whiteSpace:'nowrap' }}>
        {shown} {countLabel} {total}
      </span>
    </div>
  );
}

// Guest identity cell — shared by all three tabs; the transfers tab omits the
// organisation line to keep its wider row readable.
function GuestCell({ g, withOrg = true }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
      <Avatar initials={g.initials} size={28} tier={g.tier}/>
      {withOrg ? (
        <div>
          <div style={{ fontSize:12.5, fontWeight:500 }}>{g.name}</div>
          <div style={{ fontSize:11, color:'var(--ink-mute)' }}>{g.org}</div>
        </div>
      ) : (
        <span style={{ fontSize:12.5, fontWeight:500 }}>{g.name}</span>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function TravelView({ lang, activeEventId }) {
  const isAr = lang === 'ar';
  const fmtN = n => fmtNum(n, lang);
  const ad = s => isAr ? toArDigits(String(s)) : String(s);

  const STR = isAr ? {
    title:['الخدمات',''],
    sub:'الرحلات والتأشيرات والفنادق والنقل البري',
    tabs:['الرحلات والتأشيرات','الفنادق','النقل البري','الوصول والمغادرة'],
    newBooking:'حجز جديد',
    kpi:{ flights:'رحلات مؤكدة',flightsH:'',
      rooms:'غرف محجوزة',roomsH:'',
      transfers:'نقل بري',transfersH:'أسطول VIP · ٢٤ مركبة',
      visas:'تأشيرات موافق عليها',visasH:'٨٨٫٦٪ موافقة · مزامنة الداخلية' },
    hayya:{ title:'طلبات تأشيرة هيّا',sub:'مزامنة مباشرة · آخر تحديث قبل دقيقتين',
      connected:'متصل · وزارة الداخلية',syncNow:'مزامنة',synced:'تمت ✓' },
    inbound:{ title:'وصول اليوم · مطار حمد',chip:'مباشر' },
    itinerary:'جدول الرحلة', viewPermit:'عرض التصريح →',
    cols:{ guest:'الضيف',flight:'الرحلة',flightType:'نوع الرحلة',flightClass:'الدرجة',route:'المسار',date:'التاريخ',
      status:'الحالة',hotel:'الفندق',room:'الغرفة',
      checkIn:'الوصول',checkOut:'المغادرة',nights:'الليالي',
      vehicle:'المركبة',driver:'السائق',pickup:'الاستلام',dropoff:'التوصيل',time:'الوقت',
      inboundRoute:'مسار الوصول',outboundRoute:'مسار المغادرة',organization:'المؤسسة' },
    direction:{ all:'كل الرحلات',inbound:'الوصول',outbound:'المغادرة' },
    dateFrom:'من تاريخ', dateTo:'إلى تاريخ', clearDates:'مسح التواريخ',
    statuses:{ approved:'موافق',submitted:'قيد المراجعة',pending:'قيد الانتظار',rejected:'مرفوض',
      confirmed:'مؤكد',scheduled:'مجدول',completed:'مكتمل',
      assigned:'مُسند',arrived:'وصل السائق','in-progress':'قيد التنفيذ' },
    noResults:'لا توجد نتائج',filterAll:'الكل',searchPh:'بحث…',
    edit:'تعديل',save:'حفظ',cancel:'إلغاء',editFlight:'تعديل بيانات الرحلة',
    editHotel:'تعديل بيانات الفندق',editTransfer:'تعديل بيانات النقل',
    cancel2:'إلغاء',newBookingTitle:'حجز جديد',
    selectGuest:'اختر الضيف',bookingDetails:'تفاصيل الحجز',
    guestSearch:'بحث عن ضيف…',back:'السابق',next:'التالي',
  } : {
    title:['Services',''],
    sub:'Flights, visa applications, hotels and ground transfers',
    tabs:[
      // 'Overview',
      'Flights','Hotel','Ground Transfers','Arrivals & Departures'],
    newBooking:'New booking',
    kpi:{ flights:'Flights confirmed',flightsH:'',
      rooms:'Hotel rooms blocked',roomsH:'',
      transfers:'Ground transfers',transfersH:'',
      visas:'Visas approved',visasH:'88.6% approved · MOI Qatar live sync' },
    hayya:{ title:'Hayya visa applications',sub:'Permit-to-Enter synced via Hayya gateway · Last refresh 2m ago',
      connected:'Connected · MOI Qatar',syncNow:'Sync now',synced:'Synced ✓' },
    inbound:{ title:'Arrivals today · Hamad International',chip:'Live · MOI sync' },
    itinerary:'Itinerary', viewPermit:'View permit →',
    cols:{ guest:'Guest',flight:'Flight',flightType:'Flight Type',flightClass:'Class',route:'Route',date:'Date',
      status:'Status',hotel:'Hotel',room:'Room',
      checkIn:'Check-in',checkOut:'Check-out',nights:'Nights',
      vehicle:'Vehicle',driver:'Driver',pickup:'Pickup',dropoff:'Drop-off',time:'Time',
      inboundRoute:'Arrivals',outboundRoute:'Outbound Route',organization:'Organization' },
    direction:{ all:'All flights',inbound:'Arrivals',outbound:'Departures' },
    dateFrom:'From date', dateTo:'To date', clearDates:'Clear dates',
    statuses:{ approved:'Approved',submitted:'In review',pending:'Pending',rejected:'Rejected',
      confirmed:'Confirmed',scheduled:'Scheduled',completed:'Completed',
      assigned:'Assigned',arrived:'Driver arrived','in-progress':'In progress' },
    noResults:'No results',filterAll:'All',searchPh:'Search…',
    edit:'Edit',save:'Save',cancel:'Cancel',editFlight:'Edit flight details',
    editHotel:'Edit hotel booking',editTransfer:'Edit ground transfer',
    cancel2:'Cancel',newBookingTitle:'New Booking',
    selectGuest:'Select Guest',bookingDetails:'Booking Details',
    guestSearch:'Search guest…',back:'Back',next:'Next',
  };

  // ── Active event's own start/end date — bounds every travel date field,
  //    same as the guest wizard's TravelAccordion (event window ± margin for
  //    Arrival/Departure, raw event window for everything else).
  const [activeEvent, setActiveEvent] = useState(null);
  useEffect(() => {
    if (!activeEventId) { setActiveEvent(null); return; }
    getEvent(activeEventId).then(setActiveEvent).catch(() => setActiveEvent(null));
  }, [activeEventId]);
  const eventMinDate = activeEvent?.startDate || undefined;
  const eventMaxDate = activeEvent?.endDate || undefined;
  const dateWindowMin = useMemo(() => addDaysIso(activeEvent?.startDate, -DATE_MARGIN_DAYS) || undefined, [activeEvent?.startDate]);
  const dateWindowMax = useMemo(() => addDaysIso(activeEvent?.endDate, DATE_MARGIN_DAYS) || undefined, [activeEvent?.endDate]);

  // ── Per-tab booking rows — each tab pulls from its own table via its own
  //    endpoint, lazily on first open, refetched when the active event changes
  //    (or explicitly via refetchTab() after a save touches that tab).
  const [flightRows, setFlightRows]     = useState([]);
  const [hotelRows, setHotelRows]       = useState([]);
  const [transferRows, setTransferRows] = useState([]);
  const [tabLoading, setTabLoading]     = useState({ 0: false, 1: false, 2: false });
  const loadedRef = useRef({ 0: null, 1: null, 2: null }); // tab -> eventId already loaded

  const TAB_SVC = [getEventFlights, getEventAccommodation, getEventTransport];
  const TAB_SET = [setFlightRows, setHotelRows, setTransferRows];
  const TAB_MAP = [mapFlight, mapHotel, mapTransfer];

  async function refetchTab(idx) {
    // Arrivals & departures (tab 3) loads itself — it has no TAB_SVC entry.
    if (!activeEventId || !TAB_SVC[idx]) return;
    setTabLoading(l => ({ ...l, [idx]: true }));
    try {
      // Paged endpoint → { items, totalCount, … }.
      const res = await TAB_SVC[idx](activeEventId);
      TAB_SET[idx]((res?.items || []).map(TAB_MAP[idx]));
      loadedRef.current[idx] = activeEventId;
    } catch (err) {
      toast.fromError(err);
    } finally {
      setTabLoading(l => ({ ...l, [idx]: false }));
    }
  }

  // ── UI state ────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState(0);

  // Fetch the active tab's rows the first time it's shown for this event.
  useEffect(() => {
    if (!activeEventId) {
      setFlightRows([]); setHotelRows([]); setTransferRows([]);
      loadedRef.current = { 0: null, 1: null, 2: null };
      return;
    }
    if (loadedRef.current[activeTab] === activeEventId) return; // already loaded
    refetchTab(activeTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, activeEventId]);

  // ── Arrivals & departures tab (read-only) ──────────────────────────────────
  // Unlike the other tabs this pages server-side: the endpoint pages by guest,
  // so a page can never split a guest's flights. Search and direction therefore
  // have to go to the server too — filtering locally would only ever see the
  // rows already on screen.
  const [adRows, setAdRows]           = useState([]);
  const [adTotal, setAdTotal]         = useState(0);
  const [adLoading, setAdLoading]     = useState(false);
  const [adSearchInput, setAdSearchInput] = useState('');
  const [adSearch, setAdSearch]       = useState('');
  const [adDirection, setAdDirection] = useState('all');
  const [adFrom, setAdFrom]           = useState('');
  const [adTo, setAdTo]               = useState('');
  const [adPageIndex, setAdPageIndex] = useState(0);
  const [adPageSize, setAdPageSize]   = useState(10);

  // Debounce typing so each keystroke doesn't fire a request.
  useEffect(() => {
    const t = setTimeout(() => setAdSearch(adSearchInput.trim()), 400);
    return () => clearTimeout(t);
  }, [adSearchInput]);

  // Anything that reshapes the result set returns to page 1.
  useEffect(() => {
    setAdPageIndex(0);
  }, [activeEventId, adSearch, adDirection, adFrom, adTo, adPageSize]);

  useEffect(() => {
    if (activeTab !== 3 || !activeEventId) return undefined;
    let cancelled = false;
    setAdLoading(true);
    getEventArrivalsDepartures(activeEventId, {
      pageNumber: adPageIndex + 1, // API pages are 1-based
      pageSize: adPageSize,
      search: adSearch || undefined,
      direction: adDirection,
      fromDate: adFrom || undefined,
      toDate: adTo || undefined,
    })
      .then(r => { if (!cancelled) { setAdRows(r?.items || []); setAdTotal(r?.totalCount ?? 0); } })
      .catch(err => { if (!cancelled) { setAdRows([]); setAdTotal(0); toast.fromError(err); } })
      .finally(() => { if (!cancelled) setAdLoading(false); });
    return () => { cancelled = true; };
  }, [activeTab, activeEventId, adPageIndex, adPageSize, adSearch, adDirection, adFrom, adTo]);

  const [fSearch, setFSearch]         = useState('');
  const [fFlight, setFFlight]         = useState('All');
  const [hSearch, setHSearch]         = useState('');
  const [hHotel, setHHotel]           = useState('All hotels');
  const [tSearch, setTSearch]         = useState('');
  const [tStatus, setTStatus]         = useState('All');

  // ── Travel lookups (shared by New Booking + every Edit modal) ──────────────
  const [travelLookups, setTravelLookups] = useState({});
  useEffect(() => {
    getTravelLookups().then(setTravelLookups).catch(() => setTravelLookups({}));
  }, []);

  // ── Edit modal — reuses the exact same field set as New Booking/the guest
  //    wizard (TravelAccordion's per-section fields), scoped to one section.
  const [editModal, setEditModal] = useState(null); // { type, guestId, guestName, form } | { type, loading: true }
  const [savingEdit, setSavingEdit] = useState(false);

  async function openEdit(type, row) {
    setEditModal({ type, guestId: row.guestId, guestName: row.name, form: null, loading: true });
    try {
      const data = await getGuestTravel(row.guestId);
      const section = hydrateTravel(data)[TYPE_TO_SECTION[type]];
      setEditModal({ type, guestId: row.guestId, guestName: row.name, form: { ...section, enabled: true }, loading: false });
    } catch (err) {
      toast.fromError(err);
      setEditModal(null);
    }
  }
  function closeEdit() { setEditModal(null); }

  const DELETE_FN = { flight: deleteFlight, hotel: deleteAccommodation, transfer: deleteTransport };
  const [removingId, setRemovingId] = useState(null);

  async function removeBooking(type, bookingId) {
    setRemovingId(bookingId);
    try {
      await DELETE_FN[type](bookingId);
      await refetchTab({ flight: 0, hotel: 1, transfer: 2 }[type]);
      toast.success(isAr ? 'تمت الإزالة' : 'Removed');
    } catch (err) {
      toast.fromError(err, isAr ? 'تعذّرت الإزالة' : 'Failed to remove');
    } finally {
      setRemovingId(null);
    }
  }
  function setEditField(patch) {
    setEditModal(m => ({ ...m, form: { ...m.form, ...(typeof patch === 'function' ? patch(m.form) : patch) } }));
  }
  async function saveEdit() {
    const { type, guestId, form } = editModal;
    const section = TYPE_TO_SECTION[type];
    const travelObj = { ...EMPTY_TRAVEL, [section]: { ...form, enabled: true } };
    const travelErr = validateTravel(travelObj, isAr);
    if (travelErr) { toast.error(travelErr); return; }

    setSavingEdit(true);
    try {
      await saveGuestTravel(guestId, buildTravelPayload(travelObj));
      await refetchTab({ flight: 0, hotel: 1, transfer: 2 }[type]);
      closeEdit();
      toast.success(isAr ? 'تم الحفظ بنجاح' : 'Saved successfully');
    } catch (err) {
      toast.fromError(err, isAr ? 'حدث خطأ أثناء الحفظ' : 'Error saving changes');
    } finally {
      setSavingEdit(false);
    }
  }

  // ── New booking modal ───────────────────────────────────────────────────────
  const [showNewBooking, setShowNewBooking] = useState(false);
  const [bookStep, setBookStep] = useState(1);
  const [bookGuest, setBookGuest] = useState('');
  const [bookGuestId, setBookGuestId] = useState('');
  const [guestSearch, setGuestSearch] = useState('');
  const [bookings, setBookings] = useState([]);
  const [savingBooking, setSavingBooking] = useState(false);
  const [travel, setTravel] = useState(EMPTY_TRAVEL);

  // ── Guest picker — slim /guest/picker feed, searched and paged server-side,
  //    one page at a time as the list is scrolled. Nothing is fetched until the
  //    modal actually opens.
  const [guests, setGuests] = useState([]);
  const [guestPage, setGuestPage] = useState(1);
  const [guestHasMore, setGuestHasMore] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);
  // Debounced copy of guestSearch — one request per pause, not per keystroke.
  const [guestQuery, setGuestQuery] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setGuestQuery(guestSearch.trim()), 300);
    return () => clearTimeout(t);
  }, [guestSearch]);

  const loadGuestPage = useCallback(async (page) => {
    if (!activeEventId) { setGuests([]); return; }
    setGuestLoading(true);
    try {
      const res = await getGuestPicker({
        eventId: activeEventId, search: guestQuery, pageNumber: page, pageSize: GUEST_PAGE_SIZE,
      });
      const items = res?.items || [];
      setGuests(prev => (page === 1 ? items : [...prev, ...items]));
      setGuestPage(page);
      setGuestHasMore(page * GUEST_PAGE_SIZE < (res?.totalCount ?? 0));
    } catch {
      if (page === 1) { setGuests([]); setGuestHasMore(false); }
    } finally {
      setGuestLoading(false);
    }
  }, [activeEventId, guestQuery]);

  // Page 1 on open, on event change, and whenever the search term settles.
  useEffect(() => {
    if (!showNewBooking) return;
    loadGuestPage(1);
  }, [showNewBooking, loadGuestPage]);

  // Near the bottom → pull the next page.
  const onGuestListScroll = (e) => {
    if (guestLoading || !guestHasMore) return;
    const el = e.currentTarget;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 60) loadGuestPage(guestPage + 1);
  };

  function openNewBooking() {
    setShowNewBooking(true); setBookStep(1);
    setBookGuest(''); setBookGuestId(''); setGuestSearch('');
    setTravel(EMPTY_TRAVEL);
  }

  async function saveBooking() {
    if (!activeEventId || !bookGuestId) return;
    const travelErr = validateTravel(travel, isAr);
    if (travelErr) { toast.error(travelErr); return; }
    if (!anyTravelEnabled(travel)) {
      toast.error(isAr ? 'فعّل قسمًا واحدًا على الأقل' : 'Enable at least one section');
      return;
    }

    setSavingBooking(true);
    try {
      await saveGuestTravel(bookGuestId, buildTravelPayload(travel));

      // The tabs touched by this save may not be the active one — invalidate
      // all three so switching tabs picks up fresh data, and refetch the one
      // that's visible right now.
      loadedRef.current = { 0: null, 1: null, 2: null };
      await refetchTab(activeTab);

      setBookings(prev => [...prev, { guest: bookGuest }]);
      setShowNewBooking(false); setBookStep(1); setBookGuest(''); setBookGuestId(''); setGuestSearch('');
      toast.success(isAr ? 'تم إنشاء الحجز بنجاح' : 'Booking created successfully');
    } catch (err) {
      toast.fromError(err, isAr ? 'حدث خطأ أثناء إنشاء الحجز' : 'Error creating booking');
    } finally {
      setSavingBooking(false);
    }
  }

  // ── Filtered data ───────────────────────────────────────────────────────────
  // Filter at the booking level first, then group what's left by guest — a
  // guest only shows up if at least one of their bookings matches, and only
  // the matching bookings appear in their stacked cell.
  const filteredFlights = useMemo(() => groupByGuest(flightRows.filter(r => {
    const s = !fSearch || r.name.toLowerCase().includes(fSearch.toLowerCase()) || r.flight.toLowerCase().includes(fSearch.toLowerCase());
    const f = fFlight === 'All' || r.flightStatus === fFlight;
    return s && f;
  })), [flightRows, fSearch, fFlight]);

  const filteredHotels = useMemo(() => groupByGuest(hotelRows.filter(r => {
    const s = !hSearch || r.name.toLowerCase().includes(hSearch.toLowerCase()) || r.hotel.toLowerCase().includes(hSearch.toLowerCase());
    const h = hHotel === 'All hotels' || r.hotel === hHotel;
    return s && h;
  })), [hotelRows, hSearch, hHotel]);

  const filteredTransfers = useMemo(() => groupByGuest(transferRows.filter(r => {
    const s = !tSearch || r.name.toLowerCase().includes(tSearch.toLowerCase()) || r.driver.toLowerCase().includes(tSearch.toLowerCase());
    const st = tStatus === 'All' || r.transferStatus === tStatus;
    return s && st;
  })), [transferRows, tSearch, tStatus]);



  // ── Styles ──────────────────────────────────────────────────────────────────
  const iSt = { width:'100%', background:'var(--surface-soft-3)', border:'1px solid var(--glass-border)', borderRadius:8, padding:'8px 11px', color:'var(--ink)', fontSize:13, boxSizing:'border-box', outline:'none' };
  const lSt = { display:'block', fontSize:10.5, color:'var(--ink-mute)', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:4 };

  // A guest's column can hold more than one booking — each column stacks one
  // row per booking, all sized/spaced identically so they line up across the
  // guest's whole table row.
  const stackCell = (bookings, renderFn) => (
    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
      {bookings.map((b, i) => (
        <div key={b.bookingId ?? i} style={{ minHeight:20, display:'flex', alignItems:'center' }}>{renderFn(b)}</div>
      ))}
    </div>
  );

  // Edit only makes sense when there's exactly one booking of this kind for
  // the guest (otherwise which one would it edit?) — with more than one,
  // each gets its own remove button instead.
  const actionsCell = (type, bookings) => (
    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
      {bookings.map(b => (
        <div key={b.bookingId} style={{ minHeight:20, display:'flex', alignItems:'center' }}>
          <ActionMenu
            items={[
              bookings.length === 1 && { label: STR.edit, icon: 'edit', onClick: () => openEdit(type, b) },
              {
                label: isAr ? 'إزالة' : 'Remove', icon: 'trash', danger: true,
                disabled: removingId === b.bookingId,
                onClick: () => removeBooking(type, b.bookingId),
              },
            ]}
          />
        </div>
      ))}
    </div>
  );

  const nights = (r) => {
    try {
      const a = new Date(r.checkIn), b = new Date(r.checkOut);
      const d = Math.round((b - a) / 86400000);
      return isNaN(d) ? '—' : ad(d);
    } catch { return '—'; }
  };

  // ── Table columns ─────────────────────────────────────────────────────────
  // Rows are grouped per guest (see groupByGuest), so each cell stacks one line
  // per booking of that kind. Sorting is off throughout: a cell can hold several
  // values, so there is no single value to sort a column on. Each tab renders
  // its own FilterBar above the table, hence showSearch={false} on the DataTable.
  const columns = useMemo(() => {
    const guest = (withOrg = true) => ({
      id: 'guest', header: STR.cols.guest, enableSorting: false,
      cell: ({ row }) => <GuestCell g={row.original} withOrg={withOrg} />,
    });
    // One stacked column; `render` receives a single booking.
    const col = (id, header, render) => ({
      id, header, enableSorting: false,
      cell: ({ row }) => stackCell(row.original.bookings, render),
    });
    const actions = (type) => ({
      id: 'actions', header: '', size: 40, enableSorting: false,
      cell: ({ row }) => actionsCell(type, row.original.bookings),
    });

    const mono = { fontFamily: 'var(--mono)', fontSize: 12 };
    const muted = { fontSize: 11, color: 'var(--ink-mute)' };
    const ellipsis = { ...muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 130 };
    const text = { fontSize: 12 };

    return {
      flights: [
        guest(),
        col('flight',      STR.cols.flight,      b => <span style={{ ...mono, fontWeight: 600 }}>{b.flight}</span>),
        col('flightType',  STR.cols.flightType,  b => <span style={text}>{b.flightType}</span>),
        col('flightClass', STR.cols.flightClass, b => <span style={text}>{b.flightClass}</span>),
        col('route',       STR.cols.route,       b => <span style={{ ...muted, fontFamily: 'var(--mono)' }}>{b.from} → {b.to}</span>),
        col('date',        STR.cols.date,        b => <span style={mono}>{b.dateLabel || b.date}</span>),
        col('status',      STR.cols.status,      b => <StatusChip status={b.flightStatus} label={STR.statuses[b.flightStatus]} />),
        actions('flight'),
      ],
      hotels: [
        guest(),
        col('hotel',    STR.cols.hotel,    b => <span style={{ ...text, fontWeight: 500 }}>{b.hotel}</span>),
        col('room',     STR.cols.room,     b => <span style={text}>{b.roomType}</span>),
        col('checkIn',  STR.cols.checkIn,  b => <span style={mono}>{b.checkIn}</span>),
        col('checkOut', STR.cols.checkOut, b => <span style={mono}>{b.checkOut}</span>),
        col('nights',   STR.cols.nights,   b => <span style={{ ...mono, color: 'var(--ink-mute)' }}>{nights(b)}</span>),
        actions('hotel'),
      ],
      transfers: [
        guest(false),
        col('vehicle', STR.cols.vehicle, b => (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon name="car" size={13} style={{ color: 'var(--accent)', flexShrink: 0 }} />
            <span style={text}>{b.vehicle}</span>
          </div>
        )),
        col('driver',  STR.cols.driver,  b => <span style={text}>{b.driver}</span>),
        col('pickup',  STR.cols.pickup,  b => <div style={ellipsis}>{b.pickup}</div>),
        col('dropoff', STR.cols.dropoff, b => <div style={ellipsis}>{b.dropoff}</div>),
        col('date',    STR.cols.date,    b => (
          <div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>{b.dateLabel || b.date}</div>
            <div style={{ ...muted, fontFamily: 'var(--mono)' }}>{ad(b.time)}</div>
          </div>
        )),
        col('status',  STR.cols.status,  b => <StatusChip status={b.transferStatus} label={STR.statuses[b.transferStatus]} />),
        actions('transfer'),
      ],
    };
    // stackCell/actionsCell/nights/ad are re-created every render but only read
    // values covered below, so re-memoising on them would defeat the memo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [STR, isAr, removingId]);

  // ── Arrivals & departures columns ─────────────────────────────────────────
  // One row per guest: their inbound flights in one column, outbound in the
  // other. Whichever direction is filtered out is dropped from the table
  // entirely rather than left as a column of dashes.
  const adColumns = useMemo(() => {
    const showInbound  = adDirection !== 'outbound';
    const showOutbound = adDirection !== 'inbound';

    const routeColumn = (id, header, pick, inbound) => ({
      id, header, enableSorting: false,
      cell: ({ row }) => {
        const flights = pick(row.original);
        if (!flights?.length) return <span style={{ color:'var(--ink-faint)' }}>—</span>;
        return (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {flights.map(f => (
              <div key={f.id}>
                <div style={{ display:'flex', alignItems:'center', gap:7, fontFamily:'var(--mono)', fontSize:12, fontWeight:600 }}>
                  <span>{f.departureCode || '—'}</span>
                  <Icon
  name={inbound ? 'planeLanding' : 'planeTakeoff'}
  size={15}
  style={{
    color: 'var(--accent)',
    flexShrink: 0,
    ...(inbound && { strokeWidth: 0, borderBottom: '1px solid var(--accent)'}),
  }}
/>
                  <span>{f.arrivalCode || '—'}</span>
                </div>
                <div style={{ fontSize:11, color:'var(--ink-mute)', fontFamily:'var(--mono)', marginTop:2 }}>
                  {timeRange(f.departureTime, f.arrivalTime)}
                </div>
              </div>
            ))}
          </div>
        );
      },
    });

    return [
      {
        id: 'guest', header: STR.cols.guest, enableSorting: false,
        cell: ({ row }) => {
          const g = row.original;
          return (
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <Avatar initials={initialsFromName(g.guestName)} size={28} tier={g.tier}/>
              <div>
                <div style={{ fontSize:12.5, fontWeight:500 }}>{g.guestName || '—'}</div>
                <div style={{ fontSize:11, color:'var(--ink-mute)' }}>{g.email || '—'}</div>
              </div>
            </div>
          );
        },
      },
      {
        id: 'organization', header: STR.cols.organization, enableSorting: false,
        cell: ({ row }) => <span style={{ fontSize:12 }}>{row.original.organization || '—'}</span>,
      },
      {
        id: 'flightNo', header: STR.cols.flight, enableSorting: false,
        cell: ({ row }) => {
          // Only the directions actually on screen, so a filtered view never
          // shows a number whose route column is hidden.
          const visible = [
            ...(showInbound ? row.original.inbound : []),
            ...(showOutbound ? row.original.outbound : []),
          ];
          const numbers = visible.map(f => f.flightNumber).filter(Boolean);
          return (
            <span style={{ fontFamily:'var(--mono)', fontSize:12, fontWeight:600 }}>
              {numbers.length ? numbers.join(' / ') : '—'}
            </span>
          );
        },
      },
      ...(showInbound  ? [routeColumn('inbound',  STR.cols.inboundRoute,  r => r.inbound,  true)]  : []),
      ...(showOutbound ? [routeColumn('outbound', STR.cols.outboundRoute, r => r.outbound, false)] : []),
    ];
  }, [STR, adDirection]);

  const adDirectionOpts = useMemo(() => [
    { value: 'all',      label: STR.direction.all },
    { value: 'inbound',  label: STR.direction.inbound },
    { value: 'outbound', label: STR.direction.outbound },
  ], [STR]);

  // ── Filter dropdown options ───────────────────────────────────────────────
  const flightFilterOpts = useMemo(() => [
    { value: 'All', label: isAr ? 'كل الرحلات' : 'All flights' },
    ...['confirmed', 'pending'].map(s => ({ value: s, label: STR.statuses[s] })),
  ], [STR, isAr]);

  const hotelFilterOpts = useMemo(() => [
    { value: 'All hotels', label: isAr ? 'جميع الفنادق' : 'All hotels' },
    ...(travelLookups.hotels || []).map(h => ({ value: h.name, label: h.name })),
  ], [travelLookups.hotels, isAr]);

  const transferFilterOpts = useMemo(() => [
    { value: 'All', label: STR.filterAll },
    // Transport lifecycle (Core/Constants/TransportStatuses.cs).
    ...['pending', 'assigned', 'arrived', 'in-progress', 'completed'].map(s => ({ value: s, label: STR.statuses[s] })),
  ], [STR]);

  const grid2 = (children) => (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>{children}</div>
  );

  const flightStatusOpts = [
    { value: 'confirmed', label: isAr ? 'مؤكد' : 'Confirmed' },
    { value: 'pending', label: isAr ? 'قيد الانتظار' : 'Pending' },
  ];
  const mapOpts = (arr, labelFn) => (arr || []).map((x) => ({ value: x.id, label: labelFn(x) }));

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{STR.title[0]} <em>{STR.title[1]}</em></h1>
          <div className="page-sub">{STR.sub}</div>
        </div>
        <div className="page-actions">
          <button className="btn primary" onClick={openNewBooking}>
            <Icon name="plus" size={14}/> {STR.newBooking}
          </button>
        </div>
      </div>

      {bookings.length > 0 && (
        <div style={{ marginBottom:14, padding:'10px 16px', borderRadius:10, background:'rgba(141, 1, 52,0.1)', border:'1px solid rgba(141, 1, 52,0.3)', fontSize:13, display:'flex', gap:10, alignItems:'center' }}>
          <Icon name="check" size={14} style={{ color:'var(--accent)' }}/>
          <span>{isAr ? `تم إضافة ${ad(bookings.length)} حجز` : `${bookings.length} new booking${bookings.length>1?'s':''} added`}</span>
        </div>
      )}

      {/* KPI row */}
      <div className="kpi-grid" style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:18 }}>
        {[
          { icon:'flight', val:fmtN(flightRows.filter(f=>f.flightStatus==='confirmed').length),  label:STR.kpi.flights,   help:STR.kpi.flightsH,   tab:0 },
          { icon:'hotel',  val:fmtN(hotelRows.length), label:STR.kpi.rooms,     help:STR.kpi.roomsH,     tab:1 },
          { icon:'car',    val:fmtN(transferRows.length),   label:STR.kpi.transfers,  help:STR.kpi.transfersH, tab:2 },
        ].map((k, i) => (
          <div key={i} className="card" style={{ padding:'14px 18px', cursor:'pointer' }}
            onClick={() => setActiveTab(k.tab)}
            onMouseEnter={e => e.currentTarget.style.boxShadow='0 4px 16px rgba(0,0,0,0.14)'}
            onMouseLeave={e => e.currentTarget.style.boxShadow=''}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
              <Icon name={k.icon} size={14} style={{ color:'var(--accent)' }}/>
              <span style={{ fontSize:11, color:'var(--ink-mute)', textTransform:'uppercase', letterSpacing:'0.1em' }}>{k.label}</span>
            </div>
            <div style={{ fontFamily:'var(--serif)', fontSize:26, fontStyle:'italic', lineHeight:1, marginBottom:4, direction:'ltr' }}>{k.val}</div>
            <div style={{ fontSize:11, color:'var(--ink-mute)' }}>{k.help}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="tabs" style={{ marginBottom:16 }}>
        {STR.tabs.map((t, i) => (
          <button key={i} className={`tab${activeTab===i?' active':''}`} onClick={() => setActiveTab(i)}>{t}</button>
        ))}
      </div>

      {/* ── Tab 1: Flights ── */}
      {activeTab === 0 && (
        <div>
          <FilterBar
            search={fSearch} onSearch={setFSearch} searchPlaceholder={STR.searchPh}
            filter={fFlight} onFilter={v => setFFlight(v || 'All')}
            filterOptions={flightFilterOpts} filterPlaceholder={STR.cols.status}
            shown={fmtN(filteredFlights.length)} total={fmtN(groupByGuest(flightRows).length)}
            countLabel={isAr ? 'من' : 'of'}
          />
          <div className="card" style={{ padding:0 }}>
            <DataTable
              columns={columns.flights}
              data={filteredFlights}
              loading={tabLoading[0]}
              emptyText={STR.noResults}
              showSearch={false}
              pageSize={10}
            />
          </div>
        </div>
      )}

      {/* ── Tab 2: Hotel ── */}
      {activeTab === 1 && (
        <div>
          <FilterBar
            search={hSearch} onSearch={setHSearch} searchPlaceholder={STR.searchPh}
            filter={hHotel} onFilter={v => setHHotel(v || 'All hotels')}
            filterOptions={hotelFilterOpts} filterPlaceholder={STR.cols.hotel}
            shown={fmtN(filteredHotels.length)} total={fmtN(groupByGuest(hotelRows).length)}
            countLabel={isAr ? 'من' : 'of'}
          />
          <div className="card" style={{ padding:0 }}>
            <DataTable
              columns={columns.hotels}
              data={filteredHotels}
              loading={tabLoading[1]}
              emptyText={STR.noResults}
              showSearch={false}
              pageSize={10}
            />
          </div>
        </div>
      )}

      {/* ── Tab 3: Ground Transfers ── */}
      {activeTab === 2 && (
        <div>
          <FilterBar
            search={tSearch} onSearch={setTSearch} searchPlaceholder={STR.searchPh}
            filter={tStatus} onFilter={v => setTStatus(v || 'All')}
            filterOptions={transferFilterOpts} filterPlaceholder={STR.cols.status}
            shown={fmtN(filteredTransfers.length)} total={fmtN(groupByGuest(transferRows).length)}
            countLabel={isAr ? 'من' : 'of'}
          />
          <div className="card" style={{ padding:0 }}>
            <DataTable
              columns={columns.transfers}
              data={filteredTransfers}
              loading={tabLoading[2]}
              emptyText={STR.noResults}
              showSearch={false}
              pageSize={10}
            />
          </div>
        </div>
      )}

      {/* ── Tab 4: Arrivals & Departures (read-only) ── */}
      {activeTab === 3 && (
        <div>
          <FilterBar
            search={adSearchInput} onSearch={setAdSearchInput} searchPlaceholder={STR.searchPh}
            filter={adDirection} onFilter={v => setAdDirection(v || 'all')}
            filterOptions={adDirectionOpts} filterPlaceholder={STR.direction.all}
            shown={fmtN(adRows.length)} total={fmtN(adTotal)}
            countLabel={isAr ? 'من' : 'of'}
            extra={
              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                <div style={{ minWidth:140 }}>
                  <DateField value={adFrom} onChange={v => setAdFrom(v || '')} placeholder={STR.dateFrom}/>
                </div>
                <span style={{ color:'var(--ink-faint)', fontSize:12 }}>–</span>
                <div style={{ minWidth:140 }}>
                  <DateField value={adTo} onChange={v => setAdTo(v || '')} minDate={adFrom || undefined} placeholder={STR.dateTo}/>
                </div>
                {(adFrom || adTo) && (
                  <button
                    className="icon-btn"
                    title={STR.clearDates}
                    onClick={() => { setAdFrom(''); setAdTo(''); }}
                    style={{ opacity:0.6 }}
                  >
                    <Icon name="close" size={13}/>
                  </button>
                )}
              </div>
            }
          />
          <div className="card" style={{ padding:0 }}>
            <DataTable
              columns={adColumns}
              data={adRows}
              loading={adLoading}
              emptyText={STR.noResults}
              showSearch={false}
              manualPagination
              pageSize={adPageSize}
              pageIndex={adPageIndex}
              totalRows={adTotal}
              onPageChange={setAdPageIndex}
              onPageSizeChange={setAdPageSize}
            />
          </div>
        </div>
      )}

      {/* ── Edit Modal — same field set as New Booking / the guest wizard, ──
             scoped to just the one section (flight/hotel/transfer) being edited. */}
      {editModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}>
          <div className="card glass modal-solid" style={{ width:460, maxWidth:'92vw', padding:0, maxHeight:'85vh', display:'flex', flexDirection:'column' }}>
            <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--glass-border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div>
                <div style={{ fontWeight:600, fontSize:14 }}>
                  {editModal.type==='flight' ? STR.editFlight : editModal.type==='hotel' ? STR.editHotel : STR.editTransfer}
                </div>
                <div style={{ fontSize:11, color:'var(--ink-mute)', marginTop:2 }}>{editModal.guestName}</div>
              </div>
              <button className="icon-btn" onClick={closeEdit}><Icon name="close" size={14}/></button>
            </div>

            <div style={{ padding:'18px 20px', overflowY:'auto', flex:1, display:'flex', flexDirection:'column', gap:12 }}>
              {editModal.loading && (
                <div style={{ textAlign:'center', color:'var(--ink-mute)', fontSize:13, padding:'20px 0' }}>…</div>
              )}

              {!editModal.loading && editModal.type === 'flight' && (() => {
                const f = editModal.form;
                const set = (k, v) => setEditField({ [k]: v });
                return (
                  <>
                    {grid2(<>
                      <div><label style={lSt}>{isAr ? 'مطار المغادرة' : 'Departure Airport'} *</label>
                        <Select value={f.fromAirportId} onChange={v => set('fromAirportId', v)} options={mapOpts(travelLookups.airports, x=>`${x.code} — ${x.city}${x.country ? `, ${x.country}` : ''}`)} placeholder={isAr?'— اختر —':'— Select —'}/>
                      </div>
                      <div><label style={lSt}>{isAr ? 'مطار الوصول' : 'Arrival Airport'} *</label>
                        <Select value={f.toAirportId} onChange={v => set('toAirportId', v)} options={mapOpts(travelLookups.airports, x=>`${x.code} — ${x.city}${x.country ? `, ${x.country}` : ''}`)} placeholder={isAr?'— اختر —':'— Select —'}/>
                      </div>
                    </>)}
                    {grid2(<>
                      <div><label style={lSt}>{isAr ? 'نوع الرحلة' : 'Flight Type'} *</label>
                        <Select value={f.flightTypeId} onChange={v => set('flightTypeId', v)} options={mapOpts(travelLookups.flightTypes, x=>x.name)} placeholder={isAr?'— اختر —':'— Select —'}/>
                      </div>
                      <div><label style={lSt}>{isAr ? 'الدرجة' : 'Flight Class'}</label>
                        <Select value={f.flightClassId} onChange={v => set('flightClassId', v)} options={mapOpts(travelLookups.flightClasses, x=>x.name)} placeholder={isAr?'— اختر —':'— Select —'} isClearable/>
                      </div>
                    </>)}
                    {grid2(<>
                      <div><label style={lSt}>{isAr ? 'رقم الرحلة' : 'Flight No.'} *</label><input style={iSt} value={f.flightNumber} onChange={e => set('flightNumber', e.target.value)}/></div>
                      <div><label style={lSt}>{isAr ? 'المقعد' : 'Seat'}</label><input style={iSt} value={f.seat} onChange={e => set('seat', e.target.value)}/></div>
                    </>)}
                    {grid2(<>
                      <div><label style={lSt}>{isAr ? 'وقت الإقلاع' : 'Departure Time'} *</label>
                        <DateField value={f.startTime} onChange={v => set('startTime', v||'')} showTime minDate={eventMinDate} maxDate={eventMaxDate} placeholder="YYYY-MM-DD HH:mm"/>
                      </div>
                      <div><label style={lSt}>{isAr ? 'وقت الوصول' : 'Arrival Time'}</label>
                        <DateField value={f.endTime} onChange={v => set('endTime', v||'')} showTime minDate={f.startTime || eventMinDate} maxDate={eventMaxDate} placeholder="YYYY-MM-DD HH:mm"/>
                      </div>
                    </>)}
                    <div><label style={lSt}>{isAr ? 'حالة الحجز' : 'Booking Status'}</label>
                      <Select value={f.status} onChange={v => set('status', v)} options={flightStatusOpts} placeholder={isAr?'— اختر —':'— Select —'}/>
                    </div>
                  </>
                );
              })()}

              {!editModal.loading && editModal.type === 'hotel' && (() => {
                const f = editModal.form;
                const set = (k, v) => setEditField({ [k]: v });
                return (
                  <>
                    {grid2(<>
                      <div><label style={lSt}>{isAr ? 'الفندق' : 'Hotel'} *</label>
                        <Select value={f.hotelId} onChange={v => set('hotelId', v)} options={mapOpts(travelLookups.hotels, x=>x.name)} placeholder={isAr?'— اختر —':'— Select —'}/>
                      </div>
                      <div><label style={lSt}>{isAr ? 'نوع الغرفة' : 'Room Type'}</label>
                        <Select value={f.roomTypeId} onChange={v => set('roomTypeId', v)} options={mapOpts(travelLookups.roomTypes, x=>x.name)} placeholder={isAr?'— اختر —':'— Select —'} isClearable/>
                      </div>
                    </>)}
                    {grid2(<>
                      <div><label style={lSt}>{STR.cols.checkIn} *</label><DateField value={f.checkIn} onChange={v => set('checkIn', v||'')} minDate={dateWindowMin} maxDate={dateWindowMax} placeholder="YYYY-MM-DD"/></div>
                      <div><label style={lSt}>{STR.cols.checkOut} *</label><DateField value={f.checkOut} onChange={v => set('checkOut', v||'')} minDate={f.checkIn || dateWindowMin} maxDate={dateWindowMax} placeholder="YYYY-MM-DD"/></div>
                    </>)}
                    {/* {grid2(<>
                      <div><label style={lSt}>{isAr ? 'إطلالة الغرفة' : 'Room View'}</label><input style={iSt} value={f.roomView} onChange={e => set('roomView', e.target.value)}/></div>
                      <div><label style={lSt}>{isAr ? 'عدد النزلاء' : 'Guest Count'}</label><input type="number" style={iSt} value={f.guestCount} onChange={e => set('guestCount', e.target.value)}/></div>
                    </>)}
                    {grid2(<>
                      <div><label style={lSt}>{isAr ? 'اسم الكونسيرج' : 'Concierge Name'}</label><input style={iSt} value={f.conciergeName} onChange={e => set('conciergeName', e.target.value)}/></div>
                      <div><label style={lSt}>{isAr ? 'هاتف الكونسيرج' : 'Concierge Phone'}</label><input style={iSt} value={f.conciergePhone} onChange={e => set('conciergePhone', e.target.value)}/></div>
                    </>)} */}
                  </>
                );
              })()}

              {!editModal.loading && editModal.type === 'transfer' && (() => {
                const f = editModal.form;
                const set = (k, v) => setEditField({ [k]: v });
                return (
                  <>
                    {grid2(<>
                      <div><label style={lSt}>{isAr ? 'موقع الاستلام' : 'Pickup Location'} *</label>
                        <Select value={f.pickupLocationId} onChange={v => set('pickupLocationId', v)} options={mapOpts(travelLookups.locations, x=>x.address)} placeholder={isAr?'— اختر —':'— Select —'}/>
                      </div>
                      <div><label style={lSt}>{isAr ? 'موقع التوصيل' : 'Dropoff Location'} *</label>
                        <Select value={f.dropoffLocationId} onChange={v => set('dropoffLocationId', v)} options={mapOpts(travelLookups.locations, x=>x.address)} placeholder={isAr?'— اختر —':'— Select —'}/>
                      </div>
                    </>)}
                    {grid2(<>
                      <div><label style={lSt}>{isAr ? 'المركبة' : 'Vehicle'} *</label>
                        <Select value={f.vehicleId} onChange={v => set('vehicleId', v)} options={mapOpts(travelLookups.vehicles, vehicleLabel)} placeholder={isAr?'— اختر —':'— Select —'}/>
                      </div>
                      <div><label style={lSt}>{isAr ? 'السائق' : 'Driver'}</label>
                        <Select value={f.driverId} onChange={v => set('driverId', v)} options={mapOpts(travelLookups.drivers, driverLabel)} placeholder={isAr?'— اختر —':'— Select —'} isClearable/>
                      </div>
                    </>)}
                    {grid2(<>
                      <div><label style={lSt}>{isAr ? 'وقت الاستلام' : 'Pickup Time'} *</label><DateField value={f.pickupTime} onChange={v => set('pickupTime', v||'')} showTime minDate={dateWindowMin} maxDate={dateWindowMax} placeholder="YYYY-MM-DD HH:mm"/></div>
                      <div><label style={lSt}>{isAr ? 'وقت التوصيل' : 'Dropoff Time'}</label><DateField value={f.dropoffTime} onChange={v => set('dropoffTime', v||'')} showTime minDate={f.pickupTime || dateWindowMin} maxDate={dateWindowMax} placeholder="YYYY-MM-DD HH:mm"/></div>
                    </>)}
                  </>
                );
              })()}
            </div>

            <div style={{ padding:'12px 20px', borderTop:'1px solid var(--glass-border)', display:'flex', gap:8, justifyContent:'flex-end' }}>
              <button className="btn" onClick={closeEdit}>{STR.cancel}</button>
              <button className="btn primary" onClick={saveEdit} disabled={savingEdit || editModal.loading}>
                <Icon name="check" size={13}/> {savingEdit ? (isAr ? 'جارٍ الحفظ…' : 'Saving…') : STR.save}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── New Booking Modal — step 1 picks the guest, step 2 is the exact
             same TravelAccordion as the guest creation wizard. ── */}
      {showNewBooking && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}>
          <div className="card glass modal-solid" style={{ width:520, maxWidth:'92vw', padding:0, maxHeight:'85vh', display:'flex', flexDirection:'column' }}>
            <div style={{ padding:'18px 22px', borderBottom:'1px solid var(--glass-border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div>
                <h3 style={{ margin:0 }}>{STR.newBookingTitle}</h3>
                <div style={{ display:'flex', gap:8, marginTop:6 }}>
                  {[STR.selectGuest, STR.bookingDetails].map((l, i) => (
                    <span key={i} style={{ display:'flex', alignItems:'center', gap:4, fontSize:11, color:bookStep===i+1?'var(--accent)':bookStep>i+1?'var(--ink-dim)':'var(--ink-mute)' }}>
                      <span style={{ width:16, height:16, borderRadius:'50%', display:'grid', placeItems:'center', fontSize:10, fontWeight:700,
                        background:bookStep===i+1?'var(--accent)':bookStep>i+1?'var(--accent-deep)':'var(--surface-soft-4)',
                        color:bookStep>=i+1?'#fff':'var(--ink-mute)' }}>{i+1}</span>
                      {l}{i<1&&<span style={{ color:'var(--ink-faint)' }}>›</span>}
                    </span>
                  ))}
                </div>
              </div>
              <button className="icon-btn" onClick={() => setShowNewBooking(false)}><Icon name="close" size={14}/></button>
            </div>

            <div style={{ padding:'20px 22px', overflowY:'auto', flex:1, display:'flex', flexDirection:'column', gap:16 }}>
              {bookStep === 1 && (
                <div>
                  <label style={lSt}>{isAr?'الضيف':'Guest'}</label>
                  <input placeholder={STR.guestSearch} value={guestSearch} onChange={e => setGuestSearch(e.target.value)} style={iSt}/>
                  <div onScroll={onGuestListScroll}
                    style={{ display:'flex', flexDirection:'column', gap:4, maxHeight:280, overflowY:'auto', marginTop:8 }}>
                    {guests.map(g => {
                      const fullName = g.fullName || guestFullName(g);
                      const selected = bookGuestId === g.id;
                      return (
                        <div key={g.id} onClick={() => { setBookGuestId(g.id); setBookGuest(fullName); }}
                          style={{ padding:'8px 12px', borderRadius:8, cursor:'pointer', display:'flex', alignItems:'center', gap:10,
                            border:`1px solid ${selected?'var(--accent)':'var(--glass-border)'}`,
                            background:selected?'rgba(141, 1, 52,0.12)':'var(--surface-soft-2)' }}>
                          <Avatar initials={initialsFromName(fullName)} size={28} tier={g.tier} src={g.photoUrl}/>
                          <div>
                            <div style={{ fontSize:13, fontWeight:500 }}>{fullName}</div>
                            <div style={{ fontSize:11, color:'var(--ink-mute)' }}>{g.organization}</div>
                          </div>
                          {selected && <Icon name="check" size={13} style={{ marginLeft:'auto', color:'var(--accent)' }}/>}
                        </div>
                      );
                    })}
                    {guestLoading && (
                      <div style={{ padding:'10px', textAlign:'center', color:'var(--ink-mute)', fontSize:12 }}>
                        {isAr ? 'جارٍ التحميل…' : 'Loading…'}
                      </div>
                    )}
                    {!guestLoading && guests.length === 0 && (
                      <div style={{ padding:'12px', textAlign:'center', color:'var(--ink-mute)', fontSize:12 }}>
                        {isAr ? 'لا يوجد ضيوف لهذه الفعالية' : 'No guests found for this event'}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {bookStep === 2 && (
                <TravelAccordion
                  travel={travel}
                  onChange={setTravel}
                  lookups={travelLookups}
                  isAr={isAr}
                  dateMinDate={dateWindowMin}
                  dateMaxDate={dateWindowMax}
                  eventMinDate={eventMinDate}
                  eventMaxDate={eventMaxDate}
                />
              )}
            </div>

            <div style={{ padding:'14px 22px', borderTop:'1px solid var(--glass-border)', display:'flex', justifyContent:'space-between', gap:8 }}>
              <button className="btn" onClick={() => bookStep>1?setBookStep(1):setShowNewBooking(false)}>
                {bookStep>1?<><Icon name="arrowLeft" size={13}/> {STR.back}</>:STR.cancel2}
              </button>
              {bookStep < 2 ? (
                <button className="btn primary" onClick={() => setBookStep(2)} disabled={!bookGuestId}>
                  {STR.next} <Icon name="arrow" size={13}/>
                </button>
              ) : (
                <button className="btn primary" onClick={saveBooking} disabled={savingBooking}>
                  <Icon name="check" size={13}/> {savingBooking ? (isAr ? 'جارٍ الحفظ…' : 'Saving…') : STR.save}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
