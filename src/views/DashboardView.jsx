// Event overview. Every number here comes from GET /v1/Dashboard/{eventId}
// (GetDashboardResponse) — nothing is invented client-side, so what the client
// sees is what the data actually says.
//
// The panels themselves live in ./dashboard/parts.jsx; this file is the layout
// plus the small amount of shaping needed to turn API counts into chart rows.
import React, { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { fmtNum, toArDigits } from "../i18n/translations";
import { fmtDate, fmtDayMonth } from "../lib/date";
import { StatusChip, ServiceLevelChip } from "../components/UI";
import { Icon } from "../components/Icons";
import GuestCell from "../components/GuestCell";
import {
  PageHeader,
  Card,
  CardHead,
  Grid,
  Button,
  Badge,
  EmptyState,
  Skeleton,
  Alert,
  staggerParent,
} from "../components/ds";
import {
  DonutTabsPanel,
  BreakdownTabsPanel,
  FunnelPanel,
  AgendaPanel,
  StatCardBreakdown,
} from "./dashboard/parts";
import toast from "../lib/toast";
import { getDashboard } from "../api/services/dashboardService";
import { brandHex } from '../lib/brandColor';

// The shared StatusChip was built around a mock vocabulary
// (confirmed/pending/declined); map the real InvitationStatus onto it.
function toChipStatus(invitationStatus) {
  if (invitationStatus === "accepted") return "confirmed";
  if (invitationStatus === "sent" || invitationStatus === "opened")
    return "pending";
  if (invitationStatus === "declined") return "declined";
  return "draft";
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const getGreeting = (lang = "en") => {
  const hour = new Date().getHours();
  // Midnight-to-dawn isn't "morning"; "Good night" reads like a farewell to
  // someone who just signed in, so the small hours get a neutral welcome.
  const isNight = hour < 5;
  const isMorning = !isNight && hour < 12;
  const isAfternoon = hour < 17;

  if (lang === "ar") {
    if (isNight) return "أهلاً بك";
    if (isMorning) return "صباح الخير";
    return "مساء الخير";
  }
  if (isNight) return "Welcome Back";
  if (isMorning) return "Good Morning";
  if (isAfternoon) return "Good Afternoon";
  return "Good Evening";
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

export default function DashboardView({
  onOpenGuest,
  gotoView,
  lang,
  activeEventId,
}) {
  const isAr = lang === "ar";
  const fmtN = (n) => fmtNum(n, lang);
  const ad = (s) => (isAr ? toArDigits(String(s)) : String(s));

  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);

  // Which dataset each tabbed card is currently showing — kept local since
  // it's pure UI state, not data.
  const [donutTab, setDonutTab] = useState("rsvp");
  const [breakdownTab, setBreakdownTab] = useState("levels");

  useEffect(() => {
    if (!activeEventId) {
      setDashboard(null);
      setLoadError(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLoadError(false);
    getDashboard(activeEventId)
      .then((res) => {
        if (!cancelled) setDashboard(res);
      })
      .catch(() => {
        if (cancelled) return;
        setDashboard(null);
        setLoadError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeEventId]);

  const STR = isAr
    ? {
        export: "تصدير",
        newInvite: "دعوة جديدة",
        viewGuests: "كل المندوبين",
        totalGuests: "إجمالي المندوبين",
        confirmed: "مؤكدون",
        awaiting: "في الانتظار",
        travel: "حجوزات السفر",
        accred: "اعتمادات صادرة",
        responseRate: "نسبة الرد",
        funnelTitle: "مسار التأكيد",
        funnelSub: "من الدعوة إلى الاعتماد",
        rsvpTitle: "ملخص الردود",
        rsvpSub: "حسب حالة الدعوة",
        accredTitle: "الاعتماد",
        accredSub: "حسب حالة الشارة",
        levelsTitle: "مستويات الخدمة",
        levelsSub: "المندوبين حسب المستوى",
        natTitle: "الجنسيات",
        natSub: "الأكثر تمثيلاً",
        orgTitle: "المؤسسات",
        orgSub: "الأكثر تمثيلاً",
        moveTitle: "الوصول والمغادرة",
        moveSub: "حسب اليوم",
        recentTitle: "آخر نشاط المندوبين",
        recentSub: "أحدث الإضافات والتحديثات",
        todayTitle: "برنامج اليوم",
        meetingsTitle: "الاجتماعات القادمة",
        sessionsTitle: "الجلسات",
        sessionsSub: "كل جلسات الفعالية",
        noSessions: "لا توجد جلسات لهذه الفعالية",
        quickTitle: "إجراءات سريعة",
        flightBookings: "حجوزات الطيران",
        accommodationBookings: "حجوزات الفنادق",
        transportBookings: "حجوزات النقل",
        ofGuests: "من إجمالي المندوبين",
        cols: {
          guest: "المندوب",
          level: "المستوى",
          org: "المؤسسة",
          status: "الحالة",
          arrival: "الوصول",
        },
        noSessionsToday: "لا توجد جلسات اليوم",
        noMeetings: "لا توجد اجتماعات قادمة",
        noGuests: "لا يوجد مندوبين بعد",
        noGuestsHint: "أضف مندوبين لتظهر هنا",
        noData: "لا توجد بيانات بعد",
        noDataHint: "ستظهر هنا عند إضافة المندوبين.",
        noEvent: "اختر فعالية",
        noEventHint: "اختر فعالية من الشريط العلوي لعرض لوحة المعلومات.",
        loadError: "تعذّر تحميل لوحة المعلومات",
        loadErrorHint: "تحقّق من الاتصال ثم أعد المحاولة.",
        retry: "إعادة المحاولة",
        of: "من",
        guests: "مندوبين",
        arrivals: "الوصول",
        departures: "المغادرة",
        accredIssued: "اعتماد صادر",
        travelArranged: "سفر مُرتَّب",
        seated: "مقاعد مخصّصة",
        invited: "دعوات مُرسلة",
        daysToGo: "يوم متبقٍ",
        inProgress: "جارية الآن",
        qa: {
          addGuest: "إضافة مندوب",
          addMeeting: "إضافة اجتماع",
          invite: "إرسال دعوة",
          accredit: "الاعتماد",
          seating: "الجلوس",
        },
        rsvp: {
          accepted: "مقبولة",
          awaiting: "في الانتظار",
          declined: "مرفوضة",
          notSent: "لم تُرسل",
        },
        accredLabels: {
          issued: "صادرة",
          pending: "قيد الانتظار",
          revoked: "ملغاة",
          notRequired: "غير مطلوبة",
        },
      }
    : {
        export: "Export",
        newInvite: "New Invitation",
        viewGuests: "All delegates",
        totalGuests: "Total Delegates",
        confirmed: "Confirmed",
        awaiting: "Awaiting Response",
        travel: "Travel Booked",
        accred: "Accreditation Issued",
        responseRate: "Response rate",
        funnelTitle: "Confirmation funnel",
        funnelSub: "Invitation through to accreditation",
        rsvpTitle: "RSVP summary",
        rsvpSub: "By invitation status",
        accredTitle: "Accreditation",
        accredSub: "By badge status",
        levelsTitle: "Service levels",
        levelsSub: "Delegates per level",
        natTitle: "Nationalities",
        natSub: "Most represented",
        orgTitle: "Organisations",
        orgSub: "Most represented",
        moveTitle: "Arrivals & departures",
        moveSub: "By day",
        recentTitle: "Recent delegate activity",
        recentSub: "Latest additions and updates",
        todayTitle: "Today's programme",
        meetingsTitle: "Upcoming meetings",
        sessionsTitle: "Sessions",
        sessionsSub: "Every session on this event",
        noSessions: "No sessions for this event yet",
        quickTitle: "Quick actions",
        flightBookings: "Flight Bookings",
        accommodationBookings: "Accommodation Bookings",
        transportBookings: "Transport Bookings",
        ofGuests: "of total delegates",
        cols: {
          guest: "Delegate",
          level: "Service Level",
          org: "Organisation",
          status: "Status",
          arrival: "Arrival",
        },
        noSessionsToday: "No sessions today",
        noMeetings: "No upcoming meetings",
        noGuests: "No delegates yet",
        noGuestsHint: "Delegates you add to this event will appear here.",
        noData: "Nothing to show yet",
        noDataHint: "This fills in as you add delegates.",
        noEvent: "No event selected",
        noEventHint: "Pick an event from the top bar to see its dashboard.",
        loadError: "Could not load the dashboard",
        loadErrorHint: "Check your connection and try again.",
        retry: "Retry",
        of: "of",
        guests: "Delegates",
        arrivals: "Arrivals",
        departures: "Departures",
        accredIssued: "Accreditation issued",
        travelArranged: "Travel arranged",
        seated: "Seats assigned",
        invited: "Invitations sent",
        daysToGo: "days to go",
        inProgress: "In progress",
        qa: {
          addGuest: "Add delegate",
          invite: "Send invitation",
          accredit: "Accreditation",
          seating: "Seating",
          addMeeting: "Add meeting",
        },
        rsvp: {
          accepted: "Accepted",
          awaiting: "Awaiting",
          declined: "Declined",
          notSent: "Not sent",
        },
        accredLabels: {
          issued: "Issued",
          pending: "Pending",
          revoked: "Revoked",
          notRequired: "Not required",
        },
      };

  const funnel = dashboard?.funnelData || {
    totalGuests: 0,
    confirmedGuest: 0,
    awaitingGuest: 0,
    travelBooked: 0,
    accreditationIssued: 0,
  };
  const rsvp = dashboard?.rsvp || {
    accepted: 0,
    declined: 0,
    awaiting: 0,
    notSent: 0,
    responseRate: 0,
  };
  const accred = dashboard?.accreditation || {
    issued: 0,
    pending: 0,
    revoked: 0,
    notRequired: 0,
  };
  const travel = dashboard?.travel || {
    flightsBooked: 0,
    accommodationBooked: 0,
    transportBooked: 0,
    guestsWithTravel: 0,
  };
  const total = funnel.totalGuests || 0;

  const funnelData = useMemo(
    () => [
      { stage: isAr ? "الإجمالي" : "Total Invited", value: total },
      {
        stage: isAr ? "معتمد" : "Accredited",
        value: funnel.accreditationIssued,
      },

      { stage: isAr ? "مؤكد" : "Confirmed", value: funnel.confirmedGuest },
      {
        stage: isAr ? "مرفوض" : "Rejected",
        value: rsvp.declined,
        color: "#d1584a",
      },
      {
        stage: isAr ? "مدعوّون" : "Pending",
        value: funnel.awaitingGuest,
        color: "#e0b864",
      },
      // { stage: isAr ? 'السفر' : 'Travel', value: funnel.travelBooked },
    ],
    [funnel, rsvp, total, isAr],
  );

  // Zeros are passed through — DonutVisual drops them from the ring but keeps
  // them in the legend, so Declined still reads "0" instead of disappearing.
  //
  // "Not sent" is deliberately excluded: this card answers "how did the people
  // we invited respond?", and a guest whose invitation never went out hasn't
  // been asked yet. Counting them as a slice made the response split look worse
  // than it was. The uninvited are on the funnel's Total vs Pending gap instead.
  const rsvpData = useMemo(
    () => [
      { name: STR.rsvp.accepted, value: rsvp.accepted, color: "#5abf6e" },
      { name: STR.rsvp.awaiting, value: rsvp.awaiting, color: "#e0b864" },
      { name: STR.rsvp.declined, value: rsvp.declined, color: "#d1584a" },
    ],
    [rsvp, STR],
  );

  const accredData = useMemo(
    () => [
      { name: STR.accredLabels.issued, value: accred.issued, color: "#5abf6e" },
      {
        name: STR.accredLabels.pending,
        value: accred.pending,
        color: "#e0b864",
      },
      {
        name: STR.accredLabels.revoked,
        value: accred.revoked,
        color: "#d1584a",
      },
      {
        name: STR.accredLabels.notRequired,
        value: accred.notRequired,
        color: "#c9ced6",
      },
    ],
    [accred, STR],
  );

  // Server sends one row per day that has movement; only worth a chart when
  // there's more than a single day to compare.
  const movements = useMemo(
    () =>
      (dashboard?.movements || []).map((m) => ({
        // DD-MM (lib/date) — the year is dropped only because an axis tick has no
        // room for it, and every point is inside one event anyway.
        date: fmtDayMonth(m.date, ""),
        arrivals: m.arrivals,
        departures: m.departures,
      })),
    [dashboard, isAr],
  );

  const today = todayStr();
  // Full listing (all sessions, any date) for the SessionsListPanel at the
  // bottom of the page — not just "today's", now that it's its own section
  // rather than a compact glance.
  const allSessions = dashboard?.sessions || [];
  const upcomingMeetings = (dashboard?.meetings || [])
    .filter((m) => m.date >= today)
    .slice(0, 5);
  // Keep the dashboard's table short — full history is one click away via
  // "All guests"; the server already caps this feed at 8, this trims further.
  const recentGuests = (dashboard?.recentGuests || []).slice(0, 6);
  const countdown = daysUntil(dashboard?.startDate);

  // Icon + text segments instead of one flat "A · B · C" string — each fact
  // (event, venue, dates) gets its own glyph, same idea as the KPI cards'
  // icon chips, rather than reading as an undifferentiated sentence.
  const eventMeta = dashboard
    ? [
        dashboard.title && { icon: "star", text: dashboard.title },
        dashboard.venue && { icon: "venue", text: dashboard.venue },
        dashboard.startDate && {
          icon: "calendar",
          text: `${fmtDate(dashboard.startDate)}${dashboard.endDate && dashboard.endDate !== dashboard.startDate ? ` – ${fmtDate(dashboard.endDate)}` : ""}`,
        },
      ].filter(Boolean)
    : [];

  function handleExport() {
    const rows = recentGuests.map(
      (g) =>
        `"${g.name}","${g.organization || ""}","${g.serviceLevelName || ""}","${g.invitationStatus || ""}"`,
    );
    const csv = "Delegate,Organization,Service Level,Status\n" + rows.join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "dashboard-delegates.csv";
    a.click();
    toast.success(isAr ? "تم التصدير" : "Exported");
  }

  if (!activeEventId) {
    return (
      <div>
        <PageHeader title={getGreeting(lang)} />
        <Card>
          <EmptyState icon="calendar" title={STR.noEvent}>
            {STR.noEventHint}
          </EmptyState>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={
          <>
            {getGreeting(lang)}
            {!loading && countdown != null && (
              <Badge
                tone={countdown > 0 ? "brand" : "ok"}
                style={{ marginInlineStart: 10, verticalAlign: "middle" }}
              >
                {countdown > 0
                  ? `${ad(countdown)} ${STR.daysToGo}`
                  : STR.inProgress}
              </Badge>
            )}
          </>
        }
        subtitle={
          loading ? (
            "…"
          ) : eventMeta.length > 0 ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                flexWrap: "wrap",
              }}
            >
              {eventMeta.map((m, i) => (
                <React.Fragment key={i}>
                  {i > 0 && (
                    <span style={{ color: "var(--ink-faint)" }}>·</span>
                  )}
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                    }}
                  >
                    <Icon
                      name={m.icon}
                      size={12.5}
                      style={{ color: "var(--accent)", flexShrink: 0 }}
                    />
                    {m.text}
                  </span>
                </React.Fragment>
              ))}
            </div>
          ) : (
            STR.loadError
          )
        }
        actions={
          <>
            <Button
              icon="download"
              onClick={handleExport}
              disabled={!dashboard}
            >
              {STR.export}
            </Button>
            <Button
              variant="primary"
              icon="invitation"
              onClick={() => gotoView?.("invitations")}
            >
              {STR.newInvite}
            </Button>
          </>
        }
      />

      {loadError && (
        <Alert tone="danger" title={STR.loadError}>
          {STR.loadErrorHint}
        </Alert>
      )}

      {loading ? (
        <Grid min={220}>
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <Skeleton w="55%" h={12} />
              <Skeleton w="40%" h={26} style={{ marginTop: 12 }} />
            </Card>
          ))}
        </Grid>
      ) : (
        <>
          {/* ── KPI row — each tile carries a couple of breakdown sublines
                 (same numbers the panels below chart) so a bare total doesn't
                 read as an empty tile at a glance. ── */}
          <motion.div {...staggerParent}>
            <Grid min={216} gap={12} style={{ marginBottom: 12 }}>
              <StatCardBreakdown
                label={STR.totalGuests}
                value={fmtN(total)}
                icon="guests"
                tint={brandHex()}
                lines={[
                  {
                    label: STR.rsvp.accepted,
                    value: fmtN(rsvp.accepted),
                    tint: "var(--ok)",
                  },
                  // { label: STR.rsvp.awaiting, value: fmtN(rsvp.awaiting), tint: '#e0b864' },
                  // { label: STR.rsvp.declined, value: fmtN(rsvp.declined), tint: 'var(--danger)' },
                ]}
              />
              {/* Flight/Accommodation/Transport booking counts — real numbers
                  from the Travel module, instead of three more cards that
                  just repeated the guest-response stats above. */}
              <StatCardBreakdown
                label={STR.flightBookings}
                value={fmtN(travel.flightsBooked)}
                icon="flight"
                tint="#4a9edd"
                lines={[
                  {
                    label: STR.ofGuests,
                    value: `${ad(total ? Math.round((travel.flightsBooked / total) * 100) : 0)}%`,
                  },
                ]}
              />
              <StatCardBreakdown
                label={STR.accommodationBookings}
                value={fmtN(travel.accommodationBooked)}
                icon="hotel"
                tint="#e0b864"
                lines={[
                  {
                    label: STR.ofGuests,
                    value: `${ad(total ? Math.round((travel.accommodationBooked / total) * 100) : 0)}%`,
                  },
                ]}
              />
              <StatCardBreakdown
                label={STR.transportBookings}
                value={fmtN(travel.transportBooked)}
                icon="car"
                tint="#a78bda"
                lines={[
                  {
                    label: STR.ofGuests,
                    value: `${ad(total ? Math.round((travel.transportBooked / total) * 100) : 0)}%`,
                  },
                ]}
              />
            </Grid>
          </motion.div>

          {/* ── Row 1: funnel · RSVP/Accreditation (tabbed) · upcoming meetings
                 (Operational Readiness dropped — it just repeated numbers the
                 KPI row and donuts already show). ── */}
          <Grid min={260} gap={12} style={{ marginBottom: 12 }}>
            <FunnelPanel
              title={STR.funnelTitle}
              subtitle={STR.funnelSub}
              data={funnelData}
              seriesName={STR.guests}
            />
            <DonutTabsPanel
              title={donutTab === "accred" ? STR.accredTitle : STR.rsvpTitle}
              icon={donutTab === "accred" ? "badge" : "invitation"}
              active={donutTab}
              onChange={setDonutTab}
              fmtN={fmtN}
              ad={ad}
              tabs={[
                {
                  value: "rsvp",
                  label: STR.rsvpTitle,
                  subtitle: STR.rsvpSub,
                  icon: "invitation",
                  data: rsvpData,
                  centerValue: fmtN(total),
                  centerLabel: STR.totalGuests,
                  emptyTitle: STR.noGuests,
                  emptyHint: STR.noGuestsHint,
                },
                {
                  value: "accred",
                  label: STR.accredTitle,
                  subtitle: STR.accredSub,
                  icon: "badge",
                  data: accredData,
                  centerValue: fmtN(accred.issued),
                  centerLabel: STR.accredLabels.issued,
                  emptyTitle: STR.noData,
                  emptyHint: STR.noDataHint,
                },
              ]}
            />
            <AgendaPanel
              title={STR.meetingsTitle}
              icon="meetings"
              emptyText={STR.noMeetings}
              items={upcomingMeetings.map((m) => ({
                id: m.id,
                time: m.startTime ? String(m.startTime).slice(0, 5) : null,
                title: m.name,
                detail: [m.date, m.location].filter(Boolean).join(" · "),
              }))}
              quickActions={[
                {
                  label: STR.qa.addMeeting,
                  icon: "plus",
                  onClick: () => gotoView?.("meetings"),
                },
                // { label: STR.qa.invite, icon: 'invitation', onClick: () => gotoView?.('invitations') },
                // { label: STR.qa.accredit, icon: 'badge', onClick: () => gotoView?.('accreditation') },
                // { label: STR.qa.seating, icon: 'seating', onClick: () => gotoView?.('seating') },
              ]}
            />
          </Grid>

          {/* ── Row 2: recent guests · composition breakdown (tabbed). ── */}
          <Grid min={280} gap={12}>
            <Card padded={false}>
              <div style={{ padding: "14px 16px 0" }}>
                <CardHead
                  title={STR.recentTitle}
                  icon="guests"
                  action={
                    <Button
                      size="sm"
                      iconRight="arrow"
                      onClick={() => gotoView?.("guests")}
                    >
                      {STR.viewGuests}
                    </Button>
                  }
                />
              </div>
              {recentGuests.length === 0 ? (
                <EmptyState icon="guests" title={STR.noGuests}>
                  {STR.noGuestsHint}
                </EmptyState>
              ) : (
                <div
                  style={{
                    overflow: "auto",
                    maxHeight: 260,
                    padding: "0 4px 4px",
                  }}
                >
                  <table className="table">
                    <thead>
                      <tr>
                        <th style={{ background: "var(--page-bg)" }}>
                          {STR.cols.guest}
                        </th>
                        <th style={{ background: "var(--page-bg)" }}>
                          {STR.cols.level}
                        </th>
                        <th style={{ background: "var(--page-bg)" }}>
                          {STR.cols.status}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentGuests.map((g) => (
                        <tr
                          key={g.id}
                          style={{
                            cursor: onOpenGuest ? "pointer" : undefined,
                          }}
                          onClick={() => onOpenGuest?.(g)}
                        >
                          <td>
                            <GuestCell
                              name={g.name}
                              email={g.email}
                              photoUrl={g.photoUrl}
                              tier={g.serviceLevelName}
                              size={26}
                            />
                          </td>
                          <td>
                            <ServiceLevelChip
                              name={g.serviceLevelName}
                              color={g.serviceLevelColor}
                              lang={lang}
                            />
                          </td>
                          <td>
                            <StatusChip
                              status={toChipStatus(g.invitationStatus)}
                              lang={lang}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            <BreakdownTabsPanel
              title={
                {
                  levels: STR.levelsTitle,
                  nationalities: STR.natTitle,
                  organizations: STR.orgTitle,
                  movements: STR.moveTitle,
                }[breakdownTab] || STR.levelsTitle
              }
              icon={
                breakdownTab === "nationalities"
                  ? "globe"
                  : breakdownTab === "organizations"
                    ? "venue"
                    : breakdownTab === "movements"
                      ? "travel"
                      : "star"
              }
              active={breakdownTab}
              onChange={setBreakdownTab}
              fmtN={fmtN}
              isAr={isAr}
              tabs={[
                {
                  value: "levels",
                  label: STR.levelsTitle,
                  subtitle: STR.levelsSub,
                  kind: "bars",
                  rows: dashboard?.serviceLevels,
                  emptyTitle: STR.noData,
                  emptyHint: STR.noDataHint,
                },
                {
                  value: "nationalities",
                  label: STR.natTitle,
                  subtitle: STR.natSub,
                  kind: "bars",
                  rows: dashboard?.nationalities,
                  emptyTitle: STR.noData,
                  emptyHint: STR.noDataHint,
                },
                {
                  value: "organizations",
                  label: STR.orgTitle,
                  subtitle: STR.orgSub,
                  kind: "bars",
                  rows: dashboard?.organizations,
                  emptyTitle: STR.noData,
                  emptyHint: STR.noDataHint,
                },
                ...(movements.length > 1
                  ? [
                      {
                        value: "movements",
                        label: STR.moveTitle,
                        subtitle: STR.moveSub,
                        kind: "chart",
                        data: movements,
                        labels: {
                          arrivals: STR.arrivals,
                          departures: STR.departures,
                        },
                      },
                    ]
                  : []),
              ]}
            />

            {/* Compact sessions glance — name first, date/time below — instead
                of the full table that used to sit at the bottom of the page. */}
            <AgendaPanel
              title={STR.sessionsTitle}
              icon="calendar"
              emptyText={STR.noSessions}
              withImages
              items={allSessions.map((s) => ({
                id: s.id,
                imageUrl: s.imageUrl,
                title: s.title,
                detail: [s.date ? fmtDate(s.date) : null, s.time || null]
                  .filter(Boolean)
                  .join(" · "),
                // Guests checked into this session, right-aligned. Rendered even
                // at zero so an empty session is visibly empty rather than
                // ambiguous.
                trailing: (
                  <span
                    className="chip"
                    style={{ fontSize: 10.5, whiteSpace: "nowrap" }}
                    title={STR.guests}
                  >
                    <Icon name="guests" size={10} />
                    {fmtNum(s.guestCount || 0, lang)}
                  </span>
                ),
              }))}
            />
          </Grid>
        </>
      )}
    </div>
  );
}
