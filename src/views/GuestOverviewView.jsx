// Guest Overview — every guest in the system, across every event.
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
import { PageHeader, Card, Grid, StatCard, EmptyState } from '../components/ds';
import { Icon } from '../components/Icons';
import Select from '../components/ui/Select';
import DateField from '../components/ui/DateField';
import ActionMenu from '../components/ui/ActionMenu';
import toast from '../lib/toast';
import { getGuestOverview } from '../api/services/guestOverviewService';
import { listEvents, listSessions } from '../api/services/eventService';
import { getServiceLevels } from '../api/services/serviceCatalogService';
import { getOrganizations } from '../api/services/organizationService';
import { getNationalities } from '../api/services/nationalityService';
import {
  GuestCell, LevelChip,
  INVITATION_TONE, INVITATION_LABEL, ACCREDITATION_TONE, ACCREDITATION_LABEL,
} from './guestOverview/parts';
import GuestDetail from './guestOverview/GuestDetail';

const ALL = 'all';

// key -> label. `core: true` columns are on by default; the rest are opt-in
// from the Columns picker.
const COLUMNS = [
  { key: 'guest', label: 'Guest profile', core: true, always: true },
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
  { key: 'guestType', label: 'Guest type' },
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

export default function GuestOverviewView({ lang }) {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [showColumns, setShowColumns] = useState(false);
  const [expanded, setExpanded] = useState(() => new Set());
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [f, setF] = useState(INITIAL_FILTERS);

  const [rows, setRows] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);

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

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getGuestOverview({
      pageNumber: page + 1,
      pageSize,
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
    })
      .then((r) => {
        if (cancelled) return;
        setRows(r?.items || []);
        setTotalCount(r?.totalCount || 0);
      })
      .catch((err) => {
        if (cancelled) return;
        setRows([]);
        setTotalCount(0);
        toast.error(err?.message || 'Could not load guests');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, search, f]);

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
        title="Guest Overview"
        subtitle="Every guest across every event"
        actions={
          <>
            <button className="btn" onClick={() => toast.info('Export coming soon')}>
              <Icon name="download" size={14} /> Export
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
        <StatCard label="Guests" value={totalCount} icon="guests" tint="#8d0134" />
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
          {loading ? 'Loading…' : `${totalCount} guest${totalCount === 1 ? '' : 's'}`}
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
                    color: on ? 'var(--accent)' : 'var(--ink-mute)',
                    borderColor: on ? 'var(--accent)' : 'var(--glass-border)',
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
                  ...nationalities.map((n) => ({ value: n.id, label: `${n.flag || ''} ${n.name}` }))]} />
            </Filter>
            <Filter label="Organisation">
              <Select value={f.organisation} onChange={(v) => set('organisation', v || ALL)}
                options={[{ value: ALL, label: 'Any' },
                  ...organisations.map((o) => ({ value: o.id, label: o.name }))]} />
            </Filter>
            <Filter label="Guest type">
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
          <EmptyState icon="search" title="No guests match">
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
                                { label: 'View profile', icon: 'guests', onClick: () => toast.info('Coming soon') },
                                { label: 'Edit guest', icon: 'edit', onClick: () => toast.info('Coming soon') },
                                { label: 'Message', icon: 'message', onClick: () => toast.info('Coming soon') },
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
                                <GuestDetail guestId={g.id} />
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
