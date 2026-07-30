import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { getTranslations, fmtNum } from "../i18n/translations";
import { Avatar, StatusChip, TierChip } from "../components/UI";
import { Icon } from "../components/Icons";
import FlagIcon from "../components/FlagIcon";
import DataTable from "../components/ui/DataTable";
import ActionMenu from "../components/ui/ActionMenu";
import Select from "../components/ui/Select";
import toast from "../lib/toast";
import { listGuests } from "../api/services/guestService";
import { getNationalities } from "../api/services/nationalityService";
import { getOrganizations } from "../api/services/organizationService";
import { getTemplates } from "../api/services/invitationTemplateService";
import { listSessions, getEvent } from "../api/services/eventService";

import GuestModal from "./guests/modals/GuestModal";
import MessageModal from "./guests/modals/MessageModal";
import AccreditationModal from "./guests/modals/AccreditationModal";
import DeleteGuestsModal from "./guests/modals/DeleteGuestsModal";
import ImportModal from "./guests/modals/ImportModal";

const TIERS = ["vvip", "vip", "Speaker", "Delegate", "press", "Observer"];

export default function GuestsView({ onOpenGuest, lang, activeEventId }) {
  const t = getTranslations(lang);
  const isAr = lang === "ar";
  const fmtN = (n) => fmtNum(n, lang);
  const navigate = useNavigate();

  // ── data ──────────────────────────────────────────────────────────────────
  const [guests, setGuests] = useState([]);
  // Server-side paging: the table shows exactly the page the API returned, so
  // search + tier/status filters have to be sent along (filtering locally would
  // only ever filter the rows currently on screen).
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  // Reference data for the Add/Edit Guest modal only — fetched lazily (see
  // ensureGuestFormData) since a plain guest-list visit never needs any of
  // this, and it used to fire unconditionally on every mount/event switch.
  const [nationalities, setNationalities] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [activeEvent, setActiveEvent] = useState(null);
  const [nationalitiesLoaded, setNationalitiesLoaded] = useState(false);
  const [organizationsLoaded, setOrganizationsLoaded] = useState(false);
  const [refDataLoadedForEvent, setRefDataLoadedForEvent] = useState(null);
  const [loading, setLoading] = useState(false);

  // ── filter / selection ────────────────────────────────────────────────────
  const [query, setQuery] = useState("");
  const [tierFilter, setTierFilter] = useState("All");
  const [statusFilters, setStatusFilters] = useState([]); // multi-select, [] = all
  const [orgFilter, setOrgFilter] = useState("All");
  const [nationalityFilter, setNationalityFilter] = useState("All");
  const [accreditationFilter, setAccreditationFilter] = useState("All");
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [selectedGuests, setSelectedGuests] = useState([]);
  const [selResetKey, setSelResetKey] = useState(0);

  const activeFilterCount = [
    tierFilter !== "All",
    statusFilters.length > 0,
    orgFilter !== "All",
    nationalityFilter !== "All",
    accreditationFilter !== "All",
  ].filter(Boolean).length;

  const clearAllFilters = () => {
    setTierFilter("All");
    setStatusFilters([]);
    setOrgFilter("All");
    setNationalityFilter("All");
    setAccreditationFilter("All");
  };

  // ── modal open states ─────────────────────────────────────────────────────
  const [showAddGuest, setShowAddGuest] = useState(false);
  const [editGuest, setEditGuest] = useState(null);
  const [editGuestStep, setEditGuestStep] = useState(1);
  const [showMessage, setShowMessage] = useState(false);
  const [showAccred, setShowAccred] = useState(false);
  const [showDeleteGuests, setShowDeleteGuests] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const selCount = selectedGuests.length;
  const clearSelection = () => setSelResetKey((k) => k + 1);

  // ── load reference data, on demand ────────────────────────────────────────
  // Called right before opening Add/Edit Guest — the only consumer of any of
  // this. Nationalities are fetched once ever; templates/sessions/event are
  // per-event, so they refetch when activeEventId changes since the last load.
  const ensureGuestFormData = useCallback(() => {
    const tasks = [];
    if (!nationalitiesLoaded) {
      setNationalitiesLoaded(true);
      tasks.push(
        getNationalities().then((r) => setNationalities(r || [])).catch(() => setNationalitiesLoaded(false)),
      );
    }
    if (!organizationsLoaded) {
      setOrganizationsLoaded(true);
      tasks.push(
        getOrganizations().then((r) => setOrganizations(r || [])).catch(() => setOrganizationsLoaded(false)),
      );
    }
    if (activeEventId && refDataLoadedForEvent !== activeEventId) {
      setRefDataLoadedForEvent(activeEventId);
      tasks.push(getTemplates(activeEventId).then((r) => setTemplates(r || [])).catch(() => {}));
      tasks.push(listSessions(activeEventId).then((r) => setSessions(r || [])).catch(() => {}));
      tasks.push(getEvent(activeEventId).then(setActiveEvent).catch(() => setActiveEvent(null)));
    }
    return Promise.all(tasks);
  }, [activeEventId, nationalitiesLoaded, organizationsLoaded, refDataLoadedForEvent]);

  // Opens the Add/Edit Guest wizard directly on a given step — used by the
  // row actions menu's "Send Invite" to jump straight to the Invitation step.
  const openEditGuest = useCallback((g, step = 1) => {
    ensureGuestFormData();
    setEditGuestStep(step);
    setEditGuest(g);
  }, [ensureGuestFormData]);

  // The filter panel's Organization/Nationality dropdowns need the same
  // reference data as the Add/Edit wizard — load it lazily the first time
  // the panel is opened rather than unconditionally on page visit.
  const toggleFilterPanel = () => {
    if (!showFilterPanel) ensureGuestFormData();
    setShowFilterPanel((o) => !o);
  };

  const loadGuests = useCallback(async () => {
    if (!activeEventId) return;
    setLoading(true);
    try {
      const r = await listGuests({
        eventId: activeEventId,
        pageNumber: pageIndex + 1, // API pages are 1-based
        pageSize,
        search: query || undefined,
        tier: tierFilter !== "All" ? tierFilter : undefined,
        invitationStatuses: statusFilters.length ? statusFilters : undefined,
        organizationId: orgFilter !== "All" ? orgFilter : undefined,
        nationalityId: nationalityFilter !== "All" ? nationalityFilter : undefined,
        accreditationStatus: accreditationFilter !== "All" ? accreditationFilter : undefined,
      });
      setGuests(r?.items || []);
      setTotalCount(r?.totalCount ?? 0);
    } catch {
      // keep previous list
    } finally {
      setLoading(false);
    }
  }, [activeEventId, query, pageIndex, pageSize, tierFilter, statusFilters, orgFilter, nationalityFilter, accreditationFilter]);

  useEffect(() => {
    loadGuests();
  }, [loadGuests]);

  // Any change that reshapes the result set has to send us back to page 1 —
  // otherwise a filter that narrows to 3 rows leaves us stranded on page 5.
  useEffect(() => {
    setPageIndex(0);
  }, [activeEventId, query, tierFilter, statusFilters, orgFilter, nationalityFilter, accreditationFilter, pageSize]);

  // Selection can't span pages: only the current page's rows are in memory, so
  // a selection made on page 1 would silently vanish from the bulk actions on
  // page 2. Clearing on navigation makes that visible instead of surprising.
  useEffect(() => {
    clearSelection();
  }, [pageIndex, pageSize, query, tierFilter, statusFilters, orgFilter, nationalityFilter, accreditationFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close the filter panel on an outside click or Escape — same pattern as
  // the topbar notification dropdown.
  const filterPanelRef = useRef(null);
  useEffect(() => {
    if (!showFilterPanel) return;
    const onDoc = (e) => { if (filterPanelRef.current && !filterPanelRef.current.contains(e.target)) setShowFilterPanel(false); };
    const onKey = (e) => { if (e.key === "Escape") setShowFilterPanel(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [showFilterPanel]);

  // ── select options ────────────────────────────────────────────────────────
  const tierFilterOpts = useMemo(
    () => [
      { value: "All", label: isAr ? "كل الفئات" : "All Tiers" },
      ...TIERS.map((t) => ({ value: t, label: t })),
    ],
    [isAr],
  );

  const statusFilterOpts = useMemo(
    () => [
      { value: "not_sent", label: isAr ? "لم يُرسل" : "Not Sent" },
      { value: "sent", label: isAr ? "مُرسل" : "Sent" },
      { value: "opened", label: isAr ? "مفتوح" : "Opened" },
      { value: "accepted", label: isAr ? "مقبول" : "Accepted" },
      { value: "declined", label: isAr ? "مرفوض" : "Declined" },
    ],
    [isAr],
  );

  const orgFilterOpts = useMemo(
    () => [
      { value: "All", label: isAr ? "كل المؤسسات" : "All Organizations" },
      ...organizations.map((o) => ({ value: o.id, label: isAr ? (o.nameAr || o.name) : o.name })),
    ],
    [organizations, isAr],
  );

  const nationalityFilterOpts = useMemo(
    () => [
      { value: "All", label: isAr ? "كل الجنسيات" : "All Nationalities" },
      ...nationalities.map((n) => ({ value: n.id, label: `${n.flag} ${isAr ? n.nameAr : n.name}` })),
    ],
    [nationalities, isAr],
  );

  const accreditationFilterOpts = useMemo(
    () => [
      { value: "All", label: isAr ? "كل حالات الاعتماد" : "All Accreditation" },
      { value: "not_required", label: isAr ? "غير مطلوب" : "Not Required" },
      { value: "pending", label: isAr ? "قيد الانتظار" : "Pending" },
      { value: "issued", label: isAr ? "صادر" : "Issued" },
    ],
    [isAr],
  );

  // ── table columns ─────────────────────────────────────────────────────────
  const columns = useMemo(
    () => [
      {
        id: "guest",
        header: isAr ? "الضيف" : "Guest",
        accessorKey: "fullName",
        cell: ({ row: { original: g } }) => {
          const initials = (
            (g.firstName?.[0] || "") + (g.lastName?.[0] || "")
          ).toUpperCase();
          return (
            <div
              style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}
              onClick={(e) => {
                e.stopPropagation();
                onOpenGuest?.(g);
              }}
            >
              <Avatar
                initials={initials}
                size={32}
                tier={g.tier}
                src={g.photoUrl}
              />
              <div>
                <div style={{ fontWeight: 500, fontSize: 13 }}>
                  {g.fullName}
                </div>
                <div style={{ fontSize: 11, color: "var(--ink-mute)" }}>
                  {g.email} { g.organization && ` - ${g.organization}`}
                </div>
              </div>
            </div>
          );
        },
      },
      {
        id: "tier",
        header: isAr ? "الفئة" : "Tier",
        accessorKey: "tier",
        size: 100,
        cell: ({ getValue }) => <TierChip tier={getValue()} lang={lang} />,
      },
      {
        id: "nationality",
        header: isAr ? "الجنسية" : "Nationality",
        accessorKey: "nationalityName",
        size: 130,
        cell: ({ row: { original: g } }) => (
          <span style={{ fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}>
            <FlagIcon code={g.nationalityCode} />
            {g.nationalityName}
          </span>
        ),
      },
      {
        id: "inviteStatus",
        header: isAr ? "حالة الدعوة" : "Invite Status",
        accessorKey: "invitationStatus",
        size: 120,
        cell: ({ getValue }) => <StatusChip status={getValue()} lang={lang} />,
      },

      {
        id: "accreditation",
        header: isAr ? "الاعتماد" : "Accreditation",
        accessorKey: "accreditationStatus",
        size: 110,
        enableSorting: false,
        cell: ({ row: { original: g } }) => {
          if (!g.accreditationRequired) {
            return (
              <span className="chip draft">
                <span className="dot" />
                {isAr ? "غير مطلوب" : "Not Required"}
              </span>
            );
          }
          const issued = g.accreditationStatus === "issued";
          return (
            <span className={`chip ${issued ? "confirmed" : "pending"}`}>
              <span className="dot" />
              {issued ? (isAr ? "صادر" : "Issued") : isAr ? "معلق" : "Pending"}
            </span>
          );
        },
      },
      {
        id: "actions",
        size: 44,
        enableSorting: false,
        cell: ({ row: { original: g } }) => (
          <ActionMenu
            items={[
              {
                label: isAr ? "عرض" : "View",
                icon: "guests",
                onClick: () => navigate(`/guests/${g.id}`),
              },
              {
                label: isAr ? "رسالة" : "Message",
                icon: "message",
                onClick: () => navigate('/support-chat', {
                  state: { guestId: g.id, guestName: g.fullName, guestOrganization: g.organization || '' },
                }),
              },
              !["accepted", "declined"].includes(g.invitationStatus) && {
                label: isAr ? "إرسال الدعوة" : "Send Invite",
                icon: "invitation",
                onClick: () => openEditGuest(g, 4),
              },
              {
                label: isAr ? "تعديل" : "Edit",
                icon: "edit",
                onClick: () => openEditGuest(g),
              },
              {
                label: isAr ? "حذف" : "Delete",
                icon: "trash",
                danger: true,
                onClick: () => { setSelectedGuests([g]); setShowDeleteGuests(true); },
              },
            ]}
          />
        ),
      },
    ],
    [isAr, lang, onOpenGuest, navigate, openEditGuest],
  );

  // ── bulk action callbacks ─────────────────────────────────────────────────
  // Exports every guest matching the current filters, not just the page on
  // screen — so it re-queries with the filters and a page big enough to hold
  // the whole result set.
  async function handleExport() {
    const cols = [
      "Name",
      "Email",
      "Nationality",
      "Tier",
      "Invitation Status",
      "Hotel",
      "Accreditation",
    ];

    let all = guests;
    try {
      const r = await listGuests({
        eventId: activeEventId,
        pageNumber: 1,
        pageSize: Math.max(totalCount, 1),
        search: query || undefined,
        tier: tierFilter !== "All" ? tierFilter : undefined,
        invitationStatus: statusFilter !== "All" ? statusFilter : undefined,
      });
      if (r?.items?.length) all = r.items;
    } catch {
      toast.error(
        isAr
          ? "تعذّر تحميل كل الضيوف — سيتم تصدير الصفحة الحالية فقط"
          : "Could not load all guests — exporting the current page only",
      );
    }

    const rows = all.map((g) =>
      [
        g.fullName,
        g.email,
        g.nationalityName,
        g.tier,
        g.invitationStatus,
        g.hotel,
        g.accreditationStatus,
      ]
        .map((v) => `"${v || ""}"`)
        .join(","),
    );
    const csv = [cols.join(","), ...rows].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "guests.csv";
    a.click();
  }

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            {t.guests?.title?.[0] || "Guest"}{" "}
            <em>{t.guests?.title?.[1]}</em>
          </h1>
          <div className="page-sub">
            {fmtN(totalCount)} guest{totalCount !== 1 ? "s" : ""}
          </div>
        </div>
        <div className="page-actions">
          {selCount > 0 && (
            <>
              <button
                className="btn primary"
                onClick={() => setShowMessage(true)}
              >
                <Icon name="message" size={14} />{" "}
                {t.common?.message || "Message"} ({fmtN(selCount)})
              </button>
              <button className="btn" onClick={() => setShowAccred(true)}>
                <Icon name="badge" size={14} />{" "}
                {t.common?.issueAccreditation || "Issue Accreditation"}
              </button>
              <button
                className="btn"
                style={{ color: "#e05050", borderColor: "rgba(224,80,80,0.4)" }}
                onClick={() => setShowDeleteGuests(true)}
              >
                <Icon name="trash" size={14} />{" "}
                {isAr
                  ? `حذف (${fmtN(selCount)})`
                  : `Delete (${fmtN(selCount)})`}
              </button>
            </>
          )}
          <button className="btn" onClick={() => setShowImport(true)}>
            <Icon name="upload" size={14} /> {isAr ? "استيراد" : "Import"}
          </button>
          <button className="btn" onClick={handleExport}>
            <Icon name="download" size={14} /> {isAr ? "تصدير" : "Export"}
          </button>
          <button
            className="btn primary"
            onClick={() => { ensureGuestFormData(); setShowAddGuest(true); }}
            disabled={!activeEventId}
          >
            <Icon name="plus" size={14} /> {isAr ? "ضيف جديد" : "Add Guest"}
          </button>
        </div>
      </div>

      {/* No event warning */}
      {!activeEventId && (
        <div
          style={{
            marginBottom: 14,
            padding: "10px 16px",
            borderRadius: 10,
            background: "rgba(224,196,126,0.1)",
            border: "1px solid rgba(224,196,126,0.3)",
            fontSize: 13,
            color: "#e0c47e",
          }}
        >
          <Icon name="info" size={14} />{" "}
          {isAr
            ? "يرجى اختيار فعالية أولاً لعرض الضيوف."
            : "Select an active event to view and manage guests."}
        </div>
      )}

      {/* Filter bar */}
      <div className="filter-bar">
        <div className="search" style={{ flex: 1, maxWidth: 320 }}>
          <Icon name="search" size={14} />
          <input
            placeholder={isAr ? "بحث عن ضيف…" : "Search guests…"}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div style={{ position: "relative" }} ref={filterPanelRef}>
          <button
            className="btn"
            onClick={toggleFilterPanel}
            style={{ position: "relative" }}
            title={isAr ? "تصفية" : "Filter"}
          >
            <Icon name="filter" size={14} />
            {isAr ? "تصفية" : "Filter"}
            {activeFilterCount > 0 && (
              <span style={{
                position: "absolute", top: -6, insetInlineEnd: -6,
                minWidth: 16, height: 16, borderRadius: 8, padding: "0 4px",
                background: "var(--accent)", color: "#fff", fontSize: 10, fontWeight: 700,
                display: "grid", placeItems: "center", lineHeight: 1,
              }}>
                {fmtN(activeFilterCount)}
              </span>
            )}
          </button>

          {showFilterPanel && (
            <div style={{
              position: "absolute", top: "calc(100% + 8px)", insetInlineStart: 0,
              width: 320, zIndex: 200, padding: 14, borderRadius: 12,
              background: "var(--popover-bg)", border: "1px solid var(--glass-border-strong)",
              boxShadow: "0 24px 50px -16px rgba(0,0,0,0.7), 0 6px 16px -6px rgba(0,0,0,0.45)",
              display: "flex", flexDirection: "column", gap: 12,
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)" }}>
                  {isAr ? "تصفية الضيوف" : "Filter Guests"}
                </span>
                {activeFilterCount > 0 && (
                  <button
                    onClick={clearAllFilters}
                    style={{ background: "none", border: "none", color: "var(--accent)", fontSize: 11.5, cursor: "pointer", padding: 0 }}
                  >
                    {isAr ? "مسح الكل" : "Clear all"}
                  </button>
                )}
              </div>

              <div>
                <label style={{ display: "block", fontSize: 10.5, color: "var(--ink-mute)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 5 }}>
                  {isAr ? "الفئة" : "Tier"}
                </label>
                <Select
                  value={tierFilter}
                  onChange={(v) => setTierFilter(v || "All")}
                  options={tierFilterOpts}
                  placeholder={isAr ? "الفئة" : "Tier"}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 10.5, color: "var(--ink-mute)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 5 }}>
                  {isAr ? "حالة الدعوة" : "Invitation Status"}
                </label>
                <Select
                  value={statusFilters}
                  onChange={(v) => setStatusFilters(v || [])}
                  options={statusFilterOpts}
                  placeholder={isAr ? "أي حالة" : "Any status"}
                  isMulti
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 10.5, color: "var(--ink-mute)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 5 }}>
                  {isAr ? "المؤسسة" : "Organization"}
                </label>
                <Select
                  value={orgFilter}
                  onChange={(v) => setOrgFilter(v || "All")}
                  options={orgFilterOpts}
                  placeholder={isAr ? "المؤسسة" : "Organization"}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 10.5, color: "var(--ink-mute)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 5 }}>
                  {isAr ? "الجنسية" : "Nationality"}
                </label>
                <Select
                  value={nationalityFilter}
                  onChange={(v) => setNationalityFilter(v || "All")}
                  options={nationalityFilterOpts}
                  placeholder={isAr ? "الجنسية" : "Nationality"}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 10.5, color: "var(--ink-mute)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 5 }}>
                  {isAr ? "حالة الاعتماد" : "Accreditation"}
                </label>
                <Select
                  value={accreditationFilter}
                  onChange={(v) => setAccreditationFilter(v || "All")}
                  options={accreditationFilterOpts}
                  placeholder={isAr ? "حالة الاعتماد" : "Accreditation"}
                />
              </div>
            </div>
          )}
        </div>

        <span
          style={{
            fontSize: 12,
            color: "var(--ink-mute)",
            whiteSpace: "nowrap",
          }}
        >
          {fmtN(guests.length)} {isAr ? "من" : "of"} {fmtN(totalCount)}
        </span>
        {selCount > 0 && (
          <span style={{ fontSize: 12, color: "var(--accent)" }}>
            {fmtN(selCount)} {isAr ? "محدد" : "selected"}
          </span>
        )}
      </div>

      {/* Guest table */}
      <div className="card" style={{ padding: 0 }}>
        <DataTable
          columns={columns}
          data={guests}
          loading={loading}
          emptyText={
            activeEventId
              ? isAr
                ? "لا يوجد ضيوف بعد"
                : "No guests yet"
              : isAr
                ? "اختر فعالية أولاً"
                : "Select an event first"
          }
          showSearch={false}
          manualPagination
          pageSize={pageSize}
          pageIndex={pageIndex}
          totalRows={totalCount}
          onPageChange={setPageIndex}
          onPageSizeChange={setPageSize}
          enableRowSelection
          onSelectionChange={setSelectedGuests}
          selectionResetKey={selResetKey}
          getRowId={(g) => g.id}
        />
      </div>

      {/* ── Modals ───────────────────────────────────────────────────────── */}
      {/* Mounted only while open — GuestModal fetches enums/travel lookups
          (9+ requests) on mount, so leaving these always-mounted fired that
          fan-out on every Guests page visit regardless of whether either
          dialog was ever opened. */}
      {showAddGuest && (
        <GuestModal
          open={showAddGuest}
          onClose={() => setShowAddGuest(false)}
          guest={null}
          activeEventId={activeEventId}
          eventStartDate={activeEvent?.startDate}
          eventEndDate={activeEvent?.endDate}
          nationalities={nationalities}
          organizations={organizations}
          templates={templates}
          sessions={sessions}
          lang={lang}
          onSaved={loadGuests}
        />
      )}

      {!!editGuest && (
        <GuestModal
          open={!!editGuest}
          onClose={() => { setEditGuest(null); setEditGuestStep(1); }}
          guest={editGuest}
          initialStep={editGuestStep}
          activeEventId={activeEventId}
          eventStartDate={activeEvent?.startDate}
          eventEndDate={activeEvent?.endDate}
          nationalities={nationalities}
          organizations={organizations}
          templates={templates}
          sessions={sessions}
          lang={lang}
          onSaved={loadGuests}
        />
      )}

      <MessageModal
        open={showMessage}
        onClose={() => setShowMessage(false)}
        count={selCount}
        lang={lang}
        onSent={() => {
          clearSelection();
          toast.success(
            isAr
              ? `تم إرسال الرسالة إلى ${fmtN(selCount)} ضيف`
              : `Message sent to ${selCount} guest${selCount > 1 ? "s" : ""}`,
          );
        }}
      />

      <AccreditationModal
        open={showAccred}
        onClose={() => setShowAccred(false)}
        count={selCount}
        lang={lang}
        onConfirm={() => {
          setShowAccred(false);
          clearSelection();
          toast.success(isAr ? "تم إصدار الاعتماد" : "Accreditation issued");
        }}
      />

      <DeleteGuestsModal
        open={showDeleteGuests}
        onClose={() => setShowDeleteGuests(false)}
        selectedGuests={selectedGuests}
        activeEventId={activeEventId}
        lang={lang}
        onDeleted={() => {
          clearSelection();
          loadGuests();
        }}
      />

      <ImportModal
        open={showImport}
        onClose={() => setShowImport(false)}
        activeEventId={activeEventId}
        lang={lang}
        onImported={loadGuests}
      />
    </div>
  );
}
