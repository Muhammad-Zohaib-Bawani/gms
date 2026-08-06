// Operational listings for the DYNAMIC services — everything except the three
// built-in relational ones. The tab strip is built from whatever services exist,
// and each table's columns come from that service's form, so creating a service
// in admin puts it here automatically with no code change.
//
// Flight / Accommodation / Transport are deliberately absent: they keep their own
// tables and their own page (Travel & Logistics / TravelView), because the VIP
// app, the driver app, dispatch, inventory and conflict checking all read those
// tables by foreign key. See Core/Constants/SystemServices.cs and
// docs/service-levels-v2.md §11.
//
// A service whose form contains datetime fields also gets a schedule tab,
// listing every dated movement one row per date rather than one row per guest.
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { PageHeader, Card, EmptyState } from '../components/ds';
import { Icon } from '../components/Icons';
import { Avatar } from '../components/UI';
import DataTable from '../components/ui/DataTable';
import { getServices, getServiceEntries } from '../api/services/serviceCatalogService';
import { allFormFields } from '../components/ui/DynamicFields';
import { loadLookupOptions } from '../components/ui/lookupSources';
import { fmtDate } from '../lib/date';
import SectionCell from './serviceOps/SectionCell';
import BookingModal from './serviceOps/BookingModal';
import ActionMenu from '../components/ui/ActionMenu';
import { deleteGuestServiceEntry } from '../api/services/serviceCatalogService';
import { useEvents } from '../events/EventsContext';
import toast from '../lib/toast';

function initials(name) {
  const p = (name || '').trim().split(/\s+/);
  return ((p[0]?.[0] || '') + (p[1]?.[0] || '')).toUpperCase() || '?';
}

/** Datetime fields are what a schedule can be built from. */
function dateFieldsOf(form) {
  return allFormFields(form).filter((f) => f.type === 'datetime' || f.type === 'date');
}

