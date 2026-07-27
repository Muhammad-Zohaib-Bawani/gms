import React, { useState, useEffect, useMemo } from 'react';
import Modal from '../../components/ui/Modal';
import Select from '../../components/ui/Select';
import { Icon } from '../../components/Icons';
import toast from '../../lib/toast';
import { createVenue, getVenueTypes } from '../../api/services/venueService';
import { VENUE_CATEGORY_OPTIONS as CATEGORY_OPTIONS } from './venueHelpers';

const EMPTY_GUID = '00000000-0000-0000-0000-000000000000';

const SWATCHES = ['#8d0134', '#e0c47e', '#e05252', '#16a34a', '#2563eb', '#7c3aed', '#db2777', '#ea7c1e'];

const inputStyle = {
  width: '100%', background: 'var(--surface-soft-3)', border: '1px solid var(--glass-border)',
  borderRadius: 8, padding: '9px 12px', color: 'var(--ink)', fontSize: 13,
};
const errorBorder = { ...inputStyle, border: '1px solid #e05050' };
const labelStyle = { display: 'block', fontSize: 10.5, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 5 };

function emptyForm() {
  return { name: '', typeId: '', categories: [], color: '', blocks: [] };
}

export default function AddVenueModal({ open, onClose, lang, onSaved, activeEventId, selectedSessionId }) {
  const isAr = lang === 'ar';

  const [form,      setForm]      = useState(emptyForm);
  const [types,     setTypes]     = useState([]);
  const [errors,    setErrors]    = useState({});
  const [saving,    setSaving]    = useState(false);

  // Load venue types from the dedicated VenueType endpoint when the modal opens.
  useEffect(() => {
    if (!open) return;
    setForm(emptyForm());
    setErrors({});
    getVenueTypes().then(r => setTypes(r || [])).catch(() => setTypes([]));
  }, [open]);

  const setF = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const typeOptions = useMemo(
    () => types.map(t => ({ value: t.id, label: (isAr ? (t.nameAr || t.name) : t.name) })),
    [types, isAr],
  );
  const categoryOptions = useMemo(
    () => CATEGORY_OPTIONS.map(c => ({ value: c.value, label: isAr ? c.label.ar : c.label.en })),
    [isAr],
  );

  // ── blocks (optional) ───────────────────────────────────────────────────
  const addBlock    = () => setForm(p => ({ ...p, blocks: [...p.blocks, { label: '', rows: 10, seatsPerRow: 20 }] }));
  const removeBlock = (i) => setForm(p => ({ ...p, blocks: p.blocks.filter((_, idx) => idx !== i) }));
  const setBlock    = (i, k, v) => setForm(p => ({
    ...p, blocks: p.blocks.map((b, idx) => idx === i ? { ...b, [k]: v } : b),
  }));

  async function handleSave() {
    if (!form.name.trim()) { setErrors({ name: true }); return; }
    setSaving(true);
    try {
      const venue = await createVenue({
        venueName: form.name.trim(),
        venueType: form.typeId || EMPTY_GUID,
        category: form.categories,
        color: form.color || null,
        // Scopes the starter box (built from blocks below) to whichever
        // event/session is active — otherwise it's an orphan box that never
        // matches the per-event editor's lookup and silently never shows up.
        eventId: activeEventId || null,
        sessionId: selectedSessionId || null,
        blocks: form.blocks
          .filter(b => b.label.trim())
          .map(b => ({
            label: b.label.trim(),
            category: null,
            rows: Number(b.rows) || 1,
            seatsPerRow: Number(b.seatsPerRow) || 1,
          })),
      });
      onSaved?.(venue);
      onClose();
      toast.success(isAr ? 'تم إنشاء المكان' : 'Venue created');
    } catch (err) {
      const msg = err?.response?.data?.message;
      toast.error(msg || (isAr ? 'تعذّر إنشاء المكان' : 'Could not create venue'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isAr ? 'مكان جديد' : 'New Venue'}
      width={520}
      footer={
        <>
          <button className="btn" onClick={onClose}>{isAr ? 'إلغاء' : 'Cancel'}</button>
          <button className="btn primary" onClick={handleSave} disabled={saving}>
            <Icon name="check" size={13}/>
            {saving ? (isAr ? 'جارٍ الحفظ…' : 'Saving…') : (isAr ? 'إنشاء' : 'Create')}
          </button>
        </>
      }
    >
      <div>
        <label style={labelStyle}>{isAr ? 'اسم المكان' : 'Venue Name'} *</label>
        <input
          value={form.name}
          placeholder={isAr ? 'مثال: قاعة اللؤلؤة' : 'e.g. Pearl Auditorium'}
          onChange={e => { setF('name', e.target.value); setErrors({}); }}
          style={errors.name ? errorBorder : inputStyle}
        />
        {errors.name && <div style={{ fontSize: 11, color: '#e05050', marginTop: 3 }}>{isAr ? 'مطلوب' : 'Required'}</div>}
      </div>

      <div>
        <label style={labelStyle}>{isAr ? 'نوع المكان' : 'Venue Type'}</label>
        <Select
          value={form.typeId}
          onChange={v => setF('typeId', v || '')}
          options={typeOptions}
          placeholder={isAr ? '— اختر —' : '— Select —'}
          isClearable
        />
      </div>

      <div>
        <label style={labelStyle}>{isAr ? 'الفئات' : 'Categories'}</label>
        <Select
          isMulti
          value={form.categories}
          onChange={v => setF('categories', v || [])}
          options={categoryOptions}
          placeholder={isAr ? '— اختر —' : '— Select —'}
        />
      </div>

      <div>
        <label style={labelStyle}>{isAr ? 'اللون' : 'Color'}</label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {SWATCHES.map(c => (
            <button
              key={c}
              type="button"
              onClick={() => setF('color', form.color === c ? '' : c)}
              style={{
                width: 26, height: 26, borderRadius: 7, background: c, cursor: 'pointer',
                border: form.color === c ? '2px solid var(--ink)' : '2px solid transparent',
                outline: form.color === c ? '1px solid var(--ink)' : 'none',
              }}
            />
          ))}
          {form.color && (
            <button type="button" className="btn" style={{ fontSize: 11, padding: '3px 8px' }} onClick={() => setF('color', '')}>
              {isAr ? 'بلا لون' : 'Clear'}
            </button>
          )}
        </div>
      </div>

      {/* Optional blocks */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <label style={{ ...labelStyle, marginBottom: 0 }}>{isAr ? 'الأقسام (اختياري)' : 'Blocks (optional)'}</label>
          <button type="button" className="btn" style={{ fontSize: 11, padding: '3px 8px' }} onClick={addBlock}>
            <Icon name="plus" size={12}/> {isAr ? 'إضافة' : 'Add'}
          </button>
        </div>

        {form.blocks.length === 0 && (
          <div style={{ fontSize: 12, color: 'var(--ink-mute)', fontStyle: 'italic' }}>
            {isAr ? 'لم تتم إضافة أقسام' : 'No blocks added'}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {form.blocks.map((b, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 70px 70px 32px', gap: 8, alignItems: 'center' }}>
              <input
                value={b.label}
                placeholder={isAr ? 'اسم القسم' : 'Block label'}
                onChange={e => setBlock(i, 'label', e.target.value)}
                style={inputStyle}
              />
              <input type="number" min={1} value={b.rows} title={isAr ? 'صفوف' : 'Rows'}
                onChange={e => setBlock(i, 'rows', e.target.value)} style={inputStyle}/>
              <input type="number" min={1} value={b.seatsPerRow} title={isAr ? 'مقاعد/صف' : 'Seats/row'}
                onChange={e => setBlock(i, 'seatsPerRow', e.target.value)} style={inputStyle}/>
              <button type="button" className="btn" style={{ color: '#e05050', borderColor: 'rgba(224,80,80,0.4)', padding: '6px' }}
                onClick={() => removeBlock(i)}>
                <Icon name="close" size={13}/>
              </button>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}
