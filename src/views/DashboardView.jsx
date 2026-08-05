// Event overview. Every number here comes from GET /v1/Dashboard/{eventId}
// (GetDashboardResponse) — nothing is invented client-side, so what the client
// sees is what the data actually says.
//
// The panels themselves live in ./dashboard/parts.jsx; this file is the layout
// plus the small amount of shaping needed to turn API counts into chart rows.
import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { fmtNum, toArDigits } from '../i18n/translations';
import { fmtDate, fmtDayMonth } from '../lib/date';
import { Avatar, StatusChip, ServiceLevelChip } from '../components/UI';
import {
  PageHeader, Card, CardHead, Grid, Button, StatCard,
  EmptyState, Skeleton, Alert, staggerParent,
} from '../components/ds';
import {
  DonutPanel, BreakdownPanel, ReadinessPanel, MovementsPanel, FunnelPanel, AgendaPanel,
} from './dashboard/parts';
import toast from '../lib/toast';
import { getDashboard } from '../api/services/dashboardService';

function initialsFromName(name) {
  const parts = (name || '').trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || '?';
}

// The shared StatusChip was built around a mock vocabulary
// (confirmed/pending/declined); map the real InvitationStatus onto it.
function toChipStatus(invitationStatus) {
  if (invitationStatus === 'accepted') return 'confirmed';
  if (invitationStatus === 'sent' || invitationStatus === 'opened') return 'pending';
  if (invitationStatus === 'declined') return 'declined';
  return 'draft';
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const getGreeting = (lang = 'en') => {
  const hour = new Date().getHours();
  // Midnight-to-dawn isn't "morning"; "Good night" reads like a farewell to
  // someone who just signed in, so the small hours get a neutral welcome.
  const isNight = hour < 5;
  const isMorning = !isNight && hour < 12;
  const isAfternoon = hour < 17;

  if (lang === 'ar') {
    if (isNight) return 'أهلاً بك';
    if (isMorning) return 'صباح الخير';
    return 'مساء الخير';
  }
  if (isNight) return 'Welcome Back';
  if (isMorning) return 'Good Morning';
  if (isAfternoon) return 'Good Afternoon';
  return 'Good Evening';
};

/** Days between today and the event start; negative once it's under way. */
function daysUntil(dateStr) {
  if (!dateStr) return null;
  const start = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(start.getTime())) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((start - now) / 86400000);
}

