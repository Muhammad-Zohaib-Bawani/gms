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

export default function GuestServicesPanel({ guestId, lang, onChanged, eventStart, eventEnd }) {
  const isAr = lang === 'ar';
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);

  const [editing, setEditing] = useState(null);   // { slot, entry|null }
  const [values, setValues] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    if (!guestId) return;
    setLoading(true);
    getGuestServicePlan(guestId)
      .then(setPlan)
      .catch(() => setPlan(null))
      .finally(() => setLoading(false));
  }, [guestId]);

  useEffect(() => { load(); }, [load]);

  function openEntry(slot, entry) {
    setEditing({ slot, entry: entry || null });
    setValues(entry ? { ...(entry.values || {}) } : {});
    setError(null);
  }

  async function save(markCompleted) {
    const { slot, entry } = editing;

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

  async function removeEntry(entryId) {
    try {
      await deleteGuestServiceEntry(guestId, entryId);
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

      {plan.slots.map((slot, i) => {
        const locked = !slot.isUnlocked;
        return (
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
                  {slot.status === 'completed' ? <Icon name="check" size={11} /> : i + 1}
                </span>
              )}
              {slot.icon && <Icon name={slot.icon} size={14} style={{ color: 'var(--accent)' }} />}
              <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>
                {(isAr ? slot.nameAr : null) || slot.name}
              </span>
              <StatusPill status={slot.status} locked={locked} isAr={isAr} />
              {!locked && (
                <button className="btn" style={{ fontSize: 11.5, padding: '4px 10px' }}
                  onClick={() => openEntry(slot, null)}>
                  <Icon name="plus" size={11} /> {isAr ? 'إضافة' : 'Add'}
                </button>
              )}
            </div>

            {locked && slot.lockedReason && (
              <div style={{ fontSize: 11, color: 'var(--ink-faint)', marginTop: 6, paddingInlineStart: isFixed ? 29 : 0 }}>
                {slot.lockedReason}
              </div>
            )}

            {slot.entries.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 8, paddingInlineStart: isFixed ? 29 : 0 }}>
                {slot.entries.map((entry, n) => (
                  <div key={entry.id} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '6px 9px', borderRadius: 8,
                    background: 'var(--bg-0)', border: '1px solid var(--glass-border)',
                  }}>
                    <span style={{ fontSize: 11.5, color: 'var(--ink-dim)', flex: 1 }}>
                      {(isAr ? 'إدخال' : 'Entry')} {n + 1}
                      {entry.status !== 'completed' && (
                        <span style={{ color: 'var(--warn)' }}> · {isAr ? 'مسودة' : 'draft'}</span>
                      )}
                    </span>
                    <button className="icon-btn" title={isAr ? 'تعديل' : 'Edit'}
                      onClick={() => openEntry(slot, entry)}>
                      <Icon name="edit" size={12} />
                    </button>
                    <button className="icon-btn" style={{ color: 'var(--danger)' }}
                      title={isAr ? 'حذف' : 'Remove'} onClick={() => removeEntry(entry.id)}>
                      <Icon name="trash" size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing ? ((isAr ? editing.slot.nameAr : null) || editing.slot.name) : ''}
        subtitle={editing?.entry
          ? (isAr ? 'تعديل إدخال' : 'Edit entry')
          : (isAr ? 'إدخال جديد' : 'New entry')}
        width={620}
        footer={
          <>
            <button className="btn" onClick={() => setEditing(null)} disabled={saving}>
              {isAr ? 'إلغاء' : 'Cancel'}
            </button>
            {/* Saving as draft keeps the next service locked on a Fixed event —
                only completion advances the sequence. */}
            <button className="btn" onClick={() => save(false)} disabled={saving}>
              {isAr ? 'حفظ كمسودة' : 'Save draft'}
            </button>
            <button className="btn primary" onClick={() => save(true)} disabled={saving}>
              <Icon name="check" size={13} /> {isAr ? 'إكمال' : 'Complete'}
            </button>
          </>
        }
      >
        {error && (
          <div className="alert alert-warn" style={{ fontSize: 12.5 }}>
            <Icon name="alert" size={14} /><div>{error}</div>
          </div>
        )}
        {editing && (
          <DynamicFormInputs
            form={editing.slot.form}
            values={values}
            onChange={setValues}
            lang={lang}
            eventStart={eventStart}
            eventEnd={eventEnd}
          />
        )}
      </Modal>
    </div>
  );
}
