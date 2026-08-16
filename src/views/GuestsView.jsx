import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { getTranslations, fmtNum } from "../i18n/translations";
import { StatusChip, ServiceLevelChip } from "../components/UI";
import { Icon } from "../components/Icons";
import FlagIcon, { nationalityOptionLabel } from "../components/FlagIcon";
import GuestCell from "../components/GuestCell";
import DataTable from "../components/ui/DataTable";
import ActionMenu from "../components/ui/ActionMenu";
import Select from "../components/ui/Select";
import toast from "../lib/toast";
import { listGuests, issueAccreditation, revokeAccreditation } from "../api/services/guestService";
import { getNationalities } from "../api/services/nationalityService";
import { getOrganizations } from "../api/services/organizationService";
import { getServiceLevels } from "../api/services/serviceCatalogService";
import { getTemplates } from "../api/services/invitationTemplateService";
import { listSessions, getEvent } from "../api/services/eventService";

import GuestModal from "./guests/modals/GuestModal";
import MessageModal from "./guests/modals/MessageModal";
import AccreditationModal from "./guests/modals/AccreditationModal";
import DeleteGuestsModal from "./guests/modals/DeleteGuestsModal";
import GuestDetailView from "./GuestDetailView";

export default function GuestsView({ onOpenGuest, lang, activeEventId }) {
  const t = getTranslations(lang);
  const isAr = lang === "ar";
  const fmtN = (n) => fmtNum(n, lang);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

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
  // Needed by both the filter panel and the guest form's level picker, and it's
  // small + per-event, so it loads with the page rather than lazily.
  const [serviceLevels, setServiceLevels] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [activeEvent, setActiveEvent] = useState(null);
  const [nationalitiesLoaded, setNationalitiesLoaded] = useState(false);
  const [organizationsLoaded, setOrganizationsLoaded] = useState(false);
  const [refDataLoadedForEvent, setRefDataLoadedForEvent] = useState(null);
  const [loading, setLoading] = useState(false);

  // ── filter / selection ────────────────────────────────────────────────────
  const [query, setQuery] = useState("");
  const [levelFilter, setLevelFilter] = useState("All");
  const [statusFilters, setStatusFilters] = useState([]); // multi-select, [] = all
  const [orgFilter, setOrgFilter] = useState("All");
  const [nationalityFilter, setNationalityFilter] = useState("All");
  const [accreditationFilter, setAccreditationFilter] = useState("All");
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [selectedGuests, setSelectedGuests] = useState([]);
  const [selResetKey, setSelResetKey] = useState(0);

  // ── view mode: table list, or a master-detail split with the full guest
  // page on the right (reuses GuestDetailView as-is — it's just a guestId prop).
  const [viewMode, setViewMode] = useState("list");
  const [splitGuests, setSplitGuests] = useState([]);
  const [splitTotalCount, setSplitTotalCount] = useState(0);
  const [splitPageIndex, setSplitPageIndex] = useState(0);
  const SPLIT_PAGE_SIZE = 10;
  const [splitLoading, setSplitLoading] = useState(false);
  const [selectedGuestId, setSelectedGuestId] = useState(null);
  // Bumped after an action taken from the left card (issue/revoke, edit, delete)
  // so the embedded GuestDetailView on the right remounts and refetches — it
  // owns its own data and has no reload prop of its own.
  const [detailRefreshKey, setDetailRefreshKey] = useState(0);
  const [accredBusyId, setAccredBusyId] = useState(null);
  // { guest, action: 'issue' | 'revoke' } — confirmed before either fires.
  const [confirmAccred, setConfirmAccred] = useState(null);

  const activeFilterCount = [
    levelFilter !== "All",
    statusFilters.length > 0,
    orgFilter !== "All",
    nationalityFilter !== "All",
    accreditationFilter !== "All",
  ].filter(Boolean).length;

  const clearAllFilters = () => {
    setLevelFilter("All");
    setStatusFilters([]);
    setOrgFilter("All");
    setNationalityFilter("All");
    setAccreditationFilter("All");
  };

  // ── modal open states ─────────────────────────────────────────────────────
  const [showAddGuest, setShowAddGuest] = useState(false);
  // Which of the three ways to add a guest was picked from the Add Guest
  // dropdown. Chosen BEFORE the modal opens, which is why the modal no longer
  // carries a tab strip — see GuestModal.
  const [addGuestMode, setAddGuestMode] = useState('new');
  const [editGuest, setEditGuest] = useState(null);
  const [editGuestStep, setEditGuestStep] = useState(1);
  const [showMessage, setShowMessage] = useState(false);
  const [showAccred, setShowAccred] = useState(false);
  const [showDeleteGuests, setShowDeleteGuests] = useState(false);
  const [importBatchId, setImportBatchId] = useState(null);

  // Deep-link from an "import finished" notification (?importBatch=<id>) —
  // reopen the Add Guest modal straight into its Import tab, on that batch's
  // results.
  useEffect(() => {
    const batchId = searchParams.get('importBatch');
    if (!batchId) return;
    ensureGuestFormData();
    setImportBatchId(batchId);
    setAddGuestMode('import');
    setShowAddGuest(true);
    const next = new URLSearchParams(searchParams);
    next.delete('importBatch');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  const selCount = selectedGuests.length;
  const clearSelection = () => setSelResetKey((k) => k + 1);

  // Reloaded on every event switch, and after a guest save so the levels'
  // guestCount (which drives the capacity rule) stays accurate.
  const loadServiceLevels = useCallback(() => {
    if (!activeEventId) { setServiceLevels([]); return Promise.resolve(); }
    return getServiceLevels(false)
      .then((r) => setServiceLevels(r || []))
      .catch(() => setServiceLevels([]));
  }, [activeEventId]);

  useEffect(() => { loadServiceLevels(); }, [loadServiceLevels]);

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

  // Issue/Revoke from the split view's active-guest card — mirrors the same
  // two calls GuestDetailView makes for its own (non-embedded) header actions.
  async function handleIssueAccred(g) {
    if (g.invitationStatus !== "accepted") {
      toast.error(isAr ? "يجب قبول الدعوة أولاً" : "Guest must accept the invitation first");
      return;
    }
    setAccredBusyId(g.id);
    try {
      await issueAccreditation(g.id);
      toast.success(isAr ? "تم إصدار الاعتماد" : "Accreditation issued");
      loadSplitGuests();
      setDetailRefreshKey((k) => k + 1);
    } catch (err) {
      toast.error(err.message || (isAr ? "تعذر إصدار الاعتماد" : "Failed to issue accreditation"));
    } finally {
      setAccredBusyId(null);
    }
  }

  async function handleRevokeAccred(g) {
    setAccredBusyId(g.id);
    try {
      await revokeAccreditation(g.id);
      toast.success(isAr ? "تم سحب الاعتماد" : "Accreditation revoked");
      loadSplitGuests();
      setDetailRefreshKey((k) => k + 1);
    } catch (err) {
      toast.error(err.message || (isAr ? "تعذر سحب الاعتماد" : "Failed to revoke accreditation"));
    } finally {
      setAccredBusyId(null);
    }
  }

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
        serviceLevelId: levelFilter !== "All" ? levelFilter : undefined,
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
  }, [activeEventId, query, pageIndex, pageSize, levelFilter, statusFilters, orgFilter, nationalityFilter, accreditationFilter]);

  useEffect(() => {
    loadGuests();
  }, [loadGuests]);

  // Split view's left pane is its own server page — same filters as the table,
  // but its own page size/index, since 10 names fit the compact list far better
  // than the table's page size. Only fetched while that view is on screen.
  const loadSplitGuests = useCallback(async () => {
    if (!activeEventId) { setSplitGuests([]); setSplitTotalCount(0); return; }
    setSplitLoading(true);
    try {
      const r = await listGuests({
        eventId: activeEventId,
        pageNumber: splitPageIndex + 1,
        pageSize: SPLIT_PAGE_SIZE,
        search: query || undefined,
        serviceLevelId: levelFilter !== "All" ? levelFilter : undefined,
        invitationStatuses: statusFilters.length ? statusFilters : undefined,
        organizationId: orgFilter !== "All" ? orgFilter : undefined,
        nationalityId: nationalityFilter !== "All" ? nationalityFilter : undefined,
        accreditationStatus: accreditationFilter !== "All" ? accreditationFilter : undefined,
      });
      setSplitGuests(r?.items || []);
      setSplitTotalCount(r?.totalCount ?? 0);
    } catch {
      setSplitGuests([]);
      setSplitTotalCount(0);
    } finally {
      setSplitLoading(false);
    }
  }, [activeEventId, query, splitPageIndex, levelFilter, statusFilters, orgFilter, nationalityFilter, accreditationFilter]);

  useEffect(() => {
    if (viewMode === "split") loadSplitGuests();
  }, [viewMode, loadSplitGuests]);

  // A filter/search change reshapes the result set — go back to the split
  // list's page 1, same as the table does for its own pagination.
  useEffect(() => {
    setSplitPageIndex(0);
  }, [activeEventId, query, levelFilter, statusFilters, orgFilter, nationalityFilter, accreditationFilter]);

  // Auto-select the first guest whenever the split list (re)loads — including
  // after a filter/page change swaps in a different set, but not spuriously
  // while the same guest is still in the list.
  useEffect(() => {
    if (viewMode !== "split") return;
    if (splitGuests.some((g) => g.id === selectedGuestId)) return;
    setSelectedGuestId(splitGuests[0]?.id || null);
  }, [viewMode, splitGuests, selectedGuestId]);

  const splitPageCount = Math.max(1, Math.ceil(splitTotalCount / SPLIT_PAGE_SIZE));

  // Any change that reshapes the result set has to send us back to page 1 —
  // otherwise a filter that narrows to 3 rows leaves us stranded on page 5.
  useEffect(() => {
    setPageIndex(0);
  }, [activeEventId, query, levelFilter, statusFilters, orgFilter, nationalityFilter, accreditationFilter, pageSize]);

  // Selection can't span pages: only the current page's rows are in memory, so
  // a selection made on page 1 would silently vanish from the bulk actions on
  // page 2. Clearing on navigation makes that visible instead of surprising.
  useEffect(() => {
    clearSelection();
  }, [pageIndex, pageSize, query, levelFilter, statusFilters, orgFilter, nationalityFilter, accreditationFilter]); // eslint-disable-line react-hooks/exhaustive-deps

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
  const levelFilterOpts = useMemo(
    () => [
      { value: "All", label: isAr ? "كل المستويات" : "All Service Levels" },
      ...serviceLevels.map((l) => ({ value: l.id, label: isAr ? (l.nameAr || l.name) : l.name })),
    ],
    [serviceLevels, isAr],
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
      ...nationalities.map((n) => ({ value: n.id, label: (isAr ? n.nameAr : n.name) || n.name, code: n.code })),
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
        cell: ({ row: { original: g } }) => (
          <GuestCell
            name={g.fullName}
            email={g.email}
            photoUrl={g.photoUrl}
            tier={g.tier}
            onOpen={(e) => { e.stopPropagation(); onOpenGuest?.(g); }}
          />
        ),
      },
      {
        id: "serviceLevel",
        header: isAr ? "مستوى الخدمة" : "Service Level",
        accessorKey: "serviceLevelName",
        size: 130,
        cell: ({ row: { original: g } }) => (
          <ServiceLevelChip
            name={g.serviceLevelName}
            nameAr={g.serviceLevelNameAr}
            color={g.serviceLevelColor}
            lang={lang}
          />
        ),
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
      "Service Level",
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
        // Mirrors the list query above. `statusFilter` (singular) never existed
        // — it was left behind when the filter became multi-select, so Export
        // threw "statusFilter is not defined" and, once that was fixed, would
        // still have ignored the org/nationality/accreditation filters and
        // exported rows the user had filtered out.
        serviceLevelId: levelFilter !== "All" ? levelFilter : undefined,
        invitationStatuses: statusFilters.length ? statusFilters : undefined,
        organizationId: orgFilter !== "All" ? orgFilter : undefined,
        nationalityId: nationalityFilter !== "All" ? nationalityFilter : undefined,
        accreditationStatus: accreditationFilter !== "All" ? accreditationFilter : undefined,
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
        g.serviceLevelName || g.tier,
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
            {/* {fmtN(totalCount)} guest{totalCount !== 1 ? "s" : ""} */}
            <span style={{ color: "var(--hayya-sub-color)" }}>
              {isAr ? "متوافق مع نظام هيّا" : "Registry Compliant with Hayya"}
            </span>
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
          <button className="btn" onClick={handleExport}>
            <Icon name="download" size={14} /> {isAr ? "تصدير" : "Export"}
          </button>
          {/* Three ways in, chosen here rather than as tabs inside the dialog —
              so each one opens straight into a single-purpose modal. */}
          <ActionMenu
            align="end"
            menuWidth={286}
            disabled={!activeEventId}
            trigger={({ open, toggle, ref }) => (
              <button
                ref={ref}
                type="button"
                className="btn primary"
                onClick={toggle}
                disabled={!activeEventId}
                aria-haspopup="menu"
                aria-expanded={open}
              >
                <Icon name="plus" size={14} /> {isAr ? "ضيف جديد" : "Add Guest"}
                <Icon name="chevronDown" size={13} style={{ marginInlineStart: 2 }} />
              </button>
            )}
            items={[
              {
                label: isAr ? "ضيف جديد" : "New Guest",
                hint: isAr ? "إدخال ضيف واحد خطوة بخطوة" : "Enter one guest step by step",
                icon: "plus",
                onClick: () => { ensureGuestFormData(); setAddGuestMode("new"); setShowAddGuest(true); },
              },
              {
                label: isAr ? "ضيف حالي" : "Existing Guest",
                hint: isAr ? "انسخ ضيوفاً من فعالية أخرى" : "Copy guests from another event",
                icon: "guests",
                onClick: () => { ensureGuestFormData(); setAddGuestMode("existing"); setShowAddGuest(true); },
              },
              {
                label: isAr ? "استيراد من CSV" : "Import from CSV",
                hint: isAr ? "أضف عدة ضيوف من ملف" : "Add many guests from a file",
                icon: "upload",
                onClick: () => { ensureGuestFormData(); setAddGuestMode("import"); setShowAddGuest(true); },
              },
            ]}
          />
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
                  {isAr ? "مستوى الخدمة" : "Service Level"}
                </label>
                <Select
                  value={levelFilter}
                  onChange={(v) => setLevelFilter(v || "All")}
                  options={levelFilterOpts}
                  placeholder={isAr ? "مستوى الخدمة" : "Service Level"}
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
                  formatOptionLabel={nationalityOptionLabel}
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

        {/* List / Overview toggle — pushed to the far right of the filter row. */}
        <div className="tabs" style={{ marginInlineStart: "auto" }}>
          <button
            type="button"
            className={viewMode === "list" ? "active" : ""}
            title={isAr ? "عرض القائمة" : "List view"}
            aria-pressed={viewMode === "list"}
            onClick={() => setViewMode("list")}
            style={{ display: "grid", placeItems: "center", padding: "7px 10px" }}
          >
            <Icon name="reports" size={15} />
          </button>
          <button
            type="button"
            className={viewMode === "split" ? "active" : ""}
            title={isAr ? "عرض التفاصيل" : "Overview"}
            aria-pressed={viewMode === "split"}
            onClick={() => setViewMode("split")}
            style={{ display: "grid", placeItems: "center", padding: "7px 10px" }}
          >
            <Icon name="guests" size={15} />
          </button>
        </div>
      </div>

      {viewMode === "list" ? (
        /* Guest table */
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
      ) : (
        /* Split view — a compact all-matching-guests list on the left, the
           full Guest Detail page (unchanged, same component the standalone
           /guests/:id route renders) on the right for whichever is selected. */
        <div className="card" style={{ padding: 0, display: "flex", minHeight: 480, overflow: "hidden" }}>
          <div style={{
            width: 280, flexShrink: 0, borderInlineEnd: "1px solid var(--glass-border)",
            display: "flex", flexDirection: "column",
          }}>
            <div style={{ flex: 1, overflowY: "auto", maxHeight: 660 }}>
              {splitLoading ? (
                <div style={{ padding: 20, textAlign: "center", color: "var(--ink-mute)", fontSize: 12.5 }}>
                  {isAr ? "جارٍ التحميل…" : "Loading…"}
                </div>
              ) : splitGuests.length === 0 ? (
                <div style={{ padding: 20, textAlign: "center", color: "var(--ink-mute)", fontSize: 12.5 }}>
                  {activeEventId
                    ? (isAr ? "لا يوجد ضيوف بعد" : "No guests yet")
                    : (isAr ? "اختر فعالية أولاً" : "Select an event first")}
                </div>
              ) : (
                splitGuests.map((g) => {
                  const active = g.id === selectedGuestId;
                  const canIssue = g.invitationStatus === "accepted";
                  const issued = g.accreditationStatus === "issued";
                  return (
                    <div
                      key={g.id}
                      style={{
                        padding: active ? "13px 14px" : "10px 14px",
                        borderBottom: "1px solid var(--glass-border)",
                        background: active ? "var(--surface-soft-4)" : "transparent",
                        borderInlineStart: active ? "3px solid var(--accent)" : "3px solid transparent",
                        transition: "padding 0.2s ease, background 0.2s ease",
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedGuestId(g.id)}
                        style={{
                          display: "flex", alignItems: "center", gap: 8, width: "100%",
                          padding: 0, border: "none", background: "transparent",
                          textAlign: isAr ? "right" : "left", cursor: "pointer",
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <GuestCell
                            name={g.fullName || `${g.firstName || ""} ${g.lastName || ""}`.trim()}
                            email={g.email}
                            photoUrl={g.photoUrl}
                            size={active ? 46 : 30}
                          />
                        </div>
                        {/* Points at the detail that opens for this row. */}
                        <Icon
                          name="chevronRight"
                          size={13}
                          style={{
                            flexShrink: 0,
                            color: active ? "var(--accent)" : "var(--ink-faint)",
                            transform: isAr ? "scaleX(-1)" : "none",
                          }}
                        />
                      </button>

                      {/* The selected guest expands in place into a basic-info
                          card with its own actions, so who you're looking at
                          stays anchored to the row you clicked rather than
                          only in the pane opposite. */}
                      <AnimatePresence initial={false}>
                        {active && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                            style={{ overflow: "hidden" }}
                          >
                            <div style={{
                              marginTop: 11, paddingTop: 11, borderTop: "1px solid var(--glass-border)",
                              // Lines up with the name/email text above, not the
                              // avatar — 46px avatar + 8px gap from GuestCell.
                              paddingInlineStart: 54,
                              display: "flex", flexDirection: "column", gap: 9,
                            }}>
                              {/* Organization lives on the detail pane's
                                  Personal Info card — the list stays name,
                                  email and the actions. */}
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                <button
                                  type="button" className="icon-btn" title={isAr ? "رسالة" : "Message"}
                                  onClick={() => navigate("/support-chat", {
                                    state: { guestId: g.id, guestName: g.fullName, guestOrganization: g.organization || "" },
                                  })}
                                >
                                  <Icon name="message" size={14} />
                                </button>
                                {g.accreditationRequired && (
                                  issued ? (
                                    <button
                                      type="button" className="icon-btn" style={{ color: "var(--danger)" }}
                                      disabled={accredBusyId === g.id}
                                      title={isAr ? "سحب الاعتماد" : "Revoke Accreditation"}
                                      onClick={() => setConfirmAccred({ guest: g, action: "revoke" })}
                                    >
                                      <Icon name="x" size={14} />
                                    </button>
                                  ) : (
                                    <button
                                      type="button" className="icon-btn"
                                      disabled={accredBusyId === g.id || !canIssue}
                                      title={canIssue
                                        ? (isAr ? "إصدار الاعتماد" : "Issue Accreditation")
                                        : (isAr ? "يجب قبول الدعوة أولاً" : "Guest must accept the invitation first")}
                                      onClick={() => setConfirmAccred({ guest: g, action: "issue" })}
                                    >
                                      <Icon name="badge" size={14} />
                                    </button>
                                  )
                                )}
                                <button
                                  type="button" className="icon-btn" title={isAr ? "تعديل" : "Edit"}
                                  onClick={() => openEditGuest(g)}
                                >
                                  <Icon name="edit" size={14} />
                                </button>
                                <button
                                  type="button" className="icon-btn" style={{ color: "var(--danger)" }}
                                  title={isAr ? "حذف" : "Delete"}
                                  onClick={() => { setSelectedGuests([g]); setShowDeleteGuests(true); }}
                                >
                                  <Icon name="trash" size={14} />
                                </button>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })
              )}
            </div>

            {/* Change page — navigate to another 10 guests. Always visible
                (not just once there's a second page) so it's clear this
                list is paginated rather than showing everyone. */}
            {splitTotalCount > 0 && (
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "8px 12px", borderTop: "1px solid var(--glass-border)", flexShrink: 0,
              }}>
                <button
                  type="button" className="icon-btn" style={{ width: 28, height: 28, transform: "scaleX(-1)" }}
                  disabled={splitPageIndex === 0}
                  onClick={() => setSplitPageIndex((p) => Math.max(0, p - 1))}
                >
                  <Icon name="chevronRight" size={13} />
                </button>
                <span style={{ fontSize: 11.5, color: "var(--ink-mute)" }}>
                  {isAr
                    ? `صفحة ${fmtN(splitPageIndex + 1)} من ${fmtN(splitPageCount)}`
                    : `Page ${splitPageIndex + 1} of ${splitPageCount}`}
                </span>
                <button
                  type="button" className="icon-btn" style={{ width: 28, height: 28 }}
                  disabled={splitPageIndex + 1 >= splitPageCount}
                  onClick={() => setSplitPageIndex((p) => Math.min(splitPageCount - 1, p + 1))}
                >
                  <Icon name="chevronRight" size={13} />
                </button>
              </div>
            )}
          </div>
          <div style={{ flex: 1, overflowY: "auto", maxHeight: 720, padding: 16 }}>
            {selectedGuestId ? (
              <GuestDetailView key={`${selectedGuestId}-${detailRefreshKey}`} guestId={selectedGuestId} lang={lang} embedded />
            ) : (
              <div style={{ padding: 20, textAlign: "center", color: "var(--ink-mute)", fontSize: 12.5 }}>
                {isAr ? "اختر ضيفاً لعرض تفاصيله" : "Select a guest to view their details"}
              </div>
            )}
          </div>
        </div>
      )}


      {/* ── Modals ───────────────────────────────────────────────────────── */}
      {/* Mounted only while open — GuestModal fetches enums/travel lookups
          (9+ requests) on mount, so leaving these always-mounted fired that
          fan-out on every Guests page visit regardless of whether either
          dialog was ever opened. */}
      {showAddGuest && (
        <GuestModal
          open={showAddGuest}
          onClose={() => { setShowAddGuest(false); setImportBatchId(null); }}
          guest={null}
          activeEventId={activeEventId}
          eventStartDate={activeEvent?.startDate}
          eventEndDate={activeEvent?.endDate}
          nationalities={nationalities}
          organizations={organizations}
          serviceLevels={serviceLevels}
          templates={templates}
          sessions={sessions}
          lang={lang}
          onSaved={() => { loadGuests(); loadServiceLevels(); }}
          initialMode={importBatchId ? "import" : addGuestMode}
          initialImportBatchId={importBatchId}
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
          serviceLevels={serviceLevels}
          templates={templates}
          sessions={sessions}
          lang={lang}
          onSaved={() => {
            loadGuests();
            loadServiceLevels();
            if (viewMode === "split") { loadSplitGuests(); setDetailRefreshKey((k) => k + 1); }
          }}
        />
      )}

      <MessageModal
        open={showMessage}
        onClose={() => setShowMessage(false)}
        guests={selectedGuests}
        lang={lang}
        // The modal itself reports success/partial-failure — this just clears
        // the selection once at least one send went through.
        onSent={({ sent }) => { if (sent > 0) clearSelection(); }}
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
          if (viewMode === "split") {
            // The deleted guest can't stay selected — clearing it lets the
            // auto-select effect below pick the next available guest once
            // the reloaded list lands.
            if (selectedGuests.some((g) => g.id === selectedGuestId)) setSelectedGuestId(null);
            loadSplitGuests();
          }
        }}
      />

      {/* Confirm before an accreditation issue/revoke from the split view's
          active-guest card — same "are you sure" beat as Delete, just a
          lighter inline dialog since there's nothing else to review first. */}
      {confirmAccred && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 1200, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
          onClick={() => setConfirmAccred(null)}
        >
          <div
            className="card glass modal-solid"
            style={{ width: 400, maxWidth: "94vw", padding: "24px 24px 20px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 10 }}>
              {confirmAccred.action === "issue"
                ? (isAr ? "إصدار الاعتماد؟" : "Issue accreditation?")
                : (isAr ? "سحب الاعتماد؟" : "Revoke accreditation?")}
            </div>
            <div style={{ fontSize: 13, color: "var(--ink-mute)", lineHeight: 1.6, marginBottom: 22 }}>
              {confirmAccred.action === "issue" ? (
                isAr
                  ? <>سيتم إصدار شارة الاعتماد لـ <strong style={{ color: "var(--ink)" }}>{confirmAccred.guest.fullName}</strong>.</>
                  : <>This issues an accreditation badge for <strong style={{ color: "var(--ink)" }}>{confirmAccred.guest.fullName}</strong>.</>
              ) : (
                isAr
                  ? <>سيتم سحب اعتماد <strong style={{ color: "var(--ink)" }}>{confirmAccred.guest.fullName}</strong> الصادر مسبقاً.</>
                  : <>This revokes the previously issued accreditation for <strong style={{ color: "var(--ink)" }}>{confirmAccred.guest.fullName}</strong>.</>
              )}
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button className="btn" onClick={() => setConfirmAccred(null)} disabled={accredBusyId === confirmAccred.guest.id}>
                {isAr ? "إلغاء" : "Cancel"}
              </button>
              <button
                className="btn primary"
                disabled={accredBusyId === confirmAccred.guest.id}
                onClick={async () => {
                  const { guest, action } = confirmAccred;
                  if (action === "issue") await handleIssueAccred(guest);
                  else await handleRevokeAccred(guest);
                  setConfirmAccred(null);
                }}
              >
                {accredBusyId === confirmAccred.guest.id
                  ? (isAr ? "جارٍ…" : "Working…")
                  : confirmAccred.action === "issue" ? (isAr ? "إصدار" : "Issue") : (isAr ? "سحب" : "Revoke")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
