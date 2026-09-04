// The guest's service checklist.
//
// On a Flexible event every assigned service is optional and openable in any
// order. On a Fixed event they must be completed in the level's configured
// sequence, so anything after the first incomplete service is locked. The
// server decides both — `isUnlocked` / `lockedReason` come straight off the
// plan and are re-checked on save. See docs/service-levels-v2.md.
//
// Presentation lives in cards/GuestDetailCards: this file decides WHICH card a
// slot gets and what data goes in it, the card family decides how any of it
// looks. A new service type means a new body over there, not a new card style.
import React, { useState, useEffect, useCallback } from 'react';
import { Icon } from '../../components/Icons';
import Modal from '../../components/ui/Modal';
import { DynamicFormInputs, missingRequired, allFormFields } from '../../components/ui/DynamicFields';
import { loadLookupOptions, lookupLabelFor } from '../../components/ui/lookupSources';
import toast from '../../lib/toast';
import {
  getGuestServicePlan, saveGuestServiceEntry, deleteGuestServiceEntry,
} from '../../api/services/serviceCatalogService';
import TravelAccordion, {
  EMPTY_TRAVEL, hydrateTravel, buildTravelPayload, validateTravel, sectionHasData,
} from './modals/TravelAccordion';
import {
  getTravelLookups, getGuestTravel, saveGuestTravel,
  deleteFlight, deleteAccommodation, deleteTransport,
} from '../../api/services/travelService';
import { addDaysIso, fmtDate } from '../../lib/date';
import {
  GuestCard, CardHeader, CardFooter, CardSlider,
  FlightCard, HotelCard, TransportCard, ServiceCard,
} from './cards/GuestDetailCards';

// System slots always render in this order, regardless of where the level put
// them in its own sequence.
const SYSTEM_ORDER = ['flight', 'transport', 'accommodation'];

// This dynamic service covers the same ground as the Arrival/Departure card
// (see TravelView's own "Arrivals & Departures" tab) — it's merged INTO that
// card instead of getting a card of its own, so the subject isn't split
// across two boxes.
const AD_SERVICE_CODE = 'arrivals-departures';

// The three built-in services keep their own tables and their own hand-written
// form, so a slot for one of them opens TravelAccordion and saves through the
// travel endpoints. Everything the VIP app, the driver app, dispatch and the
// conflict checks read stays where they read it from.
// See Core/Constants/SystemServices.cs and docs/service-levels-v2.md §7.
const TRAVEL_SECTION = { flight: 'flight', accommodation: 'accommodation', transport: 'transport' };
const DELETE_BOOKING = {
  flight: deleteFlight,
  accommodation: deleteAccommodation,
  transport: deleteTransport,
};

// A service defines its own icon, but the three built-ins predate that field —
// fall back to the glyph their card already leads with.
const SYSTEM_ICON = { flight: 'planeTakeoff', accommodation: 'hotel', transport: 'car' };

// Hotel and transport dates sit a few days either side of the event itself.
const DATE_MARGIN_DAYS = 3;

// ── Display helpers ───────────────────────────────────────────────────────

/** "2026-12-11T08:30:00" -> "08:30" */
const hhmm = (v) => (v ? String(v).slice(11, 16) : '');

/** ISO timestamp -> "11-12-2026, 08:30" in the portal's own date format. */
function whenLabel(iso) {
  if (!iso) return '';
  const d = fmtDate(iso, '') || '';
  const t = hhmm(iso);
  return [d, t].filter(Boolean).join(', ');
}

/**
 * Time in the air, as "5h 15m" / "45m" — null unless both ends are present and
 * make sense. Mirrors the same calculation the Travel board's flight cells use
 * (see TravelView's flightDuration), so a flight reads the same in both places.
 */
