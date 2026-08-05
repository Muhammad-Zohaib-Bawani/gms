import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Icon } from '../components/Icons';
import Modal from '../components/ui/Modal';
import DataTable from '../components/ui/DataTable';
import ActionMenu from '../components/ui/ActionMenu';
import { useAuth } from '../auth/AuthContext';
import toast from '../lib/toast';
import {
  getFleetProviders, createFleetProvider, updateFleetProvider, deleteFleetProvider,
} from '../api/services/fleetProviderService';

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

const EMPTY_FORM = { name: '', contactPerson: '', phone: '', email: '', notes: '' };

// Fleet providers: the companies vehicles are sourced from, contracted per
// event — so the list follows the active event, like the service catalog does.
// Gated on the same Travel permissions as the vehicles screen.
export default function FleetProvidersView({ lang, activeEventId }) {
  const isAr = lang === 'ar';
  const { can } = useAuth();
  const canManage = can('Travel.Manage');

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);   // row being edited, or null for "add"
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const load = useCallback(async () => {
    if (!activeEventId) { setRows([]); setLoading(false); return; }
    setLoading(true);
    try { setRows((await getFleetProviders(activeEventId)) || []); }
    catch { setRows([]); }
    finally { setLoading(false); }
  }, [activeEventId]);

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
      contactPerson: row.contactPerson || '',
      phone: row.phone || '',
      email: row.email || '',
      notes: row.notes || '',
    });
    setErrors({});
    setShowForm(true);
  }

  async function handleSave() {
    const errs = {};
    if (!form.name.trim()) errs.name = isAr ? 'الاسم مطلوب' : 'Name is required';
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
      errs.email = isAr ? 'بريد إلكتروني غير صالح' : 'Enter a valid email';

    if (Object.keys(errs).length) { setErrors(errs); return; }

    const body = {
      name: form.name.trim(),
      contactPerson: form.contactPerson.trim() || null,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      notes: form.notes.trim() || null,
    };

    setSaving(true);
    try {
      if (editing) {
        await updateFleetProvider(activeEventId, editing.id, body);
        toast.success(isAr ? 'تم التحديث' : 'Provider updated');
      } else {
        await createFleetProvider(activeEventId, body);
        toast.success(isAr ? 'تمت الإضافة' : 'Provider added');
      }
      setShowForm(false);
      load();
    } catch (err) {
      toast.fromError(err, isAr ? 'تعذّر الحفظ' : 'Could not save the provider');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(row) {
    setDeletingId(row.id);
    try {
      await deleteFleetProvider(activeEventId, row.id);
      toast.success(isAr ? 'تم الحذف' : 'Provider deleted');
      load();
    } catch (err) {
      toast.fromError(err, isAr ? 'تعذّر الحذف' : 'Could not delete the provider');
    } finally {
      setDeletingId(null);
    }
  }

  const columns = useMemo(() => {
    const text = ({ getValue }) => <span style={{ fontSize: 13 }}>{getValue() || '—'}</span>;
    const cols = [
      { id: 'name', header: isAr ? 'المزوّد' : 'Provider', accessorKey: 'name',
        cell: ({ getValue }) => <span style={{ fontSize: 13, fontWeight: 600 }}>{getValue() || '—'}</span> },
      { id: 'contactPerson', header: isAr ? 'جهة الاتصال' : 'Contact', accessorKey: 'contactPerson', cell: text },
      { id: 'phone', header: isAr ? 'الهاتف' : 'Phone', accessorKey: 'phone',
        cell: ({ getValue }) => <span style={{ fontSize: 13, fontFamily: 'var(--mono)' }}>{getValue() || '—'}</span> },
      { id: 'email', header: isAr ? 'البريد الإلكتروني' : 'Email', accessorKey: 'email', cell: text },
      { id: 'vehicleCount', header: isAr ? 'المركبات' : 'Vehicles', accessorKey: 'vehicleCount', size: 90,
        cell: ({ getValue }) => <span style={{ fontSize: 13 }}>{getValue() ?? 0}</span> },
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
          <h1 className="page-title">{isAr ? 'مزوّدو الأسطول' : 'Fleet Providers'}</h1>
          <div className="page-sub">
            {isAr ? 'الشركات التي توفّر مركبات النقل' : 'Companies that supply transport vehicles'}
          </div>
        </div>
        {canManage && activeEventId && (
          <div className="page-actions">
            <button className="btn primary" onClick={openAdd}>
              <Icon name="plus" size={14} /> {isAr ? 'إضافة مزوّد' : 'Add Provider'}
            </button>
          </div>
        )}
      </div>

      {!activeEventId ? (
        <div style={{
          padding: '10px 16px', borderRadius: 10, fontSize: 13, color: '#e0c47e',
          background: 'rgba(224,196,126,0.1)', border: '1px solid rgba(224,196,126,0.3)',
        }}>
          <Icon name="alert" size={14} />{' '}
          {isAr ? 'اختر فعالية أولاً' : 'Select an event first'}
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <DataTable
            columns={columns}
            data={rows}
            loading={loading}
            showSearch
            pageSize={10}
            searchPlaceholder={isAr ? 'بحث…' : 'Search providers…'}
            emptyText={isAr ? 'لا يوجد مزوّدون بعد' : 'No fleet providers yet'}
          />
        </div>
      )}

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editing ? (isAr ? 'تعديل المزوّد' : 'Edit Provider') : (isAr ? 'إضافة مزوّد' : 'Add Provider')}
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
          <label style={labelStyle}>{isAr ? 'اسم المزوّد' : 'Provider Name'} *</label>
          <input style={errors.name ? errorStyle : inputStyle} value={form.name}
            onChange={(e) => setF('name', e.target.value)} />
          {errors.name && <div style={{ ...hintStyle, color: '#e05050' }}>{errors.name}</div>}
        </div>

        <div>
          <label style={labelStyle}>{isAr ? 'جهة الاتصال' : 'Contact Person'}</label>
          <input style={inputStyle} value={form.contactPerson}
            onChange={(e) => setF('contactPerson', e.target.value)} />
        </div>

        <div>
          <label style={labelStyle}>{isAr ? 'الهاتف' : 'Phone'}</label>
          <input style={inputStyle} value={form.phone}
            onChange={(e) => setF('phone', e.target.value)} />
        </div>

        <div>
          <label style={labelStyle}>{isAr ? 'البريد الإلكتروني' : 'Email'}</label>
          <input type="email" style={errors.email ? errorStyle : inputStyle} value={form.email}
            onChange={(e) => setF('email', e.target.value)} />
          {errors.email && <div style={{ ...hintStyle, color: '#e05050' }}>{errors.email}</div>}
        </div>

        <div>
          <label style={labelStyle}>{isAr ? 'ملاحظات' : 'Notes'}</label>
          <textarea rows={3} style={{ ...inputStyle, resize: 'vertical' }} value={form.notes}
            onChange={(e) => setF('notes', e.target.value)} />
          <div style={hintStyle}>{isAr ? 'اختياري' : 'Optional'}</div>
        </div>
      </Modal>
    </div>
  );
}
