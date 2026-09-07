import React, {
  useState,
  useRef,
  useMemo,
  useEffect,
  useCallback,
} from "react";
import { useNavigate } from "react-router-dom";
import { fmtNum, toArDigits } from "../i18n/translations.js";
import { travelView } from "../i18n/modules/travelView.js";
import { Icon } from "../components/Icons.jsx";
import { useAccess } from "../auth/AccessContext.jsx";
import toast from "../lib/toast.js";
import { getGuestPicker } from "../api/services/guestService.js";
import { getEvent } from "../api/services/eventService.js";
import {
  getEventFlights,
  getEventAccommodation,
  getEventTransport,
  getEventArrivalsDepartures,
  getGuestTravel,
  saveGuestTravel,
  getTravelLookups,
  deleteFlight,
  deleteAccommodation,
  deleteTransport,
} from "../api/services/travelService.js";
import { addDaysIso, fmtDate } from "../lib/date.js";
import {
  useAvailableVehicles,
  useAvailableDrivers,
} from "../lib/useAvailableVehicles.js";
import {
  useHotelRoomTypes,
  useRoomAvailability,
} from "../lib/useRoomInventory.js";
import {
  EMPTY_TRAVEL,
  hydrateTravel,
  anyTravelEnabled,
  buildTravelPayload,
  validateTravel,
  flightTypeLabel,
} from "./guests/modals/TravelAccordion.jsx";
import {
  getGuestServicePlan,
  getServices,
  getServiceEntries,
  saveGuestServiceEntry,
} from "../api/services/serviceCatalogService.js";
import ServiceOpsView from "./ServiceOpsView.jsx";
import BookingModal from "./serviceOps/BookingModal.jsx";
import {
  TRAVEL_SECTION,
  validateServices,
  slotHasData,
  slotExtras,
} from "./guests/ServiceAccordion.jsx";
import { allFormFields } from "../components/ui/DynamicFields.jsx";
import { loadLookupOptions } from "../components/ui/lookupSources.js";

import {
  AD_SERVICE_CODE,
  DATE_MARGIN_DAYS,
  TYPE_TO_SECTION,
  GUEST_PAGE_SIZE,
  downloadCsv,
  toCsv,
  csvSection,
  FLIGHT_EXPORT_HEADERS,
  flightExportRows,
  HOTEL_EXPORT_HEADERS,
  hotelExportRows,
  TRANSFER_EXPORT_HEADERS,
  transferExportRows,
  movementExportHeaders,
  movementExportRows,
  serviceEntryExportHeaders,
  serviceEntryExportRows,
  groupByGuest,
  mapFlight,
  mapHotel,
  mapTransfer,
  DRIVER_TYPE_INFO,
} from "./travel/travelView.helpers.js";
import { buildBookingColumns, buildAdColumns } from "./travel/columns.jsx";
import TravelKpiGrid from "./travel/TravelKpiGrid.jsx";
import TravelTabsBar from "./travel/TravelTabsBar.jsx";
import FlightsTab from "./travel/FlightsTab.jsx";
import HotelTab from "./travel/HotelTab.jsx";
import TransfersTab from "./travel/TransfersTab.jsx";
import ArrivalsDeparturesTab from "./travel/ArrivalsDeparturesTab.jsx";
import EditBookingModal from "./travel/EditBookingModal.jsx";
import NewBookingModal from "./travel/NewBookingModal.jsx";

// One filter bag per built-in tab rather than a state per control: each tab
// carries several filters now (Service Level is shared by all three), and a bag
// keeps "clear all", the badge count and "is anything applied?" to one line
// each. Module scope so they're stable identities for comparison.
// Every service is a permission row of its own (service-<code>, kept in step by
// ServiceCatalogService), so a role granted the Services PAGE still only sees
// the tabs it holds. Arrivals & Departures is granted on its OWN code, not
// Flight's: it is built from flight legs, but a role given the board should not
// have to be given Flights as well — which is what riding on Flight's code
// forced. Matches the endpoint's PermissionCodes.ServiceArrivalDeparture.
const svcCode = (code) => `service-${String(code || "").trim().toLowerCase()}`;
const BUILTIN_TAB_CODES = [
  svcCode("flight"),
  svcCode("accommodation"),
  svcCode("transport"),
  svcCode(AD_SERVICE_CODE),
];

const EMPTY_F = { status: "All", level: "All", org: "All", type: "All", cls: "All" };
const EMPTY_H = { hotel: "All", level: "All", org: "All", room: "All" };
const EMPTY_T = { status: "All", level: "All", driverType: "All" };

// How many of `values` differ from their unfiltered default.
const changedFrom = (values, empty) =>
  Object.keys(empty).filter((k) => values[k] !== empty[k]).length;

// ─── Main component ───────────────────────────────────────────────────────────

