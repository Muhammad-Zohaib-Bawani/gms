import React, { useState, useEffect, useCallback } from 'react';
import { Icon } from '../components/Icons';
import Modal from '../components/ui/Modal';
import LocationPickerModal from '../components/ui/LocationPickerModal';
import { useAuth } from '../auth/AuthContext';
import toast from '../lib/toast';
import {
  getOrganizations, createOrganization, updateOrganization, deleteOrganization,
} from '../api/services/organizationService';

const inputStyle = {
  width: '100%', background: 'var(--surface-soft-3)', border: '1px solid var(--glass-border)',
  borderRadius: 8, padding: '9px 12px', color: 'var(--ink)', fontSize: 13, boxSizing: 'border-box',
};
const errorStyle = { ...inputStyle, border: '1px solid #e05050' };
const labelStyle = {
  display: 'block', fontSize: 10.5, color: 'var(--ink-mute)', textTransform: 'uppercase',
  letterSpacing: '0.12em', marginBottom: 5,
};
const hintStyle = { fontSize: 11, color: 'var(--ink-faint)', marginTop: 4 };

// Mirrors the backend rule (OrganizationService): Arabic script, whitespace,
// digits and punctuation only — and at least one actual Arabic letter, so a
// string of spaces or digits doesn't pass as an Arabic name.
// Escapes, not literal glyphs: the presentation-forms block ends at U+FEFF
// (a zero-width BOM) which is invisible — and silently corruptible — in source.
const ARABIC_ONLY = /^[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿\s\d\p{P}]+$/u;
const HAS_ARABIC_LETTER = /[؀-ۿ]/;

const isArabicName = (v) => ARABIC_ONLY.test(v) && HAS_ARABIC_LETTER.test(v);

const EMPTY_FORM = { name: '', nameAr: '', code: '', location: null };

