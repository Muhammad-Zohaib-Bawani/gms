import React, { useState, useEffect } from 'react';
import { getTranslations, fmtNum, toArDigits } from '../i18n/translations';
import { Avatar, StatusChip, TierChip, Donut } from '../components/UI';
import { Icon } from '../components/Icons';
import toast from '../lib/toast';
import { getDashboard } from '../api/services/dashboardService';

function initialsFromName(name) {
  const parts = (name || '').trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || '?';
}

// The shared StatusChip/TierChip components were built around a mock status
// vocabulary (confirmed/pending/declined/VIP/VVIP) that doesn't match the
// backend's real InvitationStatus/Tier strings — map onto the closest chip style.
function toChipStatus(invitationStatus) {
  if (invitationStatus === 'accepted') return 'confirmed';
  if (invitationStatus === 'sent' || invitationStatus === 'opened') return 'pending';
  if (invitationStatus === 'declined') return 'declined';
  return 'draft';
}
function toChipTier(tier) {
  if (tier === 'vvip') return 'VVIP';
  if (tier === 'vip') return 'VIP';
  return tier;
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const getGreeting = (lang = "en") => {
  const hour = new Date().getHours();
  // Midnight through early morning isn't "morning" — keep it in the evening/
  // night bucket instead of falling into `hour < 12`.
  const isNight = hour < 5;
  const isMorning = !isNight && hour < 12;
  const isAfternoon = hour < 17;

  // "Good night" reads like a farewell to someone actively using the portal —
  // use a neutral welcome for the small hours instead.
  if (lang === "ar") {
    if (isNight) return "أهلاً بك";
    if (isMorning) return "صباح الخير";
    if (isAfternoon) return "مساء الخير";
    return "مساء الخير";
  }

  if (isNight) return "Welcome Back";
  if (isMorning) return "Good Morning";
  if (isAfternoon) return "Good Afternoon";
  return "Good Evening";
};

export default function DashboardView({ onOpenGuest, gotoView, lang, activeEventId }) {
  const isAr = lang === 'ar';
  const fmtN = (n) => fmtNum(n, lang);
  const ad = (s) => isAr ? toArDigits(String(s)) : String(s);

  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (!activeEventId) { setDashboard(null); setLoadError(false); return; }
    let cancelled = false;
    setLoading(true);
    setLoadError(false);
    getDashboard(activeEventId)
      .then(res => { if (!cancelled) setDashboard(res); })
      .catch(() => {
        if (cancelled) return;
        setDashboard(null);
        setLoadError(true);
        toast.error(isAr ? 'تعذّر تحميل لوحة المعلومات' : 'Could not load dashboard');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [activeEventId]);

  const STR = isAr ? {
    greeting: getGreeting("ar"),
    name: 'أميرة',
    export: 'تصدير',
    newInvite: 'دعوة جديدة',
    confirmed: 'الضيوف المؤكدون',
    awaiting: 'في انتظار الرد',
    travel: 'حجوزات السفر',
    accred: 'اعتمادات صادرة',
    funnelTitle: 'قمع التأكيد',
    funnelDonutSub: 'مؤكد',
    funnel: { total: 'الإجمالي', confirmed: 'مؤكد', awaiting: 'في الانتظار', travel: 'مرتب سفر', accredited: 'معتمد' },
    recentTitle: 'آخر نشاط الضيوف',
    recentSub: 'عبر الدعوات والسفر والاعتماد',
    openGuestList: 'فتح قائمة الضيوف ←',
    cols: { guest: 'الضيف', tier: 'الفئة', org: 'المؤسسة', status: 'الحالة', arrival: 'الوصول' },
    todayTitle: "برنامج اليوم",
    meetingsTitle: 'الاجتماعات القادمة',
    live: 'مباشر',
    noSessionsToday: 'لا توجد جلسات اليوم',
    noMeetings: 'لا توجد اجتماعات قادمة',
    noGuests: 'لا يوجد ضيوف بعد',
    noEvent: 'اختر فعالية لعرض لوحة المعلومات',
    loading: 'جارٍ التحميل…',
    loadError: 'تعذّر تحميل لوحة المعلومات',
  } : {
    greeting: getGreeting("en"),
    name: "",
    export: 'Export',
    newInvite: 'New Invitation',
    confirmed: 'Confirmed Guests',
    awaiting: 'Awaiting Response',
    travel: 'Travel Booked',
    accred: 'Accreditation Issued',
    funnelTitle: 'Confirmation funnel',
    funnelDonutSub: 'Confirmed',
    funnel: { total: 'Total', confirmed: 'Confirmed', awaiting: 'Awaiting', travel: 'Travel set', accredited: 'Accredited' },
    recentTitle: 'Recent guest activity',
    recentSub: 'Across invitations, travel, accreditation',
    openGuestList: 'Open guest list →',
    cols: { guest: 'Guest', tier: 'Tier', org: 'Organization', status: 'Status', arrival: 'Arrival' },
    todayTitle: "Today's program",
    meetingsTitle: 'Upcoming meetings',
    live: 'Live',
    noSessionsToday: 'No sessions today',
    noMeetings: 'No upcoming meetings',
    noGuests: 'No guests yet',
    noEvent: 'Select an event to view its dashboard',
    loading: 'Loading…',
    loadError: 'Could not load dashboard',
  };

  const funnel = dashboard?.funnelData || { totalGuests: 0, confirmedGuest: 0, awaitingGuest: 0, travelBooked: 0, accreditationIssued: 0 };
  const confirmedPct = funnel.totalGuests > 0 ? (funnel.confirmedGuest / funnel.totalGuests) * 100 : 0;
  const funnelBars = [
    [STR.funnel.total, funnel.totalGuests, 100],
    [STR.funnel.confirmed, funnel.confirmedGuest, funnel.totalGuests ? (funnel.confirmedGuest / funnel.totalGuests) * 100 : 0],
    [STR.funnel.awaiting, funnel.awaitingGuest, funnel.totalGuests ? (funnel.awaitingGuest / funnel.totalGuests) * 100 : 0],
    [STR.funnel.travel, funnel.travelBooked, funnel.totalGuests ? (funnel.travelBooked / funnel.totalGuests) * 100 : 0],
    [STR.funnel.accredited, funnel.accreditationIssued, funnel.totalGuests ? (funnel.accreditationIssued / funnel.totalGuests) * 100 : 0],
  ];

  const today = todayStr();
  const todaySessions = (dashboard?.sessions || []).filter(s => s.date === today);
  const upcomingMeetings = (dashboard?.meetings || []).filter(m => m.date >= today).slice(0, 5);
  const recentGuests = dashboard?.recentGuests || [];

  const subLine = dashboard
    ? `${dashboard.title || ''}${dashboard.venue ? ` · ${dashboard.venue}` : ''}${dashboard.startDate ? ` · ${dashboard.startDate}${dashboard.endDate && dashboard.endDate !== dashboard.startDate ? ` – ${dashboard.endDate}` : ''}` : ''} · ${fmtN(funnel.confirmedGuest)} ${isAr ? 'من' : 'of'} ${fmtN(funnel.totalGuests)} ${isAr ? 'ضيفاً مؤكداً' : 'guests confirmed'}`
    : loading ? STR.loading
    : loadError ? STR.loadError
    : STR.noEvent;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{STR.greeting} <em>{STR.name}</em></h1>
          <div className="page-sub">{subLine}</div>
        </div>
        <div className="page-actions">
          <button className="btn" onClick={() => {
            const rows = recentGuests.map(g => `"${g.name}","${g.organization || ''}","${g.tier || ''}","${g.invitationStatus || ''}"`);
            const csv = 'Guest,Organization,Tier,Status\n' + rows.join('\n');
            const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'guests.csv'; a.click();
          }} disabled={!dashboard}>
            <Icon name="download" size={14}/> {STR.export}
          </button>
          <button className="btn" onClick={() => gotoView && gotoView('invitations')}>
            <Icon name="invitation" size={14}/> {STR.newInvite}
          </button>
        </div>
      </div>

      {!activeEventId && (
        <div className="card" style={{ padding: '32px', textAlign: 'center', color: 'var(--ink-mute)' }}>{STR.noEvent}</div>
      )}

      {activeEventId && (
        <>
          {/* KPI row */}
          <div className="kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
            {[
              { label: STR.confirmed, val: funnel.confirmedGuest, color: 'var(--accent)' },
              { label: STR.awaiting, val: funnel.awaitingGuest, color: '#e0c47e' },
              { label: STR.travel, val: funnel.travelBooked, color: 'var(--accent-2)' },
              { label: STR.accred, val: funnel.accreditationIssued, color: '#c21857' },
            ].map((k, i) => (
              <div key={i} className="card" style={{ padding: '16px 20px' }}>
                <div style={{ fontSize: 11, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: isAr ? '0.04em' : '0.12em', marginBottom: 6 }}>{k.label}</div>
                <div style={{ fontFamily: 'var(--serif)', fontSize: 32, fontStyle: 'italic', color: k.color, lineHeight: 1 }}>{fmtN(k.val)}</div>
              </div>
            ))}
          </div>

          <div className="cols-2-narrow">
            {/* Funnel */}
            <div className="card">
              <div className="card-head"><h3>{STR.funnelTitle}</h3></div>
              <div className="card-body" style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
                <Donut value={confirmedPct} max={100} size={110} label={`${confirmedPct.toFixed(1)}%`} sub={STR.funnelDonutSub}/>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {funnelBars.map(([label, val, pct], i) => (
                    <div key={i}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                        <span style={{ color: 'var(--ink-dim)' }}>{label}</span>
                        <span style={{ fontFamily: 'var(--mono)' }}>{fmtN(val)}</span>
                      </div>
                      <div style={{ height: 4, borderRadius: 2, background: 'var(--surface-soft-4)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: `hsl(${187 + i * 5} 60% ${50 - i * 4}%)`, borderRadius: 2 }}/>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Upcoming meetings */}
            <div className="card">
              <div className="card-head"><h3>{STR.meetingsTitle}</h3></div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {upcomingMeetings.map((m, i) => (
                  <div key={m.id} style={{ display: 'flex', gap: 14, padding: '10px 12px', borderRadius: 10,
                    background: i === 0 ? 'rgba(141, 1, 52,0.08)' : 'var(--surface-soft-2)',
                    border: `1px solid ${i === 0 ? 'rgba(141, 1, 52,0.3)' : 'var(--glass-border)'}` }}>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: i === 0 ? 'var(--accent)' : 'var(--accent-2)', flexShrink: 0, direction: 'ltr', paddingTop: 1 }}>
                      {(m.startTime || '').slice(0, 5)}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: i === 0 ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {m.date}{m.location ? ` · ${m.location}` : ''}
                      </div>
                    </div>
                  </div>
                ))}
                {upcomingMeetings.length === 0 && (
                  <div style={{ padding: '16px', textAlign: 'center', color: 'var(--ink-mute)', fontSize: 12 }}>{STR.noMeetings}</div>
                )}
              </div>
            </div>
          </div>

          {/* Recent guests + today's program */}
          <div className="cols-2-narrow" style={{ marginTop: 14 }}>
            <div className="card">
              <div className="card-head">
                <div><h3>{STR.recentTitle}</h3><div className="sub">{STR.recentSub}</div></div>
              </div>
              <table className="table">
                <thead><tr>
                  <th>{STR.cols.guest}</th>
                  <th>{STR.cols.tier}</th>
                  <th>{STR.cols.org}</th>
                  <th>{STR.cols.status}</th>
                  <th>{STR.cols.arrival}</th>
                </tr></thead>
                <tbody>
                  {recentGuests.map(g => (
                    // onClick={() => onOpenGuest && onOpenGuest(g)} - temp removed
                    <tr key={g.id} 
                    // style={{ cursor: 'pointer' }}
                     >
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <Avatar initials={initialsFromName(g.name)} size={28} tier={toChipTier(g.tier)}/>
                          <div>
                            <div style={{ fontSize: 12.5, fontWeight: 500 }}>{g.name}</div>
                          </div>
                        </div>
                      </td>
                      <td><TierChip tier={toChipTier(g.tier)} lang={lang}/></td>
                      <td style={{ fontSize: 12 }}>{g.organization || '—'}</td>
                      <td><StatusChip status={toChipStatus(g.invitationStatus)} lang={lang}/></td>
                      <td style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>{g.arrivalDate || '—'}</td>
                    </tr>
                  ))}
                  {recentGuests.length === 0 && (
                    <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--ink-faint)', padding: '32px', fontSize: 13 }}>{STR.noGuests}</td></tr>
                  )}
                </tbody>
              </table>
              <div className="card-foot">
                <button className="btn" onClick={() => gotoView && gotoView('guests')} style={{ fontSize: 12 }}>
                  {STR.openGuestList}
                </button>
              </div>
            </div>

            <div className="card">
              <div className="card-head">
                <h3>{STR.todayTitle}</h3>
                <span className="chip confirmed"><span className="dot"/>{STR.live}</span>
              </div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {todaySessions.map((s, i) => (
                  <div key={s.id} style={{ display: 'flex', gap: 14, padding: '10px 12px', borderRadius: 10,
                    background: i === 0 ? 'rgba(141, 1, 52,0.08)' : 'var(--surface-soft-2)',
                    border: `1px solid ${i === 0 ? 'rgba(141, 1, 52,0.3)' : 'var(--glass-border)'}` }}>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: i === 0 ? 'var(--accent)' : 'var(--accent-2)', flexShrink: 0, direction: 'ltr', paddingTop: 1 }}>{s.time}</div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: i === 0 ? 600 : 400, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{s.title}</div>
                      {s.room && <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.room}</div>}
                    </div>
                  </div>
                ))}
                {todaySessions.length === 0 && (
                  <div style={{ padding: '16px', textAlign: 'center', color: 'var(--ink-mute)', fontSize: 12 }}>{STR.noSessionsToday}</div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
