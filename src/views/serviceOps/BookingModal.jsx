// "New Booking" / edit for one guest's services.
//
// Only guests whose service level actually includes the service being booked can
// be picked — offering the rest would just produce a server rejection. Once a
// guest is chosen, their whole service list appears as the same tick-list the
// create wizard uses (ServiceAccordion), so one dialog can add several services
// at once instead of one per visit.
//
// On a Fixed event the sequence still applies: the API refuses a service whose
// predecessor is unfinished, and that message is surfaced here rather than
// swallowed.
import React, { useState, useEffect, useMemo } from 'react';
import Modal from '../../components/ui/Modal';
import Select from '../../components/ui/Select';
import { Icon } from '../../components/Icons';
import ServiceAccordion, {
  TRAVEL_SECTION, slotHasData, validateServices, slotExtras,
} from '../guests/ServiceAccordion';
import {
  EMPTY_TRAVEL, hydrateTravel, buildTravelPayload, sectionHasData,
} from '../guests/modals/TravelAccordion';
import toast from '../../lib/toast';
import { listGuests } from '../../api/services/guestService';
import {
  getServiceLevels, saveGuestServiceEntry, getGuestServicePlan,
} from '../../api/services/serviceCatalogService';
import {
  getTravelLookups, getGuestTravel, saveGuestTravel,
} from '../../api/services/travelService';
import { addDaysIso } from '../../lib/date';

// Hotel and transport dates sit a few days either side of the event itself.
const DATE_MARGIN_DAYS = 3;

