import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getTranslations, fmtNum } from "../i18n/translations";
import { guestsView } from "../i18n/modules/guestsView";
import toast from "../lib/toast";
import { listGuests } from "../api/services/guestService";
import { getNationalities } from "../api/services/nationalityService";
import { getOrganizations } from "../api/services/organizationService";
import { getServiceLevels } from "../api/services/serviceCatalogService";
import { getTemplates } from "../api/services/invitationTemplateService";
import { listSessions, getEvent } from "../api/services/eventService";

import GuestsHeader from "./guests/list/GuestsHeader";
import GuestsFilterBar from "./guests/list/GuestsFilterBar";
import GuestsTable from "./guests/list/GuestsTable";
import GuestsSplitView from "./guests/list/GuestsSplitView";
import GuestModal from "./guests/modals/GuestModal";
import MessageModal from "./guests/modals/MessageModal";
import AccreditationModal from "./guests/modals/AccreditationModal";
import DeleteGuestsModal from "./guests/modals/DeleteGuestsModal";
import "./guests/guests-view.css";

export default function GuestsView({ onOpenGuest, lang, activeEventId }) {
  const t = getTranslations(lang);
  const isAr = lang === "ar";
  const gt = guestsView[isAr ? "ar" : "en"];
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
  // Rows selected in the table — GuestResponse objects whose `id` is an
  // eventGuestId (this event's participation), NOT the master personId.
  const [selectedEventGuests, setSelectedEventGuests] = useState([]);
  const [selResetKey, setSelResetKey] = useState(0);

  // ── view mode: table list, or a master-detail split with the full guest
  // page on the right (reuses GuestDetailView as-is — it just takes an
  // eventGuestId prop).
  const [viewMode, setViewMode] = useState("list");
  const [splitGuests, setSplitGuests] = useState([]);
  const [splitTotalCount, setSplitTotalCount] = useState(0);
  const [splitPageIndex, setSplitPageIndex] = useState(0);
  const SPLIT_PAGE_SIZE = 10;
  const [splitLoading, setSplitLoading] = useState(false);
  // Which participation the split view's right-hand pane is showing.
  const [selectedEventGuestId, setSelectedEventGuestId] = useState(null);
  // Bumped after an action taken from the left card (issue/revoke, edit, delete)
  // so the embedded GuestDetailView on the right remounts and refetches — it
  // owns its own data and has no reload prop of its own.
  const [detailRefreshKey, setDetailRefreshKey] = useState(0);

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

  const selCount = selectedEventGuests.length;
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

  // Row-level delete: single guest from the table's action menu or the split
  // view's expanded card — reuses the same bulk DeleteGuestsModal with a
  // one-item selection.
  const requestDeleteGuest = useCallback((g) => {
    setSelectedEventGuests([g]);
    setShowDeleteGuests(true);
  }, []);

  // The three ways to open Add Guest, chosen from GuestsHeader's dropdown
  // before the modal opens.
  const openAddGuest = useCallback((mode) => {
    ensureGuestFormData();
    setAddGuestMode(mode);
    setShowAddGuest(true);
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
        serviceLevelId: levelFilter !== "All" ? levelFilter : undefined,
        invitationStatuses: statusFilters.length ? statusFilters : undefined,
        organizationId: orgFilter !== "All" ? orgFilter : undefined,
        nationalityId: nationalityFilter !== "All" ? nationalityFilter : undefined,
        accreditationStatus: accreditationFilter !== "All" ? accreditationFilter : undefined,
      });
      setGuests(r?.items || []);
      setTotalCount(r?.totalCount ?? 0);
    } catch (err) {
      // Previous list is kept on purpose, so the toast is the only sign the
      // refresh failed — without it a stale page looked like a fresh one.
      toast.fromError(err, isAr ? 'تعذّر تحميل الضيوف' : 'Could not load guests');
    } finally {
      setLoading(false);
    }
  }, [activeEventId, query, pageIndex, pageSize, levelFilter, statusFilters, orgFilter, nationalityFilter, accreditationFilter, isAr]);

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
    } catch (err) {
      setSplitGuests([]);
      setSplitTotalCount(0);
      toast.fromError(err, isAr ? 'تعذّر تحميل الضيوف' : 'Could not load guests');
    } finally {
      setSplitLoading(false);
    }
  }, [activeEventId, query, splitPageIndex, levelFilter, statusFilters, orgFilter, nationalityFilter, accreditationFilter, isAr]);

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
    if (splitGuests.some((g) => g.id === selectedEventGuestId)) return;
    setSelectedEventGuestId(splitGuests[0]?.id || null);
  }, [viewMode, splitGuests, selectedEventGuestId]);

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
    const onDoc = (e) => {
      // Select portals its menu to <body>, so an option click is outside the
      // panel — without this the panel closes before the choice registers.
      if (e.target instanceof Element
        && e.target.closest(".gms-select__menu, .gms-select__menu-portal")) return;
      if (filterPanelRef.current && !filterPanelRef.current.contains(e.target)) setShowFilterPanel(false);
    };
    const onKey = (e) => { if (e.key === "Escape") setShowFilterPanel(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [showFilterPanel]);

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
      toast.error(gt.exportFallbackError);
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
      <GuestsHeader
        t={t}
        gt={gt}
        isAr={isAr}
        fmtN={fmtN}
        activeEventId={activeEventId}
        selCount={selCount}
        onMessage={() => setShowMessage(true)}
        onDeleteSelected={() => setShowDeleteGuests(true)}
        onExport={handleExport}
        onAddGuest={openAddGuest}
      />

      <GuestsFilterBar
        t={t}
        gt={gt}
        isAr={isAr}
        fmtN={fmtN}
        query={query}
        setQuery={setQuery}
        showFilterPanel={showFilterPanel}
        toggleFilterPanel={toggleFilterPanel}
        filterPanelRef={filterPanelRef}
        activeFilterCount={activeFilterCount}
        clearAllFilters={clearAllFilters}
        levelFilter={levelFilter}
        setLevelFilter={setLevelFilter}
        serviceLevels={serviceLevels}
        statusFilters={statusFilters}
        setStatusFilters={setStatusFilters}
        orgFilter={orgFilter}
        setOrgFilter={setOrgFilter}
        organizations={organizations}
        nationalityFilter={nationalityFilter}
        setNationalityFilter={setNationalityFilter}
        nationalities={nationalities}
        accreditationFilter={accreditationFilter}
        setAccreditationFilter={setAccreditationFilter}
        guestsCount={guests.length}
        totalCount={totalCount}
        selCount={selCount}
        viewMode={viewMode}
        setViewMode={setViewMode}
      />

      {viewMode === "list" ? (
        <GuestsTable
          gt={gt}
          isAr={isAr}
          lang={lang}
          guests={guests}
          loading={loading}
          activeEventId={activeEventId}
          pageIndex={pageIndex}
          pageSize={pageSize}
          totalCount={totalCount}
          onPageChange={setPageIndex}
          onPageSizeChange={setPageSize}
          selResetKey={selResetKey}
          onSelectionChange={setSelectedEventGuests}
          onOpenGuest={onOpenGuest}
          navigate={navigate}
          openEditGuest={openEditGuest}
          onDeleteRequest={requestDeleteGuest}
        />
      ) : (
        <GuestsSplitView
          gt={gt}
          isAr={isAr}
          lang={lang}
          fmtN={fmtN}
          navigate={navigate}
          activeEventId={activeEventId}
          splitLoading={splitLoading}
          splitGuests={splitGuests}
          selectedEventGuestId={selectedEventGuestId}
          setSelectedEventGuestId={setSelectedEventGuestId}
          openEditGuest={openEditGuest}
          onDeleteRequest={requestDeleteGuest}
          splitTotalCount={splitTotalCount}
          splitPageIndex={splitPageIndex}
          setSplitPageIndex={setSplitPageIndex}
          splitPageCount={splitPageCount}
          detailRefreshKey={detailRefreshKey}
        />
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
        guests={selectedEventGuests}
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
          toast.success(gt.accreditationIssuedToast);
        }}
      />

      <DeleteGuestsModal
        open={showDeleteGuests}
        onClose={() => setShowDeleteGuests(false)}
        selectedEventGuests={selectedEventGuests}
        activeEventId={activeEventId}
        lang={lang}
        onDeleted={() => {
          clearSelection();
          loadGuests();
          if (viewMode === "split") {
            // The deleted guest can't stay selected — clearing it lets the
            // auto-select effect below pick the next available guest once
            // the reloaded list lands.
            if (selectedEventGuests.some((g) => g.id === selectedEventGuestId)) setSelectedEventGuestId(null);
            loadSplitGuests();
          }
        }}
      />

    </div>
  );
}
