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
import { useAccess } from '../../auth/AccessContext';

const OTHER_LOCATION = '__Other_Location__';
// Sentinel for an `allowOther` field's escape hatch: picking it swaps the
// dropdown for a free-text input instead of storing a value of its own.
const OTHER_VALUE = '__Other_Value__';
const PAGE_SIZE = 15; // server page size for paged lookups (e.g. airports)

// An option label may be a plain string or a { en, ar } pair.
const optionText = (label, isAr) => (typeof label === 'string' ? label : (isAr ? label.ar : label.en));

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
    catch (err) { toast.fromError(err, isAr ? 'فشل تحميل الصورة' : 'Failed to upload image'); }
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

// A lookup row's `type: 'image'` column: the real image, or a dummy
// placeholder box (not a bare "—") when it has none set, or its url 404s.
function ImageCell({ src, isAr }) {
  const [broken, setBroken] = useState(false);
  const showPlaceholder = !src || broken;

  return showPlaceholder ? (
    <div
      title={isAr ? 'لا توجد صورة' : 'No image'}
      style={{
        width: 44, height: 32, borderRadius: 5, flexShrink: 0,
        background: 'var(--surface-soft-3)', border: '1px solid var(--glass-border)',
        display: 'grid', placeItems: 'center',
      }}
    >
      <Icon name="image" size={14} style={{ color: 'var(--ink-faint)' }}/>
    </div>
  ) : (
    <img src={src} alt="" style={{ width: 44, height: 32, objectFit: 'cover', borderRadius: 5 }}
      onError={() => setBroken(true)}/>
  );
}

