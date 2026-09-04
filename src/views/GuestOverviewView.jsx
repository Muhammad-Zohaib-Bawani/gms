// Guest Overview — every PERSON in the system, across every event.
//
// This screen is PERSON-scoped: a row's `id` is the master Guest.PublicId
// (personId), not an EventGuest.PublicId, because a row spans every event that
// human attends. Anything event-specific therefore has to go through one of the
// participations in the expanded detail's `events[]`, each of which carries its
// own `eventGuestId`. The event-scoped counterpart of this screen is
// Guests / GuestDetailView, keyed by eventGuestId.
//
// Server-paged/filtered/searched — GuestOverviewController isn't scoped to one
// event, so this is the one screen a user can land on to find any guest
// regardless of which event they belong to. The list stays lightweight
// (counts/flags only); the full A–Z for one guest — sessions, flights,
// accommodations, transport, seatings, other dynamic services — is fetched on
// demand when a row expands (see guestOverview/GuestDetail.jsx).
//
// On "all the columns": a guest has ~20 attributes and the detail view is a
// one-to-many in six directions, so rendering everything at once is the
// unreadable wall of columns this project already hit on Travel. Instead the
// table ships a readable default set, every other column is available from
// the Columns picker, and the full detail lives in the expanded row.
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader, Card, Grid, StatCard, EmptyState } from '../components/ds';
import { Icon } from '../components/Icons';
import Select from '../components/ui/Select';
import { nationalityOptionLabel } from '../components/FlagIcon';
import DateField from '../components/ui/DateField';
import ActionMenu from '../components/ui/ActionMenu';
import toast from '../lib/toast';
import { downloadWorkbook } from '../lib/xlsxExport';
import { getGuestOverview, getGuestOverviewDetail } from '../api/services/guestOverviewService';
import { listEvents, listSessions } from '../api/services/eventService';
import { getServiceLevels } from '../api/services/serviceCatalogService';
import { getOrganizations } from '../api/services/organizationService';
import { getNationalities } from '../api/services/nationalityService';
import {
  GuestCell, LevelChip,
  INVITATION_TONE, INVITATION_LABEL, ACCREDITATION_TONE, ACCREDITATION_LABEL,
} from './guestOverview/parts';
import GuestDetail from './guestOverview/GuestDetail';
import { brandHex } from '../lib/brandColor';

const ALL = 'all';

// key -> label. `core: true` columns are on by default; the rest are opt-in
// from the Columns picker.
const COLUMNS = [
  { key: 'guest', label: 'Delegate profile', core: true, always: true },
  { key: 'nationality', label: 'Nationality', core: true },
  { key: 'organisation', label: 'Organisation', core: true },
  { key: 'level', label: 'Service level', core: true },
  { key: 'event', label: 'Event', core: true },
  { key: 'sessions', label: 'Sessions', core: true },
  { key: 'flight', label: 'Flight', core: true },
  { key: 'accommodation', label: 'Accommodation', core: true },
  { key: 'transport', label: 'Transport', core: true },
  { key: 'services', label: 'Other services', core: true },
  { key: 'arrival', label: 'Arrival / departure', core: true },
  { key: 'invitation', label: 'Invitation', core: true },
  { key: 'accreditation', label: 'Accreditation', core: true },
  { key: 'guestType', label: 'Delegate type' },
  { key: 'seats', label: 'Seats' },
  { key: 'created', label: 'Added on' },
];

const PAGE_SIZES = [10, 25, 50, 100];

const INITIAL_FILTERS = {
  event: ALL, level: ALL, invitation: ALL, accreditation: ALL,
  nationality: ALL, organisation: ALL, guestType: ALL, session: ALL,
  hasFlight: ALL, hasAccommodation: ALL, hasTransport: ALL, hasPendingServices: ALL,
  arrivalFrom: '', arrivalTo: '', departureFrom: '', departureTo: '',
};

const YES_NO = [{ value: ALL, label: 'Any' }, { value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }];

const guestName = (g) => `${g.firstName || ''} ${g.lastName || ''}`.trim() || g.email || '';