export default function OrganizationsView({ lang }) {
  const isAr = lang === 'ar';
  const { can } = useAuth();
  const canManage = can('Organizations.Manage');

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);   // the row being edited, or null for "add"
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setRows((await getOrganizations()) || []); }
    catch { setRows([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const setF = (k, v) => {
    setForm((p) => ({ ...p, [k]: v }));
    if (errors[k]) setErrors((p) => ({ ...p, [k]: null }));
  };

  function openAdd() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setShowForm(true);
  }

  function openEdit(row) {
    setEditing(row);
    setForm({
      name: row.name || '',
      nameAr: row.nameAr || '',
      code: row.code || '',
      location: row.latitude && row.longitude
        ? { latitude: row.latitude, longitude: row.longitude, address: row.address || null,
            label: row.address || `${Number(row.latitude).toFixed(5)}, ${Number(row.longitude).toFixed(5)}` }
        : null,
    });
    setErrors({});
    setShowForm(true);
  }

  async function handleSave() {
    const errs = {};
    if (!form.name.trim()) errs.name = isAr ? 'الاسم مطلوب' : 'Name is required';
    if (!form.code.trim()) errs.code = isAr ? 'الرمز مطلوب' : 'Code is required';
    // Optional — but must be Arabic when filled in.
    if (form.nameAr.trim() && !isArabicName(form.nameAr.trim()))
      errs.nameAr = isAr ? 'يجب أن يحتوي على أحرف عربية فقط' : 'Arabic characters only';
    if (!form.location) errs.location = isAr ? 'الموقع مطلوب' : 'Location is required';

    if (Object.keys(errs).length) { setErrors(errs); return; }

    const body = {
      name: form.name.trim(),
      nameAr: form.nameAr.trim() || null,
      code: form.code.trim(),
      location: {
        latitude: form.location.latitude,
        longitude: form.location.longitude,
        address: form.location.address || null,
      },
    };

    setSaving(true);
    try {
      if (editing) {
        await updateOrganization(editing.id, body);
        toast.success(isAr ? 'تم التحديث' : 'Organization updated');
      } else {
        await createOrganization(body);
        toast.success(isAr ? 'تمت الإضافة' : 'Organization added');
      }
      setShowForm(false);
      load();
    } catch (err) {
      toast.fromError(err, isAr ? 'تعذّر الحفظ' : 'Could not save the organization');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(row) {
    setDeletingId(row.id);
    try {
      await deleteOrganization(row.id);
      toast.success(isAr ? 'تم الحذف' : 'Organization deleted');
      load();
    } catch (err) {
      toast.fromError(err, isAr ? 'تعذّر الحذف' : 'Could not delete the organization');
    } finally {
      setDeletingId(null);
    }
  }

  const colCount = canManage ? 5 : 4;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{isAr ? 'المؤسسات' : 'Organizations'}</h1>
          <div className="page-sub">
            {rows.length} {isAr ? 'مؤسسة' : `organization${rows.length !== 1 ? 's' : ''}`}
          </div>
        </div>
        {canManage && (
          <div className="page-actions">
            <button className="btn primary" onClick={openAdd}>
              <Icon name="plus" size={14} /> {isAr ? 'إضافة مؤسسة' : 'Add Organization'}
            </button>
          </div>
        )}
      </div>

      <div className="card" style={{ padding: 0 }}>
        <table className="table">
          <thead>
            <tr>
              <th>{isAr ? 'الاسم' : 'Name'}</th>
              <th>{isAr ? 'الاسم بالعربية' : 'Arabic Name'}</th>
              <th>{isAr ? 'الرمز' : 'Code'}</th>
              <th>{isAr ? 'الموقع' : 'Location'}</th>
              {canManage && <th style={{ width: 90 }} />}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td style={{ fontSize: 13 }}>{r.name || '—'}</td>
                <td style={{ fontSize: 13 }} dir="rtl">{r.nameAr || '—'}</td>
                <td style={{ fontSize: 13, fontFamily: 'var(--mono)' }}>{r.code || '—'}</td>
                <td style={{ fontSize: 13 }}>
                  {r.address || (r.latitude && r.longitude
                    ? `${Number(r.latitude).toFixed(5)}, ${Number(r.longitude).toFixed(5)}`
                    : '—')}
                </td>
                {canManage && (
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="icon-btn" title={isAr ? 'تعديل' : 'Edit'} onClick={() => openEdit(r)}>
                        <Icon name="edit" size={13} />
                      </button>
                      <button className="icon-btn" title={isAr ? 'حذف' : 'Delete'}
                        disabled={deletingId === r.id} onClick={() => handleDelete(r)}>
                        <Icon name="trash" size={13} />
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={colCount} style={{ textAlign: 'center', padding: 32, color: 'var(--ink-faint)', fontSize: 13 }}>
                {isAr ? 'لا توجد مؤسسات بعد' : 'No organizations yet'}
              </td></tr>
            )}
            {loading && (
              <tr><td colSpan={colCount} style={{ textAlign: 'center', padding: 32, color: 'var(--ink-faint)', fontSize: 13 }}>
                {isAr ? 'جارٍ التحميل…' : 'Loading…'}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editing
          ? (isAr ? 'تعديل المؤسسة' : 'Edit Organization')
          : (isAr ? 'إضافة مؤسسة' : 'Add Organization')}
        width={460}
        footer={
          <>
            <button className="btn" onClick={() => setShowForm(false)} disabled={saving}>
              {isAr ? 'إلغاء' : 'Cancel'}
            </button>
            <button className="btn primary" onClick={handleSave} disabled={saving}>
              <Icon name="check" size={13} /> {saving ? (isAr ? 'جارٍ الحفظ…' : 'Saving…') : (isAr ? 'حفظ' : 'Save')}
            </button>
          </>
        }
      >
        <div>
          <label style={labelStyle}>{isAr ? 'اسم المؤسسة' : 'Organization Name'} *</label>
          <input style={errors.name ? errorStyle : inputStyle} value={form.name}
            onChange={(e) => setF('name', e.target.value)} />
          {errors.name && <div style={{ ...hintStyle, color: '#e05050' }}>{errors.name}</div>}
        </div>

        <div>
          <label style={labelStyle}>{isAr ? 'الاسم بالعربية' : 'Organization Arabic Name'}</label>
          <input style={errors.nameAr ? errorStyle : inputStyle} value={form.nameAr} dir="rtl"
            onChange={(e) => setF('nameAr', e.target.value)} />
          <div style={errors.nameAr ? { ...hintStyle, color: '#e05050' } : hintStyle}>
            {errors.nameAr || (isAr ? 'اختياري — أحرف عربية فقط' : 'Optional — Arabic characters only')}
          </div>
        </div>

        <div>
          <label style={labelStyle}>{isAr ? 'رمز المؤسسة' : 'Organization Code'} *</label>
          <input style={errors.code ? errorStyle : inputStyle} value={form.code}
            onChange={(e) => setF('code', e.target.value)} />
          {errors.code && <div style={{ ...hintStyle, color: '#e05050' }}>{errors.code}</div>}
        </div>

        <div>
          <label style={labelStyle}>{isAr ? 'موقع المؤسسة' : 'Organization Location'} *</label>
          <button
            type="button"
            className="btn"
            style={{ width: '100%', justifyContent: 'flex-start', ...(errors.location ? { borderColor: '#e05050' } : {}) }}
            onClick={() => setShowPicker(true)}
          >
            <Icon name="venue" size={13} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {form.location?.label || (isAr ? 'اختر على الخريطة' : 'Pick on map')}
            </span>
          </button>
          <div style={errors.location ? { ...hintStyle, color: '#e05050' } : hintStyle}>
            {errors.location || (isAr
              ? 'يُحفظ كموقع من نوع "مؤسسة"'
              : 'Saved as a location of type "organization"')}
          </div>
        </div>
      </Modal>

      {/* pickOnly: the org save writes the Location, so cancelling this form
          never leaves a stray pin behind. */}
      <LocationPickerModal
        open={showPicker}
        pickOnly
        lang={lang}
        location={form.location}
        onClose={() => setShowPicker(false)}
        onSelect={(loc) => { setF('location', loc); setShowPicker(false); }}
      />
    </div>
  );
}