// Generic list + Add screen, driven by lookupConfig. One instance per lookup key.
export default function LookupsView({ lookupKey, lang }) {
  const { canWrite } = useAccess();
  const mayWrite = canWrite(`lookup-${lookupKey}`);
  const isAr = lang === 'ar';
  const def = getLookupDef(lookupKey);

  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(false);
  // Server-side paging/search state — only used when def.paged (e.g. airports).
  const [pageIndex, setPageIndex] = useState(0);
  const [total, setTotal]         = useState(0);
  const [search, setSearch]       = useState('');   // controlled search-box value
  const [query, setQuery]         = useState('');   // debounced term sent to the server
  const [showAdd, setShowAdd] = useState(false);
  const [editRow, setEditRow] = useState(null); // location-picker lookups only
  // The row being edited in the standard form modal — null while adding. Same
  // modal either way: the field set is identical, only the target differs.
  const [editing, setEditing] = useState(null);
  const [form, setForm]       = useState({});
  const [errors, setErrors]   = useState({});
  const [saving, setSaving]   = useState(false);
  // Which `locationPicker`-enabled field (if any) has its map picker open —
  // at most one at a time, since it's one form.
  const [mapPickerField, setMapPickerField] = useState(null);
  // Per-field flag for `allowOther` dropdowns: true once the user picks
  // "Other", which reveals the free-text input under the select.
  const [otherMode, setOtherMode] = useState({});
  // Row queued for deletion, held until the confirm modal is answered.
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    if (!def) return;
    setLoading(true);
    try {
      if (def.paged) {
        // Server-side: fetch just this page, filtered across the whole dataset.
        const res = await def.listPaged({ pageNumber: pageIndex + 1, pageSize: PAGE_SIZE, search: query });
        setRows(res?.items || []);
        setTotal(res?.totalCount ?? 0);
      } else {
        setRows((await def.list()) || []);
      }
    } catch { setRows([]); setTotal(0); }
    finally { setLoading(false); }
  }, [def, pageIndex, query]);

  useEffect(() => { load(); }, [load]);

  // Reset paging/search when switching lookup type.
  useEffect(() => { setPageIndex(0); setSearch(''); setQuery(''); }, [def]);

  // Debounce the search box → server query (paged lookups only); back to page 1.
  useEffect(() => {
    if (!def?.paged) return undefined;
    const t = setTimeout(() => { setPageIndex(0); setQuery(search.trim()); }, 300);
    return () => clearTimeout(t);
  }, [search, def]);

  // Fields carrying `optionsFrom` render as dropdowns — fetch each list once.
  const [fieldOpts, setFieldOpts] = useState({});
  useEffect(() => {
    (def?.fields || []).filter(f => f.optionsFrom).forEach(f => {
      f.optionsFrom()
        .then(rows => setFieldOpts(p => ({
          ...p,
          // `optionValue` lets a dropdown store something other than the row's
          // id — e.g. Airport's Country field stores the nationality's name,
          // since Country is a plain string column, not a foreign key.
          [f.key]: (rows || []).map(x => ({ value: (f.optionValue || (r => r.id))(x), label: f.optionLabel(x) })),
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
  // Write on THIS lookup's own menu — each reference list is grantable on its
  // own, so read access to the screen never implies editing it. The API enforces
  // the same key, so hiding the buttons only avoids offering a guaranteed 403.
  const canEdit = mayWrite && (editsOnMap || !!def.update);
  // Delete needs its own backend verb, so it is opt-in per lookup the same way
  // Edit is. Locations are excluded — they edit through the map picker.
  const canDelete = mayWrite && !editsOnMap && !!def.remove;
  const openAdd = () => { setEditing(null); setForm({}); setErrors({}); setOtherMode({}); setShowAdd(true); };
  const openEdit = (row) => {
    // Prefill straight off the row: field keys match the list's DTO keys, which
    // is the same mapping `columns` relies on.
    const next = {};
    const other = {};
    def.fields.forEach(f => {
      const v = row[f.key] ?? '';
      next[f.key] = v;
      // A stored value that isn't in the list (legacy row, or a code added to
      // the renderer later) opens in "Other" mode so editing never silently
      // rewrites it to something from the dropdown.
      if (f.options && f.allowOther && v && !f.options.some(o => o.value === v)) other[f.key] = true;
    });
    setEditing(row);
    setForm(next);
    setErrors({});
    setOtherMode(other);
    setShowAdd(true);
  };
  const setF = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const columns = useMemo(() => {
    const cols = def.columns.map(c => ({
      id: c.key,
      header: isAr ? c.label.ar : c.label.en,
      accessorFn: (r) => r[c.key],
      cell: ({ getValue }) => (c.type === 'image'
        ? <ImageCell src={getValue()} isAr={isAr} />
        : <span style={{ fontSize: 13 }}>{getValue() || '—'}</span>),
    }));
    if (canEdit || canDelete) {
      cols.push({
        id: 'actions', header: '', size: 50, enableSorting: false, enableGlobalFilter: false,
        cell: ({ row }) => (
          <ActionMenu items={[
            canEdit && {
              label: isAr ? 'تعديل' : 'Edit', icon: 'edit',
              onClick: () => (editsOnMap ? setEditRow(row.original) : openEdit(row.original)),
            },
            canDelete && {
              label: isAr ? 'حذف' : 'Delete', icon: 'trash', danger: true,
              onClick: () => setConfirmDelete(row.original),
            },
          ]} />
        ),
      });
    }
    return cols;
  }, [def, isAr, canEdit, canDelete, editsOnMap]);

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
      toast.fromError(err, isAr ? 'خطأ أثناء الحفظ' : 'Error saving');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await def.remove(confirmDelete.id);
      setConfirmDelete(null);
      load();
      toast.success(isAr ? 'تم الحذف' : 'Deleted');
    } catch (err) {
      toast.fromError(err, isAr ? 'خطأ أثناء الحذف' : 'Error deleting');
    } finally {
      setDeleting(false);
    }
  }

  const closeForm = () => { setShowAdd(false); setEditing(null); setOtherMode({}); };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{label}</h1>
          <div className="page-sub">{rows.length} {isAr ? 'عنصر' : `item${rows.length !== 1 ? 's' : ''}`}</div>
        </div>
        <div className="page-actions">
          {mayWrite && (
            <button className="btn primary" onClick={openAdd}>
              <Icon name="plus" size={14} /> {isAr ? 'إضافة' : 'Add'}
            </button>
          )}
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <DataTable
          columns={columns}
          data={rows}
          loading={loading}
          showSearch
          searchPlaceholder={isAr ? 'بحث…' : 'Search…'}
          pageSize={def.paged ? PAGE_SIZE : 15}
          getRowId={(r, i) => r.id || i}
          emptyText={isAr ? 'لا توجد عناصر بعد' : 'No items yet'}
          {...(def.paged ? {
            manualPagination: true,
            pageIndex,
            totalRows: total,
            onPageChange: setPageIndex,
            searchValue: search,
            onSearchChange: setSearch,
          } : {})}
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
            ) : f.options ? (
              // Static option list (e.g. the venue shape codes the canvas
              // renderer understands). With `allowOther`, the last entry drops
              // back to a free-text input rather than storing a value.
              <>
                <Select
                  value={otherMode[f.key] ? OTHER_VALUE : (form[f.key] || '')}
                  onChange={v => {
                    if (v === OTHER_VALUE) {
                      setOtherMode(p => ({ ...p, [f.key]: true }));
                      setF(f.key, '');
                    } else {
                      setOtherMode(p => ({ ...p, [f.key]: false }));
                      setF(f.key, v || '');
                    }
                    if (errors[f.key]) setErrors(p => ({ ...p, [f.key]: false }));
                  }}
                  options={[
                    ...f.options.map(o => ({ value: o.value, label: optionText(o.label, isAr) })),
                    ...(f.allowOther
                      ? [{ value: OTHER_VALUE, label: optionText(f.otherLabel || { en: 'Other…', ar: 'أخرى…' }, isAr) }]
                      : []),
                  ]}
                  placeholder={isAr ? '— اختر —' : '— Select —'}
                  isClearable={!f.required}
                />
                {otherMode[f.key] && (
                  <input
                    autoFocus
                    style={{ ...(errors[f.key] ? errorStyle : inputStyle), marginTop: 8 }}
                    placeholder={isAr ? 'أدخل الرمز' : 'Enter code'}
                    value={form[f.key] || ''}
                    onChange={e => { setF(f.key, e.target.value); if (errors[f.key]) setErrors(p => ({ ...p, [f.key]: false })); }}
                  />
                )}
              </>
            ) : f.optionsFrom ? (
              <Select
                value={form[f.key] || ''}
                onChange={v => (v === OTHER_LOCATION ? setMapPickerField(f) : setF(f.key, v))}
                options={f.locationPicker
                  ? [...(fieldOpts[f.key] || []), { value: OTHER_LOCATION, label: isAr ? 'أخرى — تحديد على الخريطة…' : 'Other — pick on map…' }]
                  : (fieldOpts[f.key] || [])}
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

      <Modal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title={isAr ? 'تأكيد الحذف' : 'Confirm delete'}
        width={380}
        footer={
          <>
            <button className="btn" onClick={() => setConfirmDelete(null)}>{isAr ? 'إلغاء' : 'Cancel'}</button>
            <button
              className="btn"
              style={{ color: 'var(--danger)', borderColor: 'var(--danger-border)', background: 'var(--danger-bg)' }}
              onClick={handleDelete}
              disabled={deleting}
            >
              <Icon name="trash" size={13} /> {deleting ? (isAr ? 'جارٍ الحذف…' : 'Deleting…') : (isAr ? 'حذف' : 'Delete')}
            </button>
          </>
        }
      >
        <div style={{ fontSize: 13, color: 'var(--ink-dim)', marginBottom: 6 }}>
          {confirmDelete?.name || confirmDelete?.code || ''}
        </div>
        <div style={{ fontSize: 12, color: 'var(--ink-mute)' }}>
          {isAr ? 'لا يمكن التراجع عن هذا الإجراء.' : 'This action cannot be undone.'}
        </div>
      </Modal>

      {/* Map picker for any `locationPicker`-enabled field's "Other" option —
          not pickOnly, so confirming here writes a real Location row (Type =
          field.locationPicker.defaultType) and the field just adopts its id,
          same as choosing an existing row from the dropdown would. */}
      {mapPickerField && (
        <LocationPickerModal
          open
          lang={lang}
          defaultType={mapPickerField.locationPicker.defaultType}
          onClose={() => setMapPickerField(null)}
          onSelect={({ id, label: pickedLabel }) => {
            setF(mapPickerField.key, id);
            setFieldOpts(p => ({
              ...p,
              [mapPickerField.key]: [...(p[mapPickerField.key] || []), { value: id, label: pickedLabel }],
            }));
            setMapPickerField(null);
          }}
        />
      )}
    </div>
  );
}
