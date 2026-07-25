import React, { useState, useRef, useMemo, useEffect } from 'react';
import { fmtNum, toArDigits } from '../i18n/translations.js';
import { Avatar } from '../components/UI.jsx';
import { Icon } from '../components/Icons.jsx';
import toast from '../lib/toast.js';
import { listGuests } from '../api/services/guestService.js';
import { createBooking, getEventFlights, getEventAccommodation, getEventTransport } from '../api/services/travelService.js';
import LocationPickerModal from '../components/ui/LocationPickerModal.jsx';

// ─── Static option lists for the edit / new-booking modals ───────────────────
// ponytail: hardcoded — replace with the room-type/hotel/vehicle lookup APIs
// when those modals move off placeholder options.
const ROOM_TYPES = ['Deluxe King','Executive Suite','Premier Room','Junior Suite','Club Room'];
const VEHICLES   = ['VIP Sedan','SUV','Minivan','Luxury Van'];
const HOTEL_LIST = ['Sheraton Grand','Mondrian Doha','Mandarin Oriental','St. Regis','Four Seasons'];

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
// Fields the DB doesn't carry (passport, visa/Hayya, room number, booking
// status for hotels) render as '—'; we don't fabricate them.
function mapFlight(r) {
  return {
    id: r.guestId,
    name: r.guestName || '—',
    initials: initialsFromName(r.guestName),
    tier: r.tier,
    org: r.organization,
    flight: r.flightNumber || '—',
    from: r.departureCode || '—',
    to: r.arrivalCode || '—',
    date: r.date ? r.date.slice(0, 10) : '',
    dateLabel: r.date ? dateLabelFor(r.date) : '—',
    passport: '—',
    hayyaStatus: '',
    flightStatus: (r.status || '').toLowerCase(),
  };
}

function mapHotel(r) {
  return {
    id: r.guestId,
    name: r.guestName || '—',
    initials: initialsFromName(r.guestName),
    tier: r.tier,
    org: r.organization,
    hotel: r.hotel || '—',
    roomType: r.roomType || '—',
    roomNumber: '—',
    checkIn: r.checkIn || '',
    checkOut: r.checkOut || '',
    hotelStatus: '',
  };
}