export default function TravelView({ lang, activeEventId }) {
  const isAr = lang === "ar";
  const navigate = useNavigate();
  const { canRead, canWrite } = useAccess();
  // Same code the backend's [HasPermission] policy checks — no write, no write UI.
  const canManage = canWrite("services");
  const fmtN = (n) => fmtNum(n, lang);
  const ad = (s) => (isAr ? toArDigits(String(s)) : String(s));

  const STR = travelView[isAr ? "ar" : "en"];

  const [activeEvent, setActiveEvent] = useState(null);
  useEffect(() => {
    if (!activeEventId) {
      setActiveEvent(null);
      return;
    }
    getEvent(activeEventId)
      .then(setActiveEvent)
      .catch(() => setActiveEvent(null));
  }, [activeEventId]);
  const eventMinDate = activeEvent?.startDate || undefined;
  const eventMaxDate = activeEvent?.endDate || undefined;
  const dateWindowMin = useMemo(
    () => addDaysIso(activeEvent?.startDate, -DATE_MARGIN_DAYS) || undefined,
    [activeEvent?.startDate],
  );
  const dateWindowMax = useMemo(
    () => addDaysIso(activeEvent?.endDate, DATE_MARGIN_DAYS) || undefined,
    [activeEvent?.endDate],
  );

  // ── Per-tab booking rows — each tab pulls from its own table via its own
  //    endpoint, lazily on first open, refetched when the active event changes
  //    (or explicitly via refetchTab() after a save touches that tab).
  const [flightRows, setFlightRows] = useState([]);
  const [hotelRows, setHotelRows] = useState([]);
  const [transferRows, setTransferRows] = useState([]);
  const [tabLoading, setTabLoading] = useState({
    0: false,
    1: false,
    2: false,
  });
  const loadedRef = useRef({ 0: null, 1: null, 2: null }); // tab -> eventId already loaded

  // (The A&D headline number is computed below, once the board's own state
  //  exists — see `travellingGuests`.)

  const TAB_SVC = [getEventFlights, getEventAccommodation, getEventTransport];
  const TAB_SET = [setFlightRows, setHotelRows, setTransferRows];
  const TAB_MAP = [mapFlight, mapHotel, mapTransfer];

  async function refetchTab(idx) {
    // Arrivals & departures (tab 3) loads itself — it has no TAB_SVC entry.
    if (!activeEventId || !TAB_SVC[idx]) return;
    setTabLoading((l) => ({ ...l, [idx]: true }));
    try {
      // Paged endpoint → { items, totalCount, … }.
      const res = await TAB_SVC[idx](activeEventId);
      TAB_SET[idx]((res?.items || []).map(TAB_MAP[idx]));
      loadedRef.current[idx] = activeEventId;
    } catch (err) {
      toast.fromError(err);
    } finally {
      setTabLoading((l) => ({ ...l, [idx]: false }));
    }
  }

  // ── UI state ────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState(0);

  // Which built-in tabs this role may read. Indexes are kept as they are rather
  // than re-numbered — the panels below, the KPI cards and refetchTab all still
  // address a tab by its original position.
  const allowedTabs = useMemo(
    () => [0, 1, 2, 3].filter((i) => canRead(BUILTIN_TAB_CODES[i])),
    [canRead],
  );

  // Dynamic services share this page's tab strip: the three built-in tabs (plus
  // Arrivals & Departures) are relational and rendered here, everything else in
  // the catalogue is rendered by ServiceOpsView embedded below. `svcId` set means
  // a dynamic tab is showing, so none of the built-in panels do.
  const [dynServices, setDynServices] = useState([]);
  const [svcId, setSvcId] = useState(null);
  const builtinTab = svcId ? -1 : activeTab;

  // A dynamic service coded "arrivals-departures" is the same subject as the
  // built-in board, so it does NOT get its own tab — two tabs with one name read
  // as a bug. Its entries are joined onto the board instead, one row per guest.
  const [adService, setAdService] = useState(null);

  useEffect(() => {
    getServices(false)
      .then((list) => {
        const dynamic = (list || []).filter((s) => !s.isSystem);
        const ad =
          dynamic.find(
            (s) => (s.code || "").toLowerCase() === AD_SERVICE_CODE,
          ) || null;
        // The catalogue endpoint is open to any signed-in user (the guest form
        // needs it), so the tabs are filtered here — and the entries endpoint
        // 403s anyway, which is the check that actually enforces this.
        setAdService(ad && canRead(svcCode(AD_SERVICE_CODE)) ? ad : null);
        setDynServices(
          dynamic
            .filter((s) => !ad || s.id !== ad.id)
            .filter((s) => canRead(svcCode(s.code))),
        );
      })
      .catch(() => {
        setDynServices([]);
        setAdService(null);
      });
  }, [canRead]);

  // That service's entries for this event, keyed by guest so the board can hang
  // them off the flight rows. Fetched in one generous page rather than paged: the
  // spine below pages by GUEST, so a page of entries wouldn't line up with it.
  const [adEntries, setAdEntries] = useState({});
  const [adLookups, setAdLookups] = useState({});
  // The entry being edited on the Arrivals & Departures board (the dynamic
  // "arrivals-departures" service's own data, not a flight leg) — null when
  // the edit modal is closed.
  const [adEditEntry, setAdEditEntry] = useState(null);

  const loadAdEntries = useCallback(() => {
    if (!adService || !activeEventId) {
      setAdEntries({});
      return;
    }
    getServiceEntries(adService.id, {
      eventId: activeEventId,
      pageNumber: 1,
      pageSize: 500,
    })
      .then((res) => {
        const byGuest = {};
        (res?.items || []).forEach((e) => {
          if (!e.eventGuestId) return;
          // A guest may hold several entries; the board shows one row per guest,
          // so they stack inside the cell.
          byGuest[e.eventGuestId] = [...(byGuest[e.eventGuestId] || []), e];
        });
        setAdEntries(byGuest);
      })
      .catch(() => setAdEntries({}));
  }, [adService, activeEventId]);

  useEffect(() => { loadAdEntries(); }, [loadAdEntries]);

  // Lookup-backed fields store ids; these turn them back into labels, same cache
  // the forms use.
  useEffect(() => {
    if (!adService) return;
    const keys = [
      ...new Set(
        allFormFields(adService.form)
          .filter((f) => f.type === "lookup" && f.sourceKey)
          .map((f) => f.sourceKey),
      ),
    ];
    if (keys.length === 0) return;
    let cancelled = false;
    Promise.all(
      keys.map((k) => loadLookupOptions(k).then((opts) => [k, opts])),
    ).then((pairs) => {
      if (!cancelled) setAdLookups(Object.fromEntries(pairs));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adService]);

  // (A guest whose only record is an "arrival-departure" entry used to be
  // counted here and shown as a footnote, because the flight-derived board had
  // no row to carry them. The board's own query now includes them, so there is
  // nothing left to count — see TravelService.GetEventArrivalsDeparturesAsync.)

  const adDisplay = useCallback(
    (field, raw) => {
      if (raw == null || raw === "") return "—";
      if (field.type === "lookup") {
        const hit = (adLookups[field.sourceKey] || []).find(
          (o) => o.value === String(raw),
        );
        return hit ? hit.label : String(raw);
      }
      if (field.type === "select") {
        const hit = (field.options || []).find((o) => o.value === String(raw));
        return (isAr ? hit?.labelAr : null) || hit?.label || String(raw);
      }
      if (field.type === "checkbox")
        return raw === "true" ? (isAr ? "نعم" : "Yes") : isAr ? "لا" : "No";
      if (field.type === "datetime")
        return String(raw).replace("T", " ").slice(0, 16);
      if (field.type === "date") return fmtDate(raw);
      return String(raw);
    },
    [adLookups, isAr],
  );

  // A service that stops existing (deactivated, deleted) must not leave the page
  // showing an empty tab.
  useEffect(() => {
    if (svcId && !dynServices.some((s) => s.id === svcId)) setSvcId(null);
  }, [dynServices, svcId]);

  // Neither must a tab this role cannot read. With no built-in tab allowed the
  // page opens on the first dynamic service instead of on nothing.
  useEffect(() => {
    if (svcId) return;
    if (allowedTabs.length === 0) {
      if (dynServices.length) setSvcId(dynServices[0].id);
      return;
    }
    if (!allowedTabs.includes(activeTab)) setActiveTab(allowedTabs[0]);
  }, [allowedTabs, activeTab, svcId, dynServices]);

  useEffect(() => {
    if (!activeEventId) {
      setFlightRows([]);
      setHotelRows([]);
      setTransferRows([]);
      loadedRef.current = { 0: null, 1: null, 2: null };
      return;
    }
    // Only the allowed ones: the endpoints are gated per service, so fetching a
    // tab this role cannot read would be a guaranteed 403 and a toast to match.
    [0, 1, 2].forEach((idx) => {
      if (!allowedTabs.includes(idx)) return;
      if (loadedRef.current[idx] !== activeEventId) refetchTab(idx);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeEventId, allowedTabs]);

  const [adRows, setAdRows] = useState([]);
  const [adTotal, setAdTotal] = useState(0);
  const [adLoading, setAdLoading] = useState(false);
  const [adSearchInput, setAdSearchInput] = useState("");
  const [adSearch, setAdSearch] = useState("");
  const [adDirection, setAdDirection] = useState("all");
  const [adFrom, setAdFrom] = useState("");
  const [adTo, setAdTo] = useState("");
  const [adPageIndex, setAdPageIndex] = useState(0);
  const [adPageSize, setAdPageSize] = useState(10);
  const [adLoaded, setAdLoaded] = useState(false);

  const travellingGuests = useMemo(
    () => (adLoaded
      ? adTotal
      : new Set(flightRows.map((f) => f.eventGuestId).filter(Boolean)).size),
    [adLoaded, adTotal, flightRows],
  );

  // Debounce typing so each keystroke doesn't fire a request.
  useEffect(() => {
    const t = setTimeout(() => setAdSearch(adSearchInput.trim()), 400);
    return () => clearTimeout(t);
  }, [adSearchInput]);

  // Anything that reshapes the result set returns to page 1.
  useEffect(() => {
    setAdPageIndex(0);
  }, [activeEventId, adSearch, adDirection, adFrom, adTo, adPageSize]);

  const adReqSeq = useRef(0);
  useEffect(() => {
    if (activeTab !== 3 || !activeEventId) return undefined;
    const seq = ++adReqSeq.current;
    const current = () => seq === adReqSeq.current;
    setAdLoading(true);
    getEventArrivalsDepartures(activeEventId, {
      pageNumber: adPageIndex + 1, // API pages are 1-based
      pageSize: adPageSize,
      search: adSearch || undefined,
      direction: adDirection,
      fromDate: adFrom || undefined,
      toDate: adTo || undefined,
    })
      .then((r) => {
        if (current()) {
          setAdRows(r?.items || []);
          setAdTotal(r?.totalCount ?? 0);
          // From here the KPI card reports the board's own total rather than
          // guessing from the flights list.
          setAdLoaded(true);
        }
      })
      .catch((err) => {
        if (current()) {
          setAdRows([]);
          setAdTotal(0);
          toast.fromError(err);
        }
      })
      .finally(() => {
        if (current()) setAdLoading(false);
      });
    return undefined;
  }, [
    activeTab,
    activeEventId,
    adPageIndex,
    adPageSize,
    adSearch,
    adDirection,
    adFrom,
    adTo,
  ]);

  const [fSearch, setFSearch] = useState("");
  const [fFilters, setFFilters] = useState(EMPTY_F);
  const [hSearch, setHSearch] = useState("");
  const [hFilters, setHFilters] = useState(EMPTY_H);
  const [tSearch, setTSearch] = useState("");
  const [tFilters, setTFilters] = useState(EMPTY_T);

  const setF = (k, v) => setFFilters((p) => ({ ...p, [k]: v }));
  const setH = (k, v) => setHFilters((p) => ({ ...p, [k]: v }));
  const setT = (k, v) => setTFilters((p) => ({ ...p, [k]: v }));

  // Is the tab on screen actually narrowed right now? Drives whether "Export
  // filtered view" is offered at all — with nothing applied it would produce
  // the same file as "Export current service" under a name implying otherwise.
  // Search counts: it narrows the table just as much as a dropdown does.
  const activeFilterCount = useMemo(() => {
    // A dynamic service tab keeps its filters inside ServiceOpsView, so there's
    // nothing here to report on.
    if (svcId) return 0;
    if (builtinTab === 0) return (fSearch ? 1 : 0) + changedFrom(fFilters, EMPTY_F);
    if (builtinTab === 1) return (hSearch ? 1 : 0) + changedFrom(hFilters, EMPTY_H);
    if (builtinTab === 2) return (tSearch ? 1 : 0) + changedFrom(tFilters, EMPTY_T);
    if (builtinTab === 3) {
      return (adSearch ? 1 : 0) + (adDirection !== "all" ? 1 : 0)
        + (adFrom ? 1 : 0) + (adTo ? 1 : 0);
    }
    return 0;
  }, [
    svcId, builtinTab,
    fSearch, fFilters, hSearch, hFilters, tSearch, tFilters,
    adSearch, adDirection, adFrom, adTo,
  ]);

  // ── Travel lookups (shared by New Booking + every Edit modal) ──────────────
  const [travelLookups, setTravelLookups] = useState({});
  useEffect(() => {
    getTravelLookups(activeEventId)
      .then(setTravelLookups)
      .catch(() => setTravelLookups({}));
  }, [activeEventId]);

  // { type, eventGuestId, guestName, form } | { type, loading: true }
  // eventGuestId is the row's participation id — what POST /travel/guest/{eventGuestId} takes.
  const [editModal, setEditModal] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const isTransferEdit = editModal?.type === "transfer";
  const editVehicles = useAvailableVehicles({
    pickupTime: isTransferEdit ? editModal?.form?.pickupTime : "",
    dropoffTime: isTransferEdit ? editModal?.form?.dropoffTime : "",
    eventId: activeEventId,
    excludeTransportId: editModal?.form?.id,
    fallback: travelLookups.vehicles,
  });

  // Same for its driver dropdown — drivers with no ride in that window.
  const editDrivers = useAvailableDrivers({
    pickupTime: isTransferEdit ? editModal?.form?.pickupTime : "",
    dropoffTime: isTransferEdit ? editModal?.form?.dropoffTime : "",
    excludeTransportId: editModal?.form?.id,
    fallback: travelLookups.drivers,
  });

  // Same for the hotel Edit modal: room types held at the chosen hotel, and that
  // room type's per-night availability for the date pickers.
  const isHotelEdit = editModal?.type === "hotel";
  const editHotelId = isHotelEdit ? editModal?.form?.hotelId : "";
  const editRoomTypes = useHotelRoomTypes({
    eventId: activeEventId,
    hotelId: editHotelId,
    fallback: travelLookups.roomTypes,
  });
  const editRooms = useRoomAvailability({
    eventId: activeEventId,
    hotelId: editHotelId,
    roomTypeId: isHotelEdit ? editModal?.form?.roomTypeId : "",
  });

  async function openEdit(type, row) {
    setEditModal({
      type,
      eventGuestId: row.eventGuestId,
      guestName: row.name,
      form: null,
      loading: true,
    });
    try {
      // bookingId — the guest may hold several of this kind, and the row the user
      // clicked is the one to edit (not just the most recent).
      const data = await getGuestTravel(row.eventGuestId, row.bookingId);
      const section = hydrateTravel(data)[TYPE_TO_SECTION[type]];
      setEditModal({
        type,
        eventGuestId: row.eventGuestId,
        guestName: row.name,
        form: { ...section, enabled: true },
        loading: false,
      });
    } catch (err) {
      toast.fromError(err);
      setEditModal(null);
    }
  }
  // A pending row is a guest who owes this service and has no booking yet, so
  // there is nothing to fetch — open the SAME single-section modal on a blank
  // form. saveEdit posts only this section and the API upserts, so the one path
  // both creates and edits.
  function openAdd(type, row) {
    setEditModal({
      type,
      eventGuestId: row.eventGuestId,
      guestName: row.name,
      form: { ...EMPTY_TRAVEL[TYPE_TO_SECTION[type]], enabled: true },
      loading: false,
      isNew: true,
    });
  }

  function closeEdit() {
    setEditModal(null);
  }

  const DELETE_FN = {
    flight: deleteFlight,
    hotel: deleteAccommodation,
    transfer: deleteTransport,
  };
  const [removingId, setRemovingId] = useState(null);

  async function removeBooking(type, bookingId) {
    setRemovingId(bookingId);
    try {
      await DELETE_FN[type](bookingId);
      await refetchTab({ flight: 0, hotel: 1, transfer: 2 }[type]);
      toast.success(isAr ? "تمت الإزالة" : "Removed");
    } catch (err) {
      toast.fromError(err, isAr ? "تعذّرت الإزالة" : "Failed to remove");
    } finally {
      setRemovingId(null);
    }
  }
  function setEditField(patch) {
    setEditModal((m) => ({
      ...m,
      form: {
        ...m.form,
        ...(typeof patch === "function" ? patch(m.form) : patch),
      },
    }));
  }
  async function saveEdit() {
    const { type, eventGuestId, form } = editModal;
    const section = TYPE_TO_SECTION[type];
    const travelObj = {
      ...EMPTY_TRAVEL,
      [section]: { ...form, enabled: true },
    };
    const travelErr = validateTravel(travelObj, isAr);
    if (travelErr) {
      toast.error(travelErr);
      return;
    }

    setSavingEdit(true);
    try {
      await saveGuestTravel(eventGuestId, buildTravelPayload(travelObj));
      await refetchTab({ flight: 0, hotel: 1, transfer: 2 }[type]);
      closeEdit();
      toast.success(isAr ? "تم الحفظ بنجاح" : "Saved successfully");
    } catch (err) {
      toast.fromError(
        err,
        isAr ? "حدث خطأ أثناء الحفظ" : "Error saving changes",
      );
    } finally {
      setSavingEdit(false);
    }
  }

  // ── New booking modal ───────────────────────────────────────────────────────
  const [showNewBooking, setShowNewBooking] = useState(false);
  const [bookStep, setBookStep] = useState(1);
  const [bookGuest, setBookGuest] = useState("");
  const [bookEventGuestId, setBookEventGuestId] = useState("");
  const [guestSearch, setGuestSearch] = useState("");
  const [bookings, setBookings] = useState([]);
  const [savingBooking, setSavingBooking] = useState(false);
  const [travel, setTravel] = useState(EMPTY_TRAVEL);

  // ── Guest picker — slim /guest/picker feed, searched and paged server-side,
  //    one page at a time as the list is scrolled. Nothing is fetched until the
  //    modal actually opens.
  const [guests, setGuests] = useState([]);
  const [guestPage, setGuestPage] = useState(1);
  const [guestHasMore, setGuestHasMore] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);
  // Debounced copy of guestSearch — one request per pause, not per keystroke.
  const [guestQuery, setGuestQuery] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setGuestQuery(guestSearch.trim()), 300);
    return () => clearTimeout(t);
  }, [guestSearch]);

  const loadGuestPage = useCallback(
    async (page) => {
      if (!activeEventId) {
        setGuests([]);
        return;
      }
      setGuestLoading(true);
      try {
        const res = await getGuestPicker({
          eventId: activeEventId,
          search: guestQuery,
          pageNumber: page,
          pageSize: GUEST_PAGE_SIZE,
        });
        const items = res?.items || [];
        setGuests((prev) => (page === 1 ? items : [...prev, ...items]));
        setGuestPage(page);
        setGuestHasMore(page * GUEST_PAGE_SIZE < (res?.totalCount ?? 0));
      } catch {
        if (page === 1) {
          setGuests([]);
          setGuestHasMore(false);
        }
      } finally {
        setGuestLoading(false);
      }
    },
    [activeEventId, guestQuery],
  );

  // Page 1 on open, on event change, and whenever the search term settles.
  useEffect(() => {
    if (!showNewBooking) return;
    loadGuestPage(1);
  }, [showNewBooking, loadGuestPage]);

  // Near the bottom → pull the next page.
  const onGuestListScroll = (e) => {
    if (guestLoading || !guestHasMore) return;
    const el = e.currentTarget;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 60)
      loadGuestPage(guestPage + 1);
  };

  // Which of the three built-in services this guest's service level actually
  // includes. A booking for a service their level doesn't carry isn't a booking
  // they're entitled to, so the form only offers the ones it does — same rule
  // BookingModal applies to dynamic services (docs/service-levels-v2.md §10).
  const [bookPlan, setBookPlan] = useState(null); // GuestServicePlanResponse | null
  const [bookPlanLoading, setBookPlanLoading] = useState(false);
  // Which services are ticked in the accordion. Only the built-ins are offered
  // here, so their data lands in `travel`, not in these values.
  const [bookPending, setBookPending] = useState({});

  // EVERY service on the guest's level, built-in or dynamic. This used to keep
  // only `isSystem` slots, on the assumption the dialog just wrote travel rows —
  // which silently dropped every dynamic service the guest is entitled to (a
  // service like "arrivals-departures" has isSystem: false). The two kinds save
  // through different endpoints, handled in saveBooking.
  const bookSlots = useMemo(() => bookPlan?.slots || [], [bookPlan]);

  // Fetched when the guest is chosen, not on every keystroke of the picker.
  useEffect(() => {
    if (!showNewBooking || !bookEventGuestId) {
      setBookPlan(null);
      return undefined;
    }
    let cancelled = false;
    setBookPlanLoading(true);
    getGuestServicePlan(bookEventGuestId)
      .then((p) => {
        if (!cancelled) setBookPlan(p);
      })
      .catch(() => {
        if (!cancelled) setBookPlan(null);
      })
      .finally(() => {
        if (!cancelled) setBookPlanLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [showNewBooking, bookEventGuestId]);

  function openNewBooking() {
    setShowNewBooking(true);
    setBookStep(1);
    setBookGuest("");
    setBookEventGuestId("");
    setGuestSearch("");
    setTravel(EMPTY_TRAVEL);
    setBookPlan(null);
    setBookPending({});
  }

  // `adRows` is a server-paginated page (10 at a time) — an export needs
  // every row, so this re-fetches with a page large enough to cover them all
  // rather than exporting whatever happens to be on screen.
  //
  // The A&D board filters SERVER-side (unlike the other three tabs, which filter
  // in memory), so a filtered export has to send the same params the table did
  // rather than trim the result afterwards.
  async function fetchAllMovementRows({ filtered = false } = {}) {
    try {
      const r = await getEventArrivalsDepartures(activeEventId, {
        pageNumber: 1,
        pageSize: 10000,
        ...(filtered ? {
          search: adSearch || undefined,
          direction: adDirection,
          fromDate: adFrom || undefined,
          toDate: adTo || undefined,
        } : {}),
      });
      return r?.items || [];
    } catch {
      return [];
    }
  }

  async function fetchDynamicServiceEntries(service) {
    if (!service) return [];
    try {
      const r = await getServiceEntries(service.id, { eventId: activeEventId, pageSize: 10000 });
      return r?.items || [];
    } catch {
      return [];
    }
  }

  // The board's dynamic fields (arrival lounge, meet & greet, ...) — joined
  // onto the movement rows by eventGuestId, same as the on-screen table does it.
  async function fetchAdServiceFieldData() {
    if (!adService) return { fields: [], byGuest: {} };
    const entries = await fetchDynamicServiceEntries(adService);
    const byGuest = {};
    entries.forEach((e) => { (byGuest[e.eventGuestId] ||= []).push(e); });
    return { fields: allFormFields(adService.form), byGuest };
  }

  // "current service" = whichever tab is open right now — a built-in (flight/
  // hotel/transfer/movements) or a dynamic service, with the exact same field
  // set its own table shows, not a trimmed summary.
  async function exportCurrentService() {
    if (svcId) {
      const service = dynServices.find((s) => s.id === svcId);
      if (!service) return;
      const entries = await fetchDynamicServiceEntries(service);
      const fields = allFormFields(service.form);
      downloadCsv(`${service.code || service.name || "service"}.csv`,
        toCsv(serviceEntryExportHeaders(fields, isAr), serviceEntryExportRows(entries, fields)));
      return;
    }
    if (builtinTab === 0) {
      downloadCsv("flights.csv", toCsv(FLIGHT_EXPORT_HEADERS, flightExportRows(flightRows, isAr)));
    } else if (builtinTab === 1) {
      downloadCsv("hotel-bookings.csv", toCsv(HOTEL_EXPORT_HEADERS, hotelExportRows(hotelRows)));
    } else if (builtinTab === 2) {
      downloadCsv("ground-transfers.csv", toCsv(TRANSFER_EXPORT_HEADERS, transferExportRows(transferRows)));
    } else if (builtinTab === 3) {
      const [rows, { fields, byGuest }] = await Promise.all([fetchAllMovementRows(), fetchAdServiceFieldData()]);
      downloadCsv("arrivals-departures.csv", toCsv(
        movementExportHeaders(fields, isAr), movementExportRows(rows, fields, byGuest)));
    }
  }

  // Same columns as "current service", but only the rows the search and filter
  // controls above the table actually leave on screen — so what you exported
  // matches what you were looking at when you pressed it.
  //
  // Built on the same filtered*Bookings arrays the tables render from, rather
  // than re-implementing the predicates: a filter added to a table is then
  // automatically honoured here too.
  async function exportFilteredService() {
    // A dynamic service's filters live inside ServiceOpsView, which owns its own
    // search/filter state — nothing here can see them, so this is offered only
    // on the built-in tabs (the menu disables it otherwise).
    if (svcId) return;
    if (builtinTab === 0) {
      downloadCsv("flights-filtered.csv",
        toCsv(FLIGHT_EXPORT_HEADERS, flightExportRows(filteredFlightBookings, isAr)));
    } else if (builtinTab === 1) {
      downloadCsv("hotel-bookings-filtered.csv",
        toCsv(HOTEL_EXPORT_HEADERS, hotelExportRows(filteredHotelBookings)));
    } else if (builtinTab === 2) {
      downloadCsv("ground-transfers-filtered.csv",
        toCsv(TRANSFER_EXPORT_HEADERS, transferExportRows(filteredTransferBookings)));
    } else if (builtinTab === 3) {
      const [rows, { fields, byGuest }] = await Promise.all([
        fetchAllMovementRows({ filtered: true }),
        fetchAdServiceFieldData(),
      ]);
      downloadCsv("arrivals-departures-filtered.csv", toCsv(
        movementExportHeaders(fields, isAr), movementExportRows(rows, fields, byGuest)));
    }
  }

  // Every service in one file — one section per service, since each has its
  // own columns (see csvSection). Flight/Hotel/Transfer/Movements are already
  // loaded event-wide; every dynamic service gets its own on-demand fetch.
  async function exportAllServices() {
    const [movementRows, { fields: adFields, byGuest: adByGuest }] =
      await Promise.all([fetchAllMovementRows(), fetchAdServiceFieldData()]);
    const sections = [
      csvSection("Flights", FLIGHT_EXPORT_HEADERS, flightExportRows(flightRows, isAr)),
      csvSection("Hotel", HOTEL_EXPORT_HEADERS, hotelExportRows(hotelRows)),
      csvSection("Ground Transfers", TRANSFER_EXPORT_HEADERS, transferExportRows(transferRows)),
      csvSection("Arrivals & Departures", movementExportHeaders(adFields, isAr), movementExportRows(movementRows, adFields, adByGuest)),
    ];
    for (const service of dynServices) {
      const entries = await fetchDynamicServiceEntries(service);
      const fields = allFormFields(service.form);
      sections.push(csvSection(
        (isAr ? service.nameAr : null) || service.name,
        serviceEntryExportHeaders(fields, isAr),
        serviceEntryExportRows(entries, fields),
      ));
    }
    downloadCsv("all-services-export.csv", sections.join("\r\n"));
  }

  async function saveBooking() {
    if (!activeEventId || !bookEventGuestId) return;
    // Ticking a service commits to completing it — the per-service Done button is
    // optional, so this is what enforces its required fields.
    const travelErr = validateServices(bookSlots, bookPending, travel, isAr);
    if (travelErr) {
      toast.error(travelErr);
      return;
    }

    // Ticked AND filled in. Dynamic services live in bookPending, the built-ins in
    // `travel` — so "nothing to save" has to consider both, or a booking made up
    // purely of dynamic services would be refused.
    const filledSlots = bookSlots.filter((s) =>
      slotHasData(s, bookPending, travel),
    );
    // A slot's CURRENT entry can be blank while it still has earlier ones
    // queued up via "Add another" — those live in `extra`, not here.
    const hasExtras = bookSlots.some((s) => slotExtras(s, bookPending).length > 0);
    if (filledSlots.length === 0 && !hasExtras) {
      toast.error(
        isAr ? "املأ خدمة واحدة على الأقل" : "Fill in at least one service",
      );
      return;
    }

    setSavingBooking(true);
    try {
      // The three built-ins share one travel payload; everything else is a service
      // entry of its own. Sequential on purpose: a Fixed event rejects a service
      // whose predecessor is unfinished.
      if (anyTravelEnabled(travel)) {
        await saveGuestTravel(bookEventGuestId, buildTravelPayload(travel));
      }
      for (const slot of filledSlots) {
        if (slot.isSystem) continue;

        await saveGuestServiceEntry(bookEventGuestId, {
          id: null,
          serviceId: slot.serviceId,
          values: bookPending[slot.serviceId]?.values || {},
          // Past validateServices means the required fields are in.
          markCompleted: true,
        });
      }

      // Every earlier entry this session's "Add another" queued up, one save
      // call each — always a brand new row, never the one saved above.
      for (const slot of bookSlots) {
        const extras = slotExtras(slot, bookPending);
        if (extras.length === 0) continue;
        if (slot.isSystem) {
          const key = TRAVEL_SECTION[slot.code];
          for (const snap of extras) {
            await saveGuestTravel(bookEventGuestId, buildTravelPayload({ ...EMPTY_TRAVEL, [key]: snap }));
          }
        } else {
          for (const snap of extras) {
            await saveGuestServiceEntry(bookEventGuestId, {
              id: null, serviceId: slot.serviceId, values: snap.values || {}, markCompleted: true,
            });
          }
        }
      }

      await Promise.all([0, 1, 2].map((idx) => refetchTab(idx)));

      setBookings((prev) => [...prev, { guest: bookGuest }]);
      setShowNewBooking(false);
      setBookStep(1);
      setBookGuest("");
      setBookEventGuestId("");
      setGuestSearch("");
      setBookPending({});
      toast.success(
        isAr ? "تم إنشاء الحجز بنجاح" : "Booking created successfully",
      );
    } catch (err) {
      toast.fromError(
        err,
        isAr ? "حدث خطأ أثناء إنشاء الحجز" : "Error creating booking",
      );
    } finally {
      setSavingBooking(false);
    }
  }

  const filteredFlightBookings = useMemo(
    () =>
      flightRows.filter((r) => {
        const q = fSearch.toLowerCase();
        const s =
          !fSearch ||
          r.name.toLowerCase().includes(q) ||
          r.flight.toLowerCase().includes(q) ||
          // Route codes are what people actually search a flight list by.
          r.from.toLowerCase().includes(q) ||
          r.to.toLowerCase().includes(q);
        return (
          s &&
          (fFilters.status === "All" || r.flightStatus === fFilters.status) &&
          (fFilters.level === "All" || r.serviceLevelName === fFilters.level) &&
          (fFilters.org === "All" || r.org === fFilters.org) &&
          (fFilters.type === "All" || r.flightType === fFilters.type) &&
          (fFilters.cls === "All" || r.flightClass === fFilters.cls)
        );
      }),
    [flightRows, fSearch, fFilters],
  );
  const filteredFlights = useMemo(
    () => groupByGuest(filteredFlightBookings),
    [filteredFlightBookings],
  );

  const filteredHotelBookings = useMemo(
    () =>
      hotelRows.filter((r) => {
        const q = hSearch.toLowerCase();
        const s =
          !hSearch ||
          r.name.toLowerCase().includes(q) ||
          r.hotel.toLowerCase().includes(q);
        return (
          s &&
          (hFilters.hotel === "All" || r.hotel === hFilters.hotel) &&
          (hFilters.level === "All" || r.serviceLevelName === hFilters.level) &&
          (hFilters.org === "All" || r.org === hFilters.org) &&
          (hFilters.room === "All" || r.roomType === hFilters.room)
        );
      }),
    [hotelRows, hSearch, hFilters],
  );
  const filteredHotels = useMemo(
    () => groupByGuest(filteredHotelBookings),
    [filteredHotelBookings],
  );

  const filteredTransferBookings = useMemo(
    () =>
      transferRows.filter((r) => {
        const q = tSearch.toLowerCase();
        const s =
          !tSearch ||
          r.name.toLowerCase().includes(q) ||
          r.driver.toLowerCase().includes(q) ||
          r.vehicle.toLowerCase().includes(q);
        return (
          s &&
          (tFilters.status === "All" || r.transferStatus === tFilters.status) &&
          (tFilters.level === "All" || r.serviceLevelName === tFilters.level) &&
          // driverType is a numeric enum (1 Fixed / 2 Open); the Select carries
          // it as a string, so compare loosely rather than casting both ways.
          (tFilters.driverType === "All" || String(r.driverType) === String(tFilters.driverType))
        );
      }),
    [transferRows, tSearch, tFilters],
  );
  const filteredTransfers = useMemo(
    () => groupByGuest(filteredTransferBookings),
    [filteredTransferBookings],
  );

  const columns = useMemo(
    () =>
      buildBookingColumns({
        STR,
        isAr,
        ad,
        navigate,
        removingId,
        openEdit,
        openAdd,
        removeBooking,
        canManage,
      }),
    [STR, isAr, removingId, canManage],
  );

  const adColumns = useMemo(
    () =>
      buildAdColumns({ STR, isAr, adDirection, adService, adEntries, adDisplay, onEditEntry: canManage ? setAdEditEntry : null }),
    [STR, adDirection, adService, adEntries, adDisplay, isAr, canManage],
  );

  const adDirectionOpts = useMemo(
    () => [
      { value: "all", label: STR.direction.all },
      { value: "inbound", label: STR.direction.inbound },
      { value: "outbound", label: STR.direction.outbound },
    ],
    [STR],
  );

  // ── Filter dropdown options ───────────────────────────────────────────────
  // Value lists come from the rows actually loaded, so a dropdown only ever
  // offers something that would return results. `travelLookups` isn't used for
  // these: it holds every hotel/class in the system, most of which this event
  // has no booking for.
  const distinct = (rows, pick) => [
    ...new Set(rows.map(pick).filter((v) => v && v !== "—")),
  ].sort((a, b) => String(a).localeCompare(String(b)));

  const levelOptsFor = (rows) => [
    { value: "All", label: STR.anyLevel },
    ...distinct(rows, (r) => r.serviceLevelName).map((v) => ({ value: v, label: v })),
  ];
  const orgOptsFor = (rows) => [
    { value: "All", label: STR.anyOrg },
    ...distinct(rows, (r) => r.org).map((v) => ({ value: v, label: v })),
  ];

  const flightFilterFields = useMemo(
    () => [
      {
        key: "status", label: STR.cols.status,
        options: [
          { value: "All", label: isAr ? "كل الرحلات" : "All flights" },
          ...["confirmed", "pending"].map((s) => ({ value: s, label: STR.statuses[s] })),
        ],
      },
      { key: "level", label: STR.serviceLevel, options: levelOptsFor(flightRows) },
      { key: "org", label: STR.cols.organization, options: orgOptsFor(flightRows) },
      {
        key: "type", label: STR.cols.flightType,
        options: [
          { value: "All", label: STR.filterAll },
          ...distinct(flightRows, (r) => r.flightType).map((v) => ({
            value: v, label: flightTypeLabel(v, isAr),
          })),
        ],
      },
      {
        key: "cls", label: STR.cols.flightClass,
        options: [
          { value: "All", label: STR.anyClass },
          ...distinct(flightRows, (r) => r.flightClass).map((v) => ({ value: v, label: v })),
        ],
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [STR, isAr, flightRows],
  );

  const hotelFilterFields = useMemo(
    () => [
      {
        key: "hotel", label: STR.cols.hotel,
        options: [
          { value: "All", label: isAr ? "جميع الفنادق" : "All hotels" },
          ...distinct(hotelRows, (r) => r.hotel).map((v) => ({ value: v, label: v })),
        ],
      },
      { key: "level", label: STR.serviceLevel, options: levelOptsFor(hotelRows) },
      { key: "org", label: STR.cols.organization, options: orgOptsFor(hotelRows) },
      {
        key: "room", label: STR.cols.room,
        options: [
          { value: "All", label: STR.anyRoom },
          ...distinct(hotelRows, (r) => r.roomType).map((v) => ({ value: v, label: v })),
        ],
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [STR, isAr, hotelRows],
  );

  const transferFilterFields = useMemo(
    () => [
      {
        key: "status", label: STR.cols.status,
        options: [
          { value: "All", label: STR.filterAll },
          // Full transport lifecycle, in order (Core/Constants/TransportStatuses.All).
          ...[
            "new", "pending", "assigned", "in-progress",
            "arrived", "in-transit", "completed", "cancelled",
          ].map((s) => ({ value: s, label: STR.statuses[s] })),
        ],
      },
      { key: "level", label: STR.serviceLevel, options: levelOptsFor(transferRows) },
      {
        key: "driverType", label: STR.cols.driverType,
        options: [
          { value: "All", label: STR.anyDriverType },
          ...distinct(transferRows, (r) => r.driverType).map((v) => ({
            value: String(v),
            label: (isAr ? DRIVER_TYPE_INFO[v]?.ar : DRIVER_TYPE_INFO[v]?.en) || String(v),
          })),
        ],
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [STR, isAr, transferRows],
  );

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            {STR.title[0]} <em>{STR.title[1]}</em>
          </h1>
          <div className="page-sub" style={{ color: "var(--hayya-sub-color)" }}>
            {STR.sub}
          </div>
        </div>
        {/* New Booking moved down to the end of the tab strip — see below. */}
      </div>

      {bookings.length > 0 && (
        <div
          style={{
            marginBottom: 14,
            padding: "10px 16px",
            borderRadius: 10,
            background: "rgba(0, 98, 123,0.1)",
            border: "1px solid rgba(0, 98, 123,0.3)",
            fontSize: 13,
            display: "flex",
            gap: 10,
            alignItems: "center",
          }}
        >
          <Icon name="check" size={14} style={{ color: "var(--accent)" }} />
          <span>
            {isAr
              ? `تم إضافة ${ad(bookings.length)} حجز`
              : `${bookings.length} new booking${bookings.length > 1 ? "s" : ""} added`}
          </span>
        </div>
      )}

      <TravelKpiGrid
        flightRows={flightRows}
        hotelRows={hotelRows}
        transferRows={transferRows}
        travellingGuests={travellingGuests}
        builtinTab={builtinTab}
        allowedTabs={allowedTabs}
        onSelectTab={(tab) => {
          setSvcId(null);
          setActiveTab(tab);
        }}
        STR={STR}
        fmtN={fmtN}
      />

      <TravelTabsBar
        STR={STR}
        isAr={isAr}
        builtinTab={builtinTab}
        svcId={svcId}
        dynServices={dynServices}
        allowedTabs={allowedTabs}
        onSelectBuiltinTab={(i) => {
          setSvcId(null);
          setActiveTab(i);
        }}
        onSelectServiceTab={(id) => setSvcId(id)}
        exportAllServices={exportAllServices}
        exportCurrentService={exportCurrentService}
        exportFilteredService={exportFilteredService}
        activeFilterCount={activeFilterCount}
        canManage={canManage}
        onOpenNewBooking={openNewBooking}
      />

      {/* Dynamic service: its own table, columns built from its form, and its own
          New Booking dialog — ServiceOpsView, minus the page chrome. */}
      {svcId && (
        <ServiceOpsView
          lang={lang}
          activeEventId={activeEventId}
          embeddedServiceId={svcId}
        />
      )}

      {/* ── Tab 1: Flights ── */}
      {builtinTab === 0 && (
        <FlightsTab
          STR={STR}
          isAr={isAr}
          fSearch={fSearch}
          setFSearch={setFSearch}
          filterFields={flightFilterFields}
          filterValues={fFilters}
          onFilterChange={setF}
          onFilterClear={() => setFFilters(EMPTY_F)}
          filteredFlightBookings={filteredFlightBookings}
          flightRows={flightRows}
          fmtN={fmtN}
          columns={columns}
          filteredFlights={filteredFlights}
          tabLoading={tabLoading}
        />
      )}

      {/* ── Tab 2: Hotel ── */}
      {builtinTab === 1 && (
        <HotelTab
          STR={STR}
          isAr={isAr}
          hSearch={hSearch}
          setHSearch={setHSearch}
          filterFields={hotelFilterFields}
          filterValues={hFilters}
          onFilterChange={setH}
          onFilterClear={() => setHFilters(EMPTY_H)}
          filteredHotelBookings={filteredHotelBookings}
          hotelRows={hotelRows}
          fmtN={fmtN}
          columns={columns}
          filteredHotels={filteredHotels}
          tabLoading={tabLoading}
        />
      )}

      {/* ── Tab 3: Ground Transfers ── */}
      {builtinTab === 2 && (
        <TransfersTab
          STR={STR}
          isAr={isAr}
          tSearch={tSearch}
          setTSearch={setTSearch}
          filterFields={transferFilterFields}
          filterValues={tFilters}
          onFilterChange={setT}
          onFilterClear={() => setTFilters(EMPTY_T)}
          filteredTransferBookings={filteredTransferBookings}
          transferRows={transferRows}
          fmtN={fmtN}
          columns={columns}
          filteredTransfers={filteredTransfers}
          tabLoading={tabLoading}
        />
      )}

      {/* ── Tab 4: Arrivals & Departures (read-only) ── */}
      {builtinTab === 3 && (
        <ArrivalsDeparturesTab
          STR={STR}
          isAr={isAr}
          ad={ad}
          adSearchInput={adSearchInput}
          setAdSearchInput={setAdSearchInput}
          adDirection={adDirection}
          setAdDirection={setAdDirection}
          adDirectionOpts={adDirectionOpts}
          adRows={adRows}
          adTotal={adTotal}
          fmtN={fmtN}
          adFrom={adFrom}
          setAdFrom={setAdFrom}
          adTo={adTo}
          setAdTo={setAdTo}
          adColumns={adColumns}
          adLoading={adLoading}
          adPageSize={adPageSize}
          adPageIndex={adPageIndex}
          setAdPageIndex={setAdPageIndex}
          setAdPageSize={setAdPageSize}
        />
      )}

      {/* ── Edit Modal — same field set as New Booking / the guest wizard, ──
             scoped to just the one section (flight/hotel/transfer) being edited. */}
      <EditBookingModal
        editModal={editModal}
        isAr={isAr}
        STR={STR}
        travelLookups={travelLookups}
        eventMinDate={eventMinDate}
        eventMaxDate={eventMaxDate}
        dateWindowMin={dateWindowMin}
        dateWindowMax={dateWindowMax}
        editVehicles={editVehicles}
        editDrivers={editDrivers}
        editRoomTypes={editRoomTypes}
        editRooms={editRooms}
        setEditField={setEditField}
        closeEdit={closeEdit}
        saveEdit={saveEdit}
        savingEdit={savingEdit}
      />

      <NewBookingModal
        show={showNewBooking}
        isAr={isAr}
        lang={lang}
        STR={STR}
        bookStep={bookStep}
        setBookStep={setBookStep}
        bookGuest={bookGuest}
        bookEventGuestId={bookEventGuestId}
        setBookEventGuestId={setBookEventGuestId}
        setBookGuest={setBookGuest}
        guestSearch={guestSearch}
        setGuestSearch={setGuestSearch}
        guests={guests}
        guestLoading={guestLoading}
        onGuestListScroll={onGuestListScroll}
        bookPlanLoading={bookPlanLoading}
        bookPlan={bookPlan}
        bookSlots={bookSlots}
        bookPending={bookPending}
        setBookPending={setBookPending}
        travel={travel}
        setTravel={setTravel}
        travelLookups={travelLookups}
        activeEventId={activeEventId}
        eventMinDate={eventMinDate}
        eventMaxDate={eventMaxDate}
        dateWindowMin={dateWindowMin}
        dateWindowMax={dateWindowMax}
        onClose={() => setShowNewBooking(false)}
        saveBooking={saveBooking}
        savingBooking={savingBooking}
      />

      {/* Edits one entry of the dynamic "arrivals-departures" service from the
          board above — the same generic entry form ServiceOpsView uses for
          every other dynamic service, since this is just another one. */}
      <BookingModal
        open={!!adEditEntry}
        onClose={() => setAdEditEntry(null)}
        onSaved={() => { setAdEditEntry(null); loadAdEntries(); }}
        service={adService}
        entry={adEditEntry}
        activeEventId={activeEventId}
        lang={lang}
        eventStart={activeEvent?.startDate}
        eventEnd={activeEvent?.endDate}
      />
    </div>
  );
}
