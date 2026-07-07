import React, { useState, useEffect } from 'react';
import Modal from '../../components/ui/Modal';
import { Icon } from '../../components/Icons';
import toast from '../../lib/toast';
import { createLookupItem, updateLookupItem } from '../../api/services/lookupService';

const inputStyle = {
  width: '100%', background: 'var(--surface-soft-3)', border: '1px solid var(--glass-border)',
  borderRadius: 8, padding: '9px 12px', color: 'var(--ink)', fontSize: 13,
};
const errorBorder = { ...inputStyle, border: '1px solid #e05050' };
const labelStyle = { display: 'block', fontSize: 10.5, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 5 };

function emptyForm() {
  return { code: '', name: '', nameAr: '', sortOrder: 0, isActive: true, metadata: {} };
}

function itemToForm(item) {
  return {
    code:      item.code      || '',
    name:      item.name      || '',
    nameAr:    item.nameAr    || '',
    sortOrder: item.sortOrder ?? 0,
    isActive:  item.isActive  ?? true,
    metadata:  { ...(item.metadata || {}) },
  };
}

export default function LookupItemModal({ open, onClose, categoryCode, config, item, lang, onSaved }) {
  const isAr    = lang === 'ar';
  const editing = !!item;

  const [form,   setForm]   = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(item ? itemToForm(item) : emptyForm());
    setErrors({});
  }, [open, item?.id]);

  const setF    = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const setMeta = (k, v) => setForm(p => ({ ...p, metadata: { ...p.metadata, [k]: v } }));

  async function handleSave() {
    if (!form.name.trim()) { setErrors({ name: true }); return; }
    setSaving(true);
    try {
      const body = {
        categoryCode,
        code:      form.code.trim() || null,
        name:      form.name.trim(),
        nameAr:    form.nameAr.trim() || null,
        sortOrder: Number(form.sortOrder) || 0,
        isActive:  form.isActive,
        metadata:  form.metadata,
      };
      if (editing) await updateLookupItem(item.id, body);
      else         await createLookupItem(body);
      onSaved?.();
      onClose();
      toast.success(editing
        ? (isAr ? 'تم تحديث العنصر' : 'Item updated')
        : (isAr ? 'تمت إضافة العنصر' : 'Item added'));
    } catch (err) {
      const msg = err?.response?.data?.message;
      toast.error(msg || (isAr ? 'حدث خطأ أثناء الحفظ' : 'Error saving item'));
    } finally {
      setSaving(false);
    }
  }

  const codeCfg = config?.code || { show: false };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? (isAr ? 'تعديل العنصر' : 'Edit Item') : (isAr ? 'إضافة عنصر' : 'Add Item')}
      width={460}
      footer={
        <>
          <button className="btn" onClick={onClose}>{isAr ? 'إلغاء' : 'Cancel'}</button>
          <button className="btn primary" onClick={handleSave} disabled={saving}>
            <Icon name="check" size={13}/>
            {saving ? (isAr ? 'جارٍ الحفظ…' : 'Saving…') : (isAr ? 'حفظ' : 'Save')}
          </button>
        </>
      }
    >
      {codeCfg.show && (
        <div>
          <label style={labelStyle}>{isAr ? codeCfg.labelAr : codeCfg.label}</label>
          <input
            value={form.code}
            placeholder={codeCfg.placeholder}
            onChange={e => setF('code', e.target.value)}
            style={inputStyle}
          />
        </div>
      )}

      <div>
        <label style={labelStyle}>{isAr ? 'الاسم' : 'Name'} *</label>
        <input
          value={form.name}
          onChange={e => { setF('name', e.target.value); setErrors({}); }}
          style={errors.name ? errorBorder : inputStyle}
        />
        {errors.name && <div style={{ fontSize: 11, color: '#e05050', marginTop: 3 }}>{isAr ? 'مطلوب' : 'Required'}</div>}
      </div>

      <div>
        <label style={labelStyle}>{isAr ? 'الاسم (عربي)' : 'Name (Arabic)'}</label>
        <input value={form.nameAr} onChange={e => setF('nameAr', e.target.value)} style={inputStyle} dir="rtl"/>
      </div>

      {(config?.metaFields || []).map(f => (
        <div key={f.key}>
          <label style={labelStyle}>{isAr ? f.labelAr : f.label}</label>
          <input
            value={form.metadata[f.key] || ''}
            onChange={e => setMeta(f.key, e.target.value)}
            style={inputStyle}
          />
        </div>
      ))}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={labelStyle}>{isAr ? 'الترتيب' : 'Sort Order'}</label>
          <input
            type="number"
            value={form.sortOrder}
            onChange={e => setF('sortOrder', e.target.value)}
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>{isAr ? 'الحالة' : 'Status'}</label>
          <div
            onClick={() => setF('isActive', !form.isActive)}
            style={{ cursor: 'pointer', padding: '9px 12px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10,
              border: `1px solid ${form.isActive ? 'var(--accent)' : 'var(--glass-border)'}`,
              background: form.isActive ? 'rgba(26,174,196,0.12)' : 'var(--surface-soft-2)' }}>
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: form.isActive ? '#4caf50' : 'var(--ink-mute)' }}/>
            <span style={{ fontSize: 13 }}>{form.isActive ? (isAr ? 'نشط' : 'Active') : (isAr ? 'غير نشط' : 'Inactive')}</span>
          </div>
        </div>
      </div>
    </Modal>
  );
}