export default function ServiceOpsView({ lang, activeEventId, gotoView }) {
  const isAr = lang === 'ar';

  const [services, setServices] = useState([]);
  const [tab, setTab] = useState(null);          // `${serviceId}` | `${serviceId}:schedule`
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(15);
  const [loading, setLoading] = useState(false);

  // Lookup-backed columns store ids; the labels come from the same cached
  // lookups the form uses, so a table shows "DOH — DOHA" not a guid.
  const [lookups, setLookups] = useState({});
  const [booking, setBooking] = useState(null);   // { entry } | {} for a new one
  const { activeEvent } = useEvents();

  useEffect(() => {
    getServices(false)
      .then((list) => {
        // Flight / Accommodation / Transport are built-in and relational — they
        // have no form to build columns from and no GuestServiceEntry rows to
        // list. Travel & Logistics owns those three.
        const dynamic = (list || []).filter((s) => !s.isSystem);
        setServices(dynamic);
        if (dynamic.length) setTab((t) => t || String(dynamic[0].id));
      })
      .catch(() => setServices([]));
  }, []);

  const serviceId = tab ? tab.split(':')[0] : null;
  const isSchedule = !!tab && tab.endsWith(':schedule');
  const service = useMemo(() => services.find((s) => s.id === serviceId) || null, [services, serviceId]);

  // Every lookup source this service's form references, fetched once.
  useEffect(() => {
    if (!service) return;
    const keys = [...new Set(allFormFields(service.form)
      .filter((f) => f.type === 'lookup' && f.sourceKey)
      .map((f) => f.sourceKey))];
    let cancelled = false;
    Promise.all(keys.map((k) => loadLookupOptions(k).then((opts) => [k, opts])))
      .then((pairs) => { if (!cancelled) setLookups(Object.fromEntries(pairs)); });
    return () => { cancelled = true; };
  }, [service]);

  const load = useCallback(() => {
    if (!serviceId || !activeEventId) { setRows([]); setTotal(0); return; }
    setLoading(true);
    getServiceEntries(serviceId, {
      eventId: activeEventId,
      pageNumber: pageIndex + 1,
      // The schedule groups several entries onto one guest row, so it pulls a
      // wider page than the paginated entries view.
      pageSize: isSchedule ? 200 : pageSize,
    })
      .then((res) => { setRows(res?.items || []); setTotal(res?.totalCount || 0); })
      .catch(() => { setRows([]); setTotal(0); })
      .finally(() => setLoading(false));
  }, [serviceId, activeEventId, pageIndex, pageSize, isSchedule]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPageIndex(0); }, [tab]);

  const display = useCallback((field, raw) => {
    if (raw == null || raw === '') return '—';
    if (field.type === 'lookup') {
      const hit = (lookups[field.sourceKey] || []).find((o) => o.value === String(raw));
      return hit ? hit.label : String(raw);
    }
    if (field.type === 'select') {
      const hit = (field.options || []).find((o) => o.value === String(raw));
      return (isAr ? hit?.labelAr : null) || hit?.label || String(raw);
    }
    if (field.type === 'checkbox') return raw === 'true' ? (isAr ? 'نعم' : 'Yes') : (isAr ? 'لا' : 'No');
    if (field.type === 'datetime') return String(raw).replace('T', ' ').slice(0, 16);
    if (field.type === 'date') return fmtDate ? fmtDate(raw) : raw;
    return String(raw);
  }, [lookups, isAr]);

  async function removeEntry(row) {
    try {
      await deleteGuestServiceEntry(row.guestId, row.entryId);
      toast.success(isAr ? 'تم الحذف' : 'Removed');
      load();
    } catch (err) {
      // A Fixed sequence refuses removing a service later ones depend on.
      toast.fromError(err, isAr ? 'تعذّر الحذف' : 'Could not remove');
    }
  }

  const guestColumn = {
    id: 'guest',
    header: isAr ? 'الضيف' : 'Guest',
    enableSorting: false,
    cell: ({ row: { original: r } }) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Avatar initials={initials(r.guestName)} size={28} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 550 }}>{r.guestName}</div>
          <div style={{ fontSize: 11, color: 'var(--ink-mute)' }}>{r.email || '—'}</div>
          {r.serviceLevelName && (
            <span className="chip" style={{ fontSize: 10, marginTop: 2 }}>{r.serviceLevelName}</span>
          )}
        </div>
      </div>
    ),
  };

  // ── Entries: one column per section ───────────────────────────────────────
  // A flight form has 25 fields; a column each was unreadable. Each section
  // collapses into a single compact cell instead.
  const entryColumns = useMemo(() => {
    if (!service) return [];
    return [
      guestColumn,
      ...(service.form?.sections || []).map((sec, i) => ({
        id: sec.key || `sec${i}`,
        header: (isAr ? sec.labelAr : null) || sec.label,
        enableSorting: false,
        cell: ({ row: { original: r } }) => (
          <SectionCell
            section={sec}
            values={r.values || {}}
            display={display}
            isAr={isAr}
            inbound={/inbound|arriv/i.test(sec.key || '')}
          />
        ),
      })),
      {
        id: 'status',
        header: isAr ? 'الحالة' : 'Status',
        enableSorting: false,
        cell: ({ row: { original: r } }) => (
          <span className={`chip ${r.status === 'completed' ? 'confirmed' : 'pending'}`} style={{ fontSize: 10.5 }}>
            <span className="dot" />
            {r.status === 'completed' ? (isAr ? 'مكتمل' : 'Completed') : (isAr ? 'مسودة' : 'Draft')}
          </span>
        ),
      },
      {
        id: 'actions', header: '', size: 44, enableSorting: false,
        cell: ({ row: { original: r } }) => (
          <ActionMenu
            items={[
              { label: isAr ? 'تعديل' : 'Edit', icon: 'edit', onClick: () => setBooking({ entry: r }) },
              { label: isAr ? 'حذف' : 'Delete', icon: 'trash', danger: true, onClick: () => removeEntry(r) },
            ]}
          />
        ),
      },
    ];
  }, [service, display, isAr]);

  // ── Arrivals & departures: one row per guest ──────────────────────────────
  // Matches the layout this table had before: a guest with two flights shows
  // both in the same row, stacked inside the relevant column, rather than
  // becoming two unrelated rows.
  const datedSections = useMemo(
    () => (service?.form?.sections || []).filter(
      (sec) => (sec.fields || []).some((f) => f.type === 'datetime' || f.type === 'date'),
    ),
    [service],
  );

  const scheduleRows = useMemo(() => {
    const byGuest = new Map();
    rows.forEach((r) => {
      // Only entries that actually carry a date belong on a schedule.
      const hasDate = datedSections.some((sec) => (sec.fields || [])
        .some((f) => (f.type === 'datetime' || f.type === 'date') && r.values?.[f.key]));
      if (!hasDate) return;

      if (!byGuest.has(r.guestId)) {
        byGuest.set(r.guestId, {
          id: r.guestId,
          guestName: r.guestName,
          email: r.email,
          serviceLevelName: r.serviceLevelName,
          entries: [],
        });
      }
      byGuest.get(r.guestId).entries.push(r);
    });
    return [...byGuest.values()];
  }, [rows, datedSections]);

  const scheduleColumns = useMemo(() => ([
    {
      id: 'guest', header: isAr ? 'الضيف' : 'Guest', enableSorting: false,
      cell: ({ row: { original: r } }) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Avatar initials={initials(r.guestName)} size={28} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12.5, fontWeight: 550 }}>{r.guestName}</div>
            <div style={{ fontSize: 11, color: 'var(--ink-mute)' }}>{r.email || '—'}</div>
            {r.serviceLevelName && (
              <span className="chip" style={{ fontSize: 10, marginTop: 2 }}>{r.serviceLevelName}</span>
            )}
          </div>
        </div>
      ),
    },
    ...datedSections.map((sec, i) => ({
      id: sec.key || `dated${i}`,
      header: (isAr ? sec.labelAr : null) || sec.label,
      enableSorting: false,
      cell: ({ row: { original: r } }) => {
        const cards = r.entries.filter((e) => (sec.fields || [])
          .some((f) => (f.type === 'datetime' || f.type === 'date') && e.values?.[f.key]));
        if (cards.length === 0) return <span style={{ color: 'var(--ink-faint)', fontSize: 12 }}>—</span>;
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {cards.map((e) => (
              <SectionCell
                key={e.entryId}
                section={sec}
                values={e.values || {}}
                display={display}
                isAr={isAr}
                inbound={/inbound|arriv/i.test(sec.key || '')}
              />
            ))}
          </div>
        );
      },
    })),
  ]), [datedSections, display, isAr]);

  if (!activeEventId) {
    return (
      <div>
        <PageHeader title={isAr ? 'الخدمات' : 'Services'} />
        <Card>
          <EmptyState icon="calendar" title={isAr ? 'اختر فعالية' : 'No event selected'}>
            {isAr ? 'اختر فعالية من الشريط العلوي.' : 'Pick an event from the top bar.'}
          </EmptyState>
        </Card>
      </div>
    );
  }

  if (services.length === 0) {
    return (
      <div>
        <PageHeader title={isAr ? 'الخدمات' : 'Services'} />
        <Card>
          <EmptyState icon="star" title={isAr ? 'لا توجد خدمات إضافية' : 'No other services yet'}>
            {isAr
              ? 'الرحلات والإقامة والنقل في صفحة السفر واللوجستيات. أنشئ خدمة جديدة من صفحة الخدمات لتظهر هنا.'
              : 'Flight, Accommodation and Transport live on Travel & Logistics. Create any other service on the Services page and it appears here automatically.'}
          </EmptyState>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={isAr ? 'الخدمات والعمليات' : 'Services & Logistics'}
        subtitle={isAr
          ? 'التبويبات تتبع الخدمات المُعرَّفة'
          : 'Tabs follow the services defined in the catalogue'}
        actions={service && (
          <button className="btn primary" onClick={() => setBooking({ entry: null })}>
            <Icon name="plus" size={14} />
            {isAr ? 'حجز جديد' : 'New Booking'}
          </button>
        )}
      />

      <div className="tabs" style={{ marginBottom: 14 }}>
        {services.map((s) => {
          // The schedule/"Arrivals & Departures" tab is a Flight-only concept —
          // any dated service (Transport's pickup/dropoff, Accommodation's
          // check-in/out, …) would otherwise also qualify and get its own
          // duplicate "Arrivals & Departures" tab next to every one of them.
          const isFlight = (s.code || '').toLowerCase() === 'flight';
          const dated = isFlight && dateFieldsOf(s.form).length > 0;
          return (
            <React.Fragment key={s.id}>
              <button
                className={`tab${tab === String(s.id) ? ' active' : ''}`}
                onClick={() => setTab(String(s.id))}
              >
                {s.icon && <Icon name={s.icon} size={13} />}
                {(isAr ? s.nameAr : null) || s.name}
              </button>
              {dated && (
                <button
                  className={`tab${tab === `${s.id}:schedule` ? ' active' : ''}`}
                  onClick={() => setTab(`${s.id}:schedule`)}
                >
                  <Icon name="calendar" size={13} />
                  {isAr ? 'الوصول والمغادرة' : 'Arrivals & Departures'}
                </button>
              )}
            </React.Fragment>
          );
        })}
      </div>

      <Card padded={false}>
        {isSchedule ? (
          <DataTable
            key={`sched-${serviceId}`}
            columns={scheduleColumns}
            data={scheduleRows}
            loading={loading}
            pageSize={20}
            emptyText={isAr ? 'لا توجد حركات مجدولة' : 'Nothing scheduled yet'}
            searchPlaceholder={isAr ? 'بحث…' : 'Search…'}
          />
        ) : (
          <DataTable
            key={`entries-${serviceId}`}
            columns={entryColumns}
            data={rows}
            loading={loading}
            manualPagination
            pageIndex={pageIndex}
            pageSize={pageSize}
            totalRows={total}
            onPageChange={setPageIndex}
            onPageSizeChange={(n) => { setPageSize(n); setPageIndex(0); }}
            emptyText={isAr
              ? 'لا يوجد ضيوف لهذه الخدمة بعد'
              : 'No guests have this service yet'}
            showSearch={false}
          />
        )}
      </Card>

      <BookingModal
        open={!!booking}
        onClose={() => setBooking(null)}
        onSaved={load}
        service={service}
        entry={booking?.entry || null}
        activeEventId={activeEventId}
        lang={lang}
        eventStart={activeEvent?.startDate}
        eventEnd={activeEvent?.endDate}
      />
    </div>
  );
}
