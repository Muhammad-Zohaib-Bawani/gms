// The guest's service checklist.
//
// On a Flexible event every assigned service is optional and openable in any
// order. On a Fixed event they must be completed in the level's configured
// sequence, so anything after the first incomplete service is locked. The
// server decides both — `isUnlocked` / `lockedReason` come straight off the
// plan and are re-checked on save. See docs/service-levels-v2.md.
import React, { useState, useEffect, useCallback } from 'react';
import { Icon } from '../../components/Icons';
import Modal from '../../components/ui/Modal';
import { DynamicFormInputs, missingRequired } from '../../components/ui/DynamicFields';
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

// System slots always render in this order, regardless of where the level put
// them in its own sequence — Fixed-event step numbers still use the plan's
// real order (see `stepNo` below), only the ON-SCREEN layout is fixed.
const SYSTEM_ORDER = ['flight', 'transport', 'accommodation'];

// This dynamic service covers the same ground as the Arrival/Departure card
// (see TravelView's own "Arrivals & Departures" tab) — it's merged INTO that
// card instead of getting a card of its own, so the subject isn't split
// across two boxes.
const AD_SERVICE_CODE = 'arrivals-departures';

// One entry at a time with prev/next + dots, instead of stacking every
// entry's card — a guest with several bookings of the same kind (a second
// flight, another night's stay) no longer turns the box into a scroll wall.
function EntrySlider({ items, renderItem }) {
  const [idx, setIdx] = useState(0);
  const count = items.length;
  const safeIdx = idx < count ? idx : 0;
  if (count === 0) return null;
  if (count === 1) return renderItem(items[0], 0);
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 8 }}>
        <button type="button" className="icon-btn" style={{ width: 24, height: 24, flexShrink: 0 }}
          onClick={() => setIdx((i) => (i - 1 + count) % count)}>
          <Icon name="arrowLeft" size={11} />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          {items.map((_, i) => (
            <button type="button" key={i} onClick={() => setIdx(i)} aria-label={`${i + 1}`}
              style={{
                width: i === safeIdx ? 14 : 6, height: 6, borderRadius: 3, padding: 0, border: 'none',
                cursor: 'pointer', background: i === safeIdx ? 'var(--accent)' : 'var(--glass-border)',
                transition: 'width .15s ease',
              }} />
          ))}
        </div>
        <button type="button" className="icon-btn" style={{ width: 24, height: 24, flexShrink: 0 }}
          onClick={() => setIdx((i) => (i + 1) % count)}>
          <Icon name="arrow" size={11} />
        </button>
      </div>
      {renderItem(items[safeIdx], safeIdx)}
    </div>
  );
}

// The bare key/value grid inside an entry card — no chrome of its own, so it
// can be reused both for a slot's own (editable) entries and for a read-only
// mirror of another slot's entries (the Arrival/Departure card's flight info).
function EntryFacts({ entry, isAr }) {
  const facts = Object.entries(entry.values || {}).filter(([, v]) => v != null && String(v).trim() !== '');
  if (facts.length === 0) {
    return (
      <div style={{ fontSize: 11.5, color: 'var(--ink-mute)' }}>
        {isAr ? 'لا تفاصيل مسجلة' : 'No details recorded'}
      </div>
    );
  }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '6px 12px' }}>
      {facts.map(([k, v]) => (
        <div key={k}>
          <div style={{ fontSize: 9, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{k}</div>
          <div style={{ fontSize: 12, color: 'var(--ink)' }}>{v}</div>
        </div>
      ))}
    </div>
  );
}

