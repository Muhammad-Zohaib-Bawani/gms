import React, { useState, useEffect, useRef } from 'react';
import { fmtNum, toArDigits } from '../i18n/translations.js';
import { Avatar } from '../components/UI.jsx';
import { GUESTS } from '../data/mockData.js';
import { Icon } from '../components/Icons.jsx';

export default function TravelView({ lang }) {
  const isAr = lang === 'ar';
  const fmtN = n => fmtNum(n, lang);
  const ad = s => isAr ? toArDigits(s) : s;
  const dateAr = s => {
    if (!isAr) return s;
    const months = { Dec:'ديسمبر', Nov:'نوفمبر', Jan:'يناير', Feb:'فبراير' };
    const m = s.match(/(\w+)\s+(\d+)/);
    if (!m) return s;
    return `${toArDigits(m[2])} ${months[m[1]] || m[1]}`;
  };

  const STR = isAr ? {
    title: ['السفر', 'واللوجستيات'],
    sub: 'بيانات الرحلات والفنادق والنقل البري · تكامل تأشيرة هيّا',
    filter: 'تصفية', newBooking: 'حجز جديد',
    flightsConfirmed: 'رحلات مؤكدة', flightsHelp: 'تغطية ٧٤٪ · أسعار شريك القطرية',
    roomsBlocked: 'غرف محجوزة', roomsHelp: '٥ فنادق · ٩٢٪ موزعة',
    transfers: 'نقل بري', transfersHelp: 'أسطول VIP · ٢٤ مركبة جاهزة',
    hayyaVisas: 'تأشيرات', hayyaVisasOf: '/ ١٬٢٨٤', hayyaHelp: '٨٨٫٦٪ موافقة · مزامنة مباشرة مع الداخلية',
    hayyaTitle: 'طلبات تأشيرة',
    hayyaSub: 'طلبات تصريح الدخول مزامنة عبر بوابة هيّا · آخر تحديث قبل دقيقتين',
    connected: 'متصل · وزارة الداخلية القطرية',
    syncNow: 'مزامنة الآن', synced: 'تمت المزامنة ✓',
    export: 'تصدير', bulkSubmit: 'تقديم جماعي',
    statuses: { approved:'موافق', submitted:'قيد المراجعة', pending:'بانتظار المستندات', rejected:'يحتاج إجراء' },
    statusesShort: { approved:'موافق', submitted:'مراجعة', pending:'مستندات', rejected:'مرفوض' },
    cols: { guest:'الضيف', passport:'جواز', hayyaStatus:'حالة هيّا', submitted:'قُدِم' },
    pendingShort: 'قيد الانتظار',
    inboundTitle: 'وصول اليوم · مطار حمد الدولي',
    inboundChip: 'مباشر · مزامنة الداخلية',
    inboundCols: { flight:'الرحلة', eta:'الوصول', hayya:'هيّا', driver:'السائق' },
    itineraryTitle: 'جدول الرحلة',
    permitApproved: 'تصريح هيّا · موافق',
    viewPermit: 'عرض التصريح →',
    newBookingTitle: 'حجز جديد',
    cancel: 'إلغاء', save: 'حفظ الحجز', back: 'السابق', next: 'التالي',
    bookingTypes: ['رحلة جوية', 'فندق', 'نقل بري'],
    selectGuest: 'اختر الضيف', bookingDetails: 'تفاصيل الحجز',
    guestSearch: 'بحث عن ضيف…',
    flightNum:'رقم الرحلة', origin:'من', destination:'إلى', depDate:'تاريخ المغادرة', arrDate:'تاريخ الوصول',
    hotel:'الفندق', checkIn:'تسجيل الدخول', checkOut:'تسجيل الخروج', roomType:'نوع الغرفة',
    carType:'نوع السيارة', pickupLoc:'موقع الاستقبال', dropoffLoc:'موقع التوصيل',
    filterTitle: 'تصفية النتائج', filterStatus: 'الحالة', filterHotel: 'الفندق',
    allStatuses: 'جميع الحالات', allHotels: 'جميع الفنادق',
    applyFilter: 'تطبيق', resetFilter: 'إعادة تعيين', closeFilter: 'إغلاق',
  } : {
    title: ['Travel &', 'logistics'],
    sub: 'Real-time flight, hotel, ground transport · Hayya visa integration',
    filter: 'Filter', newBooking: 'New booking',
    flightsConfirmed: 'Flights confirmed', flightsHelp: '74% coverage · QR partner fares',
    roomsBlocked: 'Hotel rooms blocked', roomsHelp: '5 properties · 92% allocated',
    transfers: 'Ground transfers', transfersHelp: 'VIP fleet · 24 vehicles on standby',
    hayyaVisas: 'visas', hayyaVisasOf: '/ 1,284', hayyaHelp: '88.6% approved · MOI Qatar live sync',
    hayyaTitle: 'visa applications',
    hayyaSub: 'Permit-to-Enter applications synced via Hayya gateway · Last refresh 2m ago',
    connected: 'Connected · MOI Qatar',
    syncNow: 'Sync now', synced: 'Synced ✓',
    export: 'Export', bulkSubmit: 'Bulk submit',
    statuses: { approved:'Approved', submitted:'Under review', pending:'Awaiting documents', rejected:'Action required' },
    statusesShort: { approved:'Approved', submitted:'In review', pending:'Documents', rejected:'Rejected' },
    cols: { guest:'Guest', passport:'Passport', hayyaStatus:'Hayya status', submitted:'Submitted' },
    pendingShort: 'Pending',
    inboundTitle: 'Arrivals today · Hamad International',
    inboundChip: 'Live · MOI sync',
    inboundCols: { flight:'Flight', eta:'ETA', hayya:'Hayya', driver:'Driver' },
    itineraryTitle: 'Itinerary',
    permitApproved: 'Hayya permit · Approved',
    viewPermit: 'View permit →',
    newBookingTitle: 'New Booking',
    cancel: 'Cancel', save: 'Save Booking', back: 'Back', next: 'Next',
    bookingTypes: ['Flight', 'Hotel', 'Ground Transfer'],
    selectGuest: 'Select Guest', bookingDetails: 'Booking Details',
    guestSearch: 'Search guest…',
    flightNum:'Flight number', origin:'From', destination:'To', depDate:'Departure date', arrDate:'Arrival date',
    hotel:'Hotel', checkIn:'Check-in', checkOut:'Check-out', roomType:'Room type',
    carType:'Vehicle type', pickupLoc:'Pickup location', dropoffLoc:'Drop-off location',
    filterTitle: 'Filter results', filterStatus: 'Status', filterHotel: 'Hotel',
    allStatuses: 'All statuses', allHotels: 'All hotels',
    applyFilter: 'Apply', resetFilter: 'Reset', closeFilter: 'Close',
  };

  // Booking modal state
  const [showNewBooking, setShowNewBooking] = useState(false);
  const [bookStep, setBookStep] = useState(1);
  const [bookType, setBookType] = useState(0);
  const [bookGuest, setBookGuest] = useState('');
  const [guestSearch, setGuestSearch] = useState('');
  const [bookings, setBookings] = useState([]);

  // Controlled Step 2 form state
  const [flightData, setFlightData] = useState({ flightNum:'QR512', origin:'DOH', destination:'LHR', depDate:'2025-12-09', arrDate:'2025-12-09' });
  const [hotelData, setHotelData] = useState({ hotel:'Sheraton Grand', checkIn:'2025-12-06', checkOut:'2025-12-10', roomType:'Deluxe King' });
  const [transferData, setTransferData] = useState({ carType:'VIP Sedan', pickupLoc:'Hamad International Airport', dropoffLoc:'Sheraton Grand Doha' });

  // Sync state
  const [synced, setSynced] = useState(false);
  const syncTimerRef = useRef(null);

  // Filter state
  const [showFilter, setShowFilter] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterHotel, setFilterHotel] = useState('all');
  const [appliedStatus, setAppliedStatus] = useState('all');
  const [appliedHotel, setAppliedHotel] = useState('all');

  const G = GUESTS;
  const filteredGuests = G.filter(g => !guestSearch || g.name.toLowerCase().includes(guestSearch.toLowerCase())).slice(0, 6);

  const hayyaData = G.slice(0, 8).map((g, i) => ({
    ...g,
    passport: `QA${String(1000000 + i * 12345).slice(0, 7)}`,
    hayyaStatus: ['approved','approved','submitted','approved','pending','approved','rejected','approved'][i],
    reference: `HYA-2025-${String(10000 + i * 1337).slice(0, 5)}`,
    submittedDate: ['Nov 12','Nov 14','Nov 16','Nov 10','Nov 20','Nov 11','Nov 13','Nov 15'][i],
    validity: '4–14 Dec',
  }));

  const filteredHayyaData = hayyaData.filter(g => {
    if (appliedStatus !== 'all' && g.hayyaStatus !== appliedStatus) return false;
    return true;
  });

  const inbound = [
    { flight:'QR512', eta:'08:20', hayya:'approved', driver:'M. Al-Kuwari' },
    { flight:'BA105', eta:'09:45', hayya:'approved', driver:'S. Hamdan' },
    { flight:'LH788', eta:'11:10', hayya:'submitted', driver:STR.pendingShort },
    { flight:'EK023', eta:'13:30', hayya:'approved', driver:'K. Al-Thani' },
  ];

  const statusColor = { approved:'var(--accent)', submitted:'#e0c47e', pending:'#e0c47e', rejected:'#e08a7e' };

  function handleSync() {
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    setSynced(true);
    syncTimerRef.current = setTimeout(() => setSynced(false), 2500);
  }

  function openNewBooking() {
    setShowNewBooking(true);
    setBookStep(1);
    setBookType(0);
    setBookGuest('');
    setGuestSearch('');
    setFlightData({ flightNum:'QR512', origin:'DOH', destination:'LHR', depDate:'2025-12-09', arrDate:'2025-12-09' });
    setHotelData({ hotel:'Sheraton Grand', checkIn:'2025-12-06', checkOut:'2025-12-10', roomType:'Deluxe King' });
    setTransferData({ carType:'VIP Sedan', pickupLoc:'Hamad International Airport', dropoffLoc:'Sheraton Grand Doha' });
  }

  function saveBooking() {
    const details = bookType === 0 ? flightData : bookType === 1 ? hotelData : transferData;
    setBookings(prev => [...prev, { guest:bookGuest, type:STR.bookingTypes[bookType], details, time:new Date().toLocaleTimeString() }]);
    setShowNewBooking(false);
    setBookStep(1);
    setBookGuest('');
    setGuestSearch('');
  }

  function applyFilter() {
    setAppliedStatus(filterStatus);
    setAppliedHotel(filterHotel);
    setShowFilter(false);
  }

  function resetFilter() {
    setFilterStatus('all');
    setFilterHotel('all');
    setAppliedStatus('all');
    setAppliedHotel('all');
  }

  const inputStyle = { width:'100%', background:'var(--surface-soft-3)', border:'1px solid var(--glass-border)', borderRadius:8, padding:'9px 12px', color:'var(--ink)', fontSize:13, boxSizing:'border-box' };
  const labelStyle = { display:'block', fontSize:11, color:'var(--ink-mute)', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:5 };
  const isFilterActive = appliedStatus !== 'all' || appliedHotel !== 'all';

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{STR.title[0]} <em>{STR.title[1]}</em></h1>
          <div className="page-sub">{STR.sub}</div>
        </div>
        <div className="page-actions">
          <button className="btn" style={{ position:'relative' }} onClick={() => { setFilterStatus(appliedStatus); setFilterHotel(appliedHotel); setShowFilter(true); }}>
            <Icon name="filter" size={14}/> {STR.filter}
            {isFilterActive && <span style={{ position:'absolute', top:4, right:4, width:6, height:6, borderRadius:'50%', background:'var(--accent)' }}/>}
          </button>
          <button className="btn primary" onClick={openNewBooking}>
            <Icon name="plus" size={14}/> {STR.newBooking}
          </button>
        </div>
      </div>

      {/* Recent bookings notice */}
      {bookings.length > 0 && (
        <div style={{ marginBottom:16, padding:'10px 16px', borderRadius:10, background:'rgba(26,174,196,0.1)', border:'1px solid rgba(26,174,196,0.3)', fontSize:13, display:'flex', gap:10, alignItems:'center' }}>
          <Icon name="check" size={14} style={{ color:'var(--accent)' }}/>
          <span>{isAr ? `تم إضافة ${bookings.length} حجز` : `${bookings.length} new booking${bookings.length>1?'s':''} added`}</span>
        </div>
      )}

      {/* KPI strip */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20 }}>
        {[
          { icon:'flight', val:fmtN(948), label:STR.flightsConfirmed, help:STR.flightsHelp },
          { icon:'hotel', val:fmtN(1192), label:STR.roomsBlocked, help:STR.roomsHelp },
          { icon:'car', val:ad('24'), label:STR.transfers, help:STR.transfersHelp },
          { icon:'qr', val:`${fmtN(1138)}${STR.hayyaVisasOf}`, label:STR.hayyaVisas, help:STR.hayyaHelp },
        ].map((k, i) => (
          <div key={i} className="card" style={{ padding:'14px 18px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
              <Icon name={k.icon} size={14} style={{ color:'var(--accent)' }}/>
              <span style={{ fontSize:11, color:'var(--ink-mute)', textTransform:'uppercase', letterSpacing:'0.1em' }}>{k.label}</span>
            </div>
            <div style={{ fontFamily:'var(--serif)', fontSize:26, fontStyle:'italic', lineHeight:1, marginBottom:4, direction:'ltr' }}>{k.val}</div>
            <div style={{ fontSize:11, color:'var(--ink-mute)' }}>{k.help}</div>
          </div>
        ))}
      </div>

      <div className="cols-2-narrow">
        {/* Hayya table */}
        <div className="card">
          <div className="card-head">
            <div>
              <h3>{fmtN(1138)} {STR.hayyaTitle}</h3>
              <div className="sub">{STR.hayyaSub}</div>
            </div>
            <div style={{ display:'flex', gap:6 }}>
              <span className="chip confirmed"><span className="dot"/>{STR.connected}</span>
              <button className="btn ghost" style={{ padding:'4px 10px', fontSize:11 }} onClick={handleSync}>
                <Icon name={synced ? 'check' : 'refresh'} size={12}/> {synced ? STR.synced : STR.syncNow}
              </button>
            </div>
          </div>
          <div style={{ display:'flex', gap:6, padding:'0 20px 12px', flexWrap:'wrap' }}>
            {Object.entries(STR.statuses).map(([k, v]) => (
              <span key={k} className={`chip${appliedStatus===k?' active':''}`}
                style={{ borderColor:statusColor[k], color:statusColor[k], cursor:'pointer' }}
                onClick={() => { setAppliedStatus(s => s===k?'all':k); }}>
                <span className="dot" style={{ background:statusColor[k] }}/>{v}
                <strong style={{ marginLeft:4 }}>{fmtN({ approved:1138, submitted:84, pending:42, rejected:20 }[k])}</strong>
              </span>
            ))}
          </div>
          <table className="table">
            <thead><tr>
              <th>{STR.cols.guest}</th>
              <th>{STR.cols.passport}</th>
              <th>{STR.cols.hayyaStatus}</th>
              <th>{STR.cols.submitted}</th>
            </tr></thead>
            <tbody>
              {filteredHayyaData.map((g, i) => (
                <tr key={i}>
                  <td>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <Avatar initials={g.initials} size={26} tier={g.tier}/>
                      <span style={{ fontSize:12 }}>{g.name}</span>
                    </div>
                  </td>
                  <td><span style={{ fontFamily:'var(--mono)', fontSize:11 }}>{g.passport}</span></td>
                  <td>
                    <span className="chip" style={{ borderColor:statusColor[g.hayyaStatus], color:statusColor[g.hayyaStatus] }}>
                      <span className="dot" style={{ background:statusColor[g.hayyaStatus] }}/>
                      {STR.statusesShort[g.hayyaStatus]}
                    </span>
                  </td>
                  <td style={{ fontFamily:'var(--mono)', fontSize:11 }}>{dateAr(g.submittedDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Right column */}
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div className="card">
            <div className="card-head">
              <div><h3>{STR.inboundTitle}</h3></div>
              <span className="chip confirmed"><span className="dot"/>{STR.inboundChip}</span>
            </div>
            <table className="table">
              <thead><tr>
                <th>{STR.inboundCols.flight}</th>
                <th>{STR.inboundCols.eta}</th>
                <th>{STR.inboundCols.hayya}</th>
                <th>{STR.inboundCols.driver}</th>
              </tr></thead>
              <tbody>
                {inbound.map((r, i) => (
                  <tr key={i}>
                    <td><span style={{ fontFamily:'var(--mono)', fontSize:12 }}>{r.flight}</span></td>
                    <td><span style={{ fontFamily:'var(--mono)', fontSize:12 }}>{ad(r.eta)}</span></td>
                    <td>
                      <span className="chip" style={{ borderColor:statusColor[r.hayya], color:statusColor[r.hayya] }}>
                        <span className="dot" style={{ background:statusColor[r.hayya] }}/>
                        {STR.statusesShort[r.hayya]}
                      </span>
                    </td>
                    <td style={{ fontSize:12 }}>{r.driver}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card">
            <div className="card-head"><h3>{STR.itineraryTitle}</h3></div>
            <div className="card-body">
              <div style={{ display:'flex', gap:12, alignItems:'flex-start' }}>
                <Avatar initials="KM" size={40} tier="VIP"/>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:600 }}>{G[0].name}</div>
                  <div style={{ fontSize:11, color:'var(--ink-mute)', marginBottom:12 }}>{G[0].role} · {G[0].org}</div>
                  <div className="timeline">
                    {[
                      { time:ad('Dec 4 · 08:20'), ev:`QR512 — DOH · ${STR.permitApproved}` },
                      { time:ad('Dec 4 · 09:30'), ev:isAr?'وصول · شيراتون الكبرى · غرفة ٧٢١':'Check-in · Sheraton Grand · Room 721' },
                      { time:ad('Dec 7 · 09:00'), ev:isAr?'الجلسة الافتتاحية — قاعة الميسرا':'Opening Plenary — Al Mayassa Hall' },
                      { time:ad('Dec 9 · 18:00'), ev:isAr?'المغادرة · QR514 — DOH → CDG':'Departure · QR514 — DOH → CDG' },
                    ].map((ev, i) => (
                      <div key={i} className="timeline-item">
                        <div style={{ fontSize:11, color:'var(--accent-2)', fontFamily:'var(--mono)', direction:'ltr' }}>{ev.time}</div>
                        <div style={{ fontSize:12.5 }}>{ev.ev}</div>
                      </div>
                    ))}
                  </div>
                  <a href="#" onClick={e => e.preventDefault()} style={{ fontSize:12, color:'var(--accent)', display:'block', marginTop:8 }}>{STR.viewPermit}</a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* FILTER PANEL */}
      {showFilter && (
        <>
          <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.3)', zIndex:499 }} onClick={() => setShowFilter(false)}/>
          <div className="drawer open" style={{ width:300, zIndex:500 }}>
            <div style={{ padding:'18px 22px', borderBottom:'1px solid var(--glass-border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div style={{ fontSize:11, letterSpacing:'0.18em', textTransform:'uppercase', color:'var(--ink-mute)' }}>{STR.filterTitle}</div>
              <button className="icon-btn" onClick={() => setShowFilter(false)}><Icon name="close" size={14}/></button>
            </div>
            <div style={{ padding:'20px 22px', display:'flex', flexDirection:'column', gap:18, flex:1 }}>
              <div>
                <label style={labelStyle}>{STR.filterStatus}</label>
                <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                  {['all', 'approved', 'submitted', 'pending', 'rejected'].map(s => (
                    <label key={s} style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontSize:12.5 }}>
                      <input type="radio" name="filterStatus" value={s} checked={filterStatus===s} onChange={() => setFilterStatus(s)}
                        style={{ accentColor:'var(--accent)' }}/>
                      <span style={{ color: s==='all' ? 'var(--ink-dim)' : statusColor[s] }}>
                        {s === 'all' ? STR.allStatuses : STR.statuses[s]}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label style={labelStyle}>{STR.filterHotel}</label>
                <select style={{ ...inputStyle }} value={filterHotel} onChange={e => setFilterHotel(e.target.value)}>
                  <option value="all">{STR.allHotels}</option>
                  {['Sheraton Grand','Mondrian Doha','Mandarin Oriental','St. Regis','Four Seasons'].map(h => <option key={h}>{h}</option>)}
                </select>
              </div>
            </div>
            <div style={{ padding:'14px 22px', borderTop:'1px solid var(--glass-border)', display:'flex', gap:8 }}>
              <button className="btn" style={{ flex:1, justifyContent:'center' }} onClick={resetFilter}>{STR.resetFilter}</button>
              <button className="btn primary" style={{ flex:1, justifyContent:'center' }} onClick={applyFilter}>{STR.applyFilter}</button>
            </div>
          </div>
        </>
      )}

      {/* NEW BOOKING MODAL */}
      {showNewBooking && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}>
          <div className="card glass" style={{ width:500, maxWidth:'90vw', padding:0, maxHeight:'85vh', display:'flex', flexDirection:'column' }}>
            <div style={{ padding:'18px 22px', borderBottom:'1px solid var(--glass-border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div>
                <h3 style={{ margin:0 }}>{STR.newBookingTitle}</h3>
                <div style={{ display:'flex', gap:6, marginTop:6 }}>
                  {[STR.selectGuest, STR.bookingDetails].map((l, i) => (
                    <span key={i} style={{ display:'flex', alignItems:'center', gap:4, fontSize:11, color:bookStep===i+1?'var(--accent)':bookStep>i+1?'var(--ink-dim)':'var(--ink-mute)' }}>
                      <span style={{ width:16, height:16, borderRadius:'50%', display:'grid', placeItems:'center', fontSize:10, fontWeight:700,
                        background:bookStep===i+1?'var(--accent)':bookStep>i+1?'var(--accent-deep)':'var(--surface-soft-4)',
                        color:bookStep>=i+1?'#fff':'var(--ink-mute)' }}>{i+1}</span>
                      {l}
                      {i<1&&<span style={{ color:'var(--ink-faint)' }}>›</span>}
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
                    <label style={labelStyle}>{isAr?'نوع الحجز':'Booking Type'}</label>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
                      {[{icon:'flight',label:STR.bookingTypes[0]},{icon:'hotel',label:STR.bookingTypes[1]},{icon:'car',label:STR.bookingTypes[2]}].map((bt, i) => (
                        <div key={i} onClick={() => setBookType(i)}
                          style={{ padding:'12px 10px', borderRadius:10, cursor:'pointer', textAlign:'center',
                            border:`1px solid ${bookType===i?'var(--accent)':'var(--glass-border)'}`,
                            background:bookType===i?'rgba(26,174,196,0.12)':'var(--surface-soft-2)' }}>
                          <Icon name={bt.icon} size={18} style={{ color:bookType===i?'var(--accent)':'var(--ink-mute)', display:'block', margin:'0 auto 6px' }}/>
                          <div style={{ fontSize:12, fontWeight:bookType===i?600:400 }}>{bt.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label style={labelStyle}>{isAr?'الضيف':'Guest'}</label>
                    <input placeholder={STR.guestSearch} value={guestSearch} onChange={e => setGuestSearch(e.target.value)} style={inputStyle}/>
                    <div style={{ display:'flex', flexDirection:'column', gap:4, maxHeight:200, overflowY:'auto', marginTop:8 }}>
                      {filteredGuests.map(g => (
                        <div key={g.id} onClick={() => setBookGuest(g.name)}
                          style={{ padding:'8px 12px', borderRadius:8, cursor:'pointer', display:'flex', alignItems:'center', gap:10,
                            border:`1px solid ${bookGuest===g.name?'var(--accent)':'var(--glass-border)'}`,
                            background:bookGuest===g.name?'rgba(26,174,196,0.12)':'var(--surface-soft-2)' }}>
                          <Avatar initials={g.initials} size={28} tier={g.tier}/>
                          <div>
                            <div style={{ fontSize:13, fontWeight:500 }}>{g.name}</div>
                            <div style={{ fontSize:11, color:'var(--ink-mute)' }}>{g.org}</div>
                          </div>
                          {bookGuest===g.name && <Icon name="check" size={13} style={{ marginLeft:'auto', color:'var(--accent)' }}/>}
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {bookStep === 2 && bookType === 0 && (
                <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                  {[
                    [STR.flightNum, 'flightNum'],
                    [STR.origin, 'origin'],
                    [STR.destination, 'destination'],
                  ].map(([label, key]) => (
                    <div key={key}>
                      <label style={labelStyle}>{label}</label>
                      <input style={inputStyle} value={flightData[key]} onChange={e => setFlightData(d => ({...d, [key]:e.target.value}))}/>
                    </div>
                  ))}
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                    <div>
                      <label style={labelStyle}>{STR.depDate}</label>
                      <input type="date" style={inputStyle} value={flightData.depDate} onChange={e => setFlightData(d => ({...d, depDate:e.target.value}))}/>
                    </div>
                    <div>
                      <label style={labelStyle}>{STR.arrDate}</label>
                      <input type="date" style={inputStyle} value={flightData.arrDate} onChange={e => setFlightData(d => ({...d, arrDate:e.target.value}))}/>
                    </div>
                  </div>
                </div>
              )}

              {bookStep === 2 && bookType === 1 && (
                <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                  <div>
                    <label style={labelStyle}>{STR.hotel}</label>
                    <select style={inputStyle} value={hotelData.hotel} onChange={e => setHotelData(d => ({...d, hotel:e.target.value}))}>
                      {['Sheraton Grand','Mondrian Doha','Mandarin Oriental','St. Regis','Four Seasons'].map(h => <option key={h}>{h}</option>)}
                    </select>
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                    <div>
                      <label style={labelStyle}>{STR.checkIn}</label>
                      <input type="date" style={inputStyle} value={hotelData.checkIn} onChange={e => setHotelData(d => ({...d, checkIn:e.target.value}))}/>
                    </div>
                    <div>
                      <label style={labelStyle}>{STR.checkOut}</label>
                      <input type="date" style={inputStyle} value={hotelData.checkOut} onChange={e => setHotelData(d => ({...d, checkOut:e.target.value}))}/>
                    </div>
                  </div>
                  <div>
                    <label style={labelStyle}>{STR.roomType}</label>
                    <input style={inputStyle} value={hotelData.roomType} onChange={e => setHotelData(d => ({...d, roomType:e.target.value}))}/>
                  </div>
                </div>
              )}

              {bookStep === 2 && bookType === 2 && (
                <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                  <div>
                    <label style={labelStyle}>{STR.carType}</label>
                    <select style={inputStyle} value={transferData.carType} onChange={e => setTransferData(d => ({...d, carType:e.target.value}))}>
                      {['VIP Sedan','SUV','Minivan','Luxury Van'].map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  {[
                    [STR.pickupLoc, 'pickupLoc'],
                    [STR.dropoffLoc, 'dropoffLoc'],
                  ].map(([label, key]) => (
                    <div key={key}>
                      <label style={labelStyle}>{label}</label>
                      <input style={inputStyle} value={transferData[key]} onChange={e => setTransferData(d => ({...d, [key]:e.target.value}))}/>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ padding:'14px 22px', borderTop:'1px solid var(--glass-border)', display:'flex', justifyContent:'space-between', gap:8 }}>
              <button className="btn" onClick={() => bookStep>1?setBookStep(1):setShowNewBooking(false)}>
                {bookStep>1?<><Icon name="arrowLeft" size={13}/> {STR.back}</>:STR.cancel}
              </button>
              {bookStep<2 ? (
                <button className="btn primary" onClick={() => setBookStep(2)} disabled={!bookGuest}>
                  {STR.next} <Icon name="arrow" size={13}/>
                </button>
              ) : (
                <button className="btn primary" onClick={saveBooking}>
                  <Icon name="check" size={13}/> {STR.save}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
