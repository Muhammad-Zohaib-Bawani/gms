// The guest's services as a tick-list: one collapsible row per service the
// level assigns, a checkbox to include it, and its form inside.
//
// A checkbox rather than a step number: the number implied a mandatory sequence
// that only Fixed events have, and it gave nothing to click. Ticking a service
// means "I'm adding this one now"; unticking clears what was typed, so an
// untouched service is never half-saved. Everything left unticked stays pending
// and can be added later from the guest's Services list.
//
// Shared by GuestModal (create wizard, step 3), BookingModal (New Booking) and
// TravelView's own New Booking modal, so all three behave identically.
//
// `pending` is the caller's state, keyed by serviceId:
//   { [serviceId]: {
//       selected: bool, completed: bool,
//       values: { fieldKey: value },   // the entry currently open/just confirmed
//       extra: [ { values } ],         // dynamic: earlier entries confirmed THIS session
//   } }
// The three built-in services (flight / accommodation / transport) don't use
// `values`/`extra[].values` at all — their fields live in the shared `travel`
// state and are saved through the travel endpoints; for them `extra` instead
// holds full clones of a completed `travel[key]` section. See
// Core/Constants/SystemServices.cs.
//
// A guest can hold the same service more than once (a second flight, another
// night's stay…). The server already keeps every entry per slot (`slot.entries`)
// once saved; `extra` is only for entries confirmed with "Add another" in THIS
// dialog session, before the caller's own Save button ever runs — see
// `slotExtras` below, which every caller loops over alongside its normal save.
import React, { useState, useRef, useEffect } from 'react';
import { Icon } from '../../components/Icons';
import toast from '../../lib/toast';
import { DynamicFormInputs, missingRequired } from '../../components/ui/DynamicFields';
import TravelAccordion, {
  EMPTY_TRAVEL, validateTravel, sectionHasData, vehicleLabel,
} from './modals/TravelAccordion';

export const TRAVEL_SECTION = { flight: 'flight', accommodation: 'accommodation', transport: 'transport' };

// Icon fallback by service code, for services whose Icon column is empty (there
// is no icon picker in the catalogue admin yet). "arrivals-departures" gets two
// arrows running opposite ways, the same one the Travel board's tab uses.
const CODE_ICON = {
  flight: 'flight',
  accommodation: 'hotel',
  transport: 'car',
  'arrivals-departures': 'arrowsExchange',
};

const iconFor = (slot) => slot.icon || CODE_ICON[(slot.code || '').toLowerCase()] || null;

/** Anything actually typed into this slot's CURRENT entry — blank keys don't count. */
export function slotHasData(slot, pending, travel) {
  if (slot.isSystem) return sectionHasData(travel, TRAVEL_SECTION[slot.code]);
  return Object.values(pending?.[slot.serviceId]?.values || {})
    .some((v) => String(v ?? '').trim() !== '');
}

/** Ticked = the user asked for this service, whether or not they typed anything. */
export const slotSelected = (slot, pending, travel) =>
  !!pending?.[slot.serviceId]?.selected || slotHasData(slot, pending, travel);

/** Earlier entries this slot got via "Add another" in this session, not yet saved. */
export function slotExtras(slot, pending) {
  return pending?.[slot.serviceId]?.extra || [];
}

/**
 * First problem across every TICKED service, or null when they're all complete.
 *
 * Ticking a service is a commitment: it has to be filled in before the guest can
 * be saved. Unticked services stay optional and are simply not created — that's
 * what lets a guest be added now and their services completed later.
 *
 * Callers run this before saving, because the per-service "Done" button is
 * optional — nothing forces the user to press it. Only the slot's CURRENT entry
 * is checked here: anything in `extra` already passed this same check at the
 * moment "Add another" folded it in, so re-checking it would be redundant.
 */
export function validateServices(slots, pending, travel, isAr = false) {
  for (const slot of slots || []) {
    if (!slotSelected(slot, pending, travel)) continue;

    const name = (isAr ? slot.nameAr : null) || slot.name;

    if (!slotHasData(slot, pending, travel)) {
      return isAr ? `أكمل بيانات "${name}" أو أزل علامتها` : `Fill in "${name}", or untick it`;
    }

    if (slot.isSystem) {
      const err = validateTravel(travel, isAr, TRAVEL_SECTION[slot.code]);
      if (err) return `${name} — ${err}`;
      continue;
    }

    const missing = missingRequired(slot.form, pending?.[slot.serviceId]?.values || {});
    if (missing.length > 0) {
      return isAr
        ? `${name} — أكمل: ${missing.join('، ')}`
        : `${name} — fill in ${missing.join(', ')}`;
    }
  }
  return null;
}