// One card, styled like the other guest-detail Sections (icon + title header,
// bordered body) — used for every slot AND for the Arrival/Departure card, so
// all of it reads as one family of boxes on the page.
function ServiceCard({ icon, title, action, children }) {
  return (
    <div className="card" style={{ padding: 0, display: 'flex', flexDirection: 'column' }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
        padding: '13px 18px', borderBottom: '1px solid var(--glass-border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {icon && <Icon name={icon} size={15} style={{ color: 'var(--accent)' }} />}
          <span style={{ fontSize: 13, fontWeight: 600 }}>{title}</span>
        </div>
        {action}
      </div>
      <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
        {children}
      </div>
    </div>
  );
}

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

// Hotel and transport dates sit a few days either side of the event itself.
const DATE_MARGIN_DAYS = 3;

function StatusPill({ status, locked, isAr }) {
  if (locked) {
    return (
      <span className="chip draft" style={{ fontSize: 10.5 }}>
        <Icon name="shield" size={10} /> {isAr ? 'مقفل' : 'Locked'}
      </span>
    );
  }
  const done = status === 'completed';
  return (
    <span className={`chip ${done ? 'confirmed' : 'pending'}`} style={{ fontSize: 10.5 }}>
      <span className="dot" />
      {done ? (isAr ? 'مكتمل' : 'Completed') : (isAr ? 'قيد الانتظار' : 'Pending')}
    </span>
  );
}

export default function GuestServicesPanel({ guestId, lang, onChanged, eventStart, eventEnd, eventId, arrivalDate, departureDate }) {
  const isAr = lang === 'ar';
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);

  const [editing, setEditing] = useState(null);   // { slot, entry|null }
  const [values, setValues] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Static-form state, used only while a built-in slot is open.
  const [travel, setTravel] = useState(EMPTY_TRAVEL);
  const [travelLookups, setTravelLookups] = useState({});

  const isSystemEdit = !!editing?.slot?.isSystem;

  const load = useCallback(() => {
    if (!guestId) return;
    setLoading(true);
    getGuestServicePlan(guestId)
      .then(setPlan)
      .catch(() => setPlan(null))
      .finally(() => setLoading(false));
  }, [guestId]);

  useEffect(() => { load(); }, [load]);

  // Only fetched once a built-in slot is actually opened — the dynamic path needs
  // none of it, and this is eight parallel lookup requests.
  useEffect(() => {
    if (!isSystemEdit || Object.keys(travelLookups).length > 0) return;
    getTravelLookups(eventId).then(setTravelLookups).catch(() => setTravelLookups({}));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSystemEdit, eventId]);

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
      getGuestTravel(guestId, entry.id)
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
      await saveGuestTravel(guestId, buildTravelPayload(travel, travelLookups));
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
      await saveGuestServiceEntry(guestId, {
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

  async function removeEntry(slot, entryId) {
    try {
      // A built-in's entry is a booking row, removed through its own endpoint.
      const del = slot.isSystem ? DELETE_BOOKING[slot.code] : null;
      if (del) await del(entryId);
      else await deleteGuestServiceEntry(guestId, entryId);
      toast.success(isAr ? 'تم الحذف' : 'Removed');
      load();
      onChanged?.();
    } catch (err) {
      toast.fromError(err, isAr ? 'تعذّر الحذف' : 'Could not remove');
    }
  }

  if (loading) {
    return <div style={{ fontSize: 12.5, color: 'var(--ink-mute)', padding: 8 }}>…</div>;
  }

  const isFixed = plan?.guestModel === 'fixed';
  const slots = plan?.slots || [];
  // Displayed in this fixed order regardless of the level's own sequence —
  // only the Fixed-event step numbers (below) use the plan's real order.
  const systemSlots = SYSTEM_ORDER.map((code) => slots.find((s) => s.isSystem && s.code === code)).filter(Boolean);
  const flightSlot = slots.find((s) => s.isSystem && s.code === 'flight');
  // The "arrivals-departures" dynamic service is merged into the
  // Arrival/Departure card below instead of getting a card of its own.
  const adSlot = slots.find((s) => !s.isSystem && s.code === AD_SERVICE_CODE);
  const dynamicSlots = slots.filter((s) => !s.isSystem && s.code !== AD_SERVICE_CODE);

  function renderSlotCard(slot) {
    const locked = !slot.isUnlocked;
    const stepNo = slots.indexOf(slot) + 1;
    return (
      <ServiceCard
        key={slot.serviceId}
        icon={slot.icon}
        title={(isAr ? slot.nameAr : null) || slot.name}
        action={<StatusPill status={slot.status} locked={locked} isAr={isAr} />}
      >
        {isFixed && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--ink-mute)' }}>
            <span style={{
              width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
              display: 'grid', placeItems: 'center', fontSize: 10.5, fontWeight: 700,
              background: slot.status === 'completed' ? 'var(--ok)' : 'var(--surface-soft-4)',
              color: slot.status === 'completed' ? '#fff' : 'var(--ink-mute)',
            }}>
              {slot.status === 'completed' ? <Icon name="check" size={11} /> : stepNo}
            </span>
            {isAr ? `الخطوة ${stepNo} من ${slots.length}` : `Step ${stepNo} of ${slots.length}`}
          </div>
        )}

        {locked && slot.lockedReason && (
          <div style={{ fontSize: 11, color: 'var(--ink-faint)' }}>
            {slot.lockedReason}
          </div>
        )}

        {/* One at a time via the slider rather than every entry stacked — a
            guest can hold several of these (a second flight, another
            night's stay), and this keeps the box a fixed size either way. */}
        {slot.entries.length > 0 ? (
          <EntrySlider
            items={slot.entries}
            renderItem={(entry) => (
              <div style={{ borderRadius: 9, padding: '8px 10px', background: 'transparent', border: '1px solid var(--glass-border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--ink-faint)', flex: 1 }}>
                    {isAr ? 'التفاصيل' : 'Details'}
                    {entry.status !== 'completed' && (
                      <span style={{ color: 'var(--warn)' }}> · {isAr ? 'مسودة' : 'draft'}</span>
                    )}
                  </span>
                  <button className="icon-btn" title={isAr ? 'تعديل' : 'Edit'}
                    onClick={() => openEntry(slot, entry)}>
                    <Icon name="edit" size={12} />
                  </button>
                  <button className="icon-btn" style={{ color: 'var(--danger)' }}
                    title={isAr ? 'حذف' : 'Remove'} onClick={() => removeEntry(slot, entry.id)}>
                    <Icon name="trash" size={12} />
                  </button>
                </div>
                <EntryFacts entry={entry} isAr={isAr} />
              </div>
            )}
          />
        ) : (
          <div style={{ fontSize: 12.5, color: 'var(--ink-faint)', textAlign: 'center', padding: '4px 0' }}>
            {isAr ? 'لا إدخالات بعد' : 'No entries yet'}
          </div>
        )}

        {/* Always adds a NEW entry (never overwrites the ones above) — that's
            how a guest ends up with a second flight or another night's stay. */}
        {!locked && (
          <button className="btn" style={{ width: '100%', fontSize: 12 }}
            onClick={() => openEntry(slot, null)}>
            <Icon name="plus" size={12} />
            {slot.entries.length > 0
              ? (isAr ? 'إضافة أخرى' : 'Add another')
              : (isAr ? 'إضافة' : 'Add')}
          </button>
        )}
      </ServiceCard>
    );
  }

  return (
    <>
      {plan?.serviceLevelId && slots.length > 0 && (
        <div style={{
          gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 8,
          fontSize: 11.5, color: 'var(--ink-mute)',
        }}>
          <span className="chip" style={{ fontSize: 10.5, background: 'var(--accent-soft)', color: 'var(--accent)' }}>
            {plan.serviceLevelName}
          </span>
          {/* <span>
            {isFixed
              ? (isAr ? 'يجب إكمال الخدمات بالترتيب' : 'Services must be completed in order')
              : (isAr ? 'كل الخدمات اختيارية' : 'All services are optional')}
          </span> */}
          {isFixed && plan.isComplete && (
            <span className="chip confirmed" style={{ fontSize: 10.5, marginInlineStart: 'auto' }}>
              <span className="dot" /> {isAr ? 'مكتمل' : 'All done'}
            </span>
          )}
        </div>
      )}

      {plan?.serviceLevelId ? (
        systemSlots.map(renderSlotCard)
      ) : (
        <div style={{ gridColumn: '1 / -1', fontSize: 12.5, color: 'var(--ink-faint)', fontStyle: 'italic' }}>
          {isAr
            ? 'لم يتم تعيين مستوى خدمة لهذا الضيف.'
            : 'This guest has no service level, so there are no built-in services to complete.'}
        </div>
      )}

      <ServiceCard
        icon="arrowsExchange"
        title={isAr ? 'الوصول والمغادرة' : 'Arrival / Departure'}
        action={adSlot && <StatusPill status={adSlot.status} locked={!adSlot.isUnlocked} isAr={isAr} />}
      >
        {/* Read-only mirror of the Flight card's own entries — this box is
            "everything about arriving and leaving" in one place, the Flight
            card above stays the one place to edit them. */}
        {flightSlot?.entries?.length > 0 && (
          <div>
            {/* <div style={{ fontSize: 10, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
              {isAr ? 'تفاصيل الرحلة' : 'Flight details'}
            </div> */}
            <EntrySlider
              items={flightSlot.entries}
              renderItem={(entry) => (
                <div style={{ borderRadius: 9, padding: '8px 10px', background: 'transparent', border: '1px solid var(--glass-border)' }}>
                  <EntryFacts entry={entry} isAr={isAr} />
                </div>
              )}
            />
          </div>
        )}

        {/* The "arrivals-departures" dynamic service, merged in here instead
            of getting a card of its own — same subject, one box. */}
        {adSlot && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              {/* <div style={{ fontSize: 10, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.08em', flex: 1 }}>
                {(isAr ? adSlot.nameAr : null) || adSlot.name}
              </div> */}
            </div>

            {!adSlot.isUnlocked && adSlot.lockedReason && (
              <div style={{ fontSize: 11, color: 'var(--ink-faint)', marginBottom: 6 }}>
                {adSlot.lockedReason}
              </div>
            )}

            {adSlot.entries.length > 0 ? (
              <EntrySlider
                items={adSlot.entries}
                renderItem={(entry) => (
                  <div style={{ borderRadius: 9, padding: '8px 10px', background: 'transparent', border: '1px solid var(--glass-border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--ink-faint)', flex: 1 }}>
                        {isAr ? 'التفاصيل' : 'Details'}
                        {entry.status !== 'completed' && (
                          <span style={{ color: 'var(--warn)' }}> · {isAr ? 'مسودة' : 'draft'}</span>
                        )}
                      </span>
                      <button className="icon-btn" title={isAr ? 'تعديل' : 'Edit'}
                        onClick={() => openEntry(adSlot, entry)}>
                        <Icon name="edit" size={12} />
                      </button>
                      <button className="icon-btn" style={{ color: 'var(--danger)' }}
                        title={isAr ? 'حذف' : 'Remove'} onClick={() => removeEntry(adSlot, entry.id)}>
                        <Icon name="trash" size={12} />
                      </button>
                    </div>
                    <EntryFacts entry={entry} isAr={isAr} />
                  </div>
                )}
              />
            ) : (
              <div style={{ fontSize: 12.5, color: 'var(--ink-faint)', textAlign: 'center', padding: '4px 0' }}>
                {isAr ? 'لا إدخالات بعد' : 'No entries yet'}
              </div>
            )}

            {adSlot.isUnlocked && (
              <button className="btn" style={{ width: '100%', fontSize: 12, marginTop: 8 }}
                onClick={() => openEntry(adSlot, null)}>
                <Icon name="plus" size={12} />
                {adSlot.entries.length > 0
                  ? (isAr ? 'إضافة أخرى' : 'Add another')
                  : (isAr ? 'إضافة' : 'Add')}
              </button>
            )}
          </div>
        )}
      </ServiceCard>

      {plan?.serviceLevelId && dynamicSlots.length > 0 && dynamicSlots.map(renderSlotCard)}

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
