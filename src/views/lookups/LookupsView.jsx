import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Icon } from '../../components/Icons';
import Modal from '../../components/ui/Modal';
import Select from '../../components/ui/Select';
import DataTable from '../../components/ui/DataTable';
import ActionMenu from '../../components/ui/ActionMenu';
import LocationPickerModal from '../../components/ui/LocationPickerModal';
import toast from '../../lib/toast';
import { uploadImageFile } from '../../api/services/uploadService';
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

// A `type: 'image'` field: uploads straight to blob storage and keeps the
// returned URL in the form. The SAS token rides along for the preview and is
// stripped by the lookup's create() before the URL is persisted.
function ImageField({ value, onChange, isAr }) {
  const [uploading, setUploading] = useState(false);

  async function pick(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try { onChange(await uploadImageFile(file)); }
    catch (err) { toast.error(err?.response?.data?.message || (isAr ? 'فشل تحميل الصورة' : 'Failed to upload image')); }
    finally { setUploading(false); }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ position: 'relative', flex: 1 }}>
        <input type="file" accept="image/*" onChange={pick} disabled={uploading}
          style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%', zIndex: 1 }}/>
        <div style={{ ...inputStyle, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}>
          <Icon name="upload" size={13} style={{ color: 'var(--ink-mute)', flexShrink: 0 }}/>
          <span style={{ fontSize: 12, color: value ? 'var(--accent)' : 'var(--ink-mute)' }}>
            {uploading ? (isAr ? 'جارٍ الرفع…' : 'Uploading…')
              : value ? (isAr ? 'تم الرفع ✓' : 'Uploaded ✓')
              : (isAr ? 'اختر صورة…' : 'Choose image…')}
          </span>
        </div>
      </div>
      {value && (
        <>
          <img src={value} alt="" style={{ width: 46, height: 34, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--glass-border)' }}
            onError={e => { e.target.style.display = 'none'; }}/>
          <button type="button" onClick={() => onChange('')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--ink-mute)' }}>
            {isAr ? 'إزالة' : 'Remove'}
          </button>
        </>
      )}
    </div>
  );
}

