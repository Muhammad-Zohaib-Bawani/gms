import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Icon } from '../components/Icons';
import Modal from '../components/ui/Modal';
import DataTable from '../components/ui/DataTable';
import ActionMenu from '../components/ui/ActionMenu';
import LocationPickerModal from '../components/ui/LocationPickerModal';
import ImageField from '../components/ui/ImageField';
import { useAuth } from '../auth/AuthContext';
import toast from '../lib/toast';
import { getVenues, updateVenue, getVenueTypes } from '../api/services/venueService';

const inputStyle = {
  width: '100%', background: 'var(--surface-soft-3)', border: '1px solid var(--glass-border)',
  borderRadius: 8, padding: '9px 12px', color: 'var(--ink)', fontSize: 13, boxSizing: 'border-box',
};
const errorStyle = { ...inputStyle, border: '1px solid #e05050' };
const labelStyle = {
  display: 'block', fontSize: 10.5, color: 'var(--ink-mute)', textTransform: 'uppercase',
  letterSpacing: '0.12em', marginBottom: 5,
};

const EMPTY_FORM = { name: '', location: null, imageUrl: '' };

// Admin management table for venues — name/location/image only. Creating a
// venue and editing its floor plan still happens in the seating editor
// (VenueConfigView / AddVenueModal); this page is for fixing up the venue's
// own record afterward.
export default function VenuesView({ lang }) {
  const isAr = lang === 'ar';
  const { can } = useAuth();
  const canManage = can('Venue.Manage');

  const [rows, setRows] = useState([]);
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // the row being edited, or null
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setRows((await getVenues()) || []); }
    catch { setRows([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { getVenueTypes().then(r => setTypes(r || [])).catch(() => setTypes([])); }, []);

  const typeNameById = useMemo(() => {
    const m = new Map();
    types.forEach(t => m.set(t.id, isAr ? (t.nameAr || t.name) : t.name));
    return m;
  }, [types, isAr]);

  const setF = (k, v) => {
    setForm((p) => ({ ...p, [k]: v }));
    if (errors[k]) setErrors((p) => ({ ...p, [k]: null }));
  };

  function openEdit(row) {
    setEditing(row);
    setForm({
      name: row.venueName || '',
      location: row.location
        ? {
            id: row.location.id, address: row.location.address, type: row.location.type,
            latitude: row.location.latitude, longitude: row.location.longitude,
            label: row.location.address || `${Number(row.location.latitude).toFixed(5)}, ${Number(row.location.longitude).toFixed(5)}`,
          }
        : null,
      imageUrl: row.imageUrl || '',
    });
    setErrors({});
  }

  async function handleSave() {
    if (!form.name.trim()) { setErrors({ name: isAr ? 'الاسم مطلوب' : 'Name is required' }); return; }

    setSaving(true);
    try {
      await updateVenue(editing.id, {
        venueName: form.name.trim(),
        locationId: form.location?.id || null,
        imageUrl: form.imageUrl || null,
      });
      toast.success(isAr ? 'تم تحديث المكان' : 'Venue updated');
      setEditing(null);
      load();
    } catch (err) {
      toast.fromError(err, isAr ? 'تعذّر حفظ المكان' : 'Could not save the venue');
    } finally {
      setSaving(false);
    }
  }

  const columns = useMemo(() => {
    const cols = [
      { id: 'image', header: '', size: 56, enableSorting: false, enableGlobalFilter: false,
        cell: ({ row: { original: r } }) => (
          <div style={{ width: 40, height: 30, borderRadius: 6, overflow: 'hidden', background: 'var(--surface-soft-3)', border: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {r.imageUrl
              ? <img src={r.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { e.target.style.display = 'none'; }}/>
              : <Icon name="venue" size={14} style={{ color: 'var(--ink-faint)' }}/>}
          </div>
        ) },
      { id: 'name', header: isAr ? 'الاسم' : 'Name', accessorKey: 'venueName',
        cell: ({ getValue }) => <span style={{ fontSize: 13, fontWeight: 500 }}>{getValue() || '—'}</span> },
      { id: 'type', header: isAr ? 'النوع' : 'Type', enableSorting: false,
        cell: ({ row: { original: r } }) => <span style={{ fontSize: 13 }}>{typeNameById.get(r.venueType) || '—'}</span> },
      { id: 'location', header: isAr ? 'الموقع' : 'Location', enableSorting: false,
        cell: ({ row: { original: r } }) => (
          <span style={{ fontSize: 13 }}>{r.location?.address || '—'}</span>
        ) },
    ];
    if (canManage) {
      cols.push({
        id: 'actions', header: '', size: 50, enableSorting: false, enableGlobalFilter: false,
        cell: ({ row: { original: r } }) => (
          <ActionMenu items={[
            { label: isAr ? 'تعديل' : 'Edit', icon: 'edit', onClick: () => openEdit(r) },
          ]} />
        ),
      });
    }
    return cols;
  }, [isAr, canManage, typeNameById]);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{isAr ? 'الأماكن' : 'Venues'}</h1>
          <div className="page-sub">
            {rows.length} {isAr ? 'مكان' : `venue${rows.length !== 1 ? 's' : ''}`}
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <DataTable
          columns={columns}
          data={rows}
          loading={loading}
          showSearch
          pageSize={10}
          getRowId={(r) => r.id}
          searchPlaceholder={isAr ? 'بحث…' : 'Search venues…'}
          emptyText={isAr ? 'لا توجد أماكن بعد' : 'No venues yet'}
        />
      </div>

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={isAr ? 'تعديل المكان' : 'Edit Venue'}
        width={460}
        footer={
          <>
            <button className="btn" onClick={() => setEditing(null)} disabled={saving}>
              {isAr ? 'إلغاء' : 'Cancel'}
            </button>
            <button className="btn primary" onClick={handleSave} disabled={saving}>
              <Icon name="check" size={13} /> {saving ? (isAr ? 'جارٍ الحفظ…' : 'Saving…') : (isAr ? 'حفظ' : 'Save')}
            </button>
          </>
        }
      >
        <div>
          <label style={labelStyle}>{isAr ? 'صورة المكان (اختياري)' : 'Venue image (optional)'}</label>
          <ImageField value={form.imageUrl} onChange={v => setF('imageUrl', v)} isAr={isAr}/>
        </div>
        <div>
          <label style={labelStyle}>{isAr ? 'اسم المكان' : 'Venue Name'} *</label>
          <input style={errors.name ? errorStyle : inputStyle} value={form.name}
            onChange={(e) => setF('name', e.target.value)} />
          {errors.name && <div style={{ fontSize: 11, color: '#e05050', marginTop: 4 }}>{errors.name}</div>}
        </div>

        <div>
          <label style={labelStyle}>{isAr ? 'الموقع (اختياري)' : 'Location (optional)'}</label>
          {form.location ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button type="button" className="btn" style={{ flex: 1, justifyContent: 'flex-start', fontSize: 12 }} onClick={() => setShowPicker(true)}>
                <Icon name="venue" size={13}/> {form.location.label}
              </button>
              <button type="button" className="btn" style={{ color: '#e05050', borderColor: 'rgba(224,80,80,0.4)', padding: '6px' }}
                onClick={() => setF('location', null)}>
                <Icon name="close" size={13}/>
              </button>
            </div>
          ) : (
            <button type="button" className="btn" style={{ width: '100%', justifyContent: 'center', fontSize: 12 }} onClick={() => setShowPicker(true)}>
              <Icon name="venue" size={13}/> {isAr ? 'اختر موقعاً على الخريطة' : 'Pick a location on the map'}
            </button>
          )}
        </div>

        
      </Modal>

      <LocationPickerModal
        open={showPicker}
        lang={lang}
        location={form.location}
        onClose={() => setShowPicker(false)}
        onSelect={(loc) => { setF('location', loc); setShowPicker(false); }}
      />
    </div>
  );
}
