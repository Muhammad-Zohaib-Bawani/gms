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
import { addDaysIso } from '../../lib/date';

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

export default function GuestServicesPanel({ guestId, lang, onChanged, eventStart, eventEnd, eventId }) {
  const isAr = lang === 'ar';
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(0);

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

  // Land on the first thing that still needs attention rather than always
  // slide 0, but only when the plan actually changes shape — re-running this
  // on every `load()` (e.g. right after saving slide 3) would yank the user
  // back to wherever is incomplete instead of keeping them on what they just did.
  useEffect(() => {
    if (!plan?.slots?.length) return;
    const firstOpen = plan.slots.findIndex((s) => s.isUnlocked && s.status !== 'completed');
    setActive(firstOpen === -1 ? 0 : firstOpen);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan?.serviceLevelId, plan?.slots?.length]);

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

  if (!plan?.serviceLevelId) {
    return (
      <div style={{ fontSize: 12.5, color: 'var(--ink-faint)', fontStyle: 'italic', padding: 8 }}>
        {isAr
          ? 'لم يتم تعيين مستوى خدمة لهذا الضيف.'
          : 'This guest has no service level, so there are no services to complete.'}
      </div>
    );
  }

  if (plan.slots.length === 0) {
    return (
      <div style={{ fontSize: 12.5, color: 'var(--ink-faint)', fontStyle: 'italic', padding: 8 }}>
        {isAr
          ? `لا توجد خدمات مُسنَدة إلى "${plan.serviceLevelName}".`
          : `No services are assigned to "${plan.serviceLevelName}" yet.`}
      </div>
    );
  }

  const isFixed = plan.guestModel === 'fixed';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, color: 'var(--ink-mute)' }}>
        <span className="chip" style={{ fontSize: 10.5, background: 'var(--accent-soft)', color: 'var(--accent)' }}>
          {plan.serviceLevelName}
        </span>
        <span>
          {isFixed
            ? (isAr ? 'يجب إكمال الخدمات بالترتيب' : 'Services must be completed in order')
            : (isAr ? 'كل الخدمات اختيارية' : 'All services are optional')}
        </span>
        {isFixed && plan.isComplete && (
          <span className="chip confirmed" style={{ fontSize: 10.5, marginInlineStart: 'auto' }}>
            <span className="dot" /> {isAr ? 'مكتمل' : 'All done'}
          </span>
        )}
      </div>

      {(() => {
        const slot = plan.slots[active];
        const locked = !slot.isUnlocked;
        const canPrev = active > 0;
        const canNext = active < plan.slots.length - 1;
        return (
          <div>
            {/* One service at a time — arrows + dots replace the old stacked
                list so a long service level doesn't turn into a scroll wall. */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <button className="icon-btn" disabled={!canPrev}
                style={{ opacity: canPrev ? 1 : 0.35 }}
                title={isAr ? 'السابق' : 'Previous'}
                onClick={() => setActive((a) => a - 1)}>
                <Icon name="chevronRight" size={14} style={{ transform: isAr ? 'none' : 'scaleX(-1)' }} />
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, justifyContent: 'center' }}>
                {plan.slots.map((s, i) => (
                  <button
                    key={s.serviceId}
                    title={(isAr ? s.nameAr : null) || s.name}
                    onClick={() => setActive(i)}
                    style={{
                      width: i === active ? 20 : 8, height: 8, borderRadius: 5,
                      border: 'none', padding: 0, cursor: 'pointer',
                      background: s.status === 'completed'
                        ? 'var(--accent)'
                        : i === active ? 'var(--accent)' : 'var(--surface-soft-4)',
                      transition: 'width .15s ease',
                    }}
                  />
                ))}
              </div>

              <button className="icon-btn" disabled={!canNext}
                style={{ opacity: canNext ? 1 : 0.35 }}
                title={isAr ? 'التالي' : 'Next'}
                onClick={() => setActive((a) => a + 1)}>
                <Icon name="chevronRight" size={14} style={{ transform: isAr ? 'scaleX(-1)' : 'none' }} />
              </button>
            </div>

            <div style={{ fontSize: 11, color: 'var(--ink-faint)', textAlign: 'center', marginBottom: 6 }}>
              {active + 1} / {plan.slots.length}
            </div>

            <div
              key={slot.serviceId}
              style={{
                border: `1px solid ${locked ? 'var(--glass-border)' : 'var(--surface-glass-border)'}`,
                borderRadius: 11,
                padding: '11px 13px',
                background: locked ? 'transparent' : 'var(--surface-soft-2)',
                opacity: locked ? 0.6 : 1,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                {isFixed && (
                  <span style={{
                    width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                    display: 'grid', placeItems: 'center', fontSize: 10.5, fontWeight: 700,
                    background: slot.status === 'completed' ? 'var(--ok)' : 'var(--surface-soft-4)',
                    color: slot.status === 'completed' ? '#fff' : 'var(--ink-mute)',
                  }}>
                    {slot.status === 'completed' ? <Icon name="check" size={11} /> : active + 1}
                  </span>
                )}
                {slot.icon && <Icon name={slot.icon} size={14} style={{ color: 'var(--accent)' }} />}
                <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>
                  {(isAr ? slot.nameAr : null) || slot.name}
                </span>
                <StatusPill status={slot.status} locked={locked} isAr={isAr} />
              </div>

              {locked && slot.lockedReason && (
                <div style={{ fontSize: 11, color: 'var(--ink-faint)', marginTop: 6, paddingInlineStart: isFixed ? 29 : 0 }}>
                  {slot.lockedReason}
                </div>
              )}

              {/* One card per entry rather than one flattened line — a booking
                  can carry several fields (flight no., date, terminal…) and
                  they all need to stay readable, not squashed into a single
                  " · "-joined string. A guest can hold several of these (a
                  second flight, another night's stay), so each gets its own
                  numbered card here in the SAME slide, instead of the slot
                  itself splitting into more slides. */}
              {slot.entries.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10, paddingInlineStart: isFixed ? 29 : 0 }}>
                  {slot.entries.map((entry, n) => {
                    const facts = Object.entries(entry.values || {})
                      .filter(([, v]) => v != null && String(v).trim() !== '');
                    return (
                      <div key={entry.id} style={{
                        borderRadius: 9, padding: '8px 10px',
                        background: 'var(--bg-0)', border: '1px solid var(--glass-border)',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: facts.length ? 6 : 0 }}>
                          <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--ink-faint)', flex: 1 }}>
                            {slot.entries.length > 1
                              ? `${isAr ? 'إدخال' : 'Entry'} ${n + 1}`
                              : (isAr ? 'التفاصيل' : 'Details')}
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
                        {facts.length > 0 ? (
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '6px 12px' }}>
                            {facts.map(([k, v]) => (
                              <div key={k}>
                                <div style={{ fontSize: 9, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                  {k}
                                </div>
                                <div style={{ fontSize: 12, color: 'var(--ink)' }}>{v}</div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div style={{ fontSize: 11.5, color: 'var(--ink-mute)' }}>
                            {isAr ? 'لا تفاصيل مسجلة' : 'No details recorded'}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Deliberately outside the slide's card, not one more thing tucked
                into its header — this always adds a NEW entry to the current
                slot (never overwrites the ones above), which is exactly how a
                guest ends up with a second flight or another night's stay. */}
            {!locked && (
              <button className="btn" style={{ width: '100%', marginTop: 10, fontSize: 12 }}
                onClick={() => openEntry(slot, null)}>
                <Icon name="plus" size={12} />
                {slot.entries.length > 0
                  ? (isAr ? 'إضافة أخرى' : 'Add another')
                  : (isAr ? 'إضافة' : 'Add')}
              </button>
            )}
          </div>
        );
      })()}

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
    </div>
  );
}