function flightDuration(start, end) {
  if (!start || !end) return null;
  const ms = new Date(end) - new Date(start);
  if (!Number.isFinite(ms) || ms <= 0) return null;
  const mins = Math.round(ms / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h ? `${h}h${m ? ` ${m}m` : ''}` : `${m}m`;
}

/** "in-progress" -> "In progress" — API status codes are not display text. */
function statusLabel(s) {
  const t = String(s || '').replace(/[-_]+/g, ' ').trim();
  return t ? t[0].toUpperCase() + t.slice(1) : '';
}

/** Vehicle labels arrive as "AB-1234 · Toyota Land Cruiser": plate, then model. */
function splitVehicle(label) {
  const parts = String(label || '').split('·').map((s) => s.trim()).filter(Boolean);
  if (parts.length > 1) return { plate: parts[0], vehicle: parts.slice(1).join(' · ') };
  return { plate: '', vehicle: parts[0] || '' };
}

// Each built-in card prefers the event-wide travel row (it carries airport
// codes, cities, class, room type — everything the card wants to show) and
// falls back to the plan's own flat display values, which is all there is if
// the guest's booking sits outside the page of rows the detail view fetched.
/**
 * A booking is one card, but a RETURN booking is two flights inside it — the
 * row's own departureCode/arrivalCode are a first-leg-to-last-leg summary
 * built for the collapsed table row, which for a return reads as the outbound
 * origin paired with the inbound destination (i.e. back where you started).
 * So the card is driven off the legs, each with its own number, route, times,
 * cabin and seat, and only falls back to the summary when a booking carries
 * no legs at all.
 */
function flightProps(row, v) {
  if (row) {
    const type = String(row.flightType || '').toLowerCase();
    const legs = row.legs || [];
    const cabin = (cls, seat) => [cls, seat].filter((x) => x && x !== '—').join(' · ');

    // Event-centric, not airline-centric: a guest ARRIVES first (inbound) and
    // departs after (outbound), the same sense the Arrivals & Departures board
    // uses. Drives the caption AND the plane glyph, so a lone arrival still
    // gets a landing plane rather than a take-off.
    const directionOf = (i) => {
      if (legs.length > 1) return i === 0 ? 'inbound' : 'outbound';
      return type === 'inbound' || type === 'outbound' ? type : null;
    };

    if (legs.length === 0) {
      return {
        status: row.status, statusLabel: statusLabel(row.status),
        legs: [{
          key: row.id,
          fromCode: row.departureCode, fromCity: row.departureCity,
          toCode: row.arrivalCode, toCity: row.arrivalCity,
          dateTime: whenLabel(row.departureTime || row.date),
          duration: flightDuration(row.departureTime, row.arrivalTime),
          flightNumber: row.flightNumber,
          flightClass: cabin(row.flightClass, row.seat),
          direction: directionOf(0),
        }],
      };
    }

    return {
      status: row.status, statusLabel: statusLabel(row.status),
      legs: legs.map((l, i) => ({
        key: l.id ?? i,
        fromCode: l.departureCode, fromCity: l.departureCity,
        toCode: l.arrivalCode, toCity: l.arrivalCity,
        dateTime: whenLabel(l.startTime),
        duration: flightDuration(l.startTime, l.endTime),
        flightNumber: l.flightNumber || row.flightNumber,
        flightClass: cabin(l.flightClass || row.flightClass, l.seat || row.seat),
        direction: directionOf(i),
      })),
    };
  }

  // No travel row — the plan's flat values, which collapse a return's legs into
  // one " / "-joined string and carry no airport codes at all.
  return {
    status: v['Flight Status'], statusLabel: statusLabel(v['Flight Status']),
    legs: [{
      key: 'fallback',
      dateTime: v.Departs,
      duration: flightDuration(v.Departs, v.Arrives),
      flightNumber: v.Flight,
      direction: null,
    }],
  };
}

/** Whole nights between two ISO dates — 0/null when the pair can't support it. */
function nightsBetween(checkIn, checkOut) {
  if (!checkIn || !checkOut) return null;
  const ms = new Date(checkOut) - new Date(checkIn);
  if (!Number.isFinite(ms) || ms <= 0) return null;
  return Math.round(ms / 86400000);
}

function hotelProps(row, v) {
  if (row) {
    return {
      hotel: row.hotel, roomType: row.roomType,
      checkIn: fmtDate(row.checkIn, '') || '', checkOut: fmtDate(row.checkOut, '') || '',
      nights: nightsBetween(row.checkIn, row.checkOut),
    };
  }
  return {
    hotel: v.Hotel, roomType: v['Room type'],
    checkIn: v['Check-in'], checkOut: v['Check-out'],
  };
}

function transportProps(row, v) {
  if (row) {
    return {
      ...splitVehicle(row.vehicle),
      driver: row.driverName,
      pickup: row.pickup, dropoff: row.dropoff,
      pickupTime: whenLabel(row.pickupTime),
      status: row.tripStatus, statusLabel: statusLabel(row.tripStatus),
    };
  }
  return {
    ...splitVehicle(v.Vehicle),
    pickup: v.Pickup, dropoff: v.Dropoff, pickupTime: v['Pickup time'],
    status: v.Status, statusLabel: statusLabel(v.Status),
  };
}

/**
 * A dynamic service has no fixed shape, so its card is driven by its own form:
 * walk the schema in render order and pair each field's LABEL with its
 * displayed value. The stored values are keyed by field key ("pickupPoint"),
 * which is not something to put in front of a reader — and the raw value is
 * often an id or an option code, so it goes through `display` too.
 *
 * The first filled field becomes the card's headline; the rest are its grid.
 */
function serviceProps(form, v, display, isAr) {
  const values = v || {};
  const filled = (x) => x != null && String(x).trim() !== '';
  const pairs = [];
  const seen = new Set();

  allFormFields(form).forEach((f) => {
    seen.add(f.key);
    if (!filled(values[f.key])) return;
    pairs.push([(isAr ? f.labelAr : null) || f.label || f.key, display(f, values[f.key])]);
  });

  // Anything the form no longer declares — the schema changed after this entry
  // was saved. Better a raw key than silently dropping the guest's data.
  Object.entries(values).forEach(([k, raw]) => {
    if (seen.has(k) || !filled(raw)) return;
    pairs.push([k, String(raw)]);
  });

  const [first, ...rest] = pairs;
  return { primaryLabel: first?.[0], primary: first?.[1], facts: rest };
}

// ── Small shared pieces ───────────────────────────────────────────────────

// A locked slot still has to say why it can't be opened; a completed/pending
// one doesn't need a pill, because the card either shows a booking or says it
// has none — the header space goes to the entry's own actions instead.
function LockedPill({ isAr }) {
  return (
    <span className="chip draft" style={{ fontSize: 10.5, flexShrink: 0 }}>
      <Icon name="shield" size={10} /> {isAr ? 'مقفل' : 'Locked'}
    </span>
  );
}

function EmptyLine({ children }) {
  return (
    <div style={{ fontSize: 12.5, color: 'var(--ink-faint)', textAlign: 'center', padding: '10px 0' }}>
      {children}
    </div>
  );
}

// `eventGuestId` — the guest's participation in `eventId` (GuestResponse.id).
// The service plan, its entries and the built-in travel sections are all saved
// against it; the master personId has no place on this screen.
export default function GuestServicesPanel({
  eventGuestId, lang, onChanged, eventStart, eventEnd, eventId,
  arrivalDate, departureDate, embedded, travelRows,
}) {
  const isAr = lang === 'ar';
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);

  const [editing, setEditing] = useState(null);   // { slot, entry|null }
  const [values, setValues] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  // { slot, entry } — removing a booking is destructive and can't be undone,
  // so nothing is deleted straight off the card's trash icon.
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [removing, setRemoving] = useState(false);

  // Static-form state, used only while a built-in slot is open.
  const [travel, setTravel] = useState(EMPTY_TRAVEL);
  const [travelLookups, setTravelLookups] = useState({});

  // Options for the dynamic services' `lookup` fields, so a card shows "DOH —
  // Doha" rather than the guid actually stored. Module-level cached, so this
  // costs nothing once another screen has already asked for the same source.
  const [lookups, setLookups] = useState({});

  const isSystemEdit = !!editing?.slot?.isSystem;

  const load = useCallback(() => {
    if (!eventGuestId) return;
    setLoading(true);
    getGuestServicePlan(eventGuestId)
      .then(setPlan)
      .catch(() => setPlan(null))
      .finally(() => setLoading(false));
  }, [eventGuestId]);

  useEffect(() => { load(); }, [load]);

  // Only fetched once a built-in slot is actually opened — the dynamic path needs
  // none of it, and this is eight parallel lookup requests.
  useEffect(() => {
    if (!isSystemEdit || Object.keys(travelLookups).length > 0) return;
    getTravelLookups(eventId).then(setTravelLookups).catch(() => setTravelLookups({}));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSystemEdit, eventId]);

  useEffect(() => {
    const sources = new Set();
    (plan?.slots || []).forEach((s) => {
      if (s.isSystem) return;
      allFormFields(s.form).forEach((f) => {
        if (f.type === 'lookup' && f.sourceKey) sources.add(f.sourceKey);
      });
    });
    if (sources.size === 0) return undefined;
    let cancelled = false;
    Promise.all([...sources].map((k) => loadLookupOptions(k, { eventId }).then((opts) => [k, opts])))
      .then((pairs) => { if (!cancelled) setLookups(Object.fromEntries(pairs)); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [plan, eventId]);

  // Stored values are raw: option codes, ids, ISO timestamps. Same resolution
  // the Services board does for its own columns (see ServiceOpsView).
  const display = useCallback((field, raw) => {
    if (raw == null || raw === '') return '';
    if (field.type === 'lookup') return lookupLabelFor(field.sourceKey, raw, lookups[field.sourceKey]);
    if (field.type === 'select') {
      const hit = (field.options || []).find((o) => o.value === String(raw));
      return (isAr ? hit?.labelAr : null) || hit?.label || String(raw);
    }
    if (field.type === 'checkbox') {
      return raw === true || raw === 'true' ? (isAr ? 'نعم' : 'Yes') : (isAr ? 'لا' : 'No');
    }
    if (field.type === 'datetime') return String(raw).replace('T', ' ').slice(0, 16);
    if (field.type === 'date') return fmtDate(raw, String(raw));
    return String(raw);
  }, [lookups, isAr]);

  function openEntry(slot, entry) {
    setEditing({ slot, entry: entry || null });
    setError(null);

    if (!slot.isSystem) {
      setValues(entry ? { ...(entry.values || {}) } : {});
      return;
    }

    // A built-in slot's entry id IS the booking's id, so the prefill comes from
    // the travel endpoint rather than from the plan's display values.
    setTravel(EMPTY_TRAVEL);
    if (entry?.id) {
      getGuestTravel(eventGuestId, entry.id)
        .then((raw) => setTravel(hydrateTravel(raw)))
        .catch(() => setError(isAr ? 'تعذّر تحميل الحجز' : 'Could not load that booking'));
    }
  }

  // A booking either exists or it doesn't — the static forms have no draft state,
  // so saving one is always "completed" as far as the checklist is concerned.
  async function saveTravelSection() {
    const key = TRAVEL_SECTION[editing.slot.code];

    if (!sectionHasData(travel, key)) {
      setError(isAr ? 'لم يتم إدخال أي بيانات' : 'Nothing filled in yet');
      return;
    }
    // Scoped to this section: another one being half-finished is not this form's
    // problem, and each booking is saved on its own.
    const err = validateTravel(travel, isAr, key);
    if (err) { setError(err); return; }

    setSaving(true);
    try {
      await saveGuestTravel(eventGuestId, buildTravelPayload(travel, travelLookups));
      toast.success(isAr ? 'تم الحفظ' : 'Saved');
      setEditing(null);
      load();
      onChanged?.();
    } catch (e) {
      // Double-booking messages come back as a readable sentence; inline beats a toast.
      setError(e?.message || (isAr ? 'تعذّر الحفظ' : 'Could not save'));
    } finally {
      setSaving(false);
    }
  }

  async function save(markCompleted) {
    const { slot, entry } = editing;
    if (slot.isSystem) return saveTravelSection();

    if (markCompleted) {
      const missing = missingRequired(slot.form, values);
      if (missing.length > 0) {
        setError(isAr
          ? `أكمل: ${missing.join('، ')}`
          : `Fill in ${missing.join(', ')} before completing.`);
        return;
      }
    }

    setSaving(true);
    try {
      await saveGuestServiceEntry(eventGuestId, {
        id: entry?.id || null,
        serviceId: slot.serviceId,
        values,
        markCompleted,
      });
      toast.success(isAr ? 'تم الحفظ' : 'Saved');
      setEditing(null);
      load();
      onChanged?.();
    } catch (err) {
      toast.fromError(err, isAr ? 'تعذّر الحفظ' : 'Could not save');
    } finally {
      setSaving(false);
    }
  }

  async function removeEntry() {
    if (!confirmDelete) return;
    const { slot, entry } = confirmDelete;
    setRemoving(true);
    try {
      // A built-in's entry is a booking row, removed through its own endpoint.
      const del = slot.isSystem ? DELETE_BOOKING[slot.code] : null;
      if (del) await del(entry.id);
      else await deleteGuestServiceEntry(eventGuestId, entry.id);
      toast.success(isAr ? 'تم الحذف' : 'Removed');
      setConfirmDelete(null);
      load();
      onChanged?.();
    } catch (err) {
      // Left open on failure — a Fixed sequence refuses to drop a service the
      // later ones depend on, and that reason is worth reading next to the
      // thing it refers to.
      toast.fromError(err, isAr ? 'تعذّر الحذف' : 'Could not remove');
    } finally {
      setRemoving(false);
    }
  }

  if (loading) {
    return <div style={{ fontSize: 12.5, color: 'var(--ink-mute)', padding: 8 }}>…</div>;
  }

  const slots = plan?.slots || [];
  const systemSlots = SYSTEM_ORDER
    .map((code) => slots.find((s) => s.isSystem && s.code === code))
    .filter(Boolean);
  // The "arrivals-departures" dynamic service is merged into the
  // Arrival/Departure card below instead of getting a card of its own.
  const adSlot = slots.find((s) => !s.isSystem && s.code === AD_SERVICE_CODE);
  const dynamicSlots = slots.filter((s) => !s.isSystem && s.code !== AD_SERVICE_CODE);

  const ROWS = {
    flight: travelRows?.flights,
    accommodation: travelRows?.accommodations,
    transport: travelRows?.transports,
  };

  /**
   * One card per slot: the slot supplies the header (subject + status) and the
   * footer (entry actions, entry pager, Add), the card family supplies the
   * body that fits this service type.
   */
  function renderSlotCard(slot, override = {}) {
    const locked = !slot.isUnlocked;
    const title = override.title || (isAr ? slot.nameAr : null) || slot.name;
    const icon = override.icon || slot.icon || SYSTEM_ICON[slot.code] || 'star';

    // Always adds a NEW entry (never overwrites the one shown) — that's how a
    // guest ends up with a second flight or another night's stay.
    const addBtn = !locked && (
      <button className="btn" style={{ width: '100%', fontSize: 12 }}
        onClick={() => openEntry(slot, null)}>
        <Icon name="plus" size={12} />
        {slot.entries.length > 0
          ? (isAr ? 'إضافة أخرى' : 'Add another')
          : (isAr ? 'إضافة' : 'Add')}
      </button>
    );

    if (slot.entries.length === 0) {
      return (
        <GuestCard key={slot.serviceId} embedded={embedded}>
          <CardHeader icon={icon} title={title}>
            {locked && <LockedPill isAr={isAr} />}
          </CardHeader>
          {locked && slot.lockedReason
            ? <EmptyLine>{slot.lockedReason}</EmptyLine>
            : <EmptyLine>{isAr ? 'لا إدخالات بعد' : 'No entries yet'}</EmptyLine>}
          <CardFooter>{addBtn}</CardFooter>
        </GuestCard>
      );
    }

    return (
      <CardSlider key={slot.serviceId} items={slot.entries}>
        {(entry, pager) => {
          // Edit/delete act on the entry the card is currently showing, so they
          // sit in its header where the status pill used to — the pill said
          // little the card body wasn't already saying.
          const header = (
            <CardHeader icon={icon} title={title}>
              {entry.status !== 'completed' && (
                <span className="chip draft" style={{ fontSize: 10, flexShrink: 0 }}>
                  {isAr ? 'مسودة' : 'Draft'}
                </span>
              )}
              <button type="button" className="icon-btn" style={{ width: 26, height: 26, flexShrink: 0 }}
                title={isAr ? 'تعديل' : 'Edit'} onClick={() => openEntry(slot, entry)}>
                <Icon name="edit" size={12} />
              </button>
              <button type="button" className="icon-btn"
                style={{ width: 26, height: 26, flexShrink: 0, color: 'var(--danger)' }}
                title={isAr ? 'حذف' : 'Remove'} onClick={() => setConfirmDelete({ slot, entry })}>
                <Icon name="trash" size={12} />
              </button>
            </CardHeader>
          );
          const shell = {
            lang, embedded, header,
            footer: <>{pager}{addBtn}</>,
          };
          const v = entry.values || {};
          const row = (ROWS[slot.code] || []).find((r) => r.id === entry.id);

          if (slot.isSystem && slot.code === 'flight') {
            return <FlightCard {...shell} {...flightProps(row, v)} />;
          }
          if (slot.isSystem && slot.code === 'accommodation') {
            return <HotelCard {...shell} {...hotelProps(row, v)} />;
          }
          if (slot.isSystem && slot.code === 'transport') {
            return <TransportCard {...shell} {...transportProps(row, v)} />;
          }
          return <ServiceCard {...shell} icon={icon} {...serviceProps(slot.form, v, display, isAr)} />;
        }}
      </CardSlider>
    );
  }

  return (
    <>
      {plan?.serviceLevelId && slots.length > 0 && (
        <div style={{
          gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 8,
          fontSize: 11.5, color: 'var(--ink-mute)',
        }}>
          <span style={{ fontWeight: 700, color: 'var(--ink)' }}>
            {isAr ? 'الخدمات' : 'Services'}
          </span>
        </div>
      )}

      {plan?.serviceLevelId ? (
        systemSlots.map((s) => renderSlotCard(s))
      ) : (
        <div style={{ gridColumn: '1 / -1', fontSize: 12.5, color: 'var(--ink-faint)', fontStyle: 'italic' }}>
          {isAr
            ? 'لم يتم تعيين مستوى خدمة لهذا المندوب.'
            : 'This delegate has no service level, so there are no built-in services to complete.'}
        </div>
      )}

      {/* Arrival / Departure — the "arrivals-departures" dynamic service gets
          this card rather than one of its own, since it's the same subject.
          Shown even when the level doesn't assign it, so the slot the board
          reads from is visible on every guest. */}
      {adSlot ? (
        renderSlotCard(adSlot, {
          icon: 'arrowsExchange',
          title: isAr ? 'الوصول والمغادرة' : 'Arrival / Departure',
        })
      ) : (
        <GuestCard embedded={embedded}>
          <CardHeader icon="arrowsExchange" title={isAr ? 'الوصول والمغادرة' : 'Arrival / Departure'} />
          <EmptyLine>{isAr ? 'غير مُسندة لهذا المستوى' : 'Not assigned by this service level'}</EmptyLine>
        </GuestCard>
      )}

      {plan?.serviceLevelId && dynamicSlots.length > 0 && dynamicSlots.map((s) => renderSlotCard(s))}

      <Modal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title={isAr ? 'حذف هذا الإدخال؟' : 'Remove this entry?'}
        subtitle={confirmDelete
          ? ((isAr ? confirmDelete.slot.nameAr : null) || confirmDelete.slot.name)
          : ''}
        width={420}
        footer={
          <>
            <button className="btn" onClick={() => setConfirmDelete(null)} disabled={removing}>
              {isAr ? 'إلغاء' : 'Cancel'}
            </button>
            <button className="btn danger" onClick={removeEntry} disabled={removing}>
              <Icon name="trash" size={13} />
              {removing ? (isAr ? 'جارٍ الحذف…' : 'Removing…') : (isAr ? 'حذف' : 'Remove')}
            </button>
          </>
        }
      >
        <div style={{ fontSize: 13, color: 'var(--ink-dim)', lineHeight: 1.6 }}>
          {confirmDelete?.slot.isSystem
            ? (isAr
              ? 'سيتم حذف هذا الحجز نهائياً من سجل المندوب. لا يمكن التراجع عن هذا الإجراء.'
              : "This permanently deletes the booking from the delegate's record. It cannot be undone.")
            : (isAr
              ? 'سيتم حذف هذا الإدخال نهائياً. لا يمكن التراجع عن هذا الإجراء.'
              : 'This permanently deletes the entry. It cannot be undone.')}
        </div>
      </Modal>

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing ? ((isAr ? editing.slot.nameAr : null) || editing.slot.name) : ''}
        subtitle={editing?.entry
          ? (isAr ? 'تعديل إدخال' : 'Edit entry')
          : (isAr ? 'إدخال جديد' : 'New entry')}
        width={isSystemEdit ? 700 : 620}
        footer={
          <>
            <button className="btn" onClick={() => setEditing(null)} disabled={saving}>
              {isAr ? 'إلغاء' : 'Cancel'}
            </button>
            {/* No draft state for a built-in: the booking row either exists or it
                does not, which is also what unlocks the next service. */}
            {!isSystemEdit && (
              <button className="btn" onClick={() => save(false)} disabled={saving}>
                {isAr ? 'حفظ كمسودة' : 'Save draft'}
              </button>
            )}
            <button className="btn primary" onClick={() => save(true)} disabled={saving}>
              <Icon name="check" size={13} />
              {isSystemEdit ? (isAr ? 'حفظ' : 'Save') : (isAr ? 'إكمال' : 'Complete')}
            </button>
          </>
        }
      >
        {error && (
          <div className="alert alert-warn" style={{ fontSize: 12.5 }}>
            <Icon name="alert" size={14} /><div>{error}</div>
          </div>
        )}
        {editing && isSystemEdit && (
          <TravelAccordion
            travel={travel}
            onChange={setTravel}
            lookups={travelLookups}
            isAr={isAr}
            only={TRAVEL_SECTION[editing.slot.code]}
            eventId={eventId}
            eventMinDate={eventStart}
            eventMaxDate={eventEnd}
            dateMinDate={addDaysIso(eventStart, -DATE_MARGIN_DAYS)}
            dateMaxDate={addDaysIso(eventEnd, DATE_MARGIN_DAYS)}
          />
        )}

        {editing && !isSystemEdit && (
          <DynamicFormInputs
            form={editing.slot.form}
            values={values}
            onChange={setValues}
            lang={lang}
            eventStart={eventStart}
            eventEnd={eventEnd}
            eventId={eventId}
          />
        )}
      </Modal>
    </>
  );
}