export default function BookingModal({
  open, onClose, onSaved, service, activeEventId, lang, eventStart, eventEnd,
  entry,           // existing row to edit, or null for a new booking
}) {
  const isAr = lang === 'ar';
  const isEdit = !!entry;

  const [guests, setGuests] = useState([]);
  const [levels, setLevels] = useState([]);
  const [eventGuestId, setEventGuestId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // The guest's own service list, and the two state bags the accordion writes to.
  const [plan, setPlan] = useState(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [planError, setPlanError] = useState(null);
  const [pending, setPending] = useState({});
  const [travel, setTravel] = useState(EMPTY_TRAVEL);
  const [travelLookups, setTravelLookups] = useState({});

  useEffect(() => {
    if (!open) return;
    setError(null);
    setEventGuestId(entry?.eventGuestId || '');
    setPending(entry
      // Editing: that one service, already ticked, prefilled.
      ? { [service?.id]: { selected: true, values: { ...(entry.values || {}) }, completed: entry.status === 'completed' } }
      : {});
    setTravel(EMPTY_TRAVEL);
  }, [open, entry, service?.id]);

  useEffect(() => {
    if (!open || !activeEventId) return;
    // pageSize is generous rather than paged: this is a picker, and a second
    // round trip per keystroke is worse than one slightly larger response.
    listGuests({ eventId: activeEventId, pageNumber: 1, pageSize: 500 })
      .then((r) => setGuests(r?.items || []))
      .catch(() => setGuests([]));
    getServiceLevels(false).then(setLevels).catch(() => setLevels([]));
  }, [open, activeEventId]);

  // The guest's plan is what decides which services this dialog offers — the
  // level, not the tab it was opened from.
  useEffect(() => {
    if (!open || !eventGuestId) { setPlan(null); setPlanError(null); return undefined; }
    let cancelled = false;
    setPlanLoading(true);
    setPlanError(null);
    getGuestServicePlan(eventGuestId)
      .then((p) => { if (!cancelled) setPlan(p); })
      // Kept and shown, not swallowed: a failed fetch and a level with no services
      // both left `slots` empty, so one warning covered two very different causes
      // and neither was diagnosable.
      .catch((err) => {
        if (cancelled) return;
        setPlan(null);
        setPlanError(err?.message || (isAr ? 'تعذّر تحميل خدمات الضيف' : "Could not load this guest's services"));
      })
      .finally(() => { if (!cancelled) setPlanLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, eventGuestId]);

  const slots = useMemo(() => (plan?.slots || []).map((s) => ({ ...s })), [plan]);
  const systemSlots = useMemo(() => slots.filter((s) => s.isSystem), [slots]);

  // Only fetched once a built-in service is actually on offer — it's eight
  // parallel lookup requests, and a purely dynamic level needs none of them.
  useEffect(() => {
    if (!open || systemSlots.length === 0 || Object.keys(travelLookups).length > 0) return;
    getTravelLookups(activeEventId).then(setTravelLookups).catch(() => setTravelLookups({}));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, systemSlots.length, activeEventId]);

  // Editing a built-in means editing a booking row, so the prefill comes from the
  // travel endpoint keyed by that booking's id (which is the entry id).
  useEffect(() => {
    if (!open || !entry?.entryId || !eventGuestId) return;
    const isSystemEntry = TRAVEL_SECTION[(service?.code || '').toLowerCase()];
    if (!isSystemEntry) return;
    getGuestTravel(eventGuestId, entry.entryId)
      .then((raw) => setTravel(hydrateTravel(raw)))
      .catch(() => setError(isAr ? 'تعذّر تحميل الحجز' : 'Could not load that booking'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, entry?.entryId, eventGuestId, service?.code]);

  // Levels carrying this service → the guests eligible for it.
  const eligible = useMemo(() => {
    if (!service) return [];
    const levelIds = new Set(
      (levels || [])
        .filter((l) => (l.services || []).some((x) => x.serviceId === service.id))
        .map((l) => l.id),
    );
    return (guests || []).filter((g) => g.serviceLevelId && levelIds.has(g.serviceLevelId));
  }, [guests, levels, service]);

  // `g.id` is the guest's eventGuestId — the roster is loaded per event, and a
  // service entry is saved against the participation, not the person.
  const guestOptions = useMemo(
    () => eligible.map((g) => ({
      value: g.id,
      label: `${g.fullName || `${g.firstName} ${g.lastName}`.trim()}${g.email ? ` · ${g.email}` : ''}`,
    })),
    [eligible],
  );

  // Everything ticked AND filled in — what Save will actually write.
  const toSave = useMemo(
    () => slots.filter((s) => slotHasData(s, pending, travel)),
    [slots, pending, travel],
  );
  // A slot whose CURRENT entry is blank can still have earlier ones queued up
  // via "Add another" — those live in `extra`, not in `toSave`.
  const hasExtras = useMemo(
    () => slots.some((s) => slotExtras(s, pending).length > 0),
    [slots, pending],
  );

  async function save() {
    if (!eventGuestId) {
      setError(isAr ? 'اختر ضيفاً' : 'Pick a guest first');
      return;
    }
    if (toSave.length === 0 && !hasExtras) {
      setError(isAr ? 'ضع علامة على خدمة واملأ بياناتها' : 'Tick a service and fill it in');
      return;
    }

    // Ticking a service commits to filling it in — the per-service Done button is
    // optional, so this is what actually enforces its required fields.
    const err = validateServices(slots, pending, travel, isAr);
    if (err) { setError(err); return; }

    setSaving(true);
    try {
      // Built-ins first and in one call: they all live on the same travel payload.
      if (systemSlots.some((s) => sectionHasData(travel, TRAVEL_SECTION[s.code]))) {
        await saveGuestTravel(eventGuestId, buildTravelPayload(travel));
      }

      // Sequential on purpose: on a Fixed event the server rejects a service whose
      // predecessor is not yet complete, so they have to go in order.
      for (const slot of toSave) {
        if (slot.isSystem) continue;
        await saveGuestServiceEntry(eventGuestId, {
          // Only the entry actually being edited updates in place; every other
          // ticked service is a new row.
          id: slot.serviceId === service?.id ? (entry?.entryId || null) : null,
          serviceId: slot.serviceId,
          values: pending[slot.serviceId]?.values || {},
          // Past validateServices means the required fields are in, so it's
          // complete — a draft would leave the next service locked on a Fixed
          // event and the rest of this loop would then be rejected.
          markCompleted: true,
        });
      }

      // Every earlier entry this session's "Add another" queued up, one save
      // call each — always a brand new row (`id: null`), never the one above.
      for (const slot of slots) {
        const extras = slotExtras(slot, pending);
        if (extras.length === 0) continue;
        if (slot.isSystem) {
          const key = TRAVEL_SECTION[slot.code];
          for (const snap of extras) {
            await saveGuestTravel(eventGuestId, buildTravelPayload({ ...EMPTY_TRAVEL, [key]: snap }));
          }
        } else {
          for (const snap of extras) {
            await saveGuestServiceEntry(eventGuestId, {
              id: null, serviceId: slot.serviceId, values: snap.values || {}, markCompleted: true,
            });
          }
        }
      }

      toast.success(isAr ? 'تم الحفظ' : 'Saved');
      onSaved?.();
      onClose?.();
    } catch (err) {
      // Sequence violations arrive as a readable sentence from the API; showing
      // it inline is more useful than a generic failure toast.
      setError(err?.message || (isAr ? 'تعذّر الحفظ' : 'Could not save'));
    } finally {
      setSaving(false);
    }
  }

  const title = isEdit
    ? (isAr ? 'تعديل الحجز' : 'Edit booking')
    : (isAr ? 'حجز جديد' : 'New booking');

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${title} — ${(isAr ? service?.nameAr : null) || service?.name || ''}`}
      width={680}
      footer={
        <>
          <button className="btn" onClick={onClose} disabled={saving}>
            {isAr ? 'إلغاء' : 'Cancel'}
          </button>
          <button className="btn primary" onClick={save} disabled={saving}>
            <Icon name="check" size={13} />
            {saving ? (isAr ? 'جارٍ الحفظ…' : 'Saving…') : (isAr ? 'حفظ' : 'Save')}
          </button>
        </>
      }
    >
      {error && (
        <div className="alert alert-warn" style={{ fontSize: 12.5 }}>
          <Icon name="alert" size={14} /><div>{error}</div>
        </div>
      )}

      <div>
        <label style={{
          display: 'block', fontSize: 10.5, color: 'var(--ink-mute)',
          textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6,
        }}>
          {isAr ? 'الضيف' : 'Guest'} *
        </label>
        {isEdit ? (
          <div style={{ fontSize: 13, fontWeight: 550 }}>{entry.guestName}</div>
        ) : guestOptions.length === 0 ? (
          <div className="alert alert-info" style={{ fontSize: 12.5 }}>
            <Icon name="alert" size={14} />
            <div>
              {isAr
                ? 'لا يوجد ضيوف على مستوى خدمة يشمل هذه الخدمة.'
                : 'No guests are on a service level that includes this service yet.'}
            </div>
          </div>
        ) : (
          <Select
            value={eventGuestId}
            onChange={(v) => setEventGuestId(v || '')}
            options={guestOptions}
            placeholder={isAr ? '— اختر ضيفاً —' : '— Select a guest —'}
          />
        )}
      </div>

      {eventGuestId && (
        planLoading ? (
          <div style={{ padding: 14, textAlign: 'center', fontSize: 12.5, color: 'var(--ink-mute)' }}>
            {isAr ? 'جارٍ التحميل…' : 'Loading…'}
          </div>
        ) : planError ? (
          <div className="alert alert-warn" style={{ fontSize: 12.5 }}>
            <Icon name="alert" size={14} /><div>{planError}</div>
          </div>
        ) : slots.length === 0 ? (
          <div className="alert alert-warn" style={{ fontSize: 12.5 }}>
            <Icon name="alert" size={14} />
            <div>
              {/* Names the level, because "no services" nearly always means the
                  services were never ASSIGNED to it — entries alone don't create
                  slots, the level's assignment list does. */}
              {plan?.serviceLevelId
                ? (isAr
                  ? `مستوى "${plan.serviceLevelName}" لا يحتوي على أي خدمة — أضِف الخدمات إليه من صفحة مستويات الخدمة.`
                  : `"${plan.serviceLevelName}" has no services assigned to it — add them on the Service Levels page.`)
                : (isAr
                  ? 'هذا الضيف بلا مستوى خدمة، لذا لا توجد خدمات لعرضها.'
                  : 'This guest has no service level, so there are no services to show.')}
            </div>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 11.5, color: 'var(--ink-mute)' }}>
              {isEdit
                ? (isAr ? 'تعديل هذا الحجز' : 'Editing this booking')
                : (isAr
                  ? `ضع علامة على ما تريد إضافته — حسب مستوى "${plan?.serviceLevelName || ''}"`
                  : `Tick whatever you want to add - from "${plan?.serviceLevelName || ''}"`)}
            </div>
            <ServiceAccordion
              slots={slots}
              pending={pending}
              onPendingChange={setPending}
              travel={travel}
              onTravelChange={setTravel}
              travelLookups={travelLookups}
              isFixed={plan?.guestModel === 'fixed'}
              lang={lang}
              eventId={activeEventId}
              eventStart={eventStart}
              eventEnd={eventEnd}
              dateMinDate={addDaysIso(eventStart, -DATE_MARGIN_DAYS)}
              dateMaxDate={addDaysIso(eventEnd, DATE_MARGIN_DAYS)}
              // Editing is scoped to the one entry that was opened.
              singleSlotId={isEdit ? service?.id : null}
            />
          </>
        )
      )}
    </Modal>
  );
}
