// "New Booking" / edit for one service entry.
//
// Only guests whose service level actually includes this service can be picked
// — offering the rest would just produce a server rejection. On a Fixed event
// the sequence still applies: the API refuses a service whose predecessor is
// unfinished, and that message is surfaced here rather than swallowed.
import React, { useState, useEffect, useMemo } from 'react';
import Modal from '../../components/ui/Modal';
import Select from '../../components/ui/Select';
import { Icon } from '../../components/Icons';
import { DynamicFormInputs, missingRequired } from '../../components/ui/DynamicFields';
import toast from '../../lib/toast';
import { listGuests } from '../../api/services/guestService';
import { getServiceLevels, saveGuestServiceEntry } from '../../api/services/serviceCatalogService';

export default function BookingModal({
  open, onClose, onSaved, service, activeEventId, lang, eventStart, eventEnd,
  entry,           // existing row to edit, or null for a new booking
}) {
  const isAr = lang === 'ar';
  const isEdit = !!entry;

  const [guests, setGuests] = useState([]);
  const [levels, setLevels] = useState([]);
  const [guestId, setGuestId] = useState('');
  const [values, setValues] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setGuestId(entry?.guestId || '');
    setValues(entry ? { ...(entry.values || {}) } : {});
  }, [open, entry]);

  useEffect(() => {
    if (!open || !activeEventId) return;
    // pageSize is generous rather than paged: this is a picker, and a second
    // round trip per keystroke is worse than one slightly larger response.
    listGuests({ eventId: activeEventId, pageNumber: 1, pageSize: 500 })
      .then((r) => setGuests(r?.items || []))
      .catch(() => setGuests([]));
    getServiceLevels(false).then(setLevels).catch(() => setLevels([]));
  }, [open, activeEventId]);

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

  const guestOptions = useMemo(
    () => eligible.map((g) => ({
      value: g.id,
      label: `${g.fullName || `${g.firstName} ${g.lastName}`.trim()}${g.email ? ` · ${g.email}` : ''}`,
    })),
    [eligible],
  );

  async function save(markCompleted) {
    if (!guestId) {
      setError(isAr ? 'اختر ضيفاً' : 'Pick a guest first');
      return;
    }
    if (markCompleted) {
      const missing = missingRequired(service.form, values);
      if (missing.length > 0) {
        setError(isAr ? `أكمل: ${missing.join('، ')}` : `Fill in ${missing.join(', ')} before completing.`);
        return;
      }
    }

    setSaving(true);
    try {
      await saveGuestServiceEntry(guestId, {
        id: entry?.entryId || null,
        serviceId: service.id,
        values,
        markCompleted,
      });
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
      width={640}
      footer={
        <>
          <button className="btn" onClick={onClose} disabled={saving}>
            {isAr ? 'إلغاء' : 'Cancel'}
          </button>
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
            value={guestId}
            onChange={(v) => setGuestId(v || '')}
            options={guestOptions}
            placeholder={isAr ? '— اختر ضيفاً —' : '— Select a guest —'}
          />
        )}
      </div>

      {service && (
        <DynamicFormInputs
          form={service.form}
          values={values}
          onChange={setValues}
          lang={lang}
          eventStart={eventStart}
          eventEnd={eventEnd}
        />
      )}
    </Modal>
  );
}