function mapTransfer(r) {
  return {
    id: r.guestId + '-T',
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
    title:['السفر','واللوجستيات'],
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
    cols:{ guest:'الضيف',flight:'الرحلة',route:'المسار',date:'التاريخ',hayya:'التأشيرة',
      passport:'الجواز',status:'الحالة',hotel:'الفندق',room:'الغرفة',
      checkIn:'الوصول',checkOut:'المغادرة',nights:'الليالي',
      vehicle:'المركبة',driver:'السائق',pickup:'الاستلام',dropoff:'التوصيل',time:'الوقت' },
    statuses:{ approved:'موافق',submitted:'قيد المراجعة',pending:'قيد الانتظار',rejected:'مرفوض',
      confirmed:'مؤكد',scheduled:'مجدول',completed:'مكتمل' },
    noResults:'لا توجد نتائج',filterAll:'الكل',searchPh:'بحث…',
    edit:'تعديل',save:'حفظ',cancel:'إلغاء',editFlight:'تعديل بيانات الرحلة',
    editHotel:'تعديل بيانات الفندق',editTransfer:'تعديل بيانات النقل',
    from:'من',to:'إلى',flightNum:'رقم الرحلة',passport:'رقم الجواز',
    hayyaStatus:'حالة التأشيرة',flightStatus:'حالة الرحلة',
    hotel:'الفندق',roomType:'نوع الغرفة',roomNum:'رقم الغرفة',
    hotelStatus:'حالة الحجز',vehicle:'المركبة',driver:'السائق',
    pickupLoc:'موقع الاستلام',dropoffLoc:'موقع التوصيل',transferStatus:'الحالة',
    cancel2:'إلغاء',newBookingTitle:'حجز جديد',
    selectGuest:'اختر الضيف',bookingDetails:'تفاصيل الحجز',
    bookingTypes:['رحلة جوية','فندق','نقل بري'],
    guestSearch:'بحث عن ضيف…',back:'السابق',next:'التالي',
  } : {
    title:['Travel &','logistics'],
    sub:'Flights, visa applications, hotels and ground transfers',
    tabs:[
      // 'Overview',
      'Flights & Visas','Hotel','Ground Transfers'],
    newBooking:'New booking',
    kpi:{ flights:'Flights confirmed',flightsH:'74% coverage · QR partner fares',
      rooms:'Hotel rooms blocked',roomsH:'5 properties · 92% allocated',
      transfers:'Ground transfers',transfersH:'VIP fleet · 24 vehicles on standby',
      visas:'Visas approved',visasH:'88.6% approved · MOI Qatar live sync' },
    hayya:{ title:'Hayya visa applications',sub:'Permit-to-Enter synced via Hayya gateway · Last refresh 2m ago',
      connected:'Connected · MOI Qatar',syncNow:'Sync now',synced:'Synced ✓' },
    inbound:{ title:'Arrivals today · Hamad International',chip:'Live · MOI sync' },
    itinerary:'Itinerary', viewPermit:'View permit →',
    cols:{ guest:'Guest',flight:'Flight',route:'Route',date:'Date',hayya:'Visa status',
      passport:'Passport',status:'Status',hotel:'Hotel',room:'Room',
      checkIn:'Check-in',checkOut:'Check-out',nights:'Nights',
      vehicle:'Vehicle',driver:'Driver',pickup:'Pickup',dropoff:'Drop-off',time:'Time' },
    statuses:{ approved:'Approved',submitted:'In review',pending:'Pending',rejected:'Rejected',
      confirmed:'Confirmed',scheduled:'Scheduled',completed:'Completed' },
    noResults:'No results',filterAll:'All',searchPh:'Search…',
    edit:'Edit',save:'Save',cancel:'Cancel',editFlight:'Edit flight details',
    editHotel:'Edit hotel booking',editTransfer:'Edit ground transfer',
    from:'From',to:'To',flightNum:'Flight number',passport:'Passport number',
    hayyaStatus:'Visa / Hayya status',flightStatus:'Booking status',
    hotel:'Hotel',roomType:'Room type',roomNum:'Room number',
    hotelStatus:'Booking status',vehicle:'Vehicle type',driver:'Driver',
    pickupLoc:'Pickup location',dropoffLoc:'Drop-off location',transferStatus:'Status',
    cancel2:'Cancel',newBookingTitle:'New Booking',
    selectGuest:'Select Guest',bookingDetails:'Booking Details',
    bookingTypes:['Flight','Hotel','Ground Transfer'],
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

  // ── Per-tab booking rows — each tab pulls from its own table via its own
  //    endpoint, lazily on first open, refetched when the active event changes.
  const [flightRows, setFlightRows]     = useState([]);
  const [hotelRows, setHotelRows]       = useState([]);
  const [transferRows, setTransferRows] = useState([]);
  const [tabLoading, setTabLoading]     = useState({ 0: false, 1: false, 2: false });
  const loadedRef = useRef({ 0: null, 1: null, 2: null }); // tab -> eventId already loaded

  // ── UI state ────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState(0);
  const [synced, setSynced]       = useState(false);
  const syncTimerRef              = useRef(null);

  // Fetch the active tab's rows the first time it's shown for this event.
  useEffect(() => {
    if (!activeEventId) {
      setFlightRows([]); setHotelRows([]); setTransferRows([]);
      loadedRef.current = { 0: null, 1: null, 2: null };
      return;
    }
    if (loadedRef.current[activeTab] === activeEventId) return; // already loaded
    const svc     = [getEventFlights, getEventAccommodation, getEventTransport][activeTab];
    const setRows = [setFlightRows, setHotelRows, setTransferRows][activeTab];
    const map     = [mapFlight, mapHotel, mapTransfer][activeTab];
    setTabLoading(l => ({ ...l, [activeTab]: true }));
    svc(activeEventId)
      .then(res => { loadedRef.current[activeTab] = activeEventId; setRows((res || []).map(map)); })
      .catch(err => { toast.fromError(err); setRows([]); })
      .finally(() => setTabLoading(l => ({ ...l, [activeTab]: false })));
  }, [activeTab, activeEventId]);

  const [fSearch, setFSearch]         = useState('');
  const [fHayya, setFHayya]           = useState('All');
  const [fFlight, setFFlight]         = useState('All');
  const [hSearch, setHSearch]         = useState('');
  const [hHotel, setHHotel]           = useState('All hotels');
  const [hStatus, setHStatus]         = useState('All');
  const [tSearch, setTSearch]         = useState('');
  const [tStatus, setTStatus]         = useState('All');

  // ── Edit modal ──────────────────────────────────────────────────────────────
  const [editModal, setEditModal] = useState(null); // { type, id, form }

  function openEdit(type, row) {
    setEditModal({ type, id: row.id, form: { ...row } });
  }
  function closeEdit() { setEditModal(null); }
  function setForm(patch) {
    setEditModal(m => ({ ...m, form: { ...m.form, ...(typeof patch === 'function' ? patch(m.form) : patch) } }));
  }
  function saveEdit() {
    const { type, id, form } = editModal;
    if (type === 'flight')   setFlightRows(rows   => rows.map(r => r.id === id ? { ...r, ...form } : r));
    if (type === 'hotel')    setHotelRows(rows    => rows.map(r => r.id === id ? { ...r, ...form } : r));
    if (type === 'transfer') setTransferRows(rows => rows.map(r => r.id === id ? { ...r, ...form } : r));
    closeEdit();
  }

  // ── New booking modal ───────────────────────────────────────────────────────
  const [showNewBooking, setShowNewBooking] = useState(false);
  const [bookStep, setBookStep] = useState(1);
  const [bookType, setBookType] = useState(0);
  const [bookGuest, setBookGuest] = useState('');
  const [bookGuestId, setBookGuestId] = useState('');
  const [guestSearch, setGuestSearch] = useState('');
  const [bookings, setBookings] = useState([]);
  const [savingBooking, setSavingBooking] = useState(false);
  const [flightData, setFlightData] = useState({ flightNum:'QR512',from:'DOH',to:'LHR',date:'2025-12-09' });
  const [hotelData, setHotelData]   = useState({ hotel:'Sheraton Grand',checkIn:'2025-12-06',checkOut:'2025-12-10',roomType:'Deluxe King' });
  // pickup/dropoff hold { id, label } once picked on the map — null until then.
  const [transferData, setTransferData] = useState({ vehicle:'VIP Sedan',driver:'',pickup:null,dropoff:null });
  const [showLocationPicker, setShowLocationPicker] = useState(null); // 'pickup' | 'dropoff' | null

  function openNewBooking() {
    setShowNewBooking(true); setBookStep(1); setBookType(0);
    setBookGuest(''); setBookGuestId(''); setGuestSearch('');
    setFlightData({ flightNum:'QR512',from:'DOH',to:'LHR',date:'2025-12-09' });
    setHotelData({ hotel:'Sheraton Grand',checkIn:'2025-12-06',checkOut:'2025-12-10',roomType:'Deluxe King' });
    setTransferData({ vehicle:'VIP Sedan',driver:'',pickup:null,dropoff:null });
  }

  async function saveBooking() {
    if (!activeEventId || !bookGuestId) return;
    const base = { eventId: activeEventId, guestId: bookGuestId };
    // bookType: 0 = Flight, 1 = Hotel, 2 = Ground Transfer — matches the
    // backend's Core.Constants.BookingTypes string values.
    const payload = bookType === 0 ? {
      ...base, bookingType: 'flight',
      flightNumber: flightData.flightNum, flightDate: flightData.date,
      flightDeparture: flightData.from, flightArrival: flightData.to,
    } : bookType === 1 ? {
      ...base, bookingType: 'hotel',
      hotelCheckIn: hotelData.checkIn, hotelCheckOut: hotelData.checkOut, roomType: hotelData.roomType,
      // NOTE: hotelData.hotel is just a display name — the backend expects a
      // real HotelId and there's no hotel lookup/endpoint yet, so it isn't sent.
    } : {
      ...base, bookingType: 'byRoad',
      vehicleType: transferData.vehicle, driverName: transferData.driver,
      pickupLocationId: transferData.pickup?.id || null,
      dropoffLocationId: transferData.dropoff?.id || null,
    };

    setSavingBooking(true);
    try {
      await createBooking(payload);
      setBookings(prev => [...prev, { guest: bookGuest, type: STR.bookingTypes[bookType] }]);
      setShowNewBooking(false); setBookStep(1); setBookGuest(''); setBookGuestId(''); setGuestSearch('');
      toast.success(isAr ? 'تم إنشاء الحجز بنجاح' : 'Booking created successfully');
    } catch (err) {
      toast.fromError(err, isAr ? 'حدث خطأ أثناء إنشاء الحجز' : 'Error creating booking');
    } finally {
      setSavingBooking(false);
    }
  }

  // ── Sync ────────────────────────────────────────────────────────────────────
  function handleSync() {
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    setSynced(true);
    syncTimerRef.current = setTimeout(() => setSynced(false), 2500);
  }

  // ── Filtered data ───────────────────────────────────────────────────────────
  const filteredFlights = useMemo(() => flightRows.filter(r => {
    const s = !fSearch || r.name.toLowerCase().includes(fSearch.toLowerCase()) || r.flight.toLowerCase().includes(fSearch.toLowerCase());
    const h = fHayya === 'All' || r.hayyaStatus === fHayya;
    const f = fFlight === 'All' || r.flightStatus === fFlight;
    return s && h && f;
  }), [flightRows, fSearch, fHayya, fFlight]);

  const filteredHotels = useMemo(() => hotelRows.filter(r => {
    const s = !hSearch || r.name.toLowerCase().includes(hSearch.toLowerCase()) || r.hotel.toLowerCase().includes(hSearch.toLowerCase());
    const h = hHotel === 'All hotels' || r.hotel === hHotel;
    const st = hStatus === 'All' || r.hotelStatus === hStatus;
    return s && h && st;
  }), [hotelRows, hSearch, hHotel, hStatus]);

  const filteredTransfers = useMemo(() => transferRows.filter(r => {
    const s = !tSearch || r.name.toLowerCase().includes(tSearch.toLowerCase()) || r.driver.toLowerCase().includes(tSearch.toLowerCase());
    const st = tStatus === 'All' || r.transferStatus === tStatus;
    return s && st;
  }), [transferRows, tSearch, tStatus]);

  const filteredGuests = guests
    .filter(g => !guestSearch || guestFullName(g).toLowerCase().includes(guestSearch.toLowerCase()))
    .slice(0, 6);

  const hayyaCounts = {
    approved: flightRows.filter(f=>f.hayyaStatus==='approved').length,
    submitted: flightRows.filter(f=>f.hayyaStatus==='submitted').length,
    pending: flightRows.filter(f=>f.hayyaStatus==='pending').length,
    rejected: flightRows.filter(f=>f.hayyaStatus==='rejected').length,
  };

  // ── Styles ──────────────────────────────────────────────────────────────────
  const iSt = { width:'100%', background:'var(--surface-soft-3)', border:'1px solid var(--glass-border)', borderRadius:8, padding:'8px 11px', color:'var(--ink)', fontSize:13, boxSizing:'border-box', outline:'none' };
  const lSt = { display:'block', fontSize:10.5, color:'var(--ink-mute)', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:4 };
  const selSt = { ...iSt, appearance:'none', backgroundImage:"url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12' fill='none' stroke='%23718fa3' stroke-width='1.6'%3E%3Cpath d='M2 4l4 4 4-4'/%3E%3C/svg%3E\")", backgroundRepeat:'no-repeat', backgroundPosition:'right 10px center', paddingRight:28 };

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
          { icon:'hotel',  val:fmtN(hotelRows.filter(h=>h.hotelStatus==='confirmed').length), label:STR.kpi.rooms,     help:STR.kpi.roomsH,     tab:1 },
          { icon:'car',    val:fmtN(transferRows.length),   label:STR.kpi.transfers,  help:STR.kpi.transfersH, tab:2 },
          // { icon:'badge',  val:fmtN(hayyaCounts.approved), label:STR.kpi.visas, help:STR.kpi.visasH, tab:1 },
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

      {/* ── Tab 1: Flights & Visas ── */}
      {activeTab === 0 && (
        <div>
          <div style={{ display:'flex', gap:8, marginBottom:14, flexWrap:'wrap', alignItems:'center' }}>
            <span style={{ fontSize:11, color:'var(--ink-mute)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.08em', marginRight:4 }}>Visa</span>
            {Object.entries(hayyaCounts).map(([k, count]) => (
              <span key={k} className={`chip${fHayya===k?' active':''}`}
                style={{ borderColor:STATUS_COLOR[k], color:STATUS_COLOR[k], cursor:'pointer' }}
                onClick={() => setFHayya(f => f===k?'All':k)}>
                <span className="dot" style={{ background:STATUS_COLOR[k] }}/>
                {STR.statuses[k]} <strong style={{ marginLeft:3 }}>{fmtN(count)}</strong>
              </span>
            ))}
            <button className="btn ghost" style={{ padding:'4px 10px', fontSize:11, marginLeft:'auto', flexShrink:0 }} onClick={handleSync}>
              <Icon name={synced?'check':'refresh'} size={12}/> {synced?STR.hayya.synced:STR.hayya.syncNow}
            </button>
          </div>
          <div className="filter-bar" style={{ marginBottom:12 }}>
            <SearchInput value={fSearch} onChange={setFSearch} placeholder={STR.searchPh}/>
            <select className="select" value={fHayya} onChange={e => setFHayya(e.target.value)}>
              <option value="All">{STR.filterAll}</option>
              {['approved','submitted','pending','rejected'].map(s => <option key={s} value={s}>{STR.statuses[s]}</option>)}
            </select>
            <select className="select" value={fFlight} onChange={e => setFFlight(e.target.value)}>
              <option value="All">{isAr?'كل الرحلات':'All flights'}</option>
              {['confirmed','pending'].map(s => <option key={s} value={s}>{STR.statuses[s]}</option>)}
            </select>
          </div>
          <div className="card" style={{ padding:0 }}>
            <table className="table">
              <thead><tr>
                <th>{STR.cols.guest}</th><th>{STR.cols.flight}</th>
                <th>{STR.cols.route}</th><th>{STR.cols.date}</th>
                <th>{STR.cols.passport}</th><th>{STR.cols.hayya}</th>
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
                    <td><span style={{ fontFamily:'var(--mono)', fontSize:11, color:'var(--ink-mute)' }}>{r.from} → {r.to}</span></td>
                    <td><span style={{ fontFamily:'var(--mono)', fontSize:12 }}>{r.dateLabel || r.date}</span></td>
                    <td><span style={{ fontFamily:'var(--mono)', fontSize:11, color:'var(--ink-mute)' }}>{r.passport}</span></td>
                    <td><StatusChip status={r.hayyaStatus} label={STR.statuses[r.hayyaStatus]}/></td>
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
              {HOTEL_LIST.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
            <select className="select" value={hStatus} onChange={e => setHStatus(e.target.value)}>
              <option value="All">{STR.filterAll}</option>
              {['confirmed','pending'].map(s => <option key={s} value={s}>{STR.statuses[s]}</option>)}
            </select>
          </div>
          <div className="card" style={{ padding:0 }}>
            <table className="table">
              <thead><tr>
                <th>{STR.cols.guest}</th><th>{STR.cols.hotel}</th>
                <th>{STR.cols.room}</th><th>{STR.cols.checkIn}</th>
                <th>{STR.cols.checkOut}</th><th>{STR.cols.nights}</th>
                <th>{STR.cols.status}</th><th style={{ width:40 }}/>
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
                    <td>
                      <div style={{ fontSize:12 }}>{r.roomType}</div>
                      <div style={{ fontSize:11, color:'var(--ink-mute)', fontFamily:'var(--mono)' }}>{isAr?`غرفة ${ad(r.roomNumber)}`:`Room ${r.roomNumber}`}</div>
                    </td>
                    <td><span style={{ fontFamily:'var(--mono)', fontSize:12 }}>{r.checkIn}</span></td>
                    <td><span style={{ fontFamily:'var(--mono)', fontSize:12 }}>{r.checkOut}</span></td>
                    <td><span style={{ fontFamily:'var(--mono)', fontSize:12, color:'var(--ink-mute)' }}>{nights(r)}</span></td>
                    <td><StatusChip status={r.hotelStatus} label={STR.statuses[r.hotelStatus]}/></td>
                    <td>{editBtn('hotel', r)}</td>
                  </tr>
                ))}
                {tabLoading[1] && <SkeletonRows cols={8} />}
                {!tabLoading[1] && filteredHotels.length === 0 && (
                  <tr><td colSpan={8} style={{ textAlign:'center', color:'var(--ink-faint)', padding:'32px', fontSize:13 }}>{STR.noResults}</td></tr>
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

      {/* ── Edit Modal ── */}
      {editModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}>
          <div className="card glass" style={{ width:440, maxWidth:'92vw', padding:0, maxHeight:'85vh', display:'flex', flexDirection:'column' }}>
            {/* Header */}
            <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--glass-border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div>
                <div style={{ fontWeight:600, fontSize:14 }}>
                  {editModal.type==='flight' ? STR.editFlight : editModal.type==='hotel' ? STR.editHotel : STR.editTransfer}
                </div>
                <div style={{ fontSize:11, color:'var(--ink-mute)', marginTop:2 }}>{editModal.form.name}</div>
              </div>
              <button className="icon-btn" onClick={closeEdit}><Icon name="close" size={14}/></button>
            </div>

            {/* Body */}
            <div style={{ padding:'18px 20px', overflowY:'auto', flex:1, display:'flex', flexDirection:'column', gap:14 }}>

              {/* Flight edit form */}
              {editModal.type === 'flight' && (
                <>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                    <div>
                      <label style={lSt}>{STR.flightNum}</label>
                      <input style={iSt} value={editModal.form.flight} onChange={e => setForm({ flight:e.target.value })}/>
                    </div>
                    <div>
                      <label style={lSt}>{STR.passport}</label>
                      <input style={iSt} value={editModal.form.passport} onChange={e => setForm({ passport:e.target.value })}/>
                    </div>
                    <div>
                      <label style={lSt}>{STR.from}</label>
                      <input style={iSt} value={editModal.form.from} onChange={e => setForm({ from:e.target.value })}/>
                    </div>
                    <div>
                      <label style={lSt}>{STR.to}</label>
                      <input style={iSt} value={editModal.form.to} onChange={e => setForm({ to:e.target.value })}/>
                    </div>
                  </div>
                  <div>
                    <label style={lSt}>{STR.cols.date}</label>
                    <input type="date" style={iSt} value={editModal.form.date} onChange={e => setForm({ date:e.target.value, dateLabel: new Date(e.target.value).toLocaleDateString('en-US',{month:'short',day:'numeric'}) })}/>
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                    <div>
                      <label style={lSt}>{STR.hayyaStatus}</label>
                      <select style={selSt} value={editModal.form.hayyaStatus} onChange={e => setForm({ hayyaStatus:e.target.value })}>
                        {['approved','submitted','pending','rejected'].map(s => <option key={s} value={s}>{STR.statuses[s]}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={lSt}>{STR.flightStatus}</label>
                      <select style={selSt} value={editModal.form.flightStatus} onChange={e => setForm({ flightStatus:e.target.value })}>
                        {['confirmed','pending'].map(s => <option key={s} value={s}>{STR.statuses[s]}</option>)}
                      </select>
                    </div>
                  </div>
                </>
              )}

              {/* Hotel edit form */}
              {editModal.type === 'hotel' && (
                <>
                  <div>
                    <label style={lSt}>{STR.hotel}</label>
                    <select style={selSt} value={editModal.form.hotel} onChange={e => setForm({ hotel:e.target.value })}>
                      {HOTEL_LIST.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                    <div>
                      <label style={lSt}>{STR.roomType}</label>
                      <select style={selSt} value={editModal.form.roomType} onChange={e => setForm({ roomType:e.target.value })}>
                        {ROOM_TYPES.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={lSt}>{STR.roomNum}</label>
                      <input style={iSt} value={editModal.form.roomNumber} onChange={e => setForm({ roomNumber:e.target.value })}/>
                    </div>
                    <div>
                      <label style={lSt}>{STR.cols.checkIn}</label>
                      <input type="date" style={iSt} value={editModal.form.checkIn} onChange={e => setForm({ checkIn:e.target.value })}/>
                    </div>
                    <div>
                      <label style={lSt}>{STR.cols.checkOut}</label>
                      <input type="date" style={iSt} value={editModal.form.checkOut} onChange={e => setForm({ checkOut:e.target.value })}/>
                    </div>
                  </div>
                  <div>
                    <label style={lSt}>{STR.hotelStatus}</label>
                    <select style={selSt} value={editModal.form.hotelStatus} onChange={e => setForm({ hotelStatus:e.target.value })}>
                      {['confirmed','pending'].map(s => <option key={s} value={s}>{STR.statuses[s]}</option>)}
                    </select>
                  </div>
                </>
              )}

              {/* Transfer edit form */}
              {editModal.type === 'transfer' && (
                <>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                    <div>
                      <label style={lSt}>{STR.vehicle}</label>
                      <select style={selSt} value={editModal.form.vehicle} onChange={e => setForm({ vehicle:e.target.value })}>
                        {VEHICLES.map(v => <option key={v} value={v}>{v}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={lSt}>{STR.driver}</label>
                      <input style={iSt} value={editModal.form.driver} onChange={e => setForm({ driver:e.target.value })}/>
                    </div>
                  </div>
                  <div>
                    <label style={lSt}>{STR.pickupLoc}</label>
                    <input style={iSt} value={editModal.form.pickup} onChange={e => setForm({ pickup:e.target.value })}/>
                  </div>
                  <div>
                    <label style={lSt}>{STR.dropoffLoc}</label>
                    <input style={iSt} value={editModal.form.dropoff} onChange={e => setForm({ dropoff:e.target.value })}/>
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                    <div>
                      <label style={lSt}>{STR.cols.date}</label>
                      <input type="date" style={iSt} value={editModal.form.date} onChange={e => setForm({ date:e.target.value, dateLabel: new Date(e.target.value).toLocaleDateString('en-US',{month:'short',day:'numeric'}) })}/>
                    </div>
                    <div>
                      <label style={lSt}>{STR.cols.time}</label>
                      <input type="time" style={iSt} value={editModal.form.time} onChange={e => setForm({ time:e.target.value })}/>
                    </div>
                  </div>
                  <div>
                    <label style={lSt}>{STR.transferStatus}</label>
                    <select style={selSt} value={editModal.form.transferStatus} onChange={e => setForm({ transferStatus:e.target.value })}>
                      {['scheduled','completed','pending'].map(s => <option key={s} value={s}>{STR.statuses[s]}</option>)}
                    </select>
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div style={{ padding:'12px 20px', borderTop:'1px solid var(--glass-border)', display:'flex', gap:8, justifyContent:'flex-end' }}>
              <button className="btn" onClick={closeEdit}>{STR.cancel}</button>
              <button className="btn primary" onClick={saveEdit}>
                <Icon name="check" size={13}/> {STR.save}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── New Booking Modal ── */}
      {showNewBooking && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}>
          <div className="card glass" style={{ width:500, maxWidth:'90vw', padding:0, maxHeight:'85vh', display:'flex', flexDirection:'column' }}>
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
                <>
                  <div>
                    <label style={lSt}>{isAr?'نوع الحجز':'Booking type'}</label>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
                      {[{icon:'flight',label:STR.bookingTypes[0]},{icon:'hotel',label:STR.bookingTypes[1]},{icon:'car',label:STR.bookingTypes[2]}].map((bt, i) => (
                        <div key={i} onClick={() => setBookType(i)}
                          style={{ padding:'12px 10px', borderRadius:10, cursor:'pointer', textAlign:'center',
                            border:`1px solid ${bookType===i?'var(--accent)':'var(--glass-border)'}`,
                            background:bookType===i?'rgba(141, 1, 52,0.12)':'var(--surface-soft-2)' }}>
                          <Icon name={bt.icon} size={18} style={{ color:bookType===i?'var(--accent)':'var(--ink-mute)', display:'block', margin:'0 auto 6px' }}/>
                          <div style={{ fontSize:12, fontWeight:bookType===i?600:400 }}>{bt.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label style={lSt}>{isAr?'الضيف':'Guest'}</label>
                    <input placeholder={STR.guestSearch} value={guestSearch} onChange={e => setGuestSearch(e.target.value)} style={iSt}/>
                    <div style={{ display:'flex', flexDirection:'column', gap:4, maxHeight:200, overflowY:'auto', marginTop:8 }}>
                      {filteredGuests.map(g => {
                        const fullName = guestFullName(g);
                        const selected = bookGuestId === g.id;
                        return (
                          <div key={g.id} onClick={() => { setBookGuestId(g.id); setBookGuest(fullName); }}
                            style={{ padding:'8px 12px', borderRadius:8, cursor:'pointer', display:'flex', alignItems:'center', gap:10,
                              border:`1px solid ${selected?'var(--accent)':'var(--glass-border)'}`,
                              background:selected?'rgba(141, 1, 52,0.12)':'var(--surface-soft-2)' }}>
                            <Avatar initials={initialsFromName(fullName)} size={28} tier={g.tier}/>
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
                </>
              )}

              {bookStep === 2 && bookType === 0 && (
                <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                    <div><label style={lSt}>{STR.flightNum}</label><input style={iSt} value={flightData.flightNum} onChange={e => setFlightData(d=>({...d,flightNum:e.target.value}))}/></div>
                    <div><label style={lSt}>{STR.cols.date}</label><input type="date" style={iSt} value={flightData.date} onChange={e => setFlightData(d=>({...d,date:e.target.value}))}/></div>
                    <div><label style={lSt}>{STR.from}</label><input style={iSt} value={flightData.from} onChange={e => setFlightData(d=>({...d,from:e.target.value}))}/></div>
                    <div><label style={lSt}>{STR.to}</label><input style={iSt} value={flightData.to} onChange={e => setFlightData(d=>({...d,to:e.target.value}))}/></div>
                  </div>
                </div>
              )}

              {bookStep === 2 && bookType === 1 && (
                <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                  <div><label style={lSt}>{STR.hotel}</label>
                    <select style={selSt} value={hotelData.hotel} onChange={e => setHotelData(d=>({...d,hotel:e.target.value}))}>
                      {HOTEL_LIST.map(h=><option key={h}>{h}</option>)}
                    </select>
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                    <div><label style={lSt}>{STR.cols.checkIn}</label><input type="date" style={iSt} value={hotelData.checkIn} onChange={e => setHotelData(d=>({...d,checkIn:e.target.value}))}/></div>
                    <div><label style={lSt}>{STR.cols.checkOut}</label><input type="date" style={iSt} value={hotelData.checkOut} onChange={e => setHotelData(d=>({...d,checkOut:e.target.value}))}/></div>
                  </div>
                  <div><label style={lSt}>{STR.roomType}</label>
                    <select style={selSt} value={hotelData.roomType} onChange={e => setHotelData(d=>({...d,roomType:e.target.value}))}>
                      {ROOM_TYPES.map(r=><option key={r}>{r}</option>)}
                    </select>
                  </div>
                </div>
              )}

              {bookStep === 2 && bookType === 2 && (
                <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                  <div><label style={lSt}>{STR.vehicle}</label>
                    <select style={selSt} value={transferData.vehicle} onChange={e => setTransferData(d=>({...d,vehicle:e.target.value}))}>
                      {VEHICLES.map(v=><option key={v}>{v}</option>)}
                    </select>
                  </div>
                  <div><label style={lSt}>{STR.driver}</label><input style={iSt} value={transferData.driver} onChange={e => setTransferData(d=>({...d,driver:e.target.value}))}/></div>
                  <div>
                    <label style={lSt}>{STR.pickupLoc}</label>
                    <button type="button" onClick={() => setShowLocationPicker('pickup')}
                      style={{ ...iSt, textAlign:'left', cursor:'pointer', display:'flex', alignItems:'center', gap:8, color: transferData.pickup ? 'var(--ink)' : 'var(--ink-mute)' }}>
                      <Icon name="venue" size={13} style={{ color:'var(--accent)', flexShrink:0 }}/>
                      {transferData.pickup?.label || (isAr ? 'اختر على الخريطة…' : 'Pick on map…')}
                    </button>
                  </div>
                  <div>
                    <label style={lSt}>{STR.dropoffLoc}</label>
                    <button type="button" onClick={() => setShowLocationPicker('dropoff')}
                      style={{ ...iSt, textAlign:'left', cursor:'pointer', display:'flex', alignItems:'center', gap:8, color: transferData.dropoff ? 'var(--ink)' : 'var(--ink-mute)' }}>
                      <Icon name="venue" size={13} style={{ color:'var(--accent)', flexShrink:0 }}/>
                      {transferData.dropoff?.label || (isAr ? 'اختر على الخريطة…' : 'Pick on map…')}
                    </button>
                  </div>
                </div>
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

      <LocationPickerModal
        open={!!showLocationPicker}
        onClose={() => setShowLocationPicker(null)}
        lang={lang}
        onSelect={(loc) => setTransferData(d => ({ ...d, [showLocationPicker]: loc }))}
      />
    </div>
  );
}