// The detail endpoint is scoped to a PERSON — every Guest row sharing an email
// (see GuestOverviewDetailResponse). So the same payload comes back for each of
// a person's event rows, and the export keys on the person, not the row: one
// fetch, one set of detail rows, no triplicated flights for a guest who
// attended three events. Rows with no email have no person identity to share,
// so they key on their own id.
const personKey = (g) => (g.email || '').trim().toLowerCase() || `id:${g.id}`;

const dt = (v) => (v ? String(v).replace('T', ' ').slice(0, 16) : '');

/**
 * Detail for every person in the export, fetched a few at a time. It's one
 * request per person with no bulk endpoint to lean on, so the pool keeps a
 * 300-guest export from opening 300 sockets at once, and a single failure is
 * swallowed — that person still gets their summary row, just no detail rows.
 */
async function fetchAllDetails(people, onProgress) {
  const out = new Map();
  const queue = [...people];
  const total = queue.length;
  let done = 0;

  const worker = async () => {
    while (queue.length) {
      const g = queue.shift();
      try {
        const d = await getGuestOverviewDetail(g.id);
        if (d) out.set(personKey(g), d);
      } catch { /* summary row still stands */ }
      onProgress(++done, total);
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(6, total) }, worker),
  );
  return out;
}

/**
 * The spreadsheet twin of `cellFor` below: same column, same meaning, plain
 * text instead of chips and icons. Kept separate rather than stringifying the
 * JSX — a cell renders a coloured pill, a spreadsheet cell wants the word.
 */
function textFor(col, g) {
  switch (col.key) {
    case 'guest': return guestName(g);
    case 'event': return g.eventTitle || '';
    case 'level': return g.serviceLevelName || '';
    case 'invitation': return INVITATION_LABEL[g.invitationStatus] || g.invitationStatus || '';
    case 'accreditation': return ACCREDITATION_LABEL[g.accreditationStatus] || g.accreditationStatus || '';
    case 'services':
      if (!g.servicesCount) return 'None';
      return g.pendingServicesCount > 0
        ? `${g.servicesCount} (${g.pendingServicesCount} pending)`
        : `${g.servicesCount} done`;
    case 'flight': return g.hasFlight ? 'Booked' : '';
    case 'accommodation': return g.hasAccommodation ? 'Booked' : '';
    case 'transport': return g.hasTransport ? 'Booked' : '';
    case 'sessions': return g.sessionsCount > 0 ? String(g.sessionsCount) : 'None';
    case 'arrival':
      if (!g.arrivalDate && !g.departureDate) return '';
      return `${g.arrivalDate || '—'} → ${g.departureDate || '—'}`;
    case 'nationality': return g.nationalityName || '';
    case 'organisation': return g.organization || '';
    case 'guestType': return g.guestType || '';
    case 'seats': return g.seatsCount > 0 ? String(g.seatsCount) : '';
    case 'created': return g.createdAt?.slice(0, 10) || '';
    default: return '';
  }
}