// Generic list + Add screen, driven by lookupConfig. One instance per lookup key.
export default function LookupsView({ lookupKey, lang }) {
  const isAr = lang === 'ar';
  const def = getLookupDef(lookupKey);

  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [editRow, setEditRow] = useState(null); // location-picker lookups only
  // The row being edited in the standard form modal — null while adding. Same
  // modal either way: the field set is identical, only the target differs.
  const [editing, setEditing] = useState(null);
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

  // Fields carrying `optionsFrom` render as dropdowns — fetch each list once.
  const [fieldOpts, setFieldOpts] = useState({});
  useEffect(() => {
    (def?.fields || []).filter(f => f.optionsFrom).forEach(f => {
      f.optionsFrom()
        .then(rows => setFieldOpts(p => ({
          ...p,
          [f.key]: (rows || []).map(x => ({ value: x.id, label: f.optionLabel(x) })),
        })))
        .catch(() => {});
    });
  }, [def]);

  if (!def) return null;

  const label = isAr ? def.label.ar : def.label.en;
  // Locations edit through the map picker; every other lookup edits through the
  // standard form — but only once it declares an `update` (i.e. the backend has
  // a PUT for it). The name-only lookups are still create-only.
  const editsOnMap = def.customAdd === 'location-picker';
  const canEdit = editsOnMap || !!def.update;
  const openAdd = () => { setEditing(null); setForm({}); setErrors({}); setShowAdd(true); };
  const openEdit = (row) => {
    // Prefill straight off the row: field keys match the list's DTO keys, which
    // is the same mapping `columns` relies on.
    const next = {};
    def.fields.forEach(f => { next[f.key] = row[f.key] ?? ''; });
    setEditing(row);
    setForm(next);
    setErrors({});
    setShowAdd(true);
  };
  const setF = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const columns = useMemo(() => {
    const cols = def.columns.map(c => ({
      id: c.key,
      header: isAr ? c.label.ar : c.label.en,
      accessorFn: (r) => r[c.key],
      cell: ({ getValue }) => (c.type === 'image'
        ? (getValue()
            ? <img src={getValue()} alt="" style={{ width: 44, height: 32, objectFit: 'cover', borderRadius: 5 }}
                onError={e => { e.target.style.display = 'none'; }}/>
            : <span style={{ fontSize: 13 }}>—</span>)
        : <span style={{ fontSize: 13 }}>{getValue() || '—'}</span>),
    }));
    if (canEdit) {
      cols.push({
        id: 'actions', header: '', size: 50, enableSorting: false, enableGlobalFilter: false,
        cell: ({ row }) => (
          <ActionMenu items={[
            {
              label: isAr ? 'تعديل' : 'Edit', icon: 'edit',
              onClick: () => (editsOnMap ? setEditRow(row.original) : openEdit(row.original)),
            },
          ]} />
        ),
      });
    }
    return cols;
  }, [def, isAr, canEdit, editsOnMap]);

  async function handleSave() {
    const errs = {};
    def.fields.forEach(f => { if (f.required && !(form[f.key] || '').trim()) errs[f.key] = true; });
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setSaving(true);
    try {
      if (editing) await def.update(editing.id, form);
      else await def.create(form);
      setShowAdd(false);
      setEditing(null);
      load();
      toast.success(editing ? (isAr ? 'تم التحديث' : 'Updated') : (isAr ? 'تمت الإضافة' : 'Added'));
    } catch (err) {
      toast.error(err?.response?.data?.message || (isAr ? 'خطأ أثناء الحفظ' : 'Error saving'));
    } finally {
      setSaving(false);
    }
  }

  const closeForm = () => { setShowAdd(false); setEditing(null); };

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
        <DataTable
          columns={columns}
          data={rows}
          loading={loading}
          showSearch={false}
          pageSize={10}
          getRowId={(r, i) => r.id || i}
          emptyText={isAr ? 'لا توجد عناصر بعد' : 'No items yet'}
        />
      </div>

      {editsOnMap && (
        <LocationPickerModal
          open={!!editRow}
          location={editRow}
          onClose={() => setEditRow(null)}
          lang={lang}
          onSelect={() => { setEditRow(null); load(); }}
        />
      )}

      {def.customAdd === 'location-picker' ? (
        <LocationPickerModal
          open={showAdd}
          onClose={() => setShowAdd(false)}
          lang={lang}
          onSelect={() => { setShowAdd(false); load(); }}
        />
      ) : (
      <Modal
        open={showAdd}
        onClose={closeForm}
        title={`${editing ? (isAr ? 'تعديل' : 'Edit') : (isAr ? 'إضافة' : 'Add')} — ${label}`}
        width={440}
        footer={
          <>
            <button className="btn" onClick={closeForm}>{isAr ? 'إلغاء' : 'Cancel'}</button>
            <button className="btn primary" onClick={handleSave} disabled={saving}>
              <Icon name="check" size={13} /> {saving ? (isAr ? 'جارٍ الحفظ…' : 'Saving…') : (isAr ? 'حفظ' : 'Save')}
            </button>
          </>
        }
      >
        {def.fields.map(f => (
          <div key={f.key} style={{ marginBottom: 12 }}>
            <label style={labelStyle}>{isAr ? f.label.ar : f.label.en}{f.required ? ' *' : ''}</label>
            {f.type === 'image' ? (
              <ImageField value={form[f.key] || ''} onChange={v => setF(f.key, v)} isAr={isAr}/>
            ) : f.optionsFrom ? (
              <Select
                value={form[f.key] || ''}
                onChange={v => setF(f.key, v)}
                options={fieldOpts[f.key] || []}
                placeholder={isAr ? '— اختر —' : '— Select —'}
                isClearable={!f.required}
              />
            ) : (
              <input
                style={errors[f.key] ? errorStyle : inputStyle}
                value={form[f.key] || ''}
                dir={f.key === 'nameAr' ? 'rtl' : undefined}
                onChange={e => { setF(f.key, e.target.value); if (errors[f.key]) setErrors(p => ({ ...p, [f.key]: false })); }}
              />
            )}
          </div>
        ))}
      </Modal>
      )}
    </div>
  );
}