export default function DashboardView({ onOpenGuest, gotoView, lang, activeEventId }) {
  const isAr = lang === 'ar';
  const fmtN = (n) => fmtNum(n, lang);
  const ad = (s) => (isAr ? toArDigits(String(s)) : String(s));

  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (!activeEventId) { setDashboard(null); setLoadError(false); return; }
    let cancelled = false;
    setLoading(true);
    setLoadError(false);
    getDashboard(activeEventId)
      .then((res) => { if (!cancelled) setDashboard(res); })
      .catch(() => {
        if (cancelled) return;
        setDashboard(null);
        setLoadError(true);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [activeEventId]);

  const STR = isAr ? {
    export: 'تصدير', newInvite: 'دعوة جديدة', viewGuests: 'كل الضيوف',
    totalGuests: 'إجمالي الضيوف', confirmed: 'مؤكدون', awaiting: 'في الانتظار',
    travel: 'حجوزات السفر', accred: 'اعتمادات صادرة', responseRate: 'نسبة الرد',
    funnelTitle: 'مسار التأكيد', funnelSub: 'من الدعوة إلى الاعتماد',
    rsvpTitle: 'ملخص الردود', rsvpSub: 'حسب حالة الدعوة',
    accredTitle: 'الاعتماد', accredSub: 'حسب حالة الشارة',
    levelsTitle: 'مستويات الخدمة', levelsSub: 'الضيوف حسب المستوى',
    natTitle: 'الجنسيات', natSub: 'الأكثر تمثيلاً',
    orgTitle: 'المؤسسات', orgSub: 'الأكثر تمثيلاً',
    readyTitle: 'جاهزية التشغيل', readySub: 'تقدّم كل مسار عمل',
    moveTitle: 'الوصول والمغادرة', moveSub: 'حسب اليوم',
    recentTitle: 'آخر نشاط الضيوف', recentSub: 'أحدث الإضافات والتحديثات',
    todayTitle: 'برنامج اليوم', meetingsTitle: 'الاجتماعات القادمة',
    quickTitle: 'إجراءات سريعة',
    cols: { guest: 'الضيف', level: 'المستوى', org: 'المؤسسة', status: 'الحالة', arrival: 'الوصول' },
    noSessionsToday: 'لا توجد جلسات اليوم', noMeetings: 'لا توجد اجتماعات قادمة',
    noGuests: 'لا يوجد ضيوف بعد', noGuestsHint: 'أضف ضيوفاً لتظهر هنا',
    noData: 'لا توجد بيانات بعد', noDataHint: 'ستظهر هنا عند إضافة الضيوف.',
    noEvent: 'اختر فعالية', noEventHint: 'اختر فعالية من الشريط العلوي لعرض لوحة المعلومات.',
    loadError: 'تعذّر تحميل لوحة المعلومات', loadErrorHint: 'تحقّق من الاتصال ثم أعد المحاولة.',
    retry: 'إعادة المحاولة', of: 'من', guests: 'ضيوف',
    arrivals: 'الوصول', departures: 'المغادرة',
    accredIssued: 'اعتماد صادر', travelArranged: 'سفر مُرتَّب', seated: 'مقاعد مخصّصة', invited: 'دعوات مُرسلة',
    daysToGo: 'يوم متبقٍ', inProgress: 'جارية الآن',
    qa: { addGuest: 'إضافة ضيف', invite: 'إرسال دعوة', accredit: 'الاعتماد', seating: 'الجلوس' },
    rsvp: { accepted: 'مقبولة', awaiting: 'في الانتظار', declined: 'مرفوضة', notSent: 'لم تُرسل' },
    accredLabels: { issued: 'صادرة', pending: 'قيد الانتظار', revoked: 'ملغاة', notRequired: 'غير مطلوبة' },
  } : {
    export: 'Export', newInvite: 'New Invitation', viewGuests: 'All guests',
    totalGuests: 'Total Guests', confirmed: 'Confirmed', awaiting: 'Awaiting Response',
    travel: 'Travel Booked', accred: 'Accreditation Issued', responseRate: 'Response rate',
    funnelTitle: 'Confirmation funnel', funnelSub: 'Invitation through to accreditation',
    rsvpTitle: 'RSVP summary', rsvpSub: 'By invitation status',
    accredTitle: 'Accreditation', accredSub: 'By badge status',
    levelsTitle: 'Service levels', levelsSub: 'Guests per level',
    natTitle: 'Nationalities', natSub: 'Most represented',
    orgTitle: 'Organisations', orgSub: 'Most represented',
    readyTitle: 'Operational readiness', readySub: 'Progress across each workstream',
    moveTitle: 'Arrivals & departures', moveSub: 'By day',
    recentTitle: 'Recent guest activity', recentSub: 'Latest additions and updates',
    todayTitle: "Today's programme", meetingsTitle: 'Upcoming meetings',
    quickTitle: 'Quick actions',
    cols: { guest: 'Guest', level: 'Service Level', org: 'Organisation', status: 'Status', arrival: 'Arrival' },
    noSessionsToday: 'No sessions today', noMeetings: 'No upcoming meetings',
    noGuests: 'No guests yet', noGuestsHint: 'Guests you add to this event will appear here.',
    noData: 'Nothing to show yet', noDataHint: 'This fills in as you add guests.',
    noEvent: 'No event selected', noEventHint: 'Pick an event from the top bar to see its dashboard.',
    loadError: 'Could not load the dashboard', loadErrorHint: 'Check your connection and try again.',
    retry: 'Retry', of: 'of', guests: 'Guests',
    arrivals: 'Arrivals', departures: 'Departures',
    accredIssued: 'Accreditation issued', travelArranged: 'Travel arranged', seated: 'Seats assigned', invited: 'Invitations sent',
    daysToGo: 'days to go', inProgress: 'In progress',
    qa: { addGuest: 'Add guest', invite: 'Send invitation', accredit: 'Accreditation', seating: 'Seating' },
    rsvp: { accepted: 'Accepted', awaiting: 'Awaiting', declined: 'Declined', notSent: 'Not sent' },
    accredLabels: { issued: 'Issued', pending: 'Pending', revoked: 'Revoked', notRequired: 'Not required' },
  };

  const funnel = dashboard?.funnelData || {
    totalGuests: 0, confirmedGuest: 0, awaitingGuest: 0, travelBooked: 0, accreditationIssued: 0,
  };
  const rsvp = dashboard?.rsvp || { accepted: 0, declined: 0, awaiting: 0, notSent: 0, responseRate: 0 };
  const accred = dashboard?.accreditation || { issued: 0, pending: 0, revoked: 0, notRequired: 0 };
  const travel = dashboard?.travel || { flightsBooked: 0, accommodationBooked: 0, transportBooked: 0, guestsWithTravel: 0 };
  const seating = dashboard?.seating || { assigned: 0, unassigned: 0 };
  const total = funnel.totalGuests || 0;
  const pct = (n) => (total > 0 ? Math.round((n / total) * 100) : 0);

  const funnelData = useMemo(() => ([
    { stage: isAr ? 'الإجمالي' : 'Total', value: total },
    { stage: isAr ? 'مدعوّون' : 'Invited', value: total - (rsvp.notSent || 0) },
    { stage: isAr ? 'مؤكد' : 'Confirmed', value: funnel.confirmedGuest },
    { stage: isAr ? 'السفر' : 'Travel', value: funnel.travelBooked },
    { stage: isAr ? 'معتمد' : 'Accredited', value: funnel.accreditationIssued },
  ]), [funnel, rsvp, total, isAr]);

  // Zero-value slices are dropped so the ring never renders invisible segments.
  const rsvpData = useMemo(() => ([
    { name: STR.rsvp.accepted, value: rsvp.accepted, color: '#5abf6e' },
    { name: STR.rsvp.awaiting, value: rsvp.awaiting, color: '#e0b864' },
    { name: STR.rsvp.declined, value: rsvp.declined, color: '#d1584a' },
    { name: STR.rsvp.notSent, value: rsvp.notSent, color: '#c9ced6' },
  ].filter((d) => d.value > 0)), [rsvp, STR]);

  const accredData = useMemo(() => ([
    { name: STR.accredLabels.issued, value: accred.issued, color: '#5abf6e' },
    { name: STR.accredLabels.pending, value: accred.pending, color: '#e0b864' },
    { name: STR.accredLabels.revoked, value: accred.revoked, color: '#d1584a' },
    { name: STR.accredLabels.notRequired, value: accred.notRequired, color: '#c9ced6' },
  ].filter((d) => d.value > 0)), [accred, STR]);

  // Server sends one row per day that has movement; only worth a chart when
  // there's more than a single day to compare.
  const movements = useMemo(() => (dashboard?.movements || []).map((m) => ({
    // DD-MM (lib/date) — the year is dropped only because an axis tick has no
    // room for it, and every point is inside one event anyway.
    date: fmtDayMonth(m.date, ''),
    arrivals: m.arrivals,
    departures: m.departures,
  })), [dashboard, isAr]);

  // Denominators differ per workstream on purpose: accreditation is measured
  // against guests who actually need a badge, not the whole list.
  const readinessRows = useMemo(() => {
    const needsAccred = accred.issued + accred.pending + accred.revoked;
    return [
      { label: STR.invited, icon: 'invitation', tint: '#8d0134', value: total - rsvp.notSent, max: total },
      { label: STR.accredIssued, icon: 'badge', tint: '#4a9edd', value: accred.issued, max: needsAccred },
      { label: STR.travelArranged, icon: 'travel', tint: '#a78bda', value: travel.guestsWithTravel, max: total },
      { label: STR.seated, icon: 'seating', tint: '#5abf6e', value: seating.assigned, max: total },
    ];
  }, [accred, travel, seating, rsvp, total, STR]);

  const today = todayStr();
  const todaySessions = (dashboard?.sessions || []).filter((s) => s.date === today);
  const upcomingMeetings = (dashboard?.meetings || []).filter((m) => m.date >= today).slice(0, 5);
  const recentGuests = dashboard?.recentGuests || [];
  const countdown = daysUntil(dashboard?.startDate);

  const eventLine = dashboard
    ? [
        dashboard.title,
        dashboard.venue,
        dashboard.startDate
          ? `${fmtDate(dashboard.startDate)}${dashboard.endDate && dashboard.endDate !== dashboard.startDate ? ` – ${fmtDate(dashboard.endDate)}` : ''}`
          : null,
        countdown != null
          ? (countdown > 0 ? `${ad(countdown)} ${STR.daysToGo}` : STR.inProgress)
          : null,
      ].filter(Boolean).join(' · ')
    : null;

  function handleExport() {
    const rows = recentGuests.map((g) =>
      `"${g.name}","${g.organization || ''}","${g.tier || ''}","${g.invitationStatus || ''}"`);
    const csv = 'Guest,Organization,Service Level,Status\n' + rows.join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'dashboard-guests.csv';
    a.click();
    toast.success(isAr ? 'تم التصدير' : 'Exported');
  }

  if (!activeEventId) {
    return (
      <div>
        <PageHeader title={getGreeting(lang)} />
        <Card>
          <EmptyState icon="calendar" title={STR.noEvent}>{STR.noEventHint}</EmptyState>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={getGreeting(lang)}
        subtitle={loading ? '…' : eventLine || STR.loadError}
        actions={
          <>
            <Button icon="download" onClick={handleExport} disabled={!dashboard}>{STR.export}</Button>
            <Button variant="primary" icon="invitation" onClick={() => gotoView?.('invitations')}>
              {STR.newInvite}
            </Button>
          </>
        }
      />

      {loadError && <Alert tone="danger" title={STR.loadError}>{STR.loadErrorHint}</Alert>}

      {loading ? (
        <Grid min={220}>
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}><Skeleton w="55%" h={12} /><Skeleton w="40%" h={26} style={{ marginTop: 12 }} /></Card>
          ))}
        </Grid>
      ) : (
        <>
          {/* ── KPI row ── */}
          <motion.div {...staggerParent}>
            <Grid min={216} style={{ marginBottom: 18 }}>
              <StatCard label={STR.totalGuests} value={fmtN(total)} icon="guests" tint="#8d0134" />
              <StatCard label={STR.confirmed} value={fmtN(rsvp.accepted)} icon="check" tint="#5abf6e"
                delta={total ? pct(rsvp.accepted) : null} deltaLabel={`${STR.of} ${fmtN(total)}`} />
              <StatCard label={STR.responseRate} value={`${ad(rsvp.responseRate)}%`} icon="invitation" tint="#e0b864"
                deltaLabel={`${fmtN(rsvp.accepted + rsvp.declined)} ${STR.of} ${fmtN(total - rsvp.notSent)}`} />
              <StatCard label={STR.accred} value={fmtN(accred.issued)} icon="badge" tint="#4a9edd"
                deltaLabel={`${fmtN(accred.pending)} ${STR.accredLabels.pending.toLowerCase()}`} />
            </Grid>
          </motion.div>

          {/* ── Funnel + RSVP ── */}
          <div className="dash-charts"
            style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.6fr) minmax(0, 1fr)', gap: 16, marginBottom: 18 }}>
            <FunnelPanel title={STR.funnelTitle} subtitle={STR.funnelSub} data={funnelData} seriesName={STR.guests} />
            <DonutPanel
              title={STR.rsvpTitle} subtitle={STR.rsvpSub} icon="invitation" data={rsvpData}
              centerValue={fmtN(total)} centerLabel={STR.totalGuests}
              emptyTitle={STR.noGuests} emptyHint={STR.noGuestsHint} fmtN={fmtN} ad={ad}
            />
          </div>

          {/* ── Readiness + accreditation ── */}
          <div className="dash-charts"
            style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.6fr) minmax(0, 1fr)', gap: 16, marginBottom: 18 }}>
            <ReadinessPanel title={STR.readyTitle} subtitle={STR.readySub} rows={readinessRows} fmtN={fmtN} ad={ad} />
            <DonutPanel
              title={STR.accredTitle} subtitle={STR.accredSub} icon="badge" data={accredData}
              centerValue={fmtN(accred.issued)} centerLabel={STR.accredLabels.issued}
              emptyTitle={STR.noData} emptyHint={STR.noDataHint} fmtN={fmtN} ad={ad}
            />
          </div>

          {/* ── Movements (only worth a chart with more than one dated day) ── */}
          {movements.length > 1 && (
            <div style={{ marginBottom: 18 }}>
              <MovementsPanel title={STR.moveTitle} subtitle={STR.moveSub} data={movements}
                labels={{ arrivals: STR.arrivals, departures: STR.departures }} />
            </div>
          )}

          {/* ── Composition breakdowns ── */}
          <Grid min={280} style={{ marginBottom: 18 }}>
            <BreakdownPanel title={STR.levelsTitle} subtitle={STR.levelsSub} icon="star"
              rows={dashboard?.serviceLevels} emptyTitle={STR.noData} emptyHint={STR.noDataHint}
              fmtN={fmtN} isAr={isAr} />
            <BreakdownPanel title={STR.natTitle} subtitle={STR.natSub} icon="globe"
              rows={dashboard?.nationalities} emptyTitle={STR.noData} emptyHint={STR.noDataHint}
              fmtN={fmtN} isAr={isAr} />
            <BreakdownPanel title={STR.orgTitle} subtitle={STR.orgSub} icon="venue"
              rows={dashboard?.organizations} emptyTitle={STR.noData} emptyHint={STR.noDataHint}
              fmtN={fmtN} isAr={isAr} />
          </Grid>

          {/* ── Programme / meetings / quick actions ── */}
          <Grid min={280} style={{ marginBottom: 18 }}>
            <AgendaPanel
              title={STR.todayTitle} icon="calendar" emptyText={STR.noSessionsToday}
              items={todaySessions.map((s) => ({ id: s.id, time: s.time || '—', title: s.title, detail: s.room }))}
            />
            <AgendaPanel
              title={STR.meetingsTitle} icon="meetings" emptyText={STR.noMeetings}
              items={upcomingMeetings.map((m) => ({
                id: m.id,
                time: m.startTime ? String(m.startTime).slice(0, 5) : null,
                title: m.name,
                detail: [m.date, m.location].filter(Boolean).join(' · '),
              }))}
            />
            <Card>
              <CardHead title={STR.quickTitle} icon="star" />
              <div style={{ display: 'grid', gap: 8 }}>
                <Button icon="plus" onClick={() => gotoView?.('guests')} style={{ justifyContent: 'flex-start' }}>
                  {STR.qa.addGuest}
                </Button>
                <Button icon="invitation" onClick={() => gotoView?.('invitations')} style={{ justifyContent: 'flex-start' }}>
                  {STR.qa.invite}
                </Button>
                <Button icon="badge" onClick={() => gotoView?.('accreditation')} style={{ justifyContent: 'flex-start' }}>
                  {STR.qa.accredit}
                </Button>
                <Button icon="seating" onClick={() => gotoView?.('seating')} style={{ justifyContent: 'flex-start' }}>
                  {STR.qa.seating}
                </Button>
              </div>
            </Card>
          </Grid>

          {/* ── Recent guests ── */}
          <Card padded={false}>
            <div style={{ padding: '16px 18px 0' }}>
              <CardHead
                title={STR.recentTitle}
                subtitle={STR.recentSub}
                icon="guests"
                action={
                  <Button size="sm" iconRight="arrow" onClick={() => gotoView?.('guests')}>
                    {STR.viewGuests}
                  </Button>
                }
              />
            </div>
            {recentGuests.length === 0 ? (
              <EmptyState icon="guests" title={STR.noGuests}>{STR.noGuestsHint}</EmptyState>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>{STR.cols.guest}</th>
                      <th>{STR.cols.level}</th>
                      <th>{STR.cols.org}</th>
                      <th>{STR.cols.status}</th>
                      {/* <th>{STR.cols.arrival}</th> */}
                    </tr>
                  </thead>
                  <tbody>
                    {recentGuests.map((g) => (
                      <tr key={g.id} style={{ cursor: onOpenGuest ? 'pointer' : undefined }}
                        onClick={() => onOpenGuest?.(g)}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                            <Avatar initials={initialsFromName(g.name)} size={30} tier={g.tier} />
                            <span style={{ fontWeight: 550 }}>{g.name}</span>
                          </div>
                        </td>
                        <td><ServiceLevelChip name={g.tier} lang={lang} /></td>
                        <td style={{ color: 'var(--ink-mute)' }}>{g.organization || '—'}</td>
                        <td><StatusChip status={toChipStatus(g.invitationStatus)} lang={lang} /></td>
                        {/* <td style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-mute)' }}>
                          {g.arrivalDate || '—'}
                        </td> */}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