export default function GuestOverviewView({ lang }) {
  const navigate = useNavigate();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [showColumns, setShowColumns] = useState(false);
  const [expanded, setExpanded] = useState(() => new Set());
  // "View profile" has to cross from person to participation: /guests/:id takes
  // an eventGuestId, which only the detail response carries. Resolved on click
  // (one request) rather than pre-fetched for every visible row.
  const [openingProfile, setOpeningProfile] = useState(null);
  async function openParticipation(row) {
    if (openingProfile) return;
    setOpeningProfile(row.id);
    try {
      const detail = await getGuestOverviewDetail(row.id);
      const blocks = detail?.events || [];
      // Prefer the event the row's own columns describe (the most recent
      // participation); fall back to the latest block the detail returned.
      const block = blocks.find((b) => b.eventId === row.eventId) || blocks[blocks.length - 1];
      if (!block?.eventGuestId) {
        toast.error('This delegate has no event participation to open.');
        return;
      }
      navigate(`/guests/${block.eventGuestId}`);
    } catch (err) {
      toast.fromError(err, 'Could not open this delegate');
    } finally {
      setOpeningProfile(null);
    }
  }
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [f, setF] = useState(INITIAL_FILTERS);

  const [rows, setRows] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  // { done, total } while the per-person detail is being pulled — one request
  // each, so silence would look like a hung button.
  const [exportProgress, setExportProgress] = useState(null);

  const [events, setEvents] = useState([]);
  const [levels, setLevels] = useState([]);
  const [organisations, setOrganisations] = useState([]);
  const [nationalities, setNationalities] = useState([]);
  const [sessions, setSessions] = useState([]);

  // The detail panel lives in a <td> inside the horizontally-scrolling table, so
  // without this it stretches to the full width of all columns and its content
  // spreads far apart. Measuring the viewport lets it stay one screen wide and
  // stick to the left edge as the columns scroll under it.
  const scrollRef = useRef(null);
  const [detailWidth, setDetailWidth] = useState(0);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;
    const measure = () => setDetailWidth(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const [visible, setVisible] = useState(
    () => new Set(COLUMNS.filter((c) => c.core).map((c) => c.key)),
  );

  // Debounce free text — every other filter resets the page immediately, this
  // one waits so a keystroke doesn't fire a request per character.
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(0); }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Filter option lists — small enough to load in full, once.
  useEffect(() => {
    listEvents({ pageSize: 200 }).then((r) => setEvents(r?.items || [])).catch(() => setEvents([]));
    getServiceLevels(false).then(setLevels).catch(() => setLevels([]));
    getOrganizations().then(setOrganisations).catch(() => setOrganisations([]));
    getNationalities().then(setNationalities).catch(() => setNationalities([]));
  }, []);

  // Sessions belong to one event — only meaningful once one is picked.
  useEffect(() => {
    if (f.event === ALL) { setSessions([]); return; }
    listSessions(f.event).then(setSessions).catch(() => setSessions([]));
  }, [f.event]);

  const set = (k, v) => {
    setF((p) => ({ ...p, [k]: v, ...(k === 'event' ? { session: ALL } : {}) }));
    setPage(0);
  };
  const resetFilters = () => {
    setF(INITIAL_FILTERS);
    setSearchInput('');
    setSearch('');
    setPage(0);
  };

  const activeFilterCount = useMemo(
    () => Object.entries(f).filter(([, v]) => v !== ALL && v !== '').length,
    [f],
  );

  // The one place filters become request params. Shared with the export, so the
  // two can't drift into disagreeing about what's being looked at — exporting
  // rows the user had filtered out is the classic version of that bug.
  const queryParams = useMemo(() => ({
    search,
    eventId: f.event !== ALL ? f.event : undefined,
    serviceLevelId: f.level !== ALL ? f.level : undefined,
    organizationId: f.organisation !== ALL ? f.organisation : undefined,
    nationalityId: f.nationality !== ALL ? f.nationality : undefined,
    sessionId: f.session !== ALL ? f.session : undefined,
    guestType: f.guestType !== ALL ? f.guestType : undefined,
    invitationStatus: f.invitation !== ALL ? f.invitation : undefined,
    accreditationStatus: f.accreditation !== ALL ? f.accreditation : undefined,
    hasFlight: f.hasFlight !== ALL ? f.hasFlight === 'yes' : undefined,
    hasAccommodation: f.hasAccommodation !== ALL ? f.hasAccommodation === 'yes' : undefined,
    hasTransport: f.hasTransport !== ALL ? f.hasTransport === 'yes' : undefined,
    hasPendingServices: f.hasPendingServices !== ALL ? f.hasPendingServices === 'yes' : undefined,
    arrivalFrom: f.arrivalFrom || undefined,
    arrivalTo: f.arrivalTo || undefined,
    departureFrom: f.departureFrom || undefined,
    departureTo: f.departureTo || undefined,
  }), [search, f]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getGuestOverview({ pageNumber: page + 1, pageSize, ...queryParams })
      .then((r) => {
        if (cancelled) return;
        setRows(r?.items || []);
        setTotalCount(r?.totalCount || 0);
      })
      .catch((err) => {
        if (cancelled) return;
        setRows([]);
        setTotalCount(0);
        toast.error(err?.message || 'Could not load delegates');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [page, pageSize, queryParams]);

  const pageCount = Math.max(1, Math.ceil(totalCount / pageSize));

  const toggleRow = (id) => setExpanded((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const toggleColumn = (key) => setVisible((prev) => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  const shown = COLUMNS.filter((c) => c.always || visible.has(c.key));

  /**
   * The whole picture in one file, for every guest the filters match — not just
   * the page on screen. A "Guests" block carrying the columns currently shown,
   * then one block per accordion section (Events / Sessions / Flights /
   * Accommodation / Transport / Seating / Other services).
   *
   * Sections rather than one wide row because the detail is a one-to-many in
   * six directions: a guest with two flights and three sessions has no single
   * flat row. Each block repeats Guest + Email so any of them can be read,
   * sorted or pivoted on its own.
   */
  async function handleExport() {
    setExporting(true);
    setExportProgress(null);
    try {
      let all = rows;
      if (totalCount > rows.length) {
        const r = await getGuestOverview({
          pageNumber: 1, pageSize: Math.max(totalCount, 1), ...queryParams,
        });
        if (r?.items?.length) all = r.items;
      }

      // The Guest column shows a name over an email; a sheet wants those as two
      // columns, so that one selection contributes two.
      const headers = shown.flatMap((c) => (c.key === 'guest' ? ['Delegate', 'Email'] : [c.label]));
      const body = all.map((g) => shown.flatMap((c) => (
        c.key === 'guest' ? [guestName(g), g.email || ''] : [textFor(c, g)]
      )));

      // One entry per person, in the order they appear in the table.
      const people = [];
      const seen = new Set();
      all.forEach((g) => {
        const key = personKey(g);
        if (seen.has(key)) return;
        seen.add(key);
        people.push(g);
      });

      const details = await fetchAllDetails(people, (done, total) => setExportProgress({ done, total }));

      const events = [], sessions = [], flights = [], stays = [], rides = [], seats = [], services = [];
      people.forEach((g) => {
        const d = details.get(personKey(g));
        if (!d) return;
        const who = [guestName(g), g.email || ''];

        (d.events || []).forEach((e) => events.push([
          ...who, e.eventTitle, e.eventType, e.startDate, e.endDate, e.venueName,
          e.serviceLevelName, e.invitationStatus, e.accreditationStatus,
          e.arrivalDate, e.departureDate,
        ]));

        (d.sessions || []).forEach((s) => sessions.push([
          ...who, s.eventTitle, s.title, s.date, s.time, s.room, s.speaker, s.status,
        ]));

        // One row per LEG — a return booking is two flights, and collapsing it
        // to the first-to-last summary is how a Dubai trip reads as DXB → DXB.
        (d.flights || []).forEach((fl) => {
          const legs = fl.legs || [];
          if (legs.length === 0) {
            // Six blanks: Leg, Flight No., From, From City, To, To City — a
            // booking with no legs knows none of them.
            flights.push([
              ...who, fl.eventTitle, fl.flightType, fl.status, '', '', '', '', '', '',
              dt(fl.departureTime), dt(fl.arrivalTime), fl.flightClass, fl.seat,
            ]);
            return;
          }
          legs.forEach((l, i) => flights.push([
            ...who, fl.eventTitle, fl.flightType, fl.status,
            legs.length > 1 ? (i === 0 ? 'Inbound' : 'Outbound') : '',
            l.flightNumber, l.departureCode, l.departureCity, l.arrivalCode, l.arrivalCity,
            dt(l.startTime), dt(l.endTime),
            l.flightClass || fl.flightClass, l.seat || fl.seat,
          ]));
        });

        (d.accommodations || []).forEach((a) => stays.push([
          ...who, a.eventTitle, a.hotel, a.roomType, a.checkIn, a.checkOut,
        ]));

        (d.transport || []).forEach((t) => rides.push([
          ...who, t.eventTitle, t.tripStatus, t.vehicle, t.driverName,
          t.pickup, t.dropoff, dt(t.pickupTime), dt(t.dropoffTime),
        ]));

        (d.seatings || []).forEach((s) => seats.push([
          ...who, s.eventTitle, s.sessionTitle, s.seatCode,
        ]));

        // A dynamic service's fields are keyed by field key here — the export
        // has no form schema to resolve labels from, unlike the guest's own
        // services panel — so each entry lands as "key: value" pairs.
        (d.otherServices || []).forEach((s) => {
          const entries = s.entries || [];
          if (entries.length === 0) {
            services.push([...who, s.eventTitle, s.name, s.status, s.isUnlocked ? '' : (s.lockedReason || 'Locked'), '']);
            return;
          }
          entries.forEach((e) => services.push([
            ...who, s.eventTitle, s.name, e.status || s.status, '',
            Object.entries(e.values || {})
              .filter(([, v]) => v != null && String(v).trim() !== '')
              .map(([k, v]) => `${k}: ${v}`).join('; '),
          ]));
        });
      });

      // One tab per element. Guests leads because it's the sheet that answers
      // "who's in this export"; the rest are its detail, each keyed back to a
      // guest by name + email.
      await downloadWorkbook('delegate-overview.xlsx', [
        { name: 'Delegates', headers, rows: body },
        { name: 'Events', headers: ['Delegate', 'Email', 'Event', 'Type', 'Start', 'End', 'Venue', 'Service Level', 'Invitation', 'Accreditation', 'Arrival', 'Departure'], rows: events },
        { name: 'Sessions', headers: ['Delegate', 'Email', 'Event', 'Session', 'Date', 'Time', 'Room', 'Speaker', 'Status'], rows: sessions },
        { name: 'Flights', headers: ['Delegate', 'Email', 'Event', 'Booking Type', 'Status', 'Leg', 'Flight No.', 'From', 'From City', 'To', 'To City', 'Departure', 'Arrival', 'Class', 'Seat'], rows: flights },
        { name: 'Accommodation', headers: ['Delegate', 'Email', 'Event', 'Hotel', 'Room Type', 'Check-in', 'Check-out'], rows: stays },
        { name: 'Transport', headers: ['Delegate', 'Email', 'Event', 'Status', 'Vehicle', 'Driver', 'Pickup', 'Dropoff', 'Pickup Time', 'Dropoff Time'], rows: rides },
        { name: 'Seating', headers: ['Delegate', 'Email', 'Event', 'Session', 'Seat'], rows: seats },
        { name: 'Other Services', headers: ['Delegate', 'Email', 'Event', 'Service', 'Status', 'Locked Reason', 'Details'], rows: services },
      ]);
    } catch (err) {
      toast.error(err?.message || 'Could not export delegates');
    } finally {
      setExporting(false);
      setExportProgress(null);
    }
  }

  const cellFor = (col, g) => {
    switch (col.key) {
      case 'guest': return <GuestCell guest={g} />;
      case 'event':
        return g.eventTitle ? <span className="chip" style={{ fontSize: 10.5 }}>{g.eventTitle}</span> : '—';
      case 'level': return <LevelChip level={g.serviceLevelId ? { color: g.serviceLevelColor, name: g.serviceLevelName } : null} />;
      case 'invitation':
        return (
          <span className={`chip ${INVITATION_TONE[g.invitationStatus] || 'draft'}`} style={{ fontSize: 10.5 }}>
            <span className="dot" />{INVITATION_LABEL[g.invitationStatus] || g.invitationStatus}
          </span>
        );
      case 'accreditation':
        return (
          <span className={`chip ${ACCREDITATION_TONE[g.accreditationStatus] || 'draft'}`} style={{ fontSize: 10.5 }}>
            <span className="dot" />{ACCREDITATION_LABEL[g.accreditationStatus] || g.accreditationStatus}
          </span>
        );
      case 'services':
        return g.servicesCount > 0 ? (
          <span className={`chip ${g.pendingServicesCount > 0 ? 'pending' : 'confirmed'}`} style={{ fontSize: 10.5 }}>
            <span className="dot" />
            {g.servicesCount} {g.pendingServicesCount > 0 ? `(${g.pendingServicesCount} pending)` : 'done'}
          </span>
        ) : <span style={{ color: 'var(--ink-faint)' }}>None</span>;
      case 'flight':
      case 'accommodation':
      case 'transport': {
        const has = col.key === 'flight' ? g.hasFlight : col.key === 'accommodation' ? g.hasAccommodation : g.hasTransport;
        return has
          ? <span className="chip confirmed" style={{ fontSize: 10.5 }}><span className="dot" />Booked</span>
          : <span style={{ color: 'var(--ink-faint)' }}>—</span>;
      }
      case 'sessions':
        return g.sessionsCount > 0
          ? <span className="chip" style={{ fontSize: 10.5 }}>{g.sessionsCount} session{g.sessionsCount > 1 ? 's' : ''}</span>
          : <span style={{ color: 'var(--ink-faint)' }}>None</span>;
      case 'arrival':
        return g.arrivalDate || g.departureDate ? (
          <span style={{ fontFamily: 'var(--mono)', fontSize: 11.5 }}>
            {g.arrivalDate || '—'} <span style={{ color: 'var(--ink-faint)' }}>→</span> {g.departureDate || '—'}
          </span>
        ) : <span style={{ color: 'var(--ink-faint)' }}>—</span>;
      case 'nationality':
        return g.nationalityName ? `${g.nationalityFlag || ''} ${g.nationalityName}` : '—';
      case 'organisation': return g.organization || '—';
      case 'guestType': return g.guestType || '—';
      case 'seats': return g.seatsCount > 0 ? g.seatsCount : '—';
      case 'created': return g.createdAt?.slice(0, 10) || '—';
      default: return '—';
    }
  };

  return (
    <div>
      <PageHeader
        title="Delegate Overview"
        subtitle="Every delegate across every event"
        actions={
          <>
            <button className="btn" onClick={handleExport} disabled={exporting || loading}>
              <Icon name="download" size={14} />
              {!exporting
                ? 'Export'
                : exportProgress
                  ? `Exporting ${exportProgress.done}/${exportProgress.total}…`
                  : 'Exporting…'}
            </button>
            <button
              className={`btn${showColumns ? ' primary' : ''}`}
              onClick={() => { setShowColumns((v) => !v); setShowFilters(false); }}
            >
              <Icon name="settings" size={14} /> Columns
            </button>
          </>
        }
      />

      {/* <Grid min={200} style={{ marginBottom: 16 }}>
        <StatCard label="Guests" value={totalCount} icon="guests" tint={brandHex()} />
      </Grid> */}

      <div className="filter-bar" style={{ marginBottom: 12 }}>
        <div className="search" style={{ flex: 1, maxWidth: 340 }}>
          <Icon name="search" size={14} />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search name, email, organisation…"
          />
        </div>

        <button
          className={`btn${showFilters ? ' primary' : ''}`}
          onClick={() => { setShowFilters((v) => !v); setShowColumns(false); }}
        >
          <Icon name="filter" size={14} /> Filters
          {activeFilterCount > 0 && (
            <span className="chip" style={{ fontSize: 10, marginInlineStart: 4 }}>{activeFilterCount}</span>
          )}
        </button>

        {(activeFilterCount > 0 || searchInput) && (
          <button className="btn" onClick={resetFilters}>
            <Icon name="close" size={13} /> Clear
          </button>
        )}

        <span style={{ marginInlineStart: 'auto', fontSize: 12, color: 'var(--ink-mute)' }}>
          {loading ? 'Loading…' : `${totalCount} delegate${totalCount === 1 ? '' : 's'}`}
        </span>
      </div>

      {showColumns && (
        <Card style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginBottom: 10 }}>
            Every attribute is available here; the defaults are the ones that stay readable at a glance.
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {COLUMNS.filter((c) => !c.always).map((c) => {
              const on = visible.has(c.key);
              return (
                <button
                  key={c.key}
                  type="button"
                  className="chip"
                  onClick={() => toggleColumn(c.key)}
                  style={{
                    cursor: 'pointer', fontSize: 11,
                    background: on ? 'var(--accent-soft)' : 'var(--bg-1)',
                    color: on ? 'var(--accent-ink)' : 'var(--ink-mute)',
                    borderColor: on ? 'var(--gc-accent)' : 'var(--glass-border)',
                  }}
                >
                  {on && <Icon name="check" size={10} />} {c.label}
                </button>
              );
            })}
          </div>
        </Card>
      )}

      {showFilters && (
        <Card style={{ marginBottom: 12 }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
            gap: 12,
          }}>
            <Filter label="Event">
              <Select value={f.event} onChange={(v) => set('event', v || ALL)}
                options={[{ value: ALL, label: 'All events' },
                  ...events.map((e) => ({ value: e.id, label: e.title }))]} />
            </Filter>
            <Filter label="Session">
              <Select value={f.session} onChange={(v) => set('session', v || ALL)}
                isDisabled={f.event === ALL}
                options={[{ value: ALL, label: f.event === ALL ? 'Pick an event first' : 'Any session' },
                  ...sessions.map((s) => ({ value: s.id, label: s.title }))]} />
            </Filter>
            <Filter label="Service level">
              <Select value={f.level} onChange={(v) => set('level', v || ALL)}
                options={[{ value: ALL, label: 'All levels' },
                  ...levels.map((l) => ({ value: l.id, label: l.name }))]} />
            </Filter>
            <Filter label="Invitation">
              <Select value={f.invitation} onChange={(v) => set('invitation', v || ALL)}
                options={[{ value: ALL, label: 'Any' },
                  ...Object.entries(INVITATION_LABEL).map(([v, label]) => ({ value: v, label }))]} />
            </Filter>
            <Filter label="Accreditation">
              <Select value={f.accreditation} onChange={(v) => set('accreditation', v || ALL)}
                options={[{ value: ALL, label: 'Any' },
                  ...Object.entries(ACCREDITATION_LABEL).map(([v, label]) => ({ value: v, label }))]} />
            </Filter>
            <Filter label="Nationality">
              <Select value={f.nationality} onChange={(v) => set('nationality', v || ALL)}
                options={[{ value: ALL, label: 'Any' },
                  ...nationalities.map((n) => ({ value: n.id, label: n.name, code: n.code }))]}
                formatOptionLabel={nationalityOptionLabel} />
            </Filter>
            <Filter label="Organisation">
              <Select value={f.organisation} onChange={(v) => set('organisation', v || ALL)}
                options={[{ value: ALL, label: 'Any' },
                  ...organisations.map((o) => ({ value: o.id, label: o.name }))]} />
            </Filter>
            <Filter label="Delegate type">
              <Select value={f.guestType} onChange={(v) => set('guestType', v || ALL)}
                options={[{ value: ALL, label: 'Any' },
                  ...['dignitary', 'delegate', 'media', 'staff', 'vip', 'observer'].map((t) => ({ value: t, label: t }))]} />
            </Filter>
            <Filter label="Has flight">
              <Select value={f.hasFlight} onChange={(v) => set('hasFlight', v || ALL)} options={YES_NO} />
            </Filter>
            <Filter label="Has accommodation">
              <Select value={f.hasAccommodation} onChange={(v) => set('hasAccommodation', v || ALL)} options={YES_NO} />
            </Filter>
            <Filter label="Has transport">
              <Select value={f.hasTransport} onChange={(v) => set('hasTransport', v || ALL)} options={YES_NO} />
            </Filter>
            <Filter label="Has pending services">
              <Select value={f.hasPendingServices} onChange={(v) => set('hasPendingServices', v || ALL)} options={YES_NO} />
            </Filter>
            <Filter label="Arrival from">
              <DateField value={f.arrivalFrom} onChange={(v) => set('arrivalFrom', v || '')} clearable />
            </Filter>
            <Filter label="Arrival to">
              <DateField value={f.arrivalTo} onChange={(v) => set('arrivalTo', v || '')} clearable />
            </Filter>
            <Filter label="Departure from">
              <DateField value={f.departureFrom} onChange={(v) => set('departureFrom', v || '')} clearable />
            </Filter>
            <Filter label="Departure to">
              <DateField value={f.departureTo} onChange={(v) => set('departureTo', v || '')} clearable />
            </Filter>
          </div>
        </Card>
      )}

      <Card padded={false}>
        {!loading && rows.length === 0 ? (
          <EmptyState icon="search" title="No delegates match">
            Try clearing a filter or widening the search.
          </EmptyState>
        ) : (
          <>
            <div className="dt-scroll" ref={scrollRef}>
              <table className="dt-table">
                <thead>
                  <tr>
                    <th className="dt-th" style={{ width: 36 }} />
                    {shown.map((c) => <th key={c.key} className="dt-th">{c.label}</th>)}
                    <th className="dt-th" style={{ width: 44 }} />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((g) => {
                    const isOpen = expanded.has(g.id);
                    return (
                      <React.Fragment key={g.id}>
                        <tr className="dt-row clickable" onClick={() => toggleRow(g.id)}>
                          <td className="dt-td">
                            <Icon
                              name={isOpen ? 'chevronDown' : 'chevronRight'}
                              size={13}
                              style={{ color: 'var(--ink-mute)' }}
                            />
                          </td>
                          {shown.map((c) => (
                            <td key={c.key} className="dt-td" style={{ fontSize: 12 }}>
                              {cellFor(c, g)}
                            </td>
                          ))}
                          <td className="dt-td" onClick={(e) => e.stopPropagation()}>
                            <ActionMenu
                              items={[
                                // /guests/:id is event-scoped, and a row here is
                                // a person — so the participation to open has to
                                // be looked up first (openParticipation).
                                { label: 'View profile', icon: 'guests', onClick: () => openParticipation(g) },
                                {
                                  // Support chat is person-scoped, so the row id
                                  // (personId) is exactly right here.
                                  label: 'Message', icon: 'message',
                                  onClick: () => navigate('/support-chat', {
                                    state: {
                                      personId: g.id,
                                      guestName: `${g.firstName} ${g.lastName}`.trim(),
                                      guestOrganization: g.organization || '',
                                    },
                                  }),
                                },
                              ]}
                            />
                          </td>
                        </tr>
                        {isOpen && (
                          <tr>
                            <td className="dt-td" colSpan={shown.length + 2} style={{ padding: 0, background: 'var(--surface-soft-2)' }}>
                              <div style={{
                                position: 'sticky', left: 0,
                                width: detailWidth || '100%',
                                boxSizing: 'border-box',
                              }}>
                                <GuestDetail personId={g.id} guest={g} />
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="dt-footer">
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {totalCount === 0 ? 0 : page * pageSize + 1}–
                {Math.min((page + 1) * pageSize, totalCount)} of {totalCount}
                <select
                  className="dt-size"
                  value={pageSize}
                  onChange={(e) => { setPageSize(Number(e.target.value)); setPage(0); }}
                  aria-label="Rows per page"
                >
                  {PAGE_SIZES.map((n) => <option key={n} value={n}>{n} / page</option>)}
                </select>
              </span>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <button className="dt-page" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>‹ Prev</button>
                {Array.from({ length: pageCount }, (_, i) => i)
                  .filter((i) => Math.abs(i - page) <= 2)
                  .map((i) => (
                    <button
                      key={i}
                      className={`dt-page${i === page ? ' active' : ''}`}
                      onClick={() => setPage(i)}
                    >
                      {i + 1}
                    </button>
                  ))}
                <button className="dt-page" disabled={page + 1 >= pageCount} onClick={() => setPage((p) => p + 1)}>Next ›</button>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

function Filter({ label, children }) {
  return (
    <div>
      <label style={{
        display: 'block', fontSize: 10, color: 'var(--ink-mute)',
        textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 5,
      }}>
        {label}
      </label>
      {children}
    </div>
  );
}