function Checkbox({ checked, disabled }) {
  return (
    <span style={{
      width: 18, height: 18, borderRadius: 5, flexShrink: 0, display: 'grid', placeItems: 'center',
      border: `2px solid ${checked ? 'var(--accent)' : 'var(--glass-border)'}`,
      background: checked ? 'var(--accent)' : 'transparent',
      opacity: disabled ? 0.5 : 1,
    }}>
      {checked && <Icon name="check" size={10} style={{ color: '#fff' }} />}
    </span>
  );
}

const cloneTravelSection = (sec) => ({
  ...sec,
  legs: Array.isArray(sec.legs) ? sec.legs.map((l) => ({ ...l })) : undefined,
});

// Best-effort one-line summary for a not-yet-saved travel section snapshot —
// there's no server-resolved display string for it yet (that only exists once
// it's actually saved), so a few of the more useful lookup ids are resolved
// here instead of showing raw guids.
function travelSectionFacts(key, sec, lookups, isAr) {
  const label = (list, id, fn) => {
    const hit = (list || []).find((x) => x.id === id);
    return hit ? fn(hit) : null;
  };
  if (key === 'flight') {
    const leg = (sec.legs || [])[0] || {};
    return [
      [isAr ? 'الرحلة' : 'Flight', leg.flightNumber || '—'],
      [isAr ? 'المسار' : 'Route', `${label(lookups.airports, leg.fromAirportId, (a) => a.code) || '—'} → ${label(lookups.airports, leg.toAirportId, (a) => a.code) || '—'}`],
      [isAr ? 'الموعد' : 'Departs', leg.startTime ? leg.startTime.replace('T', ' ').slice(0, 16) : '—'],
    ];
  }
  if (key === 'accommodation') {
    return [
      [isAr ? 'الفندق' : 'Hotel', label(lookups.hotels, sec.hotelId, (h) => h.name) || '—'],
      [isAr ? 'الوصول' : 'Check-in', sec.checkIn || '—'],
      [isAr ? 'المغادرة' : 'Check-out', sec.checkOut || '—'],
    ];
  }
  if (key === 'transport') {
    return [
      [isAr ? 'المركبة' : 'Vehicle', label(lookups.vehicles, sec.vehicleId, vehicleLabel) || '—'],
      [isAr ? 'الاستلام' : 'Pickup', sec.pickupTime ? sec.pickupTime.replace('T', ' ').slice(0, 16) : '—'],
      [isAr ? 'التوصيل' : 'Dropoff', sec.dropoffTime ? sec.dropoffTime.replace('T', ' ').slice(0, 16) : '—'],
    ];
  }
  return [];
}

