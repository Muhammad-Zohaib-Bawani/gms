import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Icon } from '../components/Icons';
import Modal from '../components/ui/Modal';
import Select from '../components/ui/Select';
import DataTable from '../components/ui/DataTable';
import ActionMenu from '../components/ui/ActionMenu';
import LookupsView from './lookups/LookupsView';
import { useAuth } from '../auth/AuthContext';
import toast from '../lib/toast';
import {
  getVehicles, createVehicle, updateVehicle, deleteVehicle,
} from '../api/services/vehicleService';
import { getVehicleTypes } from '../api/services/travelService';
import { uploadImageFile, stripSasToken } from '../api/services/uploadService';

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

const EMPTY_FORM = { vehicleTypeId: '', vehicleModel: '', vehicleNumber: '', vehicleImage: '', capacity: '' };

// Fleet admin: the vehicles themselves plus their type lookup, as two tabs —
// the types tab is the generic lookup screen, so it isn't duplicated here.
export default function VehiclesView({ lang }) {
  const isAr = lang === 'ar';
  const { can } = useAuth();
  const canManage = can('Travel.Manage');

  const [tab, setTab] = useState('vehicles');
  const [rows, setRows] = useState([]);
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);   // row being edited, or null for "add"
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setRows((await getVehicles()) || []); }
    catch { setRows([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Types feed the form dropdown — reloaded when the types tab hands back a new
  // one, so a just-added type is immediately selectable.
  const loadTypes = useCallback(async () => {
    try { setTypes((await getVehicleTypes()) || []); }
    catch { setTypes([]); }
  }, []);

  useEffect(() => { loadTypes(); }, [loadTypes, tab]);

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
      vehicleTypeId: row.vehicleTypeId || '',
      vehicleModel: row.vehicleModel || '',
      vehicleNumber: row.vehicleNumber || '',
      vehicleImage: row.vehicleImage || '',
      capacity: row.capacity ?? '',
    });
    setErrors({});
    setShowForm(true);
  }

  async function handleImage(file) {
    if (!file) return;
    setUploading(true);
    try { setF('vehicleImage', await uploadImageFile(file)); }
    catch (err) { toast.fromError(err, isAr ? 'تعذّر رفع الصورة' : 'Could not upload the image'); }
    finally { setUploading(false); }
  }

  async function handleSave() {
    const errs = {};
    if (!form.vehicleTypeId) errs.vehicleTypeId = isAr ? 'النوع مطلوب' : 'Vehicle type is required';
    if (!form.vehicleModel.trim()) errs.vehicleModel = isAr ? 'الطراز مطلوب' : 'Model is required';
    if (!form.vehicleNumber.trim()) errs.vehicleNumber = isAr ? 'رقم المركبة مطلوب' : 'Vehicle number is required';
    if (form.capacity !== '' && !(Number(form.capacity) > 0))
      errs.capacity = isAr ? 'يجب أن تكون أكبر من صفر' : 'Must be greater than zero';

    if (Object.keys(errs).length) { setErrors(errs); return; }

    const body = {
      vehicleTypeId: form.vehicleTypeId,
      vehicleModel: form.vehicleModel.trim(),
      vehicleNumber: form.vehicleNumber.trim(),
      vehicleImage: stripSasToken(form.vehicleImage) || null,
      capacity: form.capacity === '' ? null : Number(form.capacity),
    };

    setSaving(true);
    try {
      if (editing) {
        await updateVehicle(editing.id, body);
        toast.success(isAr ? 'تم التحديث' : 'Vehicle updated');
      } else {
        await createVehicle(body);
        toast.success(isAr ? 'تمت الإضافة' : 'Vehicle added');
      }
      setShowForm(false);
      load();
    } catch (err) {
      toast.fromError(err, isAr ? 'تعذّر الحفظ' : 'Could not save the vehicle');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(row) {
    setDeletingId(row.id);
    try {
      await deleteVehicle(row.id);
      toast.success(isAr ? 'تم الحذف' : 'Vehicle deleted');
      load();
    } catch (err) {
      toast.fromError(err, isAr ? 'تعذّر الحذف' : 'Could not delete the vehicle');
    } finally {
      setDeletingId(null);
    }
  }

  const columns = useMemo(() => {
    const cols = [
      { id: 'vehicleImage', header: isAr ? 'الصورة' : 'Image', size: 70, enableSorting: false, enableGlobalFilter: false,
        cell: ({ row: { original: r } }) => (
          r.vehicleImage
            ? <img src={r.vehicleImage} alt={r.vehicleModel || ''} style={{ width: 46, height: 32, objectFit: 'cover', borderRadius: 5 }} />
            : <span style={{ color: 'var(--ink-faint)', fontSize: 13 }}>—</span>
        ) },
      { id: 'vehicleNumber', header: isAr ? 'رقم المركبة' : 'Vehicle Number', accessorKey: 'vehicleNumber',
        cell: ({ getValue }) => <span style={{ fontSize: 13, fontFamily: 'var(--mono)' }}>{getValue() || '—'}</span> },
      { id: 'vehicleModel', header: isAr ? 'الطراز' : 'Model', accessorKey: 'vehicleModel',
        cell: ({ getValue }) => <span style={{ fontSize: 13 }}>{getValue() || '—'}</span> },
      { id: 'vehicleTypeName', header: isAr ? 'النوع' : 'Type', accessorKey: 'vehicleTypeName',
        cell: ({ getValue }) => <span style={{ fontSize: 13 }}>{getValue() || '—'}</span> },
      { id: 'capacity', header: isAr ? 'السعة' : 'Capacity', accessorKey: 'capacity',
        cell: ({ getValue }) => <span style={{ fontSize: 13 }}>{getValue() ?? '—'}</span> },
    ];
    if (canManage) {
      cols.push({
        id: 'actions', header: '', size: 50, enableSorting: false, enableGlobalFilter: false,
        cell: ({ row: { original: r } }) => (
          <ActionMenu items={[
            { label: isAr ? 'تعديل' : 'Edit', icon: 'edit', onClick: () => openEdit(r) },
            { label: isAr ? 'حذف' : 'Delete', icon: 'trash', danger: true,
              disabled: deletingId === r.id, onClick: () => handleDelete(r) },
          ]} />
        ),
      });
    }
    return cols;
  }, [isAr, canManage, deletingId]);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{isAr ? 'المركبات' : 'Vehicles'}</h1>
          <div className="page-sub">{isAr ? 'أسطول النقل وأنواع المركبات' : 'Transport fleet and vehicle types'}</div>
        </div>
        {tab === 'vehicles' && canManage && (
          <div className="page-actions">
            <button className="btn primary" onClick={openAdd}>
              <Icon name="plus" size={14} /> {isAr ? 'إضافة مركبة' : 'Add Vehicle'}
            </button>
          </div>
        )}
      </div>

      <div className="tabs" style={{ marginBottom: 16 }}>
        <button className={`tab${tab === 'vehicles' ? ' active' : ''}`} onClick={() => setTab('vehicles')}>
          {isAr ? 'المركبات' : 'Vehicles'}
        </button>
        <button className={`tab${tab === 'types' ? ' active' : ''}`} onClick={() => setTab('types')}>
          {isAr ? 'أنواع المركبات' : 'Vehicle Types'}
        </button>
      </div>

      {tab === 'types' ? (
        <LookupsView lookupKey="vehicle-types" lang={lang} />
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <DataTable
            columns={columns}
            data={rows}
            loading={loading}
            showSearch
            pageSize={10}
            searchPlaceholder={isAr ? 'بحث…' : 'Search vehicles…'}
            emptyText={isAr ? 'لا توجد مركبات بعد' : 'No vehicles yet'}
          />
        </div>
      )}

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editing ? (isAr ? 'تعديل المركبة' : 'Edit Vehicle') : (isAr ? 'إضافة مركبة' : 'Add Vehicle')}
        width={460}
        footer={
          <>
            <button className="btn" onClick={() => setShowForm(false)} disabled={saving}>
              {isAr ? 'إلغاء' : 'Cancel'}
            </button>
            <button className="btn primary" onClick={handleSave} disabled={saving || uploading}>
              <Icon name="check" size={13} /> {saving ? (isAr ? 'جارٍ الحفظ…' : 'Saving…') : (isAr ? 'حفظ' : 'Save')}
            </button>
          </>
        }
      >
        <div>
          <label style={labelStyle}>{isAr ? 'نوع المركبة' : 'Vehicle Type'} *</label>
          <Select
            value={form.vehicleTypeId}
            onChange={(v) => setF('vehicleTypeId', v || '')}
            options={types.map((t) => ({ value: t.id, label: t.name }))}
            placeholder={isAr ? '— اختر —' : '— Select —'}
          />
          {errors.vehicleTypeId && <div style={{ ...hintStyle, color: '#e05050' }}>{errors.vehicleTypeId}</div>}
        </div>

        <div>
          <label style={labelStyle}>{isAr ? 'الطراز' : 'Vehicle Model'} *</label>
          <input style={errors.vehicleModel ? errorStyle : inputStyle} value={form.vehicleModel}
            onChange={(e) => setF('vehicleModel', e.target.value)} />
          {errors.vehicleModel && <div style={{ ...hintStyle, color: '#e05050' }}>{errors.vehicleModel}</div>}
        </div>

        <div>
          <label style={labelStyle}>{isAr ? 'رقم المركبة' : 'Vehicle Number'} *</label>
          <input style={errors.vehicleNumber ? errorStyle : inputStyle} value={form.vehicleNumber}
            onChange={(e) => setF('vehicleNumber', e.target.value)} />
          {errors.vehicleNumber && <div style={{ ...hintStyle, color: '#e05050' }}>{errors.vehicleNumber}</div>}
        </div>

        <div>
          <label style={labelStyle}>{isAr ? 'السعة' : 'Capacity'}</label>
          <input type="number" min="1" style={errors.capacity ? errorStyle : inputStyle} value={form.capacity}
            onChange={(e) => setF('capacity', e.target.value)} />
          <div style={errors.capacity ? { ...hintStyle, color: '#e05050' } : hintStyle}>
            {errors.capacity || (isAr ? 'اختياري — عدد المقاعد' : 'Optional — number of seats')}
          </div>
        </div>

        <div>
          <label style={labelStyle}>{isAr ? 'صورة المركبة' : 'Vehicle Image'}</label>
          {/* One field-shaped dropzone: the whole thing is the label, so a click
              anywhere opens the picker. Input stays hidden — its native button
              can't be themed. */}
          <label style={{
            display: 'flex', alignItems: 'center', gap: 12,
            width: '100%', boxSizing: 'border-box', padding: 10,
            background: 'var(--surface-soft-3)', borderRadius: 10,
            border: `1px ${form.vehicleImage ? 'solid' : 'dashed'} var(--glass-border)`,
            cursor: uploading ? 'default' : 'pointer', opacity: uploading ? 0.6 : 1,
          }}>
            <div style={{
              width: 76, height: 52, borderRadius: 8, flexShrink: 0, overflow: 'hidden',
              background: 'var(--surface-soft-2)', display: 'grid', placeItems: 'center',
            }}>
              {form.vehicleImage
                ? <img src={form.vehicleImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <Icon name="car" size={20} style={{ color: 'var(--ink-faint)' }} />}
            </div>

            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 12.5, color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Icon name="upload" size={13} style={{ color: 'var(--ink-mute)' }} />
                {uploading
                  ? (isAr ? 'جارٍ الرفع…' : 'Uploading…')
                  : form.vehicleImage
                    ? (isAr ? 'انقر لتغيير الصورة' : 'Click to change image')
                    : (isAr ? 'انقر لرفع صورة المركبة' : 'Click to upload vehicle image')}
              </div>
              <div style={hintStyle}>{isAr ? 'اختياري — PNG أو JPG' : 'Optional — PNG or JPG'}</div>
            </div>

            {form.vehicleImage && !uploading && (
              <button
                type="button" className="icon-btn" title={isAr ? 'إزالة' : 'Remove'}
                // Inside a label, so stop the click from re-opening the picker.
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setF('vehicleImage', ''); }}
              >
                <Icon name="trash" size={13} />
              </button>
            )}

            <input type="file" accept="image/*" disabled={uploading} style={{ display: 'none' }}
              onChange={(e) => { handleImage(e.target.files?.[0]); e.target.value = ''; }} />
          </label>
        </div>
      </Modal>
    </div>
  );
}
