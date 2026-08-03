// Event overview. Every number here comes from GET /v1/Dashboard/{eventId}
// (GetDashboardResponse) — nothing is invented client-side, so what the client
// sees is what the data actually says.
import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { fmtNum, toArDigits } from '../i18n/translations';
import { Avatar, StatusChip, ServiceLevelChip } from '../components/UI';
import { Icon } from '../components/Icons';
import {
  PageHeader, Card, CardHead, Grid, Button, StatCard, Badge, Progress,
  EmptyState, Skeleton, Alert, staggerParent, fadeUpItem,
} from '../components/ds';
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

const CHART_COLORS = ['#8d0134', '#c21857', '#a78bda', '#4a9edd', '#5abf6e', '#e0b864'];

/** Themed recharts tooltip — the library's default is a white box that breaks in dark mode. */
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--popover-bg)', border: '1px solid var(--glass-border)',
      borderRadius: 10, padding: '9px 11px', boxShadow: 'var(--shadow-lg)', fontSize: 12,
    }}>
      {label != null && (
        <div style={{ color: 'var(--ink-mute)', marginBottom: 5, fontSize: 11 }}>{label}</div>
      )}
      {payload.map((p, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7, color: 'var(--ink)' }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: p.color || p.fill }} />
          <span style={{ color: 'var(--ink-mute)' }}>{p.name}</span>
          <strong style={{ marginInlineStart: 'auto' }}>{p.value}</strong>
        </div>
      ))}
    </div>
  );
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
    travel: 'حجوزات السفر', accred: 'اعتمادات صادرة',
    funnelTitle: 'مسار التأكيد', funnelSub: 'من الدعوة إلى الاعتماد',
    rsvpTitle: 'ملخص الردود', rsvpSub: 'حسب حالة الدعوة',
    recentTitle: 'آخر نشاط الضيوف', recentSub: 'أحدث الإضافات والتحديثات',
    todayTitle: 'برنامج اليوم', meetingsTitle: 'الاجتماعات القادمة',
    quickTitle: 'إجراءات سريعة',
    cols: { guest: 'الضيف', level: 'المستوى', org: 'المؤسسة', status: 'الحالة', arrival: 'الوصول' },
    noSessionsToday: 'لا توجد جلسات اليوم', noMeetings: 'لا توجد اجتماعات قادمة',
    noGuests: 'لا يوجد ضيوف بعد', noGuestsHint: 'أضف ضيوفاً لتظهر هنا',
    noEvent: 'اختر فعالية', noEventHint: 'اختر فعالية من الشريط العلوي لعرض لوحة المعلومات.',
    loadError: 'تعذّر تحميل لوحة المعلومات', loadErrorHint: 'تحقّق من الاتصال ثم أعد المحاولة.',
    retry: 'إعادة المحاولة', of: 'من',
    qa: { addGuest: 'إضافة ضيف', invite: 'إرسال دعوة', accredit: 'الاعتماد', seating: 'الجلوس' },
  } : {
    export: 'Export', newInvite: 'New Invitation', viewGuests: 'All guests',
    totalGuests: 'Total Guests', confirmed: 'Confirmed', awaiting: 'Awaiting Response',
    travel: 'Travel Booked', accred: 'Accreditation Issued',
    funnelTitle: 'Confirmation funnel', funnelSub: 'Invitation through to accreditation',
    rsvpTitle: 'RSVP summary', rsvpSub: 'By invitation status',
    recentTitle: 'Recent guest activity', recentSub: 'Latest additions and updates',
    todayTitle: "Today's programme", meetingsTitle: 'Upcoming meetings',
    quickTitle: 'Quick actions',
    cols: { guest: 'Guest', level: 'Service Level', org: 'Organisation', status: 'Status', arrival: 'Arrival' },
    noSessionsToday: 'No sessions today', noMeetings: 'No upcoming meetings',
    noGuests: 'No guests yet', noGuestsHint: 'Guests you add to this event will appear here.',
    noEvent: 'No event selected', noEventHint: 'Pick an event from the top bar to see its dashboard.',
    loadError: 'Could not load the dashboard', loadErrorHint: 'Check your connection and try again.',
    retry: 'Retry', of: 'of',
    qa: { addGuest: 'Add guest', invite: 'Send invitation', accredit: 'Accreditation', seating: 'Seating' },
  };

  const funnel = dashboard?.funnelData || {
    totalGuests: 0, confirmedGuest: 0, awaitingGuest: 0, travelBooked: 0, accreditationIssued: 0,
  };
  const total = funnel.totalGuests || 0;
  const pct = (n) => (total > 0 ? Math.round((n / total) * 100) : 0);

  // Funnel as a horizontal bar chart — each stage is a real backend count.
  const funnelData = useMemo(() => ([
    { stage: isAr ? 'الإجمالي' : 'Total', value: total },
    { stage: isAr ? 'مؤكد' : 'Confirmed', value: funnel.confirmedGuest },
    { stage: isAr ? 'الانتظار' : 'Awaiting', value: funnel.awaitingGuest },
    { stage: isAr ? 'السفر' : 'Travel', value: funnel.travelBooked },
    { stage: isAr ? 'معتمد' : 'Accredited', value: funnel.accreditationIssued },
  ]), [funnel, total, isAr]);

  // RSVP donut, derived from the same funnel counts. "No response" is whatever
  // the invited/confirmed numbers don't account for, so the ring always totals.
  const rsvpData = useMemo(() => {
    const noResponse = Math.max(0, total - funnel.confirmedGuest - funnel.awaitingGuest);
    return [
      { name: isAr ? 'مؤكد' : 'Confirmed', value: funnel.confirmedGuest, color: '#5abf6e' },
      { name: isAr ? 'في الانتظار' : 'Awaiting', value: funnel.awaitingGuest, color: '#e0b864' },
      { name: isAr ? 'لم يُرسل' : 'Not sent', value: noResponse, color: '#c9ced6' },
    ].filter((d) => d.value > 0);
  }, [funnel, total, isAr]);

  // Arrivals per day across the event, from the guests the API returned. Only
  // rendered when there's something real to plot.
  const arrivalTrend = useMemo(() => {
    const rows = dashboard?.recentGuests || [];
    const byDay = new Map();
    rows.forEach((g) => {
      if (!g.arrivalDate) return;
      byDay.set(g.arrivalDate, (byDay.get(g.arrivalDate) || 0) + 1);
    });
    return Array.from(byDay.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, count]) => ({
        date: new Date(date).toLocaleDateString(isAr ? 'ar' : 'en-US', { month: 'short', day: 'numeric' }),
        guests: count,
      }));
  }, [dashboard, isAr]);

  const today = todayStr();
  const todaySessions = (dashboard?.sessions || []).filter((s) => s.date === today);
  const upcomingMeetings = (dashboard?.meetings || []).filter((m) => m.date >= today).slice(0, 5);
  const recentGuests = dashboard?.recentGuests || [];

  const eventLine = dashboard
    ? [
        dashboard.title,
        dashboard.venue,
        dashboard.startDate
          ? `${dashboard.startDate}${dashboard.endDate && dashboard.endDate !== dashboard.startDate ? ` – ${dashboard.endDate}` : ''}`
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

  // ── No event / error / loading ────────────────────────────────────────────
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

      {loadError && (
        <Alert tone="danger" title={STR.loadError}>{STR.loadErrorHint}</Alert>
      )}

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
              <StatCard label={STR.confirmed} value={fmtN(funnel.confirmedGuest)} icon="check" tint="#5abf6e"
                delta={total ? pct(funnel.confirmedGuest) : null} deltaLabel={`${STR.of} ${fmtN(total)}`} />
              <StatCard label={STR.awaiting} value={fmtN(funnel.awaitingGuest)} icon="clock" tint="#e0b864" />
              <StatCard label={STR.accred} value={fmtN(funnel.accreditationIssued)} icon="badge" tint="#4a9edd" />
            </Grid>
          </motion.div>

          {/* ── Charts ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.6fr) minmax(0, 1fr)', gap: 16, marginBottom: 18 }}
            className="dash-charts">
            <motion.div {...fadeUpItem} initial="hidden" animate="show">
              <Card>
                <CardHead title={STR.funnelTitle} subtitle={STR.funnelSub} icon="reports" />
                <div style={{ height: 232 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={funnelData} layout="vertical" margin={{ left: 4, right: 16, top: 4, bottom: 4 }}>
                      <CartesianGrid horizontal={false} stroke="var(--glass-border)" />
                      <XAxis type="number" tick={{ fill: 'var(--ink-mute)', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="stage" width={78}
                        tick={{ fill: 'var(--ink-dim)', fontSize: 11.5 }} axisLine={false} tickLine={false} />
                      <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--hover-tint)' }} />
                      <Bar dataKey="value" name={isAr ? 'ضيوف' : 'Guests'} radius={[0, 6, 6, 0]} maxBarSize={26}>
                        {funnelData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </motion.div>

            <motion.div {...fadeUpItem} initial="hidden" animate="show">
              <Card>
                <CardHead title={STR.rsvpTitle} subtitle={STR.rsvpSub} icon="invitation" />
                {rsvpData.length === 0 ? (
                  <EmptyState icon="invitation" title={STR.noGuests}>{STR.noGuestsHint}</EmptyState>
                ) : (
                  <>
                    <div style={{ height: 168, position: 'relative' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={rsvpData} dataKey="value" nameKey="name"
                            innerRadius={52} outerRadius={76} paddingAngle={2} stroke="none">
                            {rsvpData.map((d, i) => <Cell key={i} fill={d.color} />)}
                          </Pie>
                          <Tooltip content={<ChartTooltip />} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div style={{
                        position: 'absolute', inset: 0, display: 'grid', placeItems: 'center',
                        pointerEvents: 'none',
                      }}>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--ink)' }}>{fmtN(total)}</div>
                          <div style={{ fontSize: 10.5, color: 'var(--ink-mute)' }}>{STR.totalGuests}</div>
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 12 }}>
                      {rsvpData.map((d) => (
                        <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
                          <span style={{ width: 8, height: 8, borderRadius: 2, background: d.color, flexShrink: 0 }} />
                          <span style={{ color: 'var(--ink-dim)' }}>{d.name}</span>
                          <span style={{ marginInlineStart: 'auto', fontWeight: 600 }}>{fmtN(d.value)}</span>
                          <span style={{ color: 'var(--ink-mute)', fontSize: 11, minWidth: 34, textAlign: 'end' }}>
                            {ad(pct(d.value))}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </Card>
            </motion.div>
          </div>

          {/* ── Arrivals trend (only when there are dated arrivals) ── */}
          {arrivalTrend.length > 1 && (
            <Card style={{ marginBottom: 18 }}>
              <CardHead
                title={isAr ? 'وصول الضيوف' : 'Guest arrivals'}
                subtitle={isAr ? 'حسب تاريخ الوصول' : 'By arrival date'}
                icon="travel"
              />
              <div style={{ height: 190 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={arrivalTrend} margin={{ left: -18, right: 8, top: 4, bottom: 0 }}>
                    <defs>
                      <linearGradient id="arrivalFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#8d0134" stopOpacity={0.28} />
                        <stop offset="100%" stopColor="#8d0134" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="var(--glass-border)" vertical={false} />
                    <XAxis dataKey="date" tick={{ fill: 'var(--ink-mute)', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: 'var(--ink-mute)', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip content={<ChartTooltip />} />
                    <Area type="monotone" dataKey="guests" name={isAr ? 'ضيوف' : 'Guests'}
                      stroke="#8d0134" strokeWidth={2} fill="url(#arrivalFill)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}

          {/* ── Programme / meetings / quick actions ── */}
          <Grid min={280} style={{ marginBottom: 18 }}>
            <Card padded={false}>
              <div style={{ padding: '16px 18px 0' }}>
                <CardHead title={STR.todayTitle} icon="calendar" />
              </div>
              <div style={{ padding: '0 18px 16px' }}>
                {todaySessions.length === 0 ? (
                  <div style={{ fontSize: 12.5, color: 'var(--ink-faint)', padding: '8px 0 4px' }}>
                    {STR.noSessionsToday}
                  </div>
                ) : todaySessions.map((s) => (
                  <div key={s.id} style={{
                    display: 'flex', gap: 11, padding: '9px 0',
                    borderBottom: '1px solid var(--glass-border)',
                  }}>
                    <span style={{
                      fontFamily: 'var(--mono)', fontSize: 11.5, color: 'var(--accent)',
                      minWidth: 42, direction: 'ltr',
                    }}>{s.time || '—'}</span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 550 }}>{s.title}</div>
                      {s.room && <div style={{ fontSize: 11, color: 'var(--ink-mute)' }}>{s.room}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card padded={false}>
              <div style={{ padding: '16px 18px 0' }}>
                <CardHead title={STR.meetingsTitle} icon="meetings" />
              </div>
              <div style={{ padding: '0 18px 16px' }}>
                {upcomingMeetings.length === 0 ? (
                  <div style={{ fontSize: 12.5, color: 'var(--ink-faint)', padding: '8px 0 4px' }}>
                    {STR.noMeetings}
                  </div>
                ) : upcomingMeetings.map((m) => (
                  <div key={m.id} style={{
                    display: 'flex', gap: 11, padding: '9px 0',
                    borderBottom: '1px solid var(--glass-border)', alignItems: 'center',
                  }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 550 }}>{m.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--ink-mute)' }}>
                        {m.date}{m.startTime ? ` · ${String(m.startTime).slice(0, 5)}` : ''}
                        {m.location ? ` · ${m.location}` : ''}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

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
                      <th>{STR.cols.arrival}</th>
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
                        <td style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-mute)' }}>
                          {g.arrivalDate || '—'}
                        </td>
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