export default function ServiceAccordion({
  slots = [],
  pending = {},
  onPendingChange,
  travel,
  onTravelChange,
  travelLookups = {},
  // Fixed events complete services in order, so everything after the first
  // unfinished one is locked. Flexible events lock nothing.
  isFixed = false,
  lang,
  eventId,
  eventStart,
  eventEnd,
  dateMinDate,
  dateMaxDate,
  // Editing one existing entry: that slot is the only one shown, already on, and
  // can't be unticked — there is nothing to choose.
  singleSlotId = null,
  // A guest can hold the same service more than once, but only New Booking is
  // meant to be where that happens — the Guests page's Add/Edit Guest modal
  // stays exactly the single-entry-per-service flow it always was.
  allowAddAnother = true,
}) {
  const isAr = lang === 'ar';
  const [open, setOpen] = useState(singleSlotId);

  const [addingNew, setAddingNew] = useState(false);

  const rowRefs = useRef({});
  useEffect(() => {
    if (!open) return;
    const el = rowRefs.current[open];
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [open, addingNew]);

  const visible = singleSlotId ? slots.filter((s) => s.serviceId === singleSlotId) : slots;

  const isSlotDone = (s) => {
    const p = pending[s.serviceId];
    return !!p?.completed || s.status === 'completed' || !!(p?.extra?.length);
  };
  const firstIncomplete = slots.findIndex((s) => !isSlotDone(s));

  const patch = (id, next) =>
    onPendingChange((prev) => ({ ...prev, [id]: { ...(prev[id] || {}), ...next } }));

  // Wipes whatever's been typed into an "Add another" draft that never got
  // confirmed — used any time it's abandoned rather than finished: collapsing
  // the row, the checkbox, or switching to another slot without hitting Done.
  // Never touches `extra`/the server's own entries, only the in-progress one.
  function discardDraft(slotId) {
    const slot = slots.find((s) => s.serviceId === slotId);
    if (!slot) return;
    if (slot.isSystem) {
      const key = TRAVEL_SECTION[slot.code];
      onTravelChange((p) => ({ ...p, [key]: { ...EMPTY_TRAVEL[key] } }));
    }
    // `selected: false` matters here — otherwise validateServices sees a ticked
    // but empty draft and demands it be filled in, even though the slot is
    // already legitimately done via `extra`/the server.
    patch(slotId, { selected: false, values: {}, completed: false });
  }

  // The one place `open` ever changes to something else — so an unfinished
  // "Add another" draft is always caught and discarded the moment focus moves
  // away from it, whether that's collapsing it, opening a different slot, or
  // starting yet another "Add another" elsewhere.
  function openRow(nextId, adding = false) {
    if (addingNew && open && open !== nextId) discardDraft(open);
    setOpen(nextId);
    setAddingNew(adding);
  }

  function toggle(slot, on) {
    if (on) {
      patch(slot.serviceId, { selected: true });
      openRow(slot.serviceId);
      return;
    }
    // Unticking is the "clear" action: a built-in's fields live in `travel`, so
    // emptying only `pending` would leave them filled in and still get saved.
    if (slot.isSystem) {
      const key = TRAVEL_SECTION[slot.code];
      onTravelChange((p) => ({ ...p, [key]: { ...EMPTY_TRAVEL[key] } }));
    }
    patch(slot.serviceId, { selected: false, values: {}, completed: false });
    setOpen((o) => (o === slot.serviceId ? null : o));
    setAddingNew(false);
  }

  function addAnother(slot) {
    const p = pending[slot.serviceId] || {};
    let extra = p.extra || [];
    if (slot.isSystem) {
      const key = TRAVEL_SECTION[slot.code];
      if (sectionHasData(travel, key)) extra = [...extra, cloneTravelSection(travel[key])];
      onTravelChange((prev) => ({ ...prev, [key]: { ...EMPTY_TRAVEL[key] } }));
    } else if (slotHasData(slot, pending, travel)) {
      extra = [...extra, { values: { ...(p.values || {}) } }];
    }
    patch(slot.serviceId, { selected: true, values: {}, completed: false, entryId: null, extra });
    openRow(slot.serviceId, true);
  }

  // Clears just the CURRENT in-progress draft and closes the row — used only
  // while `addingNew`. Anything already folded into `extra` (or already on the
  // server) is untouched: this cancels the second entry attempt, not the first.
  function cancelAddAnother(slot) {
    discardDraft(slot.serviceId);
    setOpen(null);
    setAddingNew(false);
  }

  function confirm(slot) {
    if (slot.isSystem) {
      const key = TRAVEL_SECTION[slot.code];
      const err = validateTravel(travel, isAr, key);
      if (err) { toast.warning(err); return; }
      // Nothing typed in = skipped, not done.
      patch(slot.serviceId, { values: {}, completed: sectionHasData(travel, key) });
      setOpen(null);
      setAddingNew(false);
      return;
    }

    const values = pending[slot.serviceId]?.values || {};
    const missing = missingRequired(slot.form, values);
    if (missing.length > 0) {
      toast.warning(isAr ? `أكمل: ${missing.join('، ')}` : `Fill in ${missing.join(', ')} first`);
      return;
    }
    patch(slot.serviceId, { completed: slotHasData(slot, pending, travel) });
    setOpen(null);
    setAddingNew(false);
  }

  if (visible.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {visible.map((slot) => {
        const state = pending[slot.serviceId];
        // Done either because this session marked it so, or the server already
        // has it (see isSlotDone above).
        const done = isSlotDone(slot);
        // Ticked either because the user ticked it, or because data is already
        // there (prefilled edit, a booking typed before this render, or it was
        // completed outside this dialog entirely).
        const ticked = !!state?.selected || slotHasData(slot, pending, travel) || slot.serviceId === singleSlotId || done;
        const index = slots.indexOf(slot);
        const locked = !singleSlotId && isFixed && firstIncomplete !== -1 && index > firstIncomplete;
        // Every locked slot down the chain is blocked by the SAME incomplete
        // one — repeating "Complete X first" on each of them just duplicates
        // the same sentence, so only the row right after it explains why.
        const showLockedHint = locked && index === firstIncomplete + 1;
        const expanded = open === slot.serviceId;
        const isAddingNew = expanded && addingNew;
        // A completed slot can still be opened — worth seeing what was already
        // recorded — but not edited here: this accordion writes to `pending`,
        // which for an already-done slot may hold nothing (a sibling booking
        // never touched in this dialog) or a stale copy of what's on the
        // server, so re-editing it here isn't safe. `singleSlotId` is the one
        // exception: the caller opened this dialog specifically to EDIT that
        // one entry, done or not. Reopening via "Add another" also drops out of
        // this permanent read-only view, for as long as it stays expanded.
        const viewOnly = done && !singleSlotId && !isAddingNew;

        // Every entry recorded for this slot, oldest first: the server's own
        // (from a previous session), then anything folded into `extra` this
        // session, then whatever's currently confirmed but not yet folded in.
        // Shown together and never hidden by opening "Add another" — that form
        // only ever adds one more group below these, it doesn't replace them.
        const key = slot.isSystem ? TRAVEL_SECTION[slot.code] : null;
        const groups = [
          ...(slot.entries || []).map((e) => Object.entries(e.values || {})
            .filter(([, v]) => v != null && String(v).trim() !== '')),
          ...(state?.extra || []).map((snap) => (slot.isSystem
            ? travelSectionFacts(key, snap, travelLookups, isAr)
            : Object.entries(snap.values || {}).filter(([, v]) => v != null && String(v).trim() !== ''))),
          ...(state?.completed && !isAddingNew
            ? [slot.isSystem
              ? (sectionHasData(travel, key) ? travelSectionFacts(key, travel[key], travelLookups, isAr) : null)
              : Object.entries(state.values || {}).filter(([, v]) => v != null && String(v).trim() !== '')]
              .filter(Boolean)
            : []),
        ].filter((g) => g.length > 0);

        return (
          <div
            key={slot.serviceId}
            ref={(el) => { rowRefs.current[slot.serviceId] = el; }}
            style={{
              borderRadius: 10,
              border: `1px solid ${expanded ? 'var(--accent)' : 'var(--glass-border)'}`,
              background: 'var(--surface-soft-2)',
              opacity: locked ? 0.55 : viewOnly ? 0.85 : 1,
              overflow: 'hidden',
              boxShadow: expanded ? '0 0 0 3px rgba(141, 1, 52, 0.14)' : 'none',
              transition: 'border-color 0.25s ease, box-shadow 0.25s ease',
              scrollMarginBlock: 16,
            }}
          >
            <div style={{
              display: 'flex', alignItems: 'center', gap: 9, padding: '10px 12px',
              cursor: locked ? 'not-allowed' : 'pointer',
            }}>
              {/* The checkbox includes/excludes the service; the rest of the row
                  just expands it, so ticking never has to mean two things. */}
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  if (locked || viewOnly || singleSlotId) return;
                  toggle(slot, !ticked);
                }}
                style={{ display: 'grid', placeItems: 'center' }}
              >
                <Checkbox checked={ticked} disabled={locked || viewOnly || !!singleSlotId} />
              </span>

              <div
                onClick={() => {
                  if (locked) return;
                  // Opening an untouched service is also choosing it — otherwise
                  // you could fill in a form that nothing saves. A completed one
                  // just opens straight to its (read-only) details.
                  if (!viewOnly && !ticked) { toggle(slot, true); return; }
                  // Collapsing an unfinished "Add another" draft this way — not
                  // via Done or the delete icon — discards it (openRow catches
                  // this whenever `open` changes away from an `addingNew` row).
                  openRow(expanded ? null : slot.serviceId);
                }}
                style={{ display: 'flex', alignItems: 'center', gap: 9, flex: 1, minWidth: 0 }}
              >
                {iconFor(slot) && <Icon name={iconFor(slot)} size={14} style={{ color: 'var(--accent)' }} />}
                <span style={{ fontSize: 13, fontWeight: 550, flex: 1 }}>
                  {(isAr ? slot.nameAr : null) || slot.name}
                </span>
                <span className={`chip ${done ? 'confirmed' : 'draft'}`} style={{ fontSize: 10.5 }}>
                  {done
                    ? (isAr ? 'مكتمل' : 'Completed')
                    : locked
                      ? (isAr ? 'مقفل' : 'Locked')
                      : ticked
                        ? (isAr ? 'قيد الإدخال' : 'In progress')
                        : (isAr ? 'غير مُضاف' : 'Not added')}
                </span>
                {/* Icon-only, right on the collapsed row — a guest can hold this
                    service more than once (a second flight, another night's
                    stay…), and that shouldn't require opening the row first. */}
                {done && !locked && !singleSlotId && allowAddAnother && (
                  <button
                    type="button"
                    className="icon-btn"
                    title={isAr ? 'إضافة أخرى' : 'Add another'}
                    onClick={(e) => { e.stopPropagation(); addAnother(slot); }}
                  >
                    <Icon name="plus" size={13} />
                  </button>
                )}
                {!locked && (
                  <Icon name={expanded ? 'chevronDown' : 'chevronRight'} size={13}
                    style={{ color: 'var(--ink-mute)' }} />
                )}
              </div>
            </div>

            {showLockedHint && slot.lockedReason && (
              <div style={{ fontSize: 11, color: 'var(--ink-faint)', padding: '0 12px 10px 41px' }}>
                {slot.lockedReason}
              </div>
            )}
            {showLockedHint && !slot.lockedReason && firstIncomplete !== -1 && (
              <div style={{ fontSize: 11, color: 'var(--ink-faint)', padding: '0 12px 10px 41px' }}>
                {isAr
                  ? `أكمل "${slots[firstIncomplete]?.name}" أولاً.`
                  : `Complete "${slots[firstIncomplete]?.name}" first.`}
              </div>
            )}

            {expanded && !locked && (
              <div style={{ padding: 12, borderTop: '1px solid var(--glass-border)' }}>
                {/* Every entry recorded so far — server's, and this session's
                    confirmed ones — stays visible whether the row is purely
                    read-only or a fresh "Add another" form is open below it. */}
                {groups.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: viewOnly ? 0 : 14 }}>
                    {groups.map((facts, gi) => (
                      <div key={gi} style={{
                        borderRadius: 8, padding: '8px 10px',
                        background: 'var(--bg-0)', border: '1px solid var(--glass-border)',
                      }}>
                        {groups.length > 1 && (
                          <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--ink-faint)', marginBottom: 5 }}>
                            {isAr ? `إدخال ${gi + 1}` : `Entry ${gi + 1}`}
                          </div>
                        )}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px 14px' }}>
                          {facts.map(([k, v]) => (
                            <div key={k}>
                              <div style={{
                                fontSize: 9, color: 'var(--ink-faint)', textTransform: 'uppercase',
                                letterSpacing: '0.08em', marginBottom: 2,
                              }}>
                                {k}
                              </div>
                              <div style={{ fontSize: 12, color: 'var(--ink)' }}>{v}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {viewOnly ? (
                  <>
                    {groups.length === 0 && (
                      <div style={{ fontSize: 12, color: 'var(--ink-mute)' }}>
                        {isAr ? 'لا تفاصيل مسجلة' : 'No details recorded'}
                      </div>
                    )}
                    <div style={{ fontSize: 11, color: 'var(--ink-faint)', marginTop: 10 }}>
                      {isAr ? 'مكتملة بالفعل — لا يمكن تعديلها من هنا.' : "Already completed"}
                    </div>
                  </>
                ) : (
                  <>
                    {slot.isSystem ? (
                      // Writes into the shared `travel` state, saved through the travel
                      // endpoints by the caller — never as a service entry's JSON.
                      <TravelAccordion
                        travel={travel}
                        onChange={onTravelChange}
                        lookups={travelLookups}
                        isAr={isAr}
                        only={TRAVEL_SECTION[slot.code]}
                        eventId={eventId}
                        eventMinDate={eventStart}
                        eventMaxDate={eventEnd}
                        dateMinDate={dateMinDate}
                        dateMaxDate={dateMaxDate}
                      />
                    ) : (
                      <DynamicFormInputs
                        form={slot.form}
                        values={state?.values || {}}
                        onChange={(vals) => patch(slot.serviceId, { selected: true, values: vals })}
                        lang={lang}
                        eventId={eventId}
                        eventStart={eventStart}
                        eventEnd={eventEnd}
                      />
                    )}

                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
                      {/* "Add another" mode gets a delete icon that clears just this
                          draft and closes — the "Remove" text button below it would
                          instead wipe the whole slot, including entries already
                          folded into `extra`. */}
                      {isAddingNew ? (
                        <button
                          type="button"
                          className="icon-btn"
                          style={{ color: 'var(--danger)' }}
                          title={isAr ? 'مسح وإغلاق' : 'Clear & close'}
                          onClick={() => cancelAddAnother(slot)}
                        >
                          <Icon name="trash" size={13} />
                        </button>
                      ) : (!singleSlotId && (
                        <button type="button" className="btn" onClick={() => toggle(slot, false)}>
                          {isAr ? 'إزالة' : 'Remove'}
                        </button>
                      ))}
                      <button type="button" className="btn primary" onClick={() => confirm(slot)}>
                        <Icon name="check" size={13} /> {isAr ? 'تم' : 'Done'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
