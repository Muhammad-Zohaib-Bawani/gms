import React, { useState, useEffect, useCallback } from 'react';
import { Icon } from '../../components/Icons';
import Modal from '../../components/ui/Modal';
import toast from '../../lib/toast';
import { getLookupDef } from './lookupConfig';

const inputStyle = {
  width: '100%', background: 'var(--surface-soft-3)', border: '1px solid var(--glass-border)',
  borderRadius: 8, padding: '9px 12px', color: 'var(--ink)', fontSize: 13, boxSizing: 'border-box',
};
const errorStyle = { ...inputStyle, border: '1px solid #e05050' };
const labelStyle = {
  display: 'block', fontSize: 10.5, color: 'var(--ink-mute)', textTransform: 'uppercase',
  letterSpacing: '0.12em', marginBottom: 5,
};

// Generic list + Add screen, driven by lookupConfig. One instance per lookup key.
export default function LookupsView({ lookupKey, lang }) {
  const isAr = lang === 'ar';
  const def = getLookupDef(lookupKey);

  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm]       = useState({});
  const [errors, setErrors]   = useState({});
  const [saving, setSaving]   = useState(false);

  const load = useCallback(async () => {
    if (!def) return;
    setLoading(true);
    try { setRows((await def.list()) || []); }
    catch { setRows([]); }
    finally { setLoading(false); }
  }, [def]);

  useEffect(() => { load(); }, [load]);

  if (!def) return null;

  const label = isAr ? def.label.ar : def.label.en;
  const openAdd = () => { setForm({}); setErrors({}); setShowAdd(true); };
  const setF = (k, v) => setForm(p => ({ ...p, [k]: v }));

  async function handleSave() {
    const errs = {};
    def.fields.forEach(f => { if (f.required && !(form[f.key] || '').trim()) errs[f.key] = true; });
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setSaving(true);
    try {
      await def.create(form);
      setShowAdd(false);
      load();
      toast.success(isAr ? 'تمت الإضافة' : 'Added');
    } catch (err) {
      toast.error(err?.response?.data?.message || (isAr ? 'خطأ أثناء الحفظ' : 'Error saving'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{label}</h1>
          <div className="page-sub">{rows.length} {isAr ? 'عنصر' : `item${rows.length !== 1 ? 's' : ''}`}</div>
        </div>
        <div className="page-actions">
          <button className="btn primary" onClick={openAdd}>
            <Icon name="plus" size={14} /> {isAr ? 'إضافة' : 'Add'}
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <table className="table">
          <thead>
            <tr>{def.columns.map(c => <th key={c.key}>{isAr ? c.label.ar : c.label.en}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id || i}>
                {def.columns.map(c => (
                  <td key={c.key} style={{ fontSize: 13 }}>{r[c.key] || '—'}</td>
                ))}
              </tr>
            ))}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={def.columns.length} style={{ textAlign: 'center', padding: 32, color: 'var(--ink-faint)', fontSize: 13 }}>
                {isAr ? 'لا توجد عناصر بعد' : 'No items yet'}
              </td></tr>
            )}
            {loading && (
              <tr><td colSpan={def.columns.length} style={{ textAlign: 'center', padding: 32, color: 'var(--ink-faint)', fontSize: 13 }}>
                {isAr ? 'جارٍ التحميل…' : 'Loading…'}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        title={`${isAr ? 'إضافة' : 'Add'} — ${label}`}
        width={440}
        footer={
          <>
            <button className="btn" onClick={() => setShowAdd(false)}>{isAr ? 'إلغاء' : 'Cancel'}</button>
            <button className="btn primary" onClick={handleSave} disabled={saving}>
              <Icon name="check" size={13} /> {saving ? (isAr ? 'جارٍ الحفظ…' : 'Saving…') : (isAr ? 'حفظ' : 'Save')}
            </button>
          </>
        }
      >
        {def.fields.map(f => (
          <div key={f.key} style={{ marginBottom: 12 }}>
            <label style={labelStyle}>{isAr ? f.label.ar : f.label.en}{f.required ? ' *' : ''}</label>
            <input
              style={errors[f.key] ? errorStyle : inputStyle}
              value={form[f.key] || ''}
              dir={f.key === 'nameAr' ? 'rtl' : undefined}
              onChange={e => { setF(f.key, e.target.value); if (errors[f.key]) setErrors(p => ({ ...p, [f.key]: false })); }}
            />
          </div>
        ))}
      </Modal>
    </div>
  );
}
