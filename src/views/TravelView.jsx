import React, { useState, useRef, useMemo, useEffect } from 'react';
import { fmtNum, toArDigits } from '../i18n/translations.js';
import { Avatar } from '../components/UI.jsx';
import { Icon } from '../components/Icons.jsx';
import toast from '../lib/toast.js';
import { listGuests, updateGuest } from '../api/services/guestService.js';
import { getEvent } from '../api/services/eventService.js';
import { getEventFlights, getEventAccommodation, getEventTransport, getGuestTravel, saveGuestTravel, getTravelLookups } from '../api/services/travelService.js';
import Select from '../components/ui/Select.jsx';
import DateField from '../components/ui/DateField.jsx';
import { addDaysIso } from '../lib/date.js';
import TravelAccordion, {
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

function dateLabelFor(dateStr) {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch { return ''; }
}

// ─── API row → table row mappers (data comes from the travel tables) ─────────
function mapFlight(r) {
  return {
    id: r.guestId,
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
    id: r.guestId,
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
    id: r.guestId + '-T',
    guestId: r.guestId,
    name: r.guestName || '—',
    initials: initialsFromName(r.guestName),
    tier: r.tier,
    vehicle: r.vehicleType || '—',
    driver: r.driverName || '—',
    pickup: r.pickup || '—',
    dropoff: r.dropoff || '—',
    date: r.pickupTime ? r.pickupTime.slice(0, 10) : '',
    dateLabel: r.pickupTime ? dateLabelFor(r.pickupTime) : '—',
    time: r.pickupTime ? r.pickupTime.slice(11, 16) : '—',
    transferStatus: (r.tripStatus || '').toLowerCase(),
  };
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

// Shimmer placeholder rows shown while a tab's API call is in flight.
function SkeletonRows({ cols, rows = 6 }) {
  return Array.from({ length: rows }).map((_, r) => (
    <tr key={r}>
      {Array.from({ length: cols }).map((_, c) => (
        <td key={c}><div className="skel-bar" style={{ width: c === 0 ? 150 : `${45 + ((r + c) % 4) * 14}%` }}/></td>
      ))}
    </tr>
  ));
}

function SearchInput({ value, onChange, placeholder }) {
  return (
    <div style={{ position:'relative', flex:1, minWidth:160 }}>
      <Icon name="search" size={13} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'var(--ink-mute)', pointerEvents:'none' }}/>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{ width:'100%', background:'var(--surface-soft-3)', border:'1px solid var(--glass-border)', borderRadius:10, padding:'8px 12px 8px 32px', color:'var(--ink)', fontSize:13, boxSizing:'border-box', outline:'none' }}/>
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
    tabs:['نظرة عامة','الرحلات والتأشيرات','الفنادق','النقل البري'],
    newBooking:'حجز جديد',
    kpi:{ flights:'رحلات مؤكدة',flightsH:'٧٤٪ تغطية · أسعار شريك القطرية',
      rooms:'غرف محجوزة',roomsH:'٥ فنادق · ٩٢٪ موزعة',
      transfers:'نقل بري',transfersH:'أسطول VIP · ٢٤ مركبة',
      visas:'تأشيرات موافق عليها',visasH:'٨٨٫٦٪ موافقة · مزامنة الداخلية' },
    hayya:{ title:'طلبات تأشيرة هيّا',sub:'مزامنة مباشرة · آخر تحديث قبل دقيقتين',
      connected:'متصل · وزارة الداخلية',syncNow:'مزامنة',synced:'تمت ✓' },
    inbound:{ title:'وصول اليوم · مطار حمد',chip:'مباشر' },
    itinerary:'جدول الرحلة', viewPermit:'عرض التصريح →',
    cols:{ guest:'الضيف',flight:'الرحلة',flightType:'نوع الرحلة',flightClass:'الدرجة',route:'المسار',date:'التاريخ',
      status:'الحالة',hotel:'الفندق',room:'الغرفة',
      checkIn:'الوصول',checkOut:'المغادرة',nights:'الليالي',
      vehicle:'المركبة',driver:'السائق',pickup:'الاستلام',dropoff:'التوصيل',time:'الوقت' },
    statuses:{ approved:'موافق',submitted:'قيد المراجعة',pending:'قيد الانتظار',rejected:'مرفوض',
      confirmed:'مؤكد',scheduled:'مجدول',completed:'مكتمل' },
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
      'Flights','Hotel','Ground Transfers'],
    newBooking:'New booking',
    kpi:{ flights:'Flights confirmed',flightsH:'74% coverage · QR partner fares',
      rooms:'Hotel rooms blocked',roomsH:'5 properties · 92% allocated',
      transfers:'Ground transfers',transfersH:'VIP fleet · 24 vehicles on standby',
      visas:'Visas approved',visasH:'88.6% approved · MOI Qatar live sync' },
    hayya:{ title:'Hayya visa applications',sub:'Permit-to-Enter synced via Hayya gateway · Last refresh 2m ago',
      connected:'Connected · MOI Qatar',syncNow:'Sync now',synced:'Synced ✓' },
    inbound:{ title:'Arrivals today · Hamad International',chip:'Live · MOI sync' },
    itinerary:'Itinerary', viewPermit:'View permit →',
    cols:{ guest:'Guest',flight:'Flight',flightType:'Flight Type',flightClass:'Class',route:'Route',date:'Date',
      status:'Status',hotel:'Hotel',room:'Room',
      checkIn:'Check-in',checkOut:'Check-out',nights:'Nights',
      vehicle:'Vehicle',driver:'Driver',pickup:'Pickup',dropoff:'Drop-off',time:'Time' },
    statuses:{ approved:'Approved',submitted:'In review',pending:'Pending',rejected:'Rejected',
      confirmed:'Confirmed',scheduled:'Scheduled',completed:'Completed' },
    noResults:'No results',filterAll:'All',searchPh:'Search…',
    edit:'Edit',save:'Save',cancel:'Cancel',editFlight:'Edit flight details',
    editHotel:'Edit hotel booking',editTransfer:'Edit ground transfer',
    cancel2:'Cancel',newBookingTitle:'New Booking',
    selectGuest:'Select Guest',bookingDetails:'Booking Details',
    guestSearch:'Search guest…',back:'Back',next:'Next',
  };

  // ── Guests — only the "new booking" guest picker needs this list ───────────
  const [guests, setGuests] = useState([]);

  useEffect(() => {
    if (!activeEventId) { setGuests([]); return; }
    listGuests({ eventId: activeEventId, pageSize: 500, excludeDeclined: true })
      .then(res => setGuests(res?.items || []))
      .catch(() => setGuests([]));
  }, [activeEventId]);

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
    if (!activeEventId) return;
    setTabLoading(l => ({ ...l, [idx]: true }));
    try {
      const res = await TAB_SVC[idx](activeEventId);
      TAB_SET[idx]((res || []).map(TAB_MAP[idx]));
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
  function setEditField(patch) {
    setEditModal(m => ({ ...m, form: { ...m.form, ...(typeof patch === 'function' ? patch(m.form) : patch) } }));
  }
  async function saveEdit() {
    const { type, guestId, form } = editModal;
    const section = TYPE_TO_SECTION[type];
    setSavingEdit(true);
    try {
      const travelObj = { ...EMPTY_TRAVEL, [section]: { ...form, enabled: true } };
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
  const [arrivalDate, setArrivalDate] = useState('');
  const [departureDate, setDepartureDate] = useState('');

  function handleArrivalChange(v) {
    setArrivalDate(v);
    if (departureDate && v && departureDate < v) setDepartureDate('');
  }

  function openNewBooking() {
    setShowNewBooking(true); setBookStep(1);
    setBookGuest(''); setBookGuestId(''); setGuestSearch('');
    setTravel(EMPTY_TRAVEL);
    setArrivalDate(''); setDepartureDate('');
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

      // Arrival/Departure live on the Guest entity, not the travel tables — a
      // partial PUT would null out every other guest field, so send the full
      // guest object back with just these two overridden.
      if (arrivalDate || departureDate) {
        const g = guests.find(x => x.id === bookGuestId);
        if (g) {
          try {
            await updateGuest(g.id, {
              firstName: g.firstName, lastName: g.lastName, email: g.email || null,
              guestType: g.guestType, organization: g.organization || null,
              nationalityId: g.nationalityId || null, tier: g.tier,
              arrivalDate: arrivalDate || g.arrivalDate || null,
              departureDate: departureDate || g.departureDate || null,
              photoUrl: g.photoUrl || null,
              accreditationRequired: !!g.accreditationRequired,
              invitationTemplateId: g.invitationTemplateId || null,
              sessionIds: g.sessionIds || [],
            });
          } catch {
            toast.error(isAr ? 'تم إنشاء الحجز لكن تعذّر تحديث تواريخ الضيف' : 'Booking created, but the guest’s dates failed to update');
          }
        }
      }

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
  const filteredFlights = useMemo(() => flightRows.filter(r => {
    const s = !fSearch || r.name.toLowerCase().includes(fSearch.toLowerCase()) || r.flight.toLowerCase().includes(fSearch.toLowerCase());
    const f = fFlight === 'All' || r.flightStatus === fFlight;
    return s && f;
  }), [flightRows, fSearch, fFlight]);

  const filteredHotels = useMemo(() => hotelRows.filter(r => {
    const s = !hSearch || r.name.toLowerCase().includes(hSearch.toLowerCase()) || r.hotel.toLowerCase().includes(hSearch.toLowerCase());
    const h = hHotel === 'All hotels' || r.hotel === hHotel;
    return s && h;
  }), [hotelRows, hSearch, hHotel]);

  const filteredTransfers = useMemo(() => transferRows.filter(r => {
    const s = !tSearch || r.name.toLowerCase().includes(tSearch.toLowerCase()) || r.driver.toLowerCase().includes(tSearch.toLowerCase());
    const st = tStatus === 'All' || r.transferStatus === tStatus;
    return s && st;
  }), [transferRows, tSearch, tStatus]);

  const filteredGuests = guests
    .filter(g => !guestSearch || guestFullName(g).toLowerCase().includes(guestSearch.toLowerCase()))
    .slice(0, 6);


  // ── Styles ──────────────────────────────────────────────────────────────────
  const iSt = { width:'100%', background:'var(--surface-soft-3)', border:'1px solid var(--glass-border)', borderRadius:8, padding:'8px 11px', color:'var(--ink)', fontSize:13, boxSizing:'border-box', outline:'none' };
  const lSt = { display:'block', fontSize:10.5, color:'var(--ink-mute)', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:4 };

  const editBtn = (type, row) => (
    <button className="icon-btn" title={STR.edit} onClick={() => openEdit(type, row)} style={{ opacity:0.6 }}>
      <Icon name="edit" size={13}/>
    </button>
  );

  const nights = (r) => {
    try {
      const a = new Date(r.checkIn), b = new Date(r.checkOut);
      const d = Math.round((b - a) / 86400000);
      return isNaN(d) ? '—' : ad(d);
    } catch { return '—'; }
  };

  const grid2 = (children) => (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>{children}</div>
  );

  const flightStatusOpts = [
    { value: 'confirmed', label: isAr ? 'مؤكد' : 'Confirmed' },
    { value: 'pending', label: isAr ? 'قيد الانتظار' : 'Pending' },
  ];
  const tripStatusOpts = [
    { value: 'scheduled', label: isAr ? 'مجدول' : 'Scheduled' },
    { value: 'completed', label: isAr ? 'مكتمل' : 'Completed' },
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
          <div className="filter-bar" style={{ marginBottom:12 }}>
            <SearchInput value={fSearch} onChange={setFSearch} placeholder={STR.searchPh}/>
            <select className="select" value={fFlight} onChange={e => setFFlight(e.target.value)}>
              <option value="All">{isAr?'كل الرحلات':'All flights'}</option>
              {['confirmed','pending'].map(s => <option key={s} value={s}>{STR.statuses[s]}</option>)}
            </select>
          </div>
          <div className="card" style={{ padding:0 }}>
            <table className="table">
              <thead><tr>
                <th>{STR.cols.guest}</th><th>{STR.cols.flight}</th>
                <th>{STR.cols.flightType}</th><th>{STR.cols.flightClass}</th>
                <th>{STR.cols.route}</th><th>{STR.cols.date}</th>
                <th>{STR.cols.status}</th><th style={{ width:40 }}/>
              </tr></thead>
              <tbody>
                {filteredFlights.map(r => (
                  <tr key={r.id}>
                    <td>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <Avatar initials={r.initials} size={28} tier={r.tier}/>
                        <div>
                          <div style={{ fontSize:12.5, fontWeight:500 }}>{r.name}</div>
                          <div style={{ fontSize:11, color:'var(--ink-mute)' }}>{r.org}</div>
                        </div>
                      </div>
                    </td>
                    <td><span style={{ fontFamily:'var(--mono)', fontSize:12, fontWeight:600 }}>{r.flight}</span></td>
                    <td><span style={{ fontSize:12 }}>{r.flightType}</span></td>
                    <td><span style={{ fontSize:12 }}>{r.flightClass}</span></td>
                    <td><span style={{ fontFamily:'var(--mono)', fontSize:11, color:'var(--ink-mute)' }}>{r.from} → {r.to}</span></td>
                    <td><span style={{ fontFamily:'var(--mono)', fontSize:12 }}>{r.dateLabel || r.date}</span></td>
                    <td><StatusChip status={r.flightStatus} label={STR.statuses[r.flightStatus]}/></td>
                    <td>{editBtn('flight', r)}</td>
                  </tr>
                ))}
                {tabLoading[0] && <SkeletonRows cols={8} />}
                {!tabLoading[0] && filteredFlights.length === 0 && (
                  <tr><td colSpan={8} style={{ textAlign:'center', color:'var(--ink-faint)', padding:'32px', fontSize:13 }}>{STR.noResults}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Tab 2: Hotel ── */}
      {activeTab === 1 && (
        <div>
          <div className="filter-bar" style={{ marginBottom:12 }}>
            <SearchInput value={hSearch} onChange={setHSearch} placeholder={STR.searchPh}/>
            <select className="select" value={hHotel} onChange={e => setHHotel(e.target.value)}>
              <option value="All hotels">{isAr?'جميع الفنادق':'All hotels'}</option>
              {(travelLookups.hotels||[]).map(h => <option key={h.id} value={h.name}>{h.name}</option>)}
            </select>
          </div>
          <div className="card" style={{ padding:0 }}>
            <table className="table">
              <thead><tr>
                <th>{STR.cols.guest}</th><th>{STR.cols.hotel}</th>
                <th>{STR.cols.room}</th><th>{STR.cols.checkIn}</th>
                <th>{STR.cols.checkOut}</th><th>{STR.cols.nights}</th>
                <th style={{ width:40 }}/>
              </tr></thead>
              <tbody>
                {filteredHotels.map(r => (
                  <tr key={r.id}>
                    <td>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <Avatar initials={r.initials} size={28} tier={r.tier}/>
                        <div>
                          <div style={{ fontSize:12.5, fontWeight:500 }}>{r.name}</div>
                          <div style={{ fontSize:11, color:'var(--ink-mute)' }}>{r.org}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ fontSize:12, fontWeight:500 }}>{r.hotel}</td>
                    <td><span style={{ fontSize:12 }}>{r.roomType}</span></td>
                    <td><span style={{ fontFamily:'var(--mono)', fontSize:12 }}>{r.checkIn}</span></td>
                    <td><span style={{ fontFamily:'var(--mono)', fontSize:12 }}>{r.checkOut}</span></td>
                    <td><span style={{ fontFamily:'var(--mono)', fontSize:12, color:'var(--ink-mute)' }}>{nights(r)}</span></td>
                    <td>{editBtn('hotel', r)}</td>
                  </tr>
                ))}
                {tabLoading[1] && <SkeletonRows cols={7} />}
                {!tabLoading[1] && filteredHotels.length === 0 && (
                  <tr><td colSpan={7} style={{ textAlign:'center', color:'var(--ink-faint)', padding:'32px', fontSize:13 }}>{STR.noResults}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Tab 3: Ground Transfers ── */}
      {activeTab === 2 && (
        <div>
          <div className="filter-bar" style={{ marginBottom:12 }}>
            <SearchInput value={tSearch} onChange={setTSearch} placeholder={STR.searchPh}/>
            <select className="select" value={tStatus} onChange={e => setTStatus(e.target.value)}>
              <option value="All">{STR.filterAll}</option>
              {['scheduled','completed','pending'].map(s => <option key={s} value={s}>{STR.statuses[s]}</option>)}
            </select>
          </div>
          <div className="card" style={{ padding:0 }}>
            <table className="table">
              <thead><tr>
                <th>{STR.cols.guest}</th><th>{STR.cols.vehicle}</th>
                <th>{STR.cols.driver}</th><th>{STR.cols.pickup}</th>
                <th>{STR.cols.dropoff}</th><th>{STR.cols.date}</th>
                <th>{STR.cols.status}</th><th style={{ width:40 }}/>
              </tr></thead>
              <tbody>
                {filteredTransfers.map(r => (
                  <tr key={r.id}>
                    <td>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <Avatar initials={r.initials} size={28} tier={r.tier}/>
                        <span style={{ fontSize:12.5, fontWeight:500 }}>{r.name}</span>
                      </div>
                    </td>
                    <td>
                      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                        <Icon name="car" size={13} style={{ color:'var(--accent)', flexShrink:0 }}/>
                        <span style={{ fontSize:12 }}>{r.vehicle}</span>
                      </div>
                    </td>
                    <td style={{ fontSize:12 }}>{r.driver}</td>
                    <td style={{ fontSize:11, color:'var(--ink-mute)', maxWidth:130 }}>
                      <div style={{ whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{r.pickup}</div>
                    </td>
                    <td style={{ fontSize:11, color:'var(--ink-mute)', maxWidth:130 }}>
                      <div style={{ whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{r.dropoff}</div>
                    </td>
                    <td>
                      <div style={{ fontFamily:'var(--mono)', fontSize:11 }}>{r.dateLabel || r.date}</div>
                      <div style={{ fontFamily:'var(--mono)', fontSize:11, color:'var(--ink-mute)' }}>{ad(r.time)}</div>
                    </td>
                    <td><StatusChip status={r.transferStatus} label={STR.statuses[r.transferStatus]}/></td>
                    <td>{editBtn('transfer', r)}</td>
                  </tr>
                ))}
                {tabLoading[2] && <SkeletonRows cols={8} />}
                {!tabLoading[2] && filteredTransfers.length === 0 && (
                  <tr><td colSpan={8} style={{ textAlign:'center', color:'var(--ink-faint)', padding:'32px', fontSize:13 }}>{STR.noResults}</td></tr>
                )}
              </tbody>
            </table>
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
                      <div><label style={lSt}>{isAr ? 'رمز المغادرة' : 'Departure Code'}</label><input style={iSt} value={f.departureCode} onChange={e => set('departureCode', e.target.value)}/></div>
                      <div><label style={lSt}>{isAr ? 'مدينة المغادرة' : 'Departure City'}</label><input style={iSt} value={f.departureCity} onChange={e => set('departureCity', e.target.value)}/></div>
                    </>)}
                    {grid2(<>
                      <div><label style={lSt}>{isAr ? 'رمز الوصول' : 'Arrival Code'}</label><input style={iSt} value={f.arrivalCode} onChange={e => set('arrivalCode', e.target.value)}/></div>
                      <div><label style={lSt}>{isAr ? 'مدينة الوصول' : 'Arrival City'}</label><input style={iSt} value={f.arrivalCity} onChange={e => set('arrivalCity', e.target.value)}/></div>
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
                      <div><label style={lSt}>{isAr ? 'رقم الرحلة' : 'Flight No.'}</label><input style={iSt} value={f.flightNumber} onChange={e => set('flightNumber', e.target.value)}/></div>
                      <div><label style={lSt}>{isAr ? 'المقعد' : 'Seat'}</label><input style={iSt} value={f.seat} onChange={e => set('seat', e.target.value)}/></div>
                    </>)}
                    {grid2(<>
                      <div><label style={lSt}>{isAr ? 'وقت الإقلاع' : 'Departure Time'}</label>
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
                      <div><label style={lSt}>{STR.cols.checkIn}</label><DateField value={f.checkIn} onChange={v => set('checkIn', v||'')} minDate={dateWindowMin} maxDate={dateWindowMax} placeholder="YYYY-MM-DD"/></div>
                      <div><label style={lSt}>{STR.cols.checkOut}</label><DateField value={f.checkOut} onChange={v => set('checkOut', v||'')} minDate={f.checkIn || dateWindowMin} maxDate={dateWindowMax} placeholder="YYYY-MM-DD"/></div>
                    </>)}
                    {grid2(<>
                      <div><label style={lSt}>{isAr ? 'إطلالة الغرفة' : 'Room View'}</label><input style={iSt} value={f.roomView} onChange={e => set('roomView', e.target.value)}/></div>
                      <div><label style={lSt}>{isAr ? 'عدد النزلاء' : 'Guest Count'}</label><input type="number" style={iSt} value={f.guestCount} onChange={e => set('guestCount', e.target.value)}/></div>
                    </>)}
                    {grid2(<>
                      <div><label style={lSt}>{isAr ? 'اسم الكونسيرج' : 'Concierge Name'}</label><input style={iSt} value={f.conciergeName} onChange={e => set('conciergeName', e.target.value)}/></div>
                      <div><label style={lSt}>{isAr ? 'هاتف الكونسيرج' : 'Concierge Phone'}</label><input style={iSt} value={f.conciergePhone} onChange={e => set('conciergePhone', e.target.value)}/></div>
                    </>)}
                  </>
                );
              })()}

              {!editModal.loading && editModal.type === 'transfer' && (() => {
                const f = editModal.form;
                const set = (k, v) => setEditField({ [k]: v });
                return (
                  <>
                    {grid2(<>
                      <div><label style={lSt}>{isAr ? 'موقع الاستلام' : 'Pickup Location'}</label>
                        <Select value={f.pickupLocationId} onChange={v => set('pickupLocationId', v)} options={mapOpts(travelLookups.locations, x=>x.address)} placeholder={isAr?'— اختر —':'— Select —'} isClearable/>
                      </div>
                      <div><label style={lSt}>{isAr ? 'موقع التوصيل' : 'Dropoff Location'}</label>
                        <Select value={f.dropoffLocationId} onChange={v => set('dropoffLocationId', v)} options={mapOpts(travelLookups.locations, x=>x.address)} placeholder={isAr?'— اختر —':'— Select —'} isClearable/>
                      </div>
                    </>)}
                    {grid2(<>
                      <div><label style={lSt}>{isAr ? 'نوع المركبة' : 'Vehicle Type'}</label>
                        <Select value={f.vehicleTypeId} onChange={v => set('vehicleTypeId', v)} options={mapOpts(travelLookups.vehicleTypes, x=>x.name)} placeholder={isAr?'— اختر —':'— Select —'} isClearable/>
                      </div>
                      <div><label style={lSt}>{isAr ? 'رقم اللوحة' : 'Plate'}</label><input style={iSt} value={f.plate} onChange={e => set('plate', e.target.value)}/></div>
                    </>)}
                    {grid2(<>
                      <div><label style={lSt}>{isAr ? 'اسم السائق' : 'Driver Name'}</label><input style={iSt} value={f.driverName} onChange={e => set('driverName', e.target.value)}/></div>
                      <div><label style={lSt}>{isAr ? 'هاتف السائق' : 'Driver Phone'}</label><input style={iSt} value={f.driverPhone} onChange={e => set('driverPhone', e.target.value)}/></div>
                    </>)}
                    {grid2(<>
                      <div><label style={lSt}>{isAr ? 'تقييم السائق' : 'Driver Rating'}</label><input type="number" style={iSt} value={f.driverRating} onChange={e => set('driverRating', e.target.value)}/></div>
                      <div><label style={lSt}>{isAr ? 'حالة الرحلة' : 'Trip Status'}</label>
                        <Select value={f.tripStatus} onChange={v => set('tripStatus', v)} options={tripStatusOpts} placeholder={isAr?'— اختر —':'— Select —'}/>
                      </div>
                    </>)}
                    {grid2(<>
                      <div><label style={lSt}>{isAr ? 'وقت الاستلام' : 'Pickup Time'}</label><DateField value={f.pickupTime} onChange={v => set('pickupTime', v||'')} showTime minDate={dateWindowMin} maxDate={dateWindowMax} placeholder="YYYY-MM-DD HH:mm"/></div>
                      <div><label style={lSt}>{isAr ? 'الوصول المتوقع' : 'Est. Arrival'}</label><DateField value={f.estimatedArrival} onChange={v => set('estimatedArrival', v||'')} showTime minDate={f.pickupTime || dateWindowMin} maxDate={dateWindowMax} placeholder="YYYY-MM-DD HH:mm"/></div>
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
                  <div style={{ display:'flex', flexDirection:'column', gap:4, maxHeight:280, overflowY:'auto', marginTop:8 }}>
                    {filteredGuests.map(g => {
                      const fullName = guestFullName(g);
                      const selected = bookGuestId === g.id;
                      return (
                        <div key={g.id} onClick={() => {
                          setBookGuestId(g.id); setBookGuest(fullName);
                          setArrivalDate(g.arrivalDate || ''); setDepartureDate(g.departureDate || '');
                        }}
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
                    {filteredGuests.length === 0 && (
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
                  arrivalDate={arrivalDate}
                  departureDate={departureDate}
                  onArrivalDateChange={handleArrivalChange}
                  onDepartureDateChange={setDepartureDate}
                  dateMinDate={dateWindowMin}
                  dateMaxDate={dateWindowMax}
                  dateOpenTo={eventMinDate}
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